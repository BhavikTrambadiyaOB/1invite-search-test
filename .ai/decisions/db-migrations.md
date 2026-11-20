---
paths:
  - db/migrations/**
---

# Db Migrations decisions

## 2026-11-06 · Rules-only tag coverage for query lists
- **Why:** Needed to see which words of a tester query list become tags and which do not, without AI or embeddings.
- **What:** Migration 014 adds query_coverage_list and query_coverage; npm run search:coverage fills them, /search/coverage shows them with CSV export.
- **Files:** `db/migrations/014_query_coverage.sql`, `scripts/query-coverage.ts`, `src/lib/search/query-coverage.ts`, `src/app/search/coverage/page.tsx`
