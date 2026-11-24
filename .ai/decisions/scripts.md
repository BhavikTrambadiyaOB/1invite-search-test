---
paths:
  - scripts/**
---

# Scripts decisions

## 2026-11-20 · Gender check ignores sample names
- **Why:** Second gender dry run: two cards were called girl because of the sample name "Sophia" or its pink lettering.
- **What:** The prompt names the catalog sample names (Arieta, Sophia, Sue, Richard, Joseph, John; about 1,700 birthday cards), says name lettering color and pop-culture titles do not decide, and the printed text sent to the model has those names replaced by [NAME]. Third dry run: both name mistakes fixed; girl answers look right; boy answers come from themes alone (dinosaur, soccer, golf, Pokémon).
- **Files:** `scripts/check-gender.ts`

## 2026-11-20 · Gender check: joint cards neutral, 0.85 bar, mixed sample
- **Why:** First gender dry run changed a father-and-daughter joint card to girl and a brown-bow card on a single bow.
- **What:** The prompt now keeps cards for two or more people neutral and needs a feminine look as a whole (one bow on a brown/beige/gold design is not enough). A card changes only at confidence 0.85+ (MIN_CONFIDENCE). The dry-run sample mixes girly, boyish and other cards, with --skip and --include. Second dry run: joint and bow cases fixed; 2 of 5 changes still decided by a printed sample name.
- **Files:** `scripts/check-gender.ts`

## 2026-11-20 · Gender-only AI check for neutral birthday cards
- **Why:** v2/v3 feedback: girly cards tagged neutral rank right after boy cards for "16th boy birthday" (268 neutral birthday cards show girly signs). The user approved an AI gender re-check; re-running full tagging would also move colors and elements testers approved.
- **What:** npm run search:check-gender asks one question per neutral birthday card (cover image + printed text): girl, boy or neutral, with confidence. Only --dry-run and --estimate exist so far (1,604 cards, about $0.37). First 20-card dry run: 4 sensible changes, 1 wrong (father-and-daughter joint card). Next: joint cards stay neutral, change only at 0.85+, second dry run, then a saving mode with a backup of old values.
- **Files:** `scripts/check-gender.ts`, `package.json`

## 2026-11-06 · Retry only failed live captures
- **Why:** Live search returned token errors during the v2 phase 1 capture; rerunning everything would hit the live server again.
- **What:** search-report --retry-live reruns only reports with a live error for that version and phase, saves only the live side, and keeps the 19-per-run limit and 5-minute pause per 50.
- **Files:** `scripts/search-report.ts`, `src/lib/search/report.ts`
