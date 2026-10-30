-- Gender target and visible assets (objects in the design: butterfly, basketball, lion…).

alter table template_search add column if not exists gender text;            -- girl | boy | neutral
alter table template_search add column if not exists assets text[] not null default '{}';

create index if not exists template_search_gender_idx on template_search (gender);
create index if not exists template_search_assets_idx on template_search using gin (assets);

-- Rebuild the full-text column so assets are searchable with the same weight as themes.
drop index if exists template_search_vector_idx;
alter table template_search drop column if exists search_vector;
alter table template_search add column search_vector tsvector generated always as (
  setweight(to_tsvector('english', search_unaccent(coalesce(name, ''))), 'A') ||
  setweight(to_tsvector('english', search_unaccent(occasion_words || ' ' || search_join(themes) || ' ' || search_join(assets))), 'B') ||
  setweight(to_tsvector('english', search_unaccent(coalesce(card_text, ''))), 'C') ||
  setweight(to_tsvector('english', search_unaccent(search_join(tags))), 'D')
) stored;
create index template_search_vector_idx on template_search using gin (search_vector);
