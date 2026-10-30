-- More template details for search: mood, color shades, extra occasions, languages and photos.

alter table template_search add column if not exists moods text[] not null default '{}';            -- fun, calm, heartfelt…
alter table template_search add column if not exists color_shades text[] not null default '{}';     -- lavender, sage green, metallic gold…
alter table template_search add column if not exists extra_occasions text[] not null default '{}';  -- other occasions the same design fits
alter table template_search add column if not exists languages text[] not null default '{}';        -- printed languages, main one first
alter table template_search add column if not exists photo_slot boolean not null default false;     -- the template has a photo frame (from json_data)
alter table template_search add column if not exists has_photo boolean not null default false;      -- photo slot, or a photo seen in the design

create index if not exists template_search_moods_idx on template_search using gin (moods);
create index if not exists template_search_extra_occasions_idx on template_search using gin (extra_occasions);
create index if not exists template_search_languages_idx on template_search using gin (languages);
create index if not exists template_search_has_photo_idx on template_search (has_photo);

-- Rebuild the full-text column so shades ("lavender") and moods ("fun") are searchable words.
-- occasion_words now also holds the labels of extra occasions.
drop index if exists template_search_vector_idx;
alter table template_search drop column if exists search_vector;
alter table template_search add column search_vector tsvector generated always as (
  setweight(to_tsvector('english', search_unaccent(coalesce(name, ''))), 'A') ||
  setweight(to_tsvector('english', search_unaccent(occasion_words || ' ' || search_join(themes) || ' ' || search_join(assets))), 'B') ||
  setweight(to_tsvector('english', search_unaccent(coalesce(card_text, '') || ' ' || search_join(color_shades) || ' ' || search_join(moods))), 'C') ||
  setweight(to_tsvector('english', search_unaccent(search_join(tags))), 'D')
) stored;
create index template_search_vector_idx on template_search using gin (search_vector);
