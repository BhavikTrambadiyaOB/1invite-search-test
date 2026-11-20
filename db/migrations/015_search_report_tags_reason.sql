-- Tester note on the current version's suggested tags. Null when the tester left it empty
-- (the tags are fine, or there is nothing to add). Live has no such field.
alter table search_report_feedback add column if not exists current_tags_reason text;
