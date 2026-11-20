---
paths:
  - src/components/search/**
---

# Src Components Search decisions

## 2026-11-18 · Report page switches version and phase
- **Why:** The user wanted to compare the same query across versions and phases (for example v2 vs v3 phase 1) from the report page.
- **What:** The v/Phase badge on a report is now two dropdowns listing only the runs saved for that query; choosing one opens that run's report. Changing version keeps the phase when that version has it, otherwise its first phase.
- **Files:** `src/components/search/report-run-switcher.tsx`, `src/app/search/report/[id]/page.tsx`, `src/lib/search/report.ts`
