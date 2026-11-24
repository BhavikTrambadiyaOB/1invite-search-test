/**
 * Gender-only AI check of birthday templates tagged neutral (costs money; run only after approval).
 *
 * The full AI tagging decides gender together with everything else and keeps many clearly girly or boyish
 * birthday cards "neutral" (tester feedback: "Sixteen Shades of Pink" for "16th boy birthday"). This asks the
 * model one question per card, from its cover image and printed text: would it fit a girl's, a boy's, or
 * anyone's party as it is? Nothing else about the template changes.
 *
 *   npm run search:check-gender -- --dry-run                   20 sample cards (girly, boyish, other), save nothing
 *   npm run search:check-gender -- --dry-run --skip 1,2 --include 3   leave out checked cards, recheck others
 *   npm run search:check-gender -- --dry-run --ids 70519,52807 only these templates
 *   npm run search:check-gender -- --estimate                  how many cards a full run covers, and the cost
 *   npm run search:check-gender -- --review --sample 50        25 girly-looking + 25 boyish-looking cards; answers are
 *                                                              stored in template_gender_review, not in the templates
 *   npm run search:check-gender -- --review                    every neutral birthday card not checked yet (resumable)
 *
 * Needs OPENAI_API_KEY and SEARCH_AI_ENABLED=true.
 */
import { Agent } from '@mastra/core/agent'
import { z } from 'zod'
import { db } from '@/lib/db'
import { AI_MODELS, ENRICH_IMAGE_OPTIONS, ENRICH_PROVIDER_OPTIONS, isAiEnabled, MODEL_PRICES } from '@/lib/search/ai-config'

/** Birthday occasions whose neutral cards are checked. */
const OCCASIONS = ['birthday', 'kids_birthday', 'first_birthday', 'sweet_16', 'quinceanera', 'debut', 'surprise_party']
/** Signs that a neutral card may lean girl, used only to pick the dry-run sample. */
const GIRLY_SIGNS = `(colors[1] = 'pink' or assets && array['bow','dress','tiara','high_heel','lipstick','purse','ballerina','unicorn']
  or themes && array['princess','fairy_magic','ballet'])`
/** Signs that a neutral card may lean boy, used only to pick the dry-run sample. */
const BOYISH_SIGNS = `(colors[1] in ('blue', 'navy') or assets && array['truck','car','dinosaur','soccer_ball','basketball','football','bow_tie','controller','rocket']
  or themes && array['vehicles','dinosaurs','sports','superhero','gaming','construction','space'])`
/** A card changes only when the model is at least this sure; below it the card stays neutral. */
const MIN_CONFIDENCE = 0.85
/** Measured on the enricher (2026-10-28): card text + cover image ~1,300 tokens; this prompt adds ~400. */
const TOKENS_PER_CARD = { input: 1700, output: 120 }

/** Sample names the catalog prints on most birthday cards; hidden from the printed text so they cannot decide. */
const SAMPLE_NAMES = /\b(Arieta|Sophia|Sue Vaneer|Sue|Richard|Joseph|John)\b/g

const answerSchema = z.object({
  gender: z.enum(['girl', 'boy', 'neutral']),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
})

const genderAgent = new Agent({
  id: 'template-gender-checker',
  name: 'Template Gender Checker',
  instructions: `You decide who a birthday card design is made for: a girl, a boy, or anyone.

You get the template name, the text printed on it and the cover image. Judge the design as it is, the way a parent
or friend choosing a card would.

Ask two questions:
1. Would a typical person planning a girl's (or woman's) party pick this design as it is?
2. Would a typical person planning a boy's (or man's) party pick this design as it is?

- girl: it suits a girl's party but most people would not pick it for a boy's: a pink, lilac or pastel look with
  feminine details (bows, flowers, tiara, dress, high heels, lipstick, butterflies), a girl or woman figure,
  princess, ballerina, unicorn, or words such as "her", "she", "princess", "queen", "girls".
- boy: the same for boys: a bold or blue look with boyish details (trucks, dinosaurs, sports, superheroes, bow ties,
  gaming), a boy or man figure, or words such as "his", "he", "prince", "king", "boys".
- neutral: it suits both: balloons, cake, confetti, stars, plain elegant type, mixed colors, animals for any child.
- Color alone decides only when it is the whole look: an all-pink card with hearts and bows is girl; a pink accent on
  a neutral design is neutral.
- A card for two or more people (father and daughter, twins, siblings, a joint party, a boy and a girl) is
  neutral, whoever is shown.
- A single bow, flower or heart in a brown, beige, black or gold design is not enough on its own: elegant designs
  like that suit men and women. They need a feminine look as a whole to be girl.
- Names printed on the card are sample text the user replaces. The catalog reuses the same few sample names on
  every card: Arieta, Sophia, Sue, Richard, Joseph, John. A girl's name on a card is not a sign it is for a girl,
  and a boy's name is not a sign it is for a boy. Decide as if the name were blank.
- The color or script style of the name lettering (a pink "Sophia's") does not count; only the design around it.
- A title or pop-culture line ("The Summer I Turned 15") does not decide it either; look at the design.
- A photo on the card is a sample: do not decide from the person in it.
- When unsure, answer neutral with low confidence.

confidence: 0.9+ when obvious, 0.7 when likely, lower when unsure. reason: a few plain words on what decided it.`,
  model: AI_MODELS.enrich,
})

type Card = { template_id: number; name: string; card_text: string | null; preview_url: string; occasion: string; colors: string[] }

function arg(name: string) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function pickCards(): Promise<Card[]> {
  const columns = 'template_id, name, card_text, preview_url, occasion, colors'
  const ids = arg('--ids')
  if (ids) {
    const { rows } = await db.query<Card>(`select ${columns} from template_search where template_id = any($1::int[])`, [
      ids.split(',').map(Number),
    ])
    return rows
  }
  // A mixed sample: cards that look girly, cards that look boyish, and others. --skip leaves out cards already
  // checked; --include adds cards to check again.
  const limit = Number(arg('--limit') ?? 20)
  const third = Math.ceil(limit / 3)
  const skip = (arg('--skip') ?? '').split(',').filter(Boolean).map(Number)
  const include = (arg('--include') ?? '').split(',').filter(Boolean).map(Number)
  const pool = `occasion = any($1) and coalesce(gender, 'neutral') = 'neutral' and not template_id = any($2::int[])`
  const { rows } = await db.query<Card>(
    `(select ${columns} from template_search where template_id = any($3::int[]))
     union all (select ${columns} from template_search where ${pool} and ${GIRLY_SIGNS} order by template_id desc limit $4)
     union all (select ${columns} from template_search where ${pool} and ${BOYISH_SIGNS} and not ${GIRLY_SIGNS} order by template_id desc limit $4)
     union all (select ${columns} from template_search where ${pool} and not ${GIRLY_SIGNS} and not ${BOYISH_SIGNS}
                order by template_id desc limit $5)`,
    [OCCASIONS, [...skip, ...include], include, third, limit - 2 * third],
  )
  return rows
}

/** Asks the model about one card; the sample names in its printed text are hidden first. */
async function ask(card: Card) {
  const response = await genderAgent.generate(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Template name: ${card.name}\nPrinted text: ${(card.card_text ?? '').replace(SAMPLE_NAMES, '[NAME]').slice(0, 800) || '(none)'}` },
          { type: 'image' as const, image: card.preview_url, mimeType: 'image/jpeg', providerOptions: ENRICH_IMAGE_OPTIONS },
        ],
      },
    ],
    { providerOptions: ENRICH_PROVIDER_OPTIONS, structuredOutput: { schema: answerSchema } },
  )
  return {
    answer: answerSchema.parse(response.object),
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  }
}

/** Runs `work` on every item, `parallel` at a time. */
async function inParallel<T>(items: T[], parallel: number, work: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item)
    }),
  )
}

function costOf(inputTokens: number, outputTokens: number) {
  const price = MODEL_PRICES[AI_MODELS.enrich]
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1e6 : null
}

type ReviewCard = Card & { gender: string | null }

/**
 * Cards for --review, never ones already in template_gender_review. --sample N: half that look girly, half that
 * look boyish (a test of both answers). Otherwise every neutral birthday card (or the first --limit).
 */
async function reviewCards(): Promise<ReviewCard[]> {
  const columns = 'template_id, name, card_text, preview_url, occasion, colors, gender'
  const pool = `occasion = any($1) and coalesce(gender, 'neutral') = 'neutral'
    and not exists (select 1 from template_gender_review r where r.template_id = t.template_id)`
  const sample = Number(arg('--sample') ?? 0)
  if (sample > 0) {
    const half = Math.ceil(sample / 2)
    const { rows } = await db.query<ReviewCard>(
      `(select ${columns} from template_search t where ${pool} and ${GIRLY_SIGNS} order by template_id desc limit $2)
       union all
       (select ${columns} from template_search t where ${pool} and ${BOYISH_SIGNS} and not ${GIRLY_SIGNS} order by template_id desc limit $3)`,
      [OCCASIONS, half, sample - half],
    )
    return rows
  }
  const { rows } = await db.query<ReviewCard>(
    `select ${columns} from template_search t where ${pool} order by template_id desc limit $2`,
    [OCCASIONS, Number(arg('--limit') ?? 0) || null],
  )
  return rows
}

/**
 * --review: asks about each card and stores the answer in template_gender_review right away, so a stopped run
 * continues where it left off. template_search is not changed: answers are applied only after review.
 */
async function review() {
  const parallel = Math.min(20, Math.max(1, Number(arg('--parallel') ?? 8) || 8))
  const cards = await reviewCards()
  console.log(`Checking ${cards.length} cards with ${AI_MODELS.enrich}, ${parallel} at a time; answers go to template_gender_review only`)
  let done = 0
  let failed = 0
  let inputTokens = 0
  let outputTokens = 0
  await inParallel(cards, parallel, async (card) => {
    try {
      const { answer, ...usage } = await ask(card)
      inputTokens += usage.inputTokens
      outputTokens += usage.outputTokens
      await db.query(
        `insert into template_gender_review
           (template_id, name, occasion, current_gender, ai_gender, confidence, reason, preview_url, model)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (template_id) do update set
           ai_gender = excluded.ai_gender, confidence = excluded.confidence, reason = excluded.reason,
           model = excluded.model, checked_at = now()
         where template_gender_review.status = 'pending'`,
        [card.template_id, card.name, card.occasion, card.gender, answer.gender, answer.confidence, answer.reason, card.preview_url, AI_MODELS.enrich],
      )
    } catch (error) {
      failed += 1
      console.error(`  ${card.template_id}: ${error instanceof Error ? error.message : error}`)
    }
    done += 1
    if (done % 50 === 0 || done === cards.length) console.log(`  ${done}/${cards.length} checked`)
  })
  const cost = costOf(inputTokens, outputTokens)
  console.log(`Failed: ${failed}. Tokens: ${inputTokens} in, ${outputTokens} out${cost === null ? '' : `, about $${cost.toFixed(3)}`}`)
}

async function main() {
  if (process.argv.includes('--estimate')) {
    const { rows } = await db.query<{ c: number }>(
      `select count(*)::int c from template_search where occasion = any($1) and coalesce(gender, 'neutral') = 'neutral'`,
      [OCCASIONS],
    )
    const cost = costOf(rows[0].c * TOKENS_PER_CARD.input, rows[0].c * TOKENS_PER_CARD.output)
    console.log(`${rows[0].c} neutral birthday cards; estimated cost ${cost === null ? 'unknown' : `$${cost.toFixed(2)}`} (${AI_MODELS.enrich})`)
    return
  }
  const dryRun = process.argv.includes('--dry-run')
  if (!dryRun && !process.argv.includes('--review')) {
    console.log('Use --dry-run (print only), --review (store answers in template_gender_review) or --estimate.')
    return
  }
  if (!isAiEnabled()) throw new Error('Set SEARCH_AI_ENABLED=true and OPENAI_API_KEY to run the check.')
  if (!dryRun) return review()

  const cards = await pickCards()
  console.log(`Checking ${cards.length} cards with ${AI_MODELS.enrich} (dry run, nothing saved)\n`)
  const answers: (Card & z.infer<typeof answerSchema>)[] = []
  let inputTokens = 0
  let outputTokens = 0
  await inParallel(cards, 8, async (card) => {
    const { answer, ...usage } = await ask(card)
    inputTokens += usage.inputTokens
    outputTokens += usage.outputTokens
    answers.push({ ...card, ...answer })
  })
  answers.sort((a, b) => a.gender.localeCompare(b.gender) || b.confidence - a.confidence)
  for (const a of answers) {
    const change = a.gender !== 'neutral' && a.confidence >= MIN_CONFIDENCE ? `CHANGE → ${a.gender}` : 'stays neutral'
    console.log(`${a.template_id} | ${change} | AI ${a.gender} (${a.confidence}) | ${a.occasion} | ${a.colors.slice(0, 2).join('+')} | ${a.name} | ${a.reason}`)
    console.log(`   ${a.preview_url}`)
  }
  const cost = costOf(inputTokens, outputTokens)
  console.log(`\nTokens: ${inputTokens} in, ${outputTokens} out${cost === null ? '' : `, about $${cost.toFixed(4)}`}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
