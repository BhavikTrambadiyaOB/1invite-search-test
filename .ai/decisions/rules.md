---
paths:
  - .ai/rules/**
  - AGENTS.md
  - opencode.jsonc
  - .agents/**
---

# Rules decisions

## 2026-11-17 · Decision log and automatic recording
- **Why:** infer-conventions never ran on its own: Claude Code could not see it (.agents/skills only), it had disable-model-invocation, and it only recorded timeless rules, so why and when a change was made got lost.
- **What:** .ai/decisions keeps dated why/what entries per area next to .ai/rules. The skill has an After a change mode that agents run without being asked; .claude/skills links to it; a project Stop hook (.claude/settings.json) reminds once per turn when code is newer than the last record.
- **Files:** `.agents/skills/infer-conventions/SKILL.md`, `.agents/skills/infer-conventions/scripts/record-decision.mjs`, `.agents/skills/infer-conventions/scripts/check-decisions.mjs`, `.claude/settings.json`, `AGENTS.md`
