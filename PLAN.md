# Template Search — Implementation Plan

How we will build what [REQUIREMENTS.md](REQUIREMENTS.md) describes. Review this before coding starts.

---

## 1. Overview

```
images (legacy, read-only)
   │  1. sync script: copy active templates, extract card text
   ▼
template_search (new table) ◄── 2. enrichment: rules now, AI + embeddings later
   │
   │  3. search engine: parse query → filter → match → rank → facets
   ▼
/search page ──► 4. search log + click events ──► 5. failed-query report (/search/insights)
```

Ground rules:
- **`images` is never modified.** All new data lives in new tables.
- **No AI calls until you approve.** The AI code is written and switched off until an OpenAI key is added and you say go.
- **Search works without AI.** A rule-based version runs first and AI improves it later.

---

## 2. Before writing code

- Read the Next.js 16 docs in `node_modules/next/dist/docs/` for route handlers, `searchParams`, Cache Components, Server Actions and `next/image` remote images. This project has Cache Components turned on, so the search page must be handled as dynamic.
- Load the `mastra`, `shadcn` and `next-dev-loop` skills.
- Follow the matching `.ai/rules` files:
  - Use the shared pool from `src/lib/db.ts`
  - Mastra tools, workflows and agents use Zod schemas and kebab-case ids
  - Route handlers return `NextResponse.json`
  - Never edit the shadcn files in `src/components/ui`

---

## 3. Database

SQL migration files in `db/migrations`, run by `npm run db:migrate`.
- `001_template_search.sql` turns on `pg_trgm` and `unaccent` and creates the tables below.
- `002_template_embeddings.sql.pending` adds pgvector and the `embedding` columns. It is held back because installing pgvector needs a database superuser: run `create extension vector;` as an admin, rename the file to `.sql`, and migrate again.

### 3.1 `template_search`: one row per searchable template

| Column | Purpose |
| --- | --- |
| `template_id` (PK) | Points to `images.id` |
| `name`, `tags`, `card_text` | Text that gets searched |
| `preview_url` | `CDN_URL` + `images.image` |
| `is_free` | True when `is_free = 1` or `is_ios_free = 1` |
| `is_portrait`, `created_at`, `is_featured` | Used by filters and ranking |
| `occasion`, `occasion_confidence` | Category, for example `wedding_anniversary` |
| `milestone`, `format`, `doc_type`, `audience` | For example `5`, `dinner`, `invitation`, `couple` |
| `themes`, `styles`, `colors` (text arrays) | For example `butterfly`, `elegant`, `gold` |
| `quality_score` | 0 to 1. AI rating later; `is_featured` until then |
| `summary` | Short clean description; this is what gets embedded |
| `search_vector` | Weighted full-text index: name A, occasion and themes B, card text C, tags D |
| `embedding vector(1536)` | Empty until AI runs |
| `enrich_source` | `rules` or `ai` |
| `source_hash`, `enriched_at` | Detect changed templates so only those are redone |

Indexes:
- GIN on `search_vector`
- GIN on `themes`
- Trigram on `name`, so typos still match
- B-tree on `occasion`, `is_free` and `created_at`
- HNSW on `embedding`, added once embeddings exist

### 3.2 Other tables

| Table | Purpose |
| --- | --- |
| `search_query_cache` | Normalized query → parsed intent (JSON) and whether rules or AI produced it |
| `search_log` | One row per search: session, query, intent, filters, result count, top score, time |
| `search_event` | User actions on results: `click`, `open`, `bounce` (with result position and time) |
| `failed_query_report` | Daily summary: query, volume, failure rate, reasons, gap type |

---

## 4. Sync templates (`scripts/sync-templates.ts`)

1. Read rows where `content_type = 1` and `is_active = 1` (about 11.2k).
2. Pull the printed text out of `json_data`. It's double-escaped JSON. Collect every `text_json[].text` across all pages and strip placeholders such as addresses where possible.
3. Upsert into `template_search` and remove templates that are no longer active.
4. Recompute `source_hash` so enrichment knows which templates changed.

The script can be rerun safely at any time. 190 templates have no name; card text and, later, AI will fill that gap.

---

## 5. Taxonomy and rule-based enrichment (no AI)

**`src/lib/search/taxonomy.ts`** is the single list of allowed values used by everything else:
- **Occasions** (about 40 to 60), each with synonyms, for example `wedding_anniversary`: "wedding anniversary", "marriage anniversary", "vow renewal"
- **Words that rule an occasion out**, for example "company", "business", "corporate", "years of service" mean `company_anniversary`
- **Formats:** dinner, brunch, lunch, party, ceremony, shower…
- **Themes, styles, colors**, document types and audiences

**`src/lib/search/rule-enrich.ts`** tags each template using the name and card text against the taxonomy. Card text decides ties, which is how "Company's 5 Year Anniversary" becomes `company_anniversary`. This is a first version with lower confidence, and AI overwrites it later.

---

## 6. Query understanding

**`src/lib/search/parse-query.ts`**, rule-based and free:
- Normalize the query: lowercase, remove accents and filler words ("template", "card", "invitation"), handle plurals.
- Read ordinals: "5th", "fifth" and "5 year" all become milestone 5.
- Match the taxonomy, and look for multi-word phrases before single words.
- Output: `{ occasion, occasionConfidence, milestone, format, themes, docType, keywords }`.

**AI fallback (written now, switched off):** used when the rule parser can't pick a clear occasion or leaves unknown words.
- A Mastra agent, `query-parser-agent`, returns the same shape using a Zod structured output.
- Every result is stored in `search_query_cache`, so each distinct query costs AI only once.

---

## 7. Search engine (`src/lib/search/search-templates.ts`)

One function, `searchTemplates({ query, filters, page })`:

1. **Parse** the query (cache first, then rules, then AI if enabled).
2. **Strict filters:**
   - The detected occasion (only when confidence is high)
   - The user's chosen filters
   - "Dinner" with no occasion only filters on format
3. **Match:**
   - Full-text search with `websearch_to_tsquery`, ranked with field weights
   - Once embeddings exist, also the 200 nearest templates by meaning
   - Both lists merged with Reciprocal Rank Fusion
4. **Cut off** results below a minimum relevance score.
5. **Rank:** `score = 0.75 × relevance + 0.15 × freshness + 0.10 × quality`
   - Freshness fades with age: a template about 18 months old gets half the boost.
   - An exact milestone match (a "5th" template for "5th anniversary") gets a bonus.
   - The weights are constants in one file, so they're easy to tune.
6. **Facets:** counts by occasion, theme, free/premium, color, orientation and type, from the same filtered set.
7. **Quick tags:** when no occasion was detected, show the occasions with results, labeled with the format ("Birthday Dinner · 11"). Zero-count tags are never shown.
8. Return 24 results per page with facets, quick tags, the parsed intent and a `searchId` for logging.

---

## 8. Search page (`/search`)

- **The URL holds all state** (`/search?q=dinner&occasion=birthday&free=1`), so every search can be shared and reloaded.
- **The page is a Server Component** that calls `searchTemplates` directly. Results are wrapped in Suspense because search is dynamic.
- **Client components:**
  - Search box
  - Quick-tag chips
  - Filter sidebar (a drawer on mobile)
  - Results grid
  - A preview dialog with the template image and details
- **Images** come from the CDN through `next/image`, with `images.remotePatterns` added to `next.config.ts`.
- **UI parts:** the existing shadcn components (input, badge, select, switch, dialog). Checkbox and sheet get added with `npx shadcn@latest add`.
- **A debug toggle** shows each result's score breakdown and the parsed intent, to help tune ranking.

---

## 9. Failed-query detection

**Logging:**
- The server writes a `search_log` row for every search.
- The page sends clicks, opens and quick bounces (closing a preview in under 5 seconds) to `POST /api/search/events`.
- An anonymous session id cookie links searches together.

**A search fails if:**
- It returns zero results
- Its top score is below the cut-off
- The user clicks nothing
- The user searches again in the same session within 60 seconds
- The user bounces quickly

There's no editor in this project, so "opened but didn't edit" is approximated by a quick bounce.

**Daily report (`scripts/report-failed-queries.ts`):**
1. Group by normalized query.
2. Compute volume, failure rate and the main reasons.
3. Rank by volume × failure rate.
4. Label each query:
   - **Content gap:** the intent was understood but few or no templates matched. The design team should create these.
   - **Search gap:** the parser didn't understand the query. A synonym or rule needs adding.

**`/search/insights`** shows this report as a table.

---

## 10. AI enrichment (written now, run only after your approval)

**What it is:**
- A Mastra workflow, `template-enrichment-workflow`, with a `template-enricher-agent`.
- **Input:** name, tags, card text and the cover image.
- **Output:** a Zod schema of occasion, milestone, format, themes, styles, colors, doc type, audience, quality score and summary. Values must come from the taxonomy.
- After that, an embedding of the `summary` is stored in `embedding`.

**Running it safely:**
- Batches with limited concurrency.
- Resumable, and skips templates whose `source_hash` hasn't changed.
- `--dry-run` runs on a few templates so we can check quality first.
- It prints a cost estimate before any full run.

**Turning it on:** AI stays off unless `OPENAI_API_KEY` is set and `SEARCH_AI_ENABLED=true`. Both names go in `.env.example`, together with `CDN_URL`.

---

## 11. File layout

```
db/migrations/001_template_search.sql
scripts/migrate.ts
scripts/sync-templates.ts
scripts/enrich-templates.ts          (AI, run with approval)
scripts/report-failed-queries.ts
scripts/eval-search.ts
src/lib/search/taxonomy.ts
src/lib/search/card-text.ts
src/lib/search/rule-enrich.ts
src/lib/search/parse-query.ts
src/lib/search/search-templates.ts
src/lib/search/ranking.ts            (weights and scoring)
src/lib/search/types.ts
src/mastra/agents/template-enricher-agent.ts
src/mastra/agents/query-parser-agent.ts
src/mastra/workflows/template-enrichment-workflow.ts
src/app/search/page.tsx (+ components)
src/app/search/insights/page.tsx
src/app/api/search/events/route.ts
```

---

## 12. Order of work

| Step | What | Uses AI? |
| --- | --- | --- |
| 1 | Migration, sync script, card-text extraction | No |
| 2 | Taxonomy and rule enrichment | No |
| 3 | Query parser and search engine | No |
| 4 | `/search` page with filters and quick tags | No |
| 5 | Logging, events, failed-query report, insights page | No |
| 6 | Evaluation script and tuning | No |
| 7 | AI enrichment, embeddings and query fallback (code only) | Written, not run |
| 8 | Dry run on about 20 templates, then a full run | **Yes, after your OK** |

After each step:
- Run `npm run build` and check the result on the dev server.
- Use the `infer-conventions` skill to record new conventions in `.ai/rules`, for example for `src/lib/search`, `scripts` and `db`. The rule files are never edited by hand.

---

## 13. How we check quality

**`scripts/eval-search.ts`** runs a fixed set of test queries against the database and reports pass or fail:

| Query | Pass condition |
| --- | --- |
| `5th Wedding Anniversary` | No `company_anniversary` in the results; 5th-year templates in the top results |
| `Dinner Invitation` | At least 3 quick tags, all with results |
| `Butterfly birthday invitation` | No `baby_shower` in the results; all results have the butterfly theme |

More queries get added over time, including real failed queries from the report.

**Known limit before AI runs:** rule enrichment depends on wording in the names and card text. Some templates will have no occasion or the wrong one until the AI enrichment runs.

---

## 14. Points to confirm in review

1. **Ranking weights:** relevance 75%, freshness 15%, quality 10%, with freshness halving at about 18 months. OK to start with these?
2. **Tests:** use the evaluation script only, or also add Vitest for parser unit tests? Vitest would be a new dev dependency.
3. **Page size:** 24 results per page?
