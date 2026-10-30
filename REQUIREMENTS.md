# Template Search — Requirements

The single reference for what we are building and why. Check here before planning or coding.

---

## 1. Problem

Users struggle to find the right template for their event and browse too much before finding it.
The current keyword search uses noisy tags, so unrelated templates show up and good ones get buried.

## 2. Goal

Return the **most contextually relevant templates in one search**, with:

- **No irrelevant results.** If only a few templates match, show only those.
- **Newer, better designs first** (the catalog spans 10 years).
- **Filters** like Greetings Island: Category, Theme, Free/Premium (plus Color, Orientation and Type).
- **Quick tags** that help users narrow down an ambiguous search.
- **Failed-query detection** so we know what users can't find.

## 3. Acceptance examples

| Query | Must show | Must NOT show |
| --- | --- | --- |
| `5th Wedding Anniversary` | Wedding anniversary templates, 5th-year matches ranked first | Company or business anniversaries, other anniversaries |
| `Dinner Invitation` | Dinner templates from all occasions, plus quick tags (Birthday Dinner, Rehearsal Dinner, Christmas Dinner, Thanksgiving, New Year, Corporate…) with counts | Quick tags that have zero results |
| `Butterfly birthday invitation` | Butterfly-themed birthday templates | Baby shower templates, even ones with butterflies |

General rule: **relevance first, then freshness and quality.** A fresh template that doesn't match the query never outranks one that does.

---

## 4. Data facts (from the Postgres audit, 2026-10-27)

- `images` has 26,769 rows. **Only `content_type = 1` (about 11.7k) are templates.** Types 4 and 5 (about 15k) look like covers and stickers and are excluded from search.
- `catalog_master` has only a sample row, so `catalog_id` has no category names. Categories come from AI instead (see Decisions).
- `search_category` tags are **unreliable** (e.g. "Celebration of Life" is tagged `anniversary`).
- **The text printed on the card (inside `json_data`) is the most reliable signal.** Example: "Elegant Golden Leaf 5 Year Anniversary" looks like a wedding anniversary by name, but the card says "Company's".
- `template_name` is filled for about 11.5k rows. `template_description` is empty for all rows.
- `is_free`, `is_featured` (127 templates), `is_portrait` and `created_at` are available. 63% of templates were created in 2025.
- **No usage data** (opens, edits, downloads) is in the database yet.
- Postgres has `vector` (pgvector), `pg_trgm`, `unaccent` and `fuzzystrmatch` available but not yet enabled.

---

## 5. Solution design

**Core idea:** use AI to understand each template **once, ahead of time**. At search time, only the user's query is interpreted, so search stays fast and cheap.

### 5.1 Template enrichment (one-time, then on every new upload)

Inputs: template name, tags, card text from `json_data` and the cover image.
Output: a new table `template_search`. The legacy `images` table is never modified.

| Field | Example |
| --- | --- |
| `occasion` (fixed list) | `wedding_anniversary`, `company_anniversary`, `birthday`, `baby_shower` |
| `milestone` | `5`, `50` |
| `format` | `dinner`, `brunch`, `party`, `ceremony` |
| `themes` | `butterfly`, `floral`, `gold` |
| `style`, `colors` | `elegant`, `rustic`; `black`, `gold` |
| `doc_type` | `invitation`, `save_the_date`, `greeting`, `announcement` |
| `audience` | `kids`, `adults`, `couple`, `corporate` |
| `quality_score` | AI design-quality rating |
| `card_text` | Plain text extracted from `json_data` |
| `search_vector` | Postgres full-text index |
| `embedding` | pgvector embedding of a clean summary (added once AI is enabled) |

### 5.2 Query understanding

Turn a query into a structured intent, for example `5th wedding anniversary` becomes `{occasion: wedding_anniversary, milestone: 5}`.

1. **Rule-based parser (free).** Synonyms, ordinals ("5th", "fifth", "5 year") and occasion keywords. This covers the common queries.
2. **AI fallback** for queries the rules can't parse. Each result is cached by normalized query, so a repeated search costs nothing.

### 5.3 Retrieval and ranking

1. **Strict filters.** A clearly detected occasion is a hard filter, so company anniversaries and baby showers are excluded. User-selected filters (category, theme, free/premium) are also strict.
2. **Hybrid matching.** Keyword matches (full-text) and meaning matches (embeddings) are merged into one relevance score.
3. **Relevance cut-off.** Weak matches are dropped. A short list is better than a wrong one.
4. **Final order:** relevance first, then freshness (a boost that fades as a template ages), then quality (`is_featured` and the AI quality score). Usage-based ranking is out of scope for now (see Decisions).

### 5.4 Quick tags (ambiguous queries)

When the occasion is unclear (e.g. "Dinner Invitation"), show all matching results plus tags built from those results, each with a count. Clicking a tag applies that occasion as a filter. A tag with zero results is never shown.

### 5.5 Filters

Category (occasion), Theme or Style, Free or Premium, Color, Orientation (portrait or landscape) and Type (invitation, save the date, greeting…). Each filter shows result counts.

### 5.6 Failed-query detection

Log every search with its query, parsed intent, filters, result count and top score, plus what the user did next (click, open, edit, leave).

A search **fails** if any of these happen:

| Signal | Meaning |
| --- | --- |
| Zero results | Nothing matched |
| Low relevance | The best match is below the cut-off |
| No click | The user saw results but opened nothing |
| Reformulation | The user typed a new query within about 60 seconds |
| Quick bounce | The user opened a template and left without editing it |

A daily job ranks query patterns by **volume × failure rate** and sorts them into two groups:

- **Content gaps:** the design team needs to create templates for these.
- **Search gaps:** a synonym or rule is missing from the parser.

---

## 6. Decisions

1. **Categories come from AI, not `catalog_id`.** The AI enrichment assigns each template its `occasion` (category). `catalog_id` is not used for categories.
2. **No usage data, and it's out of scope for now.** We don't have data on which templates are used or viewed most, so ranking by popularity isn't covered in this version. "Best design first" relies on relevance, freshness, `is_featured` and the AI quality score. Usage-based ranking can be added later if that data becomes available.
3. **Only `content_type = 1` is searchable** (about 11.7k templates). Types 4 and 5 (covers and stickers) are excluded.
4. **Search is a page in this project only.** No separate API for the existing web or mobile apps is needed for now.
5. **Inactive templates are excluded.** Search only shows templates with `is_active = 1`.
6. **A template is Free if `is_free = 1` or `is_ios_free = 1`.** All other templates are Premium. Both appear in search; the Free/Premium filter narrows them.
7. **AI enrichment reads the text and the cover image.** Text means the name, tags and card text. The cover image improves themes, colors, style and the quality score.
