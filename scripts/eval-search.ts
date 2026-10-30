/**
 * Runs fixed test queries against the database and reports pass/fail.
 * Add real failed queries from /search/insights here over time.
 * Usage: npm run search:eval
 */
import { flushTracesAndClose } from './lib/close'
import { searchTemplates } from '@/lib/search/search-templates'
import { getVocabulary, occasionFamilyFrom } from '@/lib/search/vocabulary'
import type { SearchResponse } from '@/lib/search/types'

type Check = { label: string; pass: (r: SearchResponse) => boolean }
type Case = { query: string; checks: Check[] }

const TOP = 24

/** Occasion families from the live vocabulary, so occasions learned by AI (Pastor Anniversary) count too. */
let occasionFamily: (id: string) => string[] = (id) => [id]

const occasionsIn = (r: SearchResponse) => r.results.slice(0, TOP).map((x) => x.occasion)

// A template counts when its own occasion or one of its extra occasions is in the family.
const onlyOccasion = (family: string): Check => ({
  label: `top results are all ${family}`,
  pass: (r) =>
    r.results.length > 0 &&
    r.results.slice(0, TOP).every((x) => [x.occasion, ...x.extraOccasions].some((o) => !!o && occasionFamily(family).includes(o))),
})
const noOccasion = (id: string): Check => ({
  label: `no ${id} in results`,
  pass: (r) => !occasionsIn(r).some((o) => o && occasionFamily(id).includes(o)),
})
const atLeast = (n: number): Check => ({ label: `at least ${n} results`, pass: (r) => r.total >= n })
const quickTags = (n: number): Check => ({
  label: `at least ${n} quick tags, all with results`,
  pass: (r) => r.quickTags.length >= n && r.quickTags.every((t) => t.count > 0),
})
const noQuickTags: Check = { label: 'no quick tags (occasion is clear)', pass: (r) => r.quickTags.length === 0 }
const topMilestone = (m: number, within: number): Check => ({
  label: `a ${m}th-milestone template in the top ${within}`,
  pass: (r) => r.results.slice(0, within).some((x) => x.milestone === m),
})
const noOtherMilestone = (m: number): Check => ({
  label: `no template printed with a different milestone than ${m}`,
  pass: (r) => r.results.every((x) => x.milestone === null || x.milestone === m),
})
// A theme, a visible element (AI tagging lists butterflies as elements) or the word in the name.
const allTheme = (theme: string): Check => ({
  label: `every result has the ${theme} theme, element or word`,
  pass: (r) =>
    r.results.every((x) => x.themes.includes(theme) || x.assets.includes(theme) || x.name.toLowerCase().includes(theme)),
})
const zero: Check = { label: 'no results', pass: (r) => r.total === 0 }
const noGender = (g: string): Check => ({
  label: `no ${g}-only templates`,
  pass: (r) => r.results.every((x) => x.gender !== g),
})
const hasAsset = (asset: string, within: number): Check => ({
  label: `top ${within} all contain ${asset}`,
  pass: (r) => r.results.length > 0 && r.results.slice(0, within).every((x) => x.assets.includes(asset) || x.name.toLowerCase().includes(asset)),
})

const allPhoto: Check = { label: 'every result has a photo', pass: (r) => r.results.length > 0 && r.results.every((x) => x.hasPhoto) }
const allLanguage = (lang: string): Check => ({
  label: `every result is in ${lang}`,
  pass: (r) => r.results.length > 0 && r.results.every((x) => x.languages.includes(lang)),
})
// The top results fit a second occasion from the query too ("halloween" in "halloween wedding").
const topAlsoFit = (family: string, within: number): Check => ({
  label: `top ${within} also fit ${family}`,
  pass: (r) =>
    r.results.length >= within &&
    r.results.slice(0, within).every((x) => [x.occasion, ...x.extraOccasions].some((o) => !!o && occasionFamily(family).includes(o))),
})
// Exact event and number first, then the exact event, then its parent: for "5th Wedding Anniversary",
// 5th wedding anniversaries → wedding anniversaries → anniversaries. Never a sibling (Engagement Anniversary).
const tierOrder = (occasion: string, parent: string, milestone: number): Check => ({
  label: `${milestone}th ${occasion} first, then ${occasion}, then ${parent}`,
  pass: (r) => {
    const rank = (x: SearchResponse['results'][number]) =>
      (occasionFamily(occasion).includes(x.occasion ?? '') ? 4 : x.occasion === parent ? 2 : 0) + (x.milestone === milestone ? 1 : 0)
    const ranks = r.results.map(rank)
    return ranks[0] === 5 && ranks.every((v, i) => v > 0 && (i === 0 || v <= ranks[i - 1]))
  },
})
// A suggested tag must narrow: never the occasion the query already implies, nor another age.
const noTag = (group: string, value?: string): Check => ({
  label: value ? `no "${value}" tag` : `no ${group} tags`,
  pass: (r) => !r.suggestedTags.some((t) => t.group === group && (!value || t.value === value)),
})
// An unclear query first asks for the occasion: these occasion chips lead the tag row.
const occasionTagsFirst = (occasions: string[]): Check => ({
  label: `tag row starts with occasions incl. ${occasions.join(', ')}`,
  pass: (r) => {
    const lead = r.suggestedTags.slice(0, r.suggestedTags.findIndex((t) => t.group !== 'occasions'))
    return lead.length > 0 && occasions.every((o) => lead.some((t) => t.value === o))
  },
})

// With an occasion, card type, photo and language rank instead of filter: matching cards come first,
// then the rest of the occasion. Checks the first page holds every exact match before any other card.
const askedFirst = (label: string, has: (x: SearchResponse['results'][number]) => boolean): Check => ({
  label: `${label} first, then other cards`,
  pass: (r) => {
    const flags = r.results.map(has)
    const firstMiss = flags.indexOf(false)
    return flags[0] === true && (firstMiss === -1 || flags.slice(firstMiss).every((f) => !f))
  },
})
const allDocType = (docType: string): Check => ({
  label: `every result is a ${docType}`,
  pass: (r) => r.results.length > 0 && r.results.every((x) => x.docType === docType),
})

const CASES: Case[] = [
  // The three examples from the requirements.
  { query: '5th Wedding Anniversary', checks: [atLeast(5), onlyOccasion('wedding_anniversary'), noOccasion('company_anniversary'), topMilestone(5, 5), noOtherMilestone(5), noQuickTags] },
  { query: 'Dinner Invitation', checks: [atLeast(50), quickTags(4), occasionTagsFirst(['birthday', 'wedding', 'christmas'])] },
  { query: 'Butterfly birthday invitation', checks: [atLeast(5), onlyOccasion('birthday'), noOccasion('baby_shower'), allTheme('butterfly')] },
  // More cases.
  { query: 'company anniversary', checks: [atLeast(10), onlyOccasion('company_anniversary')] },
  { query: 'anniversary', checks: [atLeast(50), onlyOccasion('anniversary'), quickTags(2)] },
  { query: 'butterfly baby shower', checks: [atLeast(3), onlyOccasion('baby_shower')] },
  { query: 'first birthday', checks: [atLeast(20), onlyOccasion('first_birthday')] },
  { query: '50th birthday', checks: [atLeast(5), onlyOccasion('birthday'), noOtherMilestone(50)] },
  { query: 'christmas dinner', checks: [atLeast(3), onlyOccasion('christmas')] },
  { query: 'rehearsal dinner', checks: [atLeast(20), onlyOccasion('rehearsal_dinner')] },
  { query: 'gender reveal', checks: [atLeast(50), onlyOccasion('gender_reveal')] },
  { query: 'free baby shower', checks: [atLeast(3), onlyOccasion('baby_shower'), { label: 'all free', pass: (r) => r.results.every((x) => x.isFree) }] },
  { query: 'sushi', checks: [atLeast(1), allTheme('sushi')] },
  // Gender and assets.
  { query: 'my boy 1st birthday', checks: [atLeast(20), onlyOccasion('first_birthday'), noGender('girl')] },
  { query: '16 year girl birthday', checks: [atLeast(10), onlyOccasion('birthday'), noGender('boy'), noOtherMilestone(16)] },
  { query: 'baby boy shower', checks: [atLeast(10), onlyOccasion('baby_shower'), noGender('girl')] },
  { query: 'basketball birthday', checks: [atLeast(3), onlyOccasion('birthday'), hasAsset('basketball', 3)] },
  { query: 'sports birthday', checks: [atLeast(20), onlyOccasion('birthday')] },
  // Extra occasions, photos and languages.
  { query: 'kids birthday', checks: [atLeast(100), onlyOccasion('kids_birthday'), noTag('occasions', 'birthday')] },
  { query: 'photo birthday invitation', checks: [atLeast(10), onlyOccasion('birthday'), allPhoto] },
  { query: 'spanish birthday invitation', checks: [atLeast(3), onlyOccasion('birthday'), allLanguage('spanish')] },
  { query: 'halloween wedding', checks: [atLeast(10), onlyOccasion('wedding'), topAlsoFit('halloween', 10)] },
  { query: 'christmas gender reveal', checks: [atLeast(5), onlyOccasion('gender_reveal'), topAlsoFit('christmas', 5)] },
  { query: 'graduation thank you', checks: [atLeast(5), onlyOccasion('graduation'), topAlsoFit('thank_you', 5)] },
  { query: 'memorial day', checks: [atLeast(20), onlyOccasion('memorial_day')] },
  { query: 'griha pravesh', checks: [atLeast(15), onlyOccasion('housewarming')] },
  { query: '5th Wedding Anniversary', checks: [tierOrder('wedding_anniversary', 'anniversary', 5), noOccasion('engagement_anniversary'), atLeast(100), noTag('occasions', 'anniversary'), noTag('milestones')] },
  { query: '5th birthday', checks: [atLeast(100), topMilestone(5, 24), noTag('occasions', 'birthday'), noTag('occasions', 'quinceanera'), noTag('milestones')] },
  { query: 'kids birthday tags', checks: [] },

  { query: 'engagement anniversary', checks: [atLeast(3), { label: 'engagement anniversaries first', pass: (r) => r.results[0]?.occasion === 'engagement_anniversary' }] },
  { query: 'zxqv blorf', checks: [zero] },
  // Card type, photo and language rank when an occasion is named; "card" alone is not a greeting card.
  { query: 'eid wishes', checks: [atLeast(30), onlyOccasion('eid'), askedFirst('greetings', (x) => x.docType === 'greeting')] },
  { query: 'wedding card', checks: [atLeast(100), onlyOccasion('wedding')] },
  { query: 'christmas cards', checks: [atLeast(100), onlyOccasion('christmas'), askedFirst('greetings', (x) => x.docType === 'greeting')] },
  { query: 'thanksgiving card', checks: [atLeast(90), onlyOccasion('thanksgiving'), askedFirst('greetings', (x) => x.docType === 'greeting')] },
  { query: 'diwali card', checks: [atLeast(40), onlyOccasion('diwali'), askedFirst('greetings', (x) => x.docType === 'greeting')] },
  { query: 'spanish wedding invitation', checks: [atLeast(30), onlyOccasion('wedding'), askedFirst('spanish', (x) => x.languages.includes('spanish'))] },
  { query: 'graduation announcement with photo', checks: [atLeast(30), onlyOccasion('graduation')] },
  { query: 'greeting card', checks: [atLeast(100), allDocType('greeting')] },
  // Other scripts are read (AI + meaning), never shown as the whole catalog; a number after the event is the age.
  { query: 'عيد مبارك', checks: [atLeast(5), onlyOccasion('eid'), { label: 'not the whole catalog', pass: (r) => r.total < 2000 }] },
  { query: 'ঈদুল আজহা', checks: [atLeast(5), onlyOccasion('eid')] },
  { query: 'birthday 40', checks: [atLeast(20), onlyOccasion('birthday'), topMilestone(40, 5), noOtherMilestone(40)] },
  { query: 'birthday 6 june', checks: [atLeast(100), onlyOccasion('birthday')] },
  // A guessed occasion never hides a named theme; dates, chat prefixes and the query's own language are not required.
  { query: 'baby boss, party', checks: [atLeast(4), { label: 'every result is Boss Baby', pass: (r) => r.results.every((x) => x.themes.includes('boss_baby') || /boss baby/i.test(x.name)) }] },
  { query: 'birthday 10 juin', checks: [atLeast(100), onlyOccasion('birthday'), { label: 'date is not a required word', pass: (r) => r.exactTotal === r.total }] },
  { query: '[27/05, 1:14 pm] tassu _delighti: birthday invitation', checks: [atLeast(100), onlyOccasion('birthday')] },
  { query: 'invitación de hombre', checks: [atLeast(200), { label: 'not only Spanish cards', pass: (r) => r.intent.language === null }] },
  // Synonyms.
  { query: 'tabaski', checks: [atLeast(30), onlyOccasion('eid')] },
  { query: 'bakri', checks: [atLeast(30), onlyOccasion('eid')] },
  { query: 'srimant', checks: [atLeast(100), onlyOccasion('baby_shower')] },
  { query: 'pre-k graduation', checks: [atLeast(100), onlyOccasion('graduation')] },
  { query: 'maiyan', checks: [atLeast(10), onlyOccasion('haldi_mehendi')] },
  { query: 'folletos', checks: [atLeast(100), allDocType('announcement')] },
  // Thin occasions: the asked one first, then its parent and close designs fill the page.
  { query: 'umembeso', checks: [atLeast(24), { label: 'Umembeso first, then weddings', pass: (r) => r.results[0]?.occasion === 'umembeso' && r.exactTotal >= 1 }] },
  { query: 'tombstone unveiling', checks: [atLeast(24), { label: 'all 13 unveilings before the rest', pass: (r) => r.results.slice(0, 13).every((x) => x.occasion === 'tombstone_unveiling') }] },
  // Data fixes: tiny duplicate occasions merged, new languages tagged from the card's script.
  // Read as the lunch format across occasions (Christmas lunch, ladies luncheon…), not a 2-design occasion.
  { query: 'lunch party', checks: [atLeast(100), { label: 'top 10 are lunches', pass: (r) => r.results.slice(0, 10).every((x) => /lunch/i.test(x.name)) }] },
  { query: 'marathi wedding', checks: [atLeast(100), onlyOccasion('wedding'), askedFirst('marathi', (x) => x.languages.includes('marathi'))] },
  { query: 'tamil wedding', checks: [atLeast(100), onlyOccasion('wedding'), askedFirst('tamil', (x) => x.languages.includes('tamil'))] },
  { query: 'marathi baby shower', checks: [atLeast(100), onlyOccasion('baby_shower'), askedFirst('marathi', (x) => x.languages.includes('marathi'))] },
]

async function main() {
  const vocab = await getVocabulary()
  occasionFamily = (id) => occasionFamilyFrom(vocab, id)
  let failed = 0
  for (const c of CASES) {
    const r = await searchTemplates({ query: c.query })
    const results = c.checks.map((check) => ({ check, ok: check.pass(r) }))
    const ok = results.every((x) => x.ok)
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.query}  (${r.total} results)`)
    for (const x of results) if (!x.ok) console.log(`      ✗ ${x.check.label}`)
  }
  console.log(`\n${CASES.length - failed}/${CASES.length} passed`)
  if (failed) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => flushTracesAndClose())
