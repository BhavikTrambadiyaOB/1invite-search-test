-- A search run by a report capture (search_report: version and phase) is logged like a user search, so the
-- failed-queries page can list a report run's failed searches. Null for searches made on the search page.
-- One log row per report: a new capture of the same report replaces it.
alter table search_log add column if not exists report_id bigint references search_report (id) on delete cascade;
create unique index if not exists search_log_report_idx on search_log (report_id) where report_id is not null;
