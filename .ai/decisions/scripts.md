---
paths:
  - scripts/**
---

# Scripts decisions

## 2026-11-06 · Retry only failed live captures
- **Why:** Live search returned token errors during the v2 phase 1 capture; rerunning everything would hit the live server again.
- **What:** search-report --retry-live reruns only reports with a live error for that version and phase, saves only the live side, and keeps the 19-per-run limit and 5-minute pause per 50.
- **Files:** `scripts/search-report.ts`, `src/lib/search/report.ts`
