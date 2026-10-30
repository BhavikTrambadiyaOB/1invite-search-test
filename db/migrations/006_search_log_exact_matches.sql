-- Failed-query signals that still work now that searches keep nearby results instead of returning none.

-- Results that fit the occasion and every asked detail ("dinosaur" in "dinosaur wedding"). Null for older rows.
alter table search_log add column if not exists exact_count integer;
-- Parts of the query reading the user removed (the × on a "Showing" tag): a sign it was misread.
alter table search_log add column if not exists ignored text[] not null default '{}';
