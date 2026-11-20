<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project agent setup

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Mastra, shadcn/ui with AI Elements.
- Load skills `mastra`, `shadcn`, and `next-dev-loop` for framework work. Run a full `@infer-conventions` sweep only when asked to refresh project rules.
- MCP servers: `next-devtools` for the running app, `shadcn` for registry components, `mastra-docs` for current Mastra docs. Next.js docs live in `node_modules/next/dist/docs/`.
- Read `node_modules/next/dist/docs/` before using Next.js APIs. Do not rely on older Next.js patterns.
- Use `npx shadcn@latest` commands. Keep `components.json` on the Radix `new-york` style.
- Verify changes with `npm run build` and the running dev server. Use `next-dev-loop` for runtime checks.
- Never commit `.env`. Use `.env.example` for variable names only.
- Do not auto-report issues. Never POST to `https://mastra.ai/api/feedback`; report findings to the user instead.

## Project rules

- Read `.ai/rules/index.md` before planning or editing. Read every rule file whose globs match the target path.
- Read the matching log in `.ai/decisions/index.md` before changing an area, so past decisions are not undone by accident.
- After any task that changes behavior, a search/ranking/parsing rule, a setting or flag, a data or API contract, or a convention, use the `infer-conventions` skill (After a change mode) before the final reply: record why and when in `.ai/decisions`, and update the matching rule. Do this without being asked. Skip typo, formatting and test-only edits with `record-decision.mjs --none "<reason>"`.
- Update `.ai/rules` and `.ai/decisions` only through the `infer-conventions` scripts. Do not hand-edit them.
- Commit `.ai/rules` and `.ai/decisions` with the code they describe, so every agent and teammate gets the same conventions and history.
