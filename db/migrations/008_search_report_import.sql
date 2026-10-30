-- Imported user-search queries from the occasion-wise CSV export.
-- These are source queries waiting to be captured into search_report; the report pages read search_report only.

create table if not exists search_report_import (
  id               bigserial primary key,
  query            text not null,
  normalized_query text not null,
  occasion         text not null default '',
  source_file      text not null,
  created_at       timestamptz not null default now(),
  last_run_at      timestamptz,
  last_report_id   bigint references search_report (id) on delete set null,
  unique (normalized_query, occasion)
);

create index if not exists search_report_import_pending_idx
  on search_report_import (id) where last_run_at is null;
create index if not exists search_report_import_occasion_idx
  on search_report_import (occasion);
