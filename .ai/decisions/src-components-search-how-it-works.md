---
paths:
  - src/components/search/how-it-works/**
---

# Src Components Search How It Works decisions

## 2026-11-26 · How it works covers negation, audiences, card type and the 26 Nov reading fixes
- **Why:** User asked to update How it works for the new changes (25–26 Nov: negation, Seniors and Adults audiences, card type rung and chips, Hindi/Urdu words, cowboy / Gatsby, prints_rsvp), so testers and future agents see why results changed.
- **What:** Reading the query: clean step joins "10 th" / "cow boy" and sets aside what is not wanted; exact rules explain exclusions (hide sure facts, rank loose ones, Hindi "no" = of), audiences (toddler, teen, adult incl. men / women / mom on a plain birthday, seniors 60+), Hindi/Urdu words and kind words (effect, activities, gatsby, plaid…), and the facts kept from the rules. Filter or rank: new "Said it is not wanted" rung; Without RSVP card uses every text line. Sorting ladder: new rung 3 Card type asked (rungs renumbered, story and example table follow). Tag chips: Men / Women for adult and senior searches, asked card type / second occasion chip first. Known gaps, numbers (age ranges incl. 60–110), glossary (Exclusion, Audience, Card type), cheat sheet and two new captured examples (1st birthday without photo, mens birthday).
- **Files:** `src/components/search/how-it-works/explainer.tsx`, `src/components/search/how-it-works/story.tsx`, `src/components/search/how-it-works/cheat-sheet.tsx`, `src/components/search/how-it-works/query-explorer.tsx`

## 2026-11-20 · How it works covers the new tag chip rules
- **Why:** The page must match the tag chip fixes from the tester tags reasons.
- **What:** Tag chips section explains the near-results fallback for unmatched details, separate kinds, gender pair and Men/Women, the smaller card count for small searches and the style slot; reading rules list the facts kept from the rules (photo, second occasion, exact element).
- **Files:** `src/components/search/how-it-works/explainer.tsx`

## 2026-11-20 · How it works covers the nine v3 ranking fixes
- **Why:** The page must match the current search after the v3 phase 1 Major fixes.
- **What:** Explained separate kinds, element listed first, first color tag counting most, age ties and implied ages, toddler 1-3, kids party over AI, and chips from the first 40 results; added Main element and Separate kinds to the numbers table.
- **Files:** `src/components/search/how-it-works/explainer.tsx`, `src/components/search/how-it-works/cheat-sheet.tsx`, `src/components/search/how-it-works/field-matrix.tsx`

## 2026-11-17 · How it works pages follow the 17 Nov ranking
- **Why:** The explainer still described the old ladder, the price filter as always on, and fixed gaps as open.
- **What:** Rule reader list, sorting ladder (main color, design-word gender, implied age), field matrix, known gaps (catalog 700+ behind live), numbers, glossary, examples and the worked example (#71319 now #1) match the code.
- **Files:** `src/components/search/how-it-works/explainer.tsx`, `src/components/search/how-it-works/story.tsx`, `src/components/search/how-it-works/query-explorer.tsx`, `src/components/search/how-it-works/example.ts`
