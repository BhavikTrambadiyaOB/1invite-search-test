-- Structured result counts help distinguish complete, partial, and occasion-only matches.
alter table search_log add column if not exists direct_count integer;
alter table search_log add column if not exists partial_count integer;
alter table search_log add column if not exists occasion_only_count integer;
