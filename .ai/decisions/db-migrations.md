---
paths:
  - db/migrations/**
  - scripts/**
---

# Db Migrations decisions

## 2026-11-25 · template_search.prints_rsvp from every text layer
- **Why:** card_text drops contact lines (phone numbers, addresses) as placeholders, and the RSVP word is usually on that same line ("RSVP TO +1 012 345 6789"), so 1,186 of 2,685 birthday cards looked RSVP-free.
- **What:** Migration 019 adds prints_rsvp; sync sets it with printsRsvp() over every text layer, contact lines included; npm run search:fill-rsvp fills it alone without touching other columns or source_hash (no re-enrichment, no AI). 6,343 of 11,253 templates print a reply line (2,146 of 2,685 birthday cards).
- **Files:** `db/migrations/019_template_prints_rsvp.sql`, `scripts/fill-prints-rsvp.ts`, `scripts/sync-templates.ts`, `src/lib/search/card-text.ts`, `package.json`

## 2026-11-20 · AI gender answers go to a review table first
- **Why:** The user wants AI gender answers stored apart and checked before template data changes, so nothing is lost and all answers can be reviewed.
- **What:** Migration 016 adds template_gender_review (current gender, AI gender, confidence, reason, preview, status pending/approved/rejected, applied_at). check-gender --review stores answers there only (resumable, 8 at a time); --sample N takes half girly-looking and half boyish-looking cards. template_search is not changed until approved answers are applied. First 50-card test: girl answers at 0.9+ all right; boy answers mostly from themes (soccer, golf, dinosaur, farm) and not reliable.
- **Files:** `db/migrations/016_template_gender_review.sql`, `scripts/check-gender.ts`

## 2026-11-06 · Rules-only tag coverage for query lists
- **Why:** Needed to see which words of a tester query list become tags and which do not, without AI or embeddings.
- **What:** Migration 014 adds query_coverage_list and query_coverage; npm run search:coverage fills them, /search/coverage shows them with CSV export.
- **Files:** `db/migrations/014_query_coverage.sql`, `scripts/query-coverage.ts`, `src/lib/search/query-coverage.ts`, `src/app/search/coverage/page.tsx`
