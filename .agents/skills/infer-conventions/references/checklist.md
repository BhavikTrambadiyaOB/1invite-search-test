# Convention checklist

Use with `infer-conventions`. Mark every applicable dimension as config fact, pattern, conflict, default, no signal, already recorded, or tooling-owned. Search hints are starting points, not limits.

## A. Project and config

- Package manager and lockfile: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`.
- Next.js version, router, `src/` directory, Turbopack: `package.json`, `next.config.ts`, `src/app`.
- TypeScript strictness and path aliases: `tsconfig.json`, `next-env.d.ts`.
- Next flags: `cacheComponents`, `partialPrefetching`, `serverExternalPackages`, experimental options.
- Tailwind version and integration: `package.json`, `postcss.config.*`, `src/app/globals.css`, `next.config.ts`.
- shadcn config: `components.json` `style`, base library, `rsc`, `tsx`, aliases, icon library, registries.
- Environment contract: `.env.example`, `.gitignore`, `README.md`.
- Scripts and verification: `package.json` scripts, CI files.
- Agent tooling: `AGENTS.md`, `opencode.jsonc`, `.agents/skills`, `.ai/rules`.

## B. Next.js app

- App Router structure: route groups, layouts, loading, error, not-found files.
- Server/client boundary: `'use client'`, `'use server'`, client-only hooks.
- Data fetching: server components vs route handlers, `fetch` caching, `"use cache"`, `cacheLife`, `cacheTag`.
- Mutations: Server Actions, route handlers, forms, validation.
- Navigation: `Link`, `redirect`, `router.push`, prefetch behavior.
- API route style: named exports, status codes, JSON shape, runtime config, streaming responses.
- Metadata and SEO: `metadata`, `generateMetadata`, viewport.
- Error handling: thrown errors, error boundaries, API error envelopes.
- Dynamic routes and params: async `params`/`searchParams`, catch-all segments.

## C. Mastra

- File layout: `agents/`, `tools/`, `workflows/`, registry in `src/mastra/index.ts`.
- Agent IDs and names: kebab-case, filename match, registry match.
- Model IDs: provider/model string format.
- Agent instructions: system prompt style and shared prompt fragments.
- Tools: `createTool`, Zod input/output schemas, execute error handling.
- Memory: thread/resource IDs, storage, last-messages settings.
- Storage: LibSQL, composite store, DuckDB observability, absolute vs relative paths.
- Mastra instance: registered agents, workflows, logger, observability.
- Server adapter: mount path, prefix, exported HTTP methods.
- AI SDK bridge: `handleChatStream`, `toAISdkMessages`, `version`, message shape.
- CLI usage: `mastra dev`, `mastra build`, `mastra api`, Studio.

## D. shadcn and AI Elements

- Primitive location and import alias: `src/components/ui`, `@/components/ui`.
- AI Elements location: `src/components/ai-elements`.
- Component composition: `cn`, CVA variants, `data-slot`, `asChild`.
- Client/server boundaries for interactive components.
- Local patches to generated files and overwrite risk from `shadcn add`.
- Icon library and naming.
- Styling: semantic tokens, CSS variables, dark mode, arbitrary values.
- Accessibility: labels, roles, keyboard handling.
- Chat UI patterns: `useChat`, transport, message parts, tool parts, streaming states.

## E. TypeScript and code style

- Import style and type-only imports.
- Type vs interface, `satisfies`, generics, inference.
- Runtime validation: Zod at boundaries.
- Naming: files, components, hooks, constants, schemas.
- Error handling: try/catch, logging, user-facing messages.
- Async patterns: `await`, parallel calls, error propagation.
- Formatting and lint rules: leave to Prettier/ESLint.

## F. Testing and verification

- Test framework and layout: Vitest, Jest, Playwright, `*.test.*`, `*.spec.*`, `e2e/`.
- Test data and mocking style.
- Build, lint, typecheck, and test commands.
- Runtime verification: `next-devtools` MCP, `next-dev-loop`, `agent-browser`.
- API smoke tests: curl commands, expected status and shape.

## G. Security

- Secret handling and env exposure: server-only vars, no `NEXT_PUBLIC_` secrets.
- Auth and authorization on API routes and Server Actions.
- Input validation and output encoding.
- CORS and CSRF posture.
- Unsafe HTML or dynamic code.
- Dependency and supply-chain notes that affect code decisions.

## Evidence rules

- Inferred pattern: at least 3 consistent examples, no meaningful rival.
- Config fact: authoritative file and line.
- Conflict: report counts and files; do not choose a winner.
- Skip framework defaults, formatter-owned style, and anything already recorded.
- Record the convention, not the evidence.
