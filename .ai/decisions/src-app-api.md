---
paths:
  - src/app/api/**
---

# Src App Api decisions

## 2026-11-23 · Long searches are logged
- **Why:** Logging 50 report queries showed prompt-style searches over 200 characters were rejected by /api/search/log (400), so long searches from the search page never reached Failed queries.
- **What:** The search log accepts queries up to 2,000 characters and stores the full text; normalized_query stays cut to 200.
- **Files:** `src/app/api/search/log/route.ts`

## 2026-11-23 · Emoji-only searches are logged with their own text
- **Why:** A 20-query test of failed-query detection showed emoji-only searches (tester case "😅😃🥳…", a real "🎂" search) normalize to empty text, and the failed-query report skips empty searches, so they never appeared.
- **What:** The search log keeps the trimmed, lower-cased query as normalized_query when normalizing leaves nothing; such searches show in Failed queries (no words understood = search gap). The one existing empty log was backfilled.
- **Files:** `src/app/api/search/log/route.ts`
