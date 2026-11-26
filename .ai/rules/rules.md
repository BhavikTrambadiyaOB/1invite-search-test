---
paths:
  - .ai/rules/**
  - AGENTS.md
  - opencode.jsonc
  - .agents/**
---

# Rules

## Project rules drive agent work
Before planning or editing, read .ai/rules/index.md and every rule whose globs match the target path, and the matching log in .ai/decisions/index.md. After any change to behavior, settings or conventions, record why and when with the infer-conventions scripts (After a change mode) without being asked; do not hand-edit .ai/rules or .ai/decisions. Never auto-post Mastra feedback; report findings to the user.

## Decisions name their evidence
In a decision entry, the why names the source: report version and phase, the tester query and its note (#rank), or the user's own words; the what gives the new behavior and the snapshot result. Record a user decision not to change something too, so it is not reopened.
