This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## PostgreSQL setup

Next.js and Mastra share one PostgreSQL connection pool (`src/lib/db.ts`).
Mastra stores memory, workflow snapshots, eval data and AI traces (observability) in PostgreSQL.

1. Create the database and role:

   ```bash
   psql -d postgres <<'SQL'
   CREATE ROLE invite_template_search LOGIN PASSWORD 'change-me';
   CREATE DATABASE invite_template_search OWNER invite_template_search;
   SQL
   ```

2. Copy the environment file and set `DATABASE_URL`:

   ```bash
   cp .env.example .env
   ```

3. Start the app and check the connection:

   ```bash
   curl http://localhost:3000/api/health
   # {"status":"ok","database":"ok"}
   ```

Mastra creates its own tables on first use. Set `DATABASE_SSL=true` for hosted
providers that require SSL.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Template search

Requirements: [REQUIREMENTS.md](REQUIREMENTS.md). Design: [PLAN.md](PLAN.md).

Pages:
- `/search`: search with filters and quick tags. Add `&debug=1` to see scores and the parsed query.
- `/search/report`: stored live vs current search snapshots with six-answer review feedback.
- `/search/insights`: failed queries (content gaps and search gaps).

Setup and data:

```bash
npm run db:migrate            # create search tables
npm run search:sync           # copy active templates from `images` (rerun after new uploads)
npm run search:enrich-rules   # tag new or changed templates with rules (no AI)
npm run search:eval           # run the test queries
npm run search:report         # save yesterday's failed-query report (run daily)
npm run search:report:snapshot -- "5th Wedding Anniversary" "Dinner Invitation"
npm run search:report:snapshot -- --file queries.txt
npm run search:report:snapshot -- --csv "1invites_user_search - Occasion_Wise.csv"
npm run search:report:snapshot -- --from-import --limit 10
npm run search:report:snapshot -- --phase=2 --limit=10 # run/resume 10 Phase 2 queries
npm run search:report:snapshot -- --phase=2 --limit=50 # continue with the next 50
npm run search:report:snapshot -- --phase=2 --limit=100
npm run search:report:snapshot -- --phase=2            # capture all remaining Phase 2 queries
npm run search:report:snapshot -- --refresh   # rerun every stored report query
```

The occasion-wise CSV keeps its column name as the query's occasion in `search_report_import`. Importing does not
run the queries; `--from-import` captures pending ones. The search report stores the first 40 live production results and the first 40 current-version results for each query,
along with live suggested tags and tags produced by the current search logic. Existing reports are assigned to phase 1.
`--phase=N` resumes imported and stored queries not yet successfully captured in that phase, with up to three queries
running concurrently. `--limit` caps each invocation; omit it to finish the remaining queries. A phase with no remaining
queries reports that it is already complete. Requesting a phase beyond the next phase starts the next phase instead.
Reports are stored separately per query and phase. If earlier runs replaced Phase 1 snapshots, rerun
`npm run search:report:snapshot -- --phase=1` to capture them again; this creates fresh snapshots, not the historical ones.
The report page can filter by query text, phase, imported occasion, feedback completion, and live/current capture errors.
Set `LIVE_SEARCH_TOKEN` in `.env`; see
`.env.example` for the other live API variables.

AI (costs money; needs `OPENAI_API_KEY` and `SEARCH_AI_ENABLED=true`):

```bash
npm run search:enrich-ai -- --estimate   # how many templates and tokens
npm run search:enrich-ai -- --dry-run    # 20 templates, print results, save nothing
npm run search:enrich-ai -- --yes        # full run
```

Embeddings also need pgvector: see `db/migrations/002_template_embeddings.sql.pending`.

### AI tracing

Every AI call is traced (sampling: always) and stored in Postgres (`mastra_span_events`), whether it runs in
`npm run dev`, `npm start` or a script:

- template tagging (`tag template #id`), query understanding (`understand query: …`),
  term matching (`match term: …`) and embeddings (`embed N texts`)
- each trace carries metadata (`feature`, `templateId`, `query`, `word`) for filtering

View them in Mastra Studio while the app runs:

```bash
npm run mastra:studio   # http://localhost:4000, reads traces through the app on :3000
```
