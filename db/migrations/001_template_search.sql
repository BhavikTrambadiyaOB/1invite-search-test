-- Template search tables. The legacy `images` table is read-only and never changed here.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- `unaccent` is not immutable, so wrap it for use in generated columns and indexes.
create or replace function search_unaccent(text) returns text
  language sql immutable parallel safe strict
  as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- array_to_string is only stable, so wrap it for the generated search column.
create or replace function search_join(text[]) returns text
  language sql immutable parallel safe
  as $$ select coalesce(array_to_string($1, ' '), '') $$;

-- One row per searchable template (content_type = 1, is_active = 1).
create table if not exists template_search (
  template_id          integer primary key,
  name                 text not null default '',
  tags                 text[] not null default '{}',
  card_text            text not null default '',
  preview_url          text not null default '',
  is_free              boolean not null default false,
  is_portrait          boolean,
  is_featured          boolean not null default false,
  created_at           timestamptz not null,

  occasion             text,
  occasion_confidence  real not null default 0,
  milestone            integer,
  format               text,
  doc_type             text,
  audience             text,
  themes               text[] not null default '{}',
  styles               text[] not null default '{}',
  colors               text[] not null default '{}',
  quality_score        real not null default 0.5,
  summary              text not null default '',

  -- Occasion and themes are kept in plain words so full-text search can match them.
  occasion_words       text not null default '',

  search_vector tsvector generated always as (
    setweight(to_tsvector('english', search_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('english', search_unaccent(occasion_words || ' ' || search_join(themes))), 'B') ||
    setweight(to_tsvector('english', search_unaccent(coalesce(card_text, ''))), 'C') ||
    setweight(to_tsvector('english', search_unaccent(search_join(tags))), 'D')
  ) stored,

  enrich_source        text not null default 'none',   -- none | rules | ai
  source_hash          text not null default '',
  enriched_hash        text not null default '',        -- source_hash at the time of the last enrichment
  enriched_at          timestamptz,
  synced_at            timestamptz not null default now()
);

create index if not exists template_search_vector_idx   on template_search using gin (search_vector);
create index if not exists template_search_themes_idx   on template_search using gin (themes);
create index if not exists template_search_colors_idx   on template_search using gin (colors);
create index if not exists template_search_name_trgm    on template_search using gin (name gin_trgm_ops);
create index if not exists template_search_occasion_idx on template_search (occasion);
create index if not exists template_search_free_idx     on template_search (is_free);
create index if not exists template_search_created_idx  on template_search (created_at desc);

-- Parsed query intent, so each distinct query is understood once.
create table if not exists search_query_cache (
  normalized_query text primary key,
  intent           jsonb not null,
  source           text not null,             -- rules | ai
  created_at       timestamptz not null default now()
);

-- One row per search.
create table if not exists search_log (
  id               bigserial primary key,
  session_id       text not null,
  query            text not null,
  normalized_query text not null,
  intent           jsonb not null,
  filters          jsonb not null default '{}',
  page             integer not null default 1,
  result_count     integer not null,
  top_score        real,
  created_at       timestamptz not null default now()
);
create index if not exists search_log_session_idx on search_log (session_id, created_at);
create index if not exists search_log_created_idx on search_log (created_at);

-- What the user did with the results.
create table if not exists search_event (
  id           bigserial primary key,
  search_id    bigint not null references search_log (id) on delete cascade,
  template_id  integer not null,
  type         text not null check (type in ('click', 'open', 'bounce')),
  position     integer,
  created_at   timestamptz not null default now()
);
create index if not exists search_event_search_idx on search_event (search_id);

-- Daily failed-query summary.
create table if not exists failed_query_report (
  day              date not null,
  normalized_query text not null,
  searches         integer not null,
  failures         integer not null,
  failure_rate     real not null,
  priority         real not null,
  reasons          jsonb not null,
  gap_type         text not null,             -- content_gap | search_gap
  example_intent   jsonb,
  primary key (day, normalized_query)
);

create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
