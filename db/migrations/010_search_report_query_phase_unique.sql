-- Keep a separate immutable report row for each query in each search phase.
alter table search_report
  drop constraint if exists search_report_normalized_query_key;

create unique index if not exists search_report_normalized_phase_key
  on search_report (normalized_query, phase);
