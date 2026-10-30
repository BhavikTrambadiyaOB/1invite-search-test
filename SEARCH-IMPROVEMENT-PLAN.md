# Search improvement plan (for review before any change)

Based on: the code as it is today, the 1,034 real queries in `search_report`, and the issues in `SEARCH-ISSUES.md`.
Goal: fix the gaps without hurting searches that already work.

---

## 1. How search works today

### Template data (built once, stored in `template_search`)
| Step | What it produces | Where |
|---|---|---|
| Sync | name, card text, preview, free/paid, date, photo slot | `scripts/sync-templates.ts` |
| AI tagging (gpt-6-luna, image + text) | occasion, also-fits occasions, age, boy/girl, audience, format, card type, themes, elements, styles, colors and shades, mood, languages, has photo, quality score, summary | `template-enrichment-workflow.ts`, `template-enricher-agent.ts` |
| Vocabulary | new words the AI used become terms (2,070 terms, 4,651 spellings) | `vocabulary.ts` |
| Embedding (text-embedding-3-large, 1,536) | one vector per template from the tags + summary + card wording | `embedding-text.ts`, `template-embeddings.ts` |

### A search, step by step
1. **Read the query.** The rule parser maps words to the vocabulary (`parse-query.ts`). If anything stays unknown, the AI query parser reads it (`ai-parse-query.ts`, cached per query).
2. **Meaning.** The query is embedded and compared with every template (`embeddings.ts`).
3. **Filter (SQL WHERE).**
   - The occasion family, plus its parent as a lower tier.
   - Hard filters: card type, language, photo, boy/girl, free.
   - Without an occasion, the details also filter.
4. **Rank.**
   - Tiers first: occasion match, then how many asked details match, then the age.
   - Then a score: relevance (occasion, attributes, keywords, meaning) × 0.75 + freshness × 0.15 + quality × 0.10.
5. **Tags and log.** Suggested tags come from the best matches. Searches are logged for failed-query detection.

---

## 2. Root causes behind the issues

| # | Root cause | Issues it explains | Queries |
|---|---|---|---|
| R1 | **NULL bug:** the check "format = dinner" is unknown (not false) for the 41% of templates without a format, which drops them silently | eid dinner 25/41, success party, graduation reception, every "party / dinner / ceremony / brunch" query | many (silent) |
| R2 | **Hard filters** for card type, language and photo, even when an occasion is named | most results under 40 | ~85 |
| R3 | **"card / cards"** maps to Greeting Card (and "wishes / mubarak" force it as a filter) | eid wishes 6/41, wedding card 0, nikah card 5 | ~50 |
| R4 | **Non-Latin text is erased** by the query cleanup | عيد مبارك, ঈদ মোবারক, दव… show the whole catalog; OpenAI error each time | 18 |
| R5 | **A number after the occasion** is not read as age | birthday 40, birthday 90 gold | 8 |
| R6 | **A weak or generic occasion guess** anchors the search | baby boss party loses all Boss Baby designs | few, but bad |
| R7 | **Freshness and quality are too weak** inside a tier; small meaning differences decide the order | old designs on top while newer exact matches sit lower | 111 |
| R8 | **Small learned occasions** take over common words (Lunch Party 2, Lunch Date 3, Morning Greeting 2); overlapping occasions (Indian Festival / Religious Service / *_puja) | lunch party, morning event, kirtan, hindu puja | ~20 |
| R9 | **Missing synonyms** and **noise words treated as required** (dates, names, pasted chat) | bakri, tabaski, srimant, afterparty, pre-k, cookoff; "10 juin", "tasnim" | ~40 |
| R10 | **Query language taken as template language** (AI parser), and coarse language tags ("Other" mixes Tamil, Odia, Indonesian…) | invitación de hombre, bahasa indonesia, tamil wedding | ~25 |
| R11 | **Data:** every baby shower and gender reveal has audience "kids"; Marathi, Tamil and others are tagged "Other" | wrong text in embeddings, weak language matching | 949 + ~270 templates |
| — | **Missing designs** (not a search problem) | umembeso, krishna baby shower, tarpaulin, name tag… | ~90 |

---

## 3. Proposed changes

Every change is checked against the safety net (section 4) before moving on.

### Phase A — Safety net first (no behavior change)
**A1. Baseline snapshot.** Save today's top-24 results for all 1,034 report queries and the 31 search tests.

**A2. Regression report script.** It runs the same queries after each change and lists:
- queries whose top 10 changed, as winners and losers
- counts that went to 0
- tests that fail

I review every "loser" before keeping a change.

### Phase B — Query understanding fixes (code only, no AI cost)
| Change | Fixes | Risk and protection |
|---|---|---|
| **B1. Fix the NULL bug:** a missing format counts as "no match", never "unknown" | R1 | None; only adds back cards that were wrongly dropped |
| **B2. Card type, language and photo rank instead of filter** when an occasion is named (asked ones first, others after). Boy/girl and free stay strict. Without an occasion they still filter. | R2 | Same rule we already use for age and theme; exact matches stay on top |
| **B3. "card / cards" no longer means Greeting Card.** "greeting card", "e-card", "wishes" still do, and with B2 they only rank. | R3 | Small vocabulary change; tests for "greeting card" queries |
| **B4. Keep letters of every script** in queries. Send such queries to the AI parser and the meaning search, and never embed empty text. | R4 | Only affects queries that are empty today |
| **B5. Read "birthday 40" / "anniversary 25"** (number right after the occasion) as age | R5 | Only when the number directly follows a birthday or anniversary word |
| **B6. A low-confidence or generic occasion does not anchor.** A named theme or character leads; the occasion only ranks. | R6 | Only for occasion confidence < 0.9 or generic occasions |
| **B7. Ignore noise in queries:** dates, times, chat prefixes like "[27/05, 1:14 pm] name:", very long pasted text (keep the first meaningful part) | R9 | Words are only removed from "must match", not from meaning search |
| **B8. AI query parser:** set the language only when the user asks for one ("in spanish", "español"), not because the query is written in it. Fixed temperature for stable readings. | R10, variants | Prompt change; cached readings are cleared once |
| **B9. Synonyms:** bakri, bakra, tabaski, srimant, maiyan, afterparty, pre-k, 12th grade, cookoff, pitmaster, "she did it", nikkah nama, ambedkar… plus the timeline / program group (already written, uncommitted; "rustic barn wedding" re-check first) | R9 | Added as vocabulary spellings; each one tested |

### Phase C — Ranking
| Change | Fixes | Risk and protection |
|---|---|---|
| **C1. Relevance bands.** Inside a tier, templates within a small relevance band count as equally relevant and are ordered by freshness + quality. Meaning still decides between clearly different matches. | R7 | Tune the band on the baseline: top-10 average year should rise without losing exact matches |
| **C2. Fill thin results with near meaning, not random cards.** When an occasion has few designs, the rest of page 1 comes from the parent occasion and meaning similarity. | R8 (thin pages) | Only applies when exact matches are fewer than a page |

### Phase D — Vocabulary and data cleanup (small AI cost, only where needed)
| Change | Fixes | Cost |
|---|---|---|
| **D1. Merge tiny learned occasions** (fewer than 5 designs) into their seed parent where they duplicate one: Lunch Party / Lunch Date → Brunch & Luncheon, Morning Greeting → Greeting… Link overlapping Indian occasions under one parent. | R8 | None (data rules + review list for you) |
| **D2. Baby showers and gender reveals: audience = adults** (rule, no AI) | R11 | None |
| **D3. Better language tags.** Add Marathi, Tamil, Telugu, Bengali, Punjabi, Odia, Malayalam, Kannada, Arabic (separate from Urdu), Indonesian, Dutch, Turkish. Re-tag only the ~270 templates that are non-English or "Other": script detection first, AI only when unsure. | R10, R11 | under $0.20 |
| **D4. Re-embed** only templates whose embedding text changed after D1–D3, plus add the card type and language names to the embedding text (helps multilingual and "greeting / announcement" meaning). | R4, R10 | up to ~$0.17 (all) |

### Phase E — Content gaps (for the design team, no code)
A ranked list from the failed-query report and section B of `SEARCH-ISSUES.md`:
- **Designs we don't have:** tarpaulin, name tags, Umembeso, Half Saree, Welcome, Tombstone…
- **Theme + occasion combinations:** Krishna baby shower, Cocomelon graduation…

---

## 4. How we make sure nothing gets worse
1. **Baseline first** (A1): today's results for all 1,034 queries are saved before any change.
2. **One phase at a time:** after each phase, the regression report (A2) and the 31 tests run.
3. **Every "loser" is reviewed.** A change is kept only if successful searches stay at least as good.
4. **Measured targets after all phases**, on the same 1,034 queries:
   - results under 40: from 210 (20%) to under 100, apart from real design gaps
   - zero results: from 18 to only the 3 real gaps
   - full-catalog results from non-Latin queries: 18 to 0
   - average year of the top 10 goes up
   - the 31 search tests pass, plus new tests for each fix

## 5. Cost and order
| Phase | AI cost | Data change | Re-embed |
|---|---|---|---|
| A safety net | none | none | no |
| B query fixes | none (a few cached query readings re-asked) | none | no |
| C ranking | none | none | no |
| D vocabulary / data | under $0.40 total | yes, only listed templates | changed ones |
| E content list | none | none | no |

Suggested order: A → B1 (biggest silent bug) → B2/B3 → B4/B5 → C1 → D → remaining B items → C2.
Nothing is committed until you approve each phase's regression report.
