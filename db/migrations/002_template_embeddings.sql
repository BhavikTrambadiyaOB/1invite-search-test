-- Meaning-based search: one embedding per template and per distinct query.
-- pgvector needs a superuser to install. Run once as the Postgres admin before `npm run db:migrate`:
--   sudo -u postgres psql -d invite_template_search -c "create extension if not exists vector;"

create extension if not exists vector;

-- text-embedding-3-large shortened to 1536 numbers (see EMBEDDING_DIMENSIONS in src/lib/search/ai-config.ts).
alter table template_search add column if not exists embedding vector(1536);
-- md5 of the model name and embedded text, so only templates whose text changed are embedded again.
alter table template_search add column if not exists embedding_hash text;

create index if not exists template_search_embedding_idx
  on template_search using hnsw (embedding vector_cosine_ops);

-- Query embeddings are cached so each distinct query is embedded once.
alter table search_query_cache add column if not exists embedding vector(1536);
alter table search_query_cache alter column intent drop not null;
