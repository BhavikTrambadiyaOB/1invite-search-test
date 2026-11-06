-- Report versions: every new test-case sheet (new format or new set of queries) is its own version.
-- Phases run inside a version, so Phase 1 of v2 never mixes with Phase 1 of v1.
create table if not exists search_report_version (
  version     integer primary key,
  source_file text not null,
  -- Header row of the sheet, to see which format the version was imported from.
  columns     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- Everything captured so far is v1 (the first test-case sheet).
insert into search_report_version (version, source_file, columns)
select 1,
       coalesce((select source_file from search_report_import order by id limit 1), 'before versions'),
       array['Case Type', 'Search Query', 'What It Tests', 'Expected Result']
 where not exists (select 1 from search_report_version where version = 1);

alter table search_report_import
  add column if not exists version integer not null default 1 references search_report_version (version),
  -- Sheet columns with no column of their own ("Priority", "Notes"…), kept for the export.
  add column if not exists extra jsonb not null default '{}';
alter table search_report
  add column if not exists version integer not null default 1 references search_report_version (version);

-- A sheet row is one test case: "Birthday" and "BIRTHDAY" stay two rows (keyed by the exact query text),
-- while the report captures their shared normalized query once per version and phase.
drop index if exists search_report_import_query_group_key;
create unique index if not exists search_report_import_version_row_key
  on search_report_import (version, case_type, occasion, query);
create index if not exists search_report_import_version_idx
  on search_report_import (version, normalized_query);

drop index if exists search_report_normalized_phase_key;
create unique index if not exists search_report_version_phase_key
  on search_report (normalized_query, version, phase);
create index if not exists search_report_version_idx
  on search_report (version, phase);
