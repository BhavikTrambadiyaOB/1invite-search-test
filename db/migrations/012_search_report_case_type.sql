-- Test-case CSV: every query has a case type ("Age-Based Search", "Typo & Spelling Mistake Search"…),
-- what it tests and the expected result. The report is filtered and exported by case type.
alter table search_report_import
  add column if not exists case_type text not null default '',
  add column if not exists what_it_tests text not null default '',
  add column if not exists expected_result text not null default '';

-- The same query may appear under two case types, so the case type is part of the key.
alter table search_report_import
  drop constraint if exists search_report_import_normalized_query_occasion_key;
create unique index if not exists search_report_import_query_group_key
  on search_report_import (normalized_query, occasion, case_type);

create index if not exists search_report_import_case_type_idx
  on search_report_import (case_type);
