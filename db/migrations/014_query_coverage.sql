-- Tag coverage: for a list of user search queries, which words the rules turn into tags, which words
-- only match template text, and which words match nothing. Rules only (no AI, no embeddings).
-- Each imported sheet is one list; re-running the same file replaces its rows.
create table if not exists query_coverage_list (
  id          serial primary key,
  source_file text not null unique,
  query_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists query_coverage (
  id                  bigserial primary key,
  list_id             integer not null references query_coverage_list (id) on delete cascade,
  row_no              integer not null,
  query               text not null,
  -- full: every meaningful word is a tag; partial: some words are tags; text_only: no tags, but the
  -- words appear in template text; none: nothing in the query matches.
  status              text not null,
  -- [{ "group": "Occasion", "label": "Birthday" }, …] in parser order.
  tags                jsonb not null default '[]',
  -- Words that are not tags but appear in some template's text (matched by full-text search).
  text_words          text[] not null default '{}',
  -- Words that are not tags and appear in no template at all.
  missing_words       text[] not null default '{}',
  -- Local templates that carry every tag of the query (null when the query has no tags).
  templates_all_tags  integer,
  -- Tags that no local template carries.
  empty_tags          text[] not null default '{}',
  unique (list_id, row_no)
);

create index if not exists query_coverage_list_status_idx on query_coverage (list_id, status);
