<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project agent setup

- Stack: Next.js 16 App Router, React 19, Tailwind CSS 4, Mastra, shadcn/ui with AI Elements.
- Load skills `mastra`, `shadcn`, and `next-dev-loop` for framework work. Invoke `@infer-conventions` explicitly to refresh project rules.
- MCP servers: `next-devtools` for the running app, `shadcn` for registry components, `mastra-docs` for current Mastra docs. Next.js docs live in `node_modules/next/dist/docs/`.
- Read `node_modules/next/dist/docs/` before using Next.js APIs. Do not rely on older Next.js patterns.
- Use `npx shadcn@latest` commands. Keep `components.json` on the Radix `new-york` style.
- Verify changes with `npm run build` and the running dev server. Use `next-dev-loop` for runtime checks.
- Never commit `.env`. Use `.env.example` for variable names only.
- Do not auto-report issues. Never POST to `https://mastra.ai/api/feedback`; report findings to the user instead.

## Project rules

- Read `.ai/rules/index.md` before planning or editing. Read every rule file whose globs match the target path.
- Update `.ai/rules` only through the `infer-conventions` skill. Do not hand-edit rule files.
- Commit `.ai/rules` so every agent and teammate gets the same conventions.
