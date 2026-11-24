---
paths:
  - src/app/search/**
  - src/components/search/**
---

# Src App Search decisions

## 2026-11-24 · Report failed-query check moves into a header button
- **Why:** The user found the inline panel on the report page unnecessary and asked for its details to open from a button next to Edit feedback instead.
- **What:** The report page header has an Explain numbers button (with the gap badge) beside the feedback button. It opens the Explain numbers window with the numbers (including Top relevance), the reasons, what to do, unknown words and missing-tag hints, when it was judged, and an Open in Failed queries link. If the search is not logged yet, the button is disabled and its tooltip gives the log command. The inline panel is gone.
- **Files:** `src/components/search/report-failed-query.tsx`, `src/components/search/count-explanation.tsx`, `src/app/search/report/[id]/page.tsx`

## 2026-11-24 · Report page shows its failed-query check
- **Why:** Testers checking one report query should not have to filter the whole Failed queries list to see why it passed or failed.
- **What:** Each /search/report/:id page shows a Failed query check panel for that report search: gap, reasons, Templates / Direct (by tags) / Partial / Occasion only / Top relevance, the collection direction, missing-tag hints, Explain numbers and a link to the row on Failed queries. It uses the same judgement as the Failed queries page, limited to that report_id (FailedQuerySource.reportId). If the search is not logged yet, the panel shows the log command. Gap labels and the direction text are shared in failed-query-gaps.ts.
- **Files:** `src/components/search/report-failed-query.tsx`, `src/app/search/report/[id]/page.tsx`, `src/lib/search/failed-queries.ts`, `src/lib/search/failed-query-gaps.ts`, `src/app/search/insights/page.tsx`

## 2026-11-23 · Failed queries: Explain numbers panel
- **Why:** Testers could not tell why a row shows e.g. Direct 0 and Partial 57; the debug view is only readable by developers.
- **What:** Each failed query has an Explain numbers button: what search understood, how many cards of the occasion have each asked part, how many miss only that part, what Templates / Direct / Occasion only / Partial mean, and the closest blocker ("18 cards have everything except 80th"). Recounted on today’s data with the same tests as search (live occasion family, joint and no-RSVP rules); matched search exactly on 50 of 55 logged rows, the rest are no-occasion searches, flagged in the panel. Report only.
- **Files:** `src/lib/search/failed-query-checks.ts`, `src/components/search/count-explanation.tsx`, `src/app/search/insights/page.tsx`

## 2026-11-20 · Gender review: one card at a time with Skip
- **Why:** The user wants to review cards one by one, keep the AI answer with a Skip button, change it when wrong, and compare the current metadata with the new AI gender.
- **What:** The page shows one card at a time (position n in the filtered list): large image, three boxes (search uses now / AI says / your answer), AI reason, the template full current metadata from template_search, and buttons Skip (keeps the AI answer as final_gender), Girl, Boy, Neutral. Keys S/G/B/N, U undoes the last card (shown in a Last strip). To review: the saved card leaves the list and the next loads; Reviewed/All: Previous/Next step through. The paginated grid is gone.
- **Files:** `src/app/search/gender-review/page.tsx`, `src/components/search/gender-review-panel.tsx`, `src/lib/search/gender-review.ts`, `src/lib/search/gender-review-types.ts`

## 2026-11-20 · Gender review page
- **Why:** The user wants to check each AI gender answer one by one, change it when wrong, and finish the whole list before template data changes.
- **What:** /search/gender-review (nav: Gender review) shows each card in template_gender_review with its image, the AI answer, sureness and reason, and Girl/Boy/Neutral buttons that save the person answer to final_gender right away (status reviewed; Undo clears it). Filters: status, AI answer, AI sureness; progress shows reviewed count and disagreements. Migration 017 adds final_gender and reviewed_at; status is pending/reviewed. A later AI re-check never overwrites a reviewed row. template_search is still unchanged.
- **Files:** `src/app/search/gender-review/page.tsx`, `src/components/search/gender-review-card.tsx`, `src/lib/search/gender-review.ts`, `src/lib/search/gender-review-types.ts`, `src/app/api/search/gender-review/route.ts`, `db/migrations/017_template_gender_review_final.sql`
