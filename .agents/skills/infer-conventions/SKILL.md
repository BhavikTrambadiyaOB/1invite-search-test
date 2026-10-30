---
name: infer-conventions
description: "Analyze this Next.js + Mastra + shadcn/ui codebase and record its actual conventions as durable path-scoped rules in .ai/rules. Trigger only when the user explicitly asks to infer, document, update, or standardize project conventions, set up .ai/rules, resolve mixed patterns, or onboard agents to how this repo works. Covers config, App Router/API routes, Mastra agents/tools/memory, shadcn/AI Elements, TypeScript, testing, security, and agent tooling. Do not use for one-off reviews or formatter-owned style."
license: MIT
metadata:
  author: local
disable-model-invocation: true
---

# Infer conventions

Document how this app actually works. Record durable, path-scoped rules in `.ai/rules` so future agents read the right rule before editing a file.

## Ground rules

- Reality over preference. The majority pattern wins. Never propose a "better" style while recording.
- Decisions, not defaults. Record a pattern only when the repo chose one valid option where an agent would plausibly pick another, or when authoritative config makes a choice.
- Evidence or silence. An inferred code convention needs at least 3 consistent examples and no meaningful rival. A config fact needs the authoritative file line.
- Skip formatter and linter-owned style. Prettier, ESLint, and TypeScript own formatting and syntax. Do not record it.
- Never duplicate. Read `.ai/rules/index.md` and matching files before the sweep. A dimension already covered is done.
- The rule states the convention only. No counts, ratios, file lists, or detection evidence. One or two imperative lines.
- Do not record secrets, transient state, or obvious framework defaults.
- Only run when explicitly asked.

## Process

### Step 0 - Orient

Read:
- `package.json`, `next.config.ts`, `tsconfig.json`, `components.json`, `AGENTS.md`, `opencode.jsonc`
- `.ai/rules/index.md` and every rule file if present
- the tree under `src/` and `scripts/`

Map every non-default directory. High-signal areas in this stack:
`src/app`, `src/app/api`, `src/mastra`, `src/mastra/agents`, `src/mastra/tools`, `src/mastra/workflows`, `src/components/ui`, `src/components/ai-elements`, `src/lib`.

Note installed dependencies and scripts. Note Next flags, path aliases, shadcn base/style, Mastra storage and adapter, AI SDK version.

Done when: you know the applicable checklist groups, existing rules, and the purpose of every non-default directory.

### Step 1 - Predefined sweep

Open `references/checklist.md`. Give every applicable dimension exactly one verdict:

- **Config fact** - an authoritative file proves the choice. Candidate.
- **Pattern** - 3+ consistent examples, no meaningful rival, real choice. Candidate.
- **Conflict** - both styles present in meaningful numbers. Report the split and files. Do not pick a winner.
- **Default** - framework or common-practice default an agent already writes. Skip.
- **No signal** - too little code. Skip.
- **Already recorded** or **tooling-owned** - skip.

Done when every applicable dimension has a verdict.

### Step 2 - Open-ended pass

Look for house patterns not in the checklist: layered folders, barrel exports, server/client split, error envelope, naming, feature modules, state and data flow, custom wrappers around Mastra or AI SDK, patched generated components.

Cap non-config findings at about 5 so the rules stay high-signal. Cite 2-3 files per finding.

Done when every non-default directory has a verdict and the open-ended findings are listed or declared empty.

### Step 3 - Confirm

Present every candidate in one batch: dimension, verdict, evidence, proposed glob(s), title, and note.

Default is confirm: record only what the user approves. Switch to yolo only when the invocation says so ("yolo", "don't ask", "just record them"). Conflicts always go to the user.

Done when every candidate is approved, rejected, or deferred.

### Step 4 - Record

Use the helper for each approved rule:

```bash
node .agents/skills/infer-conventions/scripts/record-rule.mjs \
  --glob 'src/mastra/**' \
  --title 'Agent IDs match file names' \
  --note 'Use kebab-case agent IDs that match the agent file name. Keep the same ID in src/mastra/index.ts and API calls.'
```

Pass `--glob` more than once when one rule covers several paths. Use `--root` when the project root is not the current directory. The script merges area files, updates an existing section with the same title, and regenerates `.ai/rules/index.md`. Do not edit `.ai/rules` by hand.

Done when every approved item is written and appears in the index.

### Step 5 - Summarize

List recorded rules, conflicts deferred, and notable no-signals. Tell the user to commit `.ai/rules`.

## Glob mapping

- App routes, pages, layouts: `src/app/**`
- API route handlers: `src/app/api/**`
- Mastra agents: `src/mastra/agents/**`
- Mastra tools: `src/mastra/tools/**`
- Mastra workflows: `src/mastra/workflows/**`
- Mastra config: `src/mastra/index.ts`
- shadcn primitives: `src/components/ui/**`
- AI Elements: `src/components/ai-elements/**`
- Shared utilities: `src/lib/**`
- Root config: `package.json`, `next.config.ts`, `tsconfig.json`, `components.json`, `opencode.jsonc`, `AGENTS.md`
- Agent rules: `.ai/rules/**`

Use the most specific glob that covers the evidence. Split a convention across domains when it applies to more than one path.

## Current baseline

These project facts are already in `.ai/rules`. Do not re-record them unless they change. Update the matching rule instead.

- Next.js 16 App Router + Turbopack, `src/` directory, alias `@/*`.
- Cache Components and Partial Prefetching enabled.
- Tailwind CSS 4, shadcn Radix `new-york`, AI Elements.
- Mastra weather agent, `/api/chat` AI SDK v7 stream, `/api/[...mastra]` adapter.
- npm scripts: `dev`, `build`, `start`, `lint`.
- No test framework installed.
