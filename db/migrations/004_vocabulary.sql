-- Growing vocabulary: occasions, themes, assets and styles learned from templates.
-- Seeded from src/lib/search/taxonomy.ts (npm run search:vocab-seed), then extended by AI tagging.

create table if not exists vocab_term (
  kind            text not null check (kind in ('occasion', 'theme', 'asset', 'style')),
  id              text not null,                      -- singular snake_case, e.g. hockey_stick
  label           text not null,                      -- "Hockey Stick"
  occasion_group  text,                                -- occasions only: sidebar group (Birthday, Wedding…)
  parent          text,                                -- occasions only: family parent (first_birthday → birthday)
  themes          text[] not null default '{}',        -- assets only: themes the asset belongs to
  source          text not null default 'seed',        -- seed | ai
  template_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists vocab_term_label_trgm on vocab_term using gin (label gin_trgm_ops);

-- Every known spelling of a term: plural forms, synonyms, and merges decided during clean-up.
create table if not exists vocab_alias (
  kind        text not null,
  alias       text not null,                           -- normalized, e.g. "hockey sticks"
  term_id     text not null,
  method      text not null default 'seed',            -- seed | exact | singular | spelling | meaning | ai_judge | new
  created_at  timestamptz not null default now(),
  primary key (kind, alias),
  foreign key (kind, term_id) references vocab_term (kind, id) on delete cascade
);
create index if not exists vocab_alias_trgm on vocab_alias using gin (alias gin_trgm_ops);

-- The words AI returned before clean-up, so templates can be re-mapped later without new AI calls.
alter table template_search add column if not exists raw_terms jsonb;
