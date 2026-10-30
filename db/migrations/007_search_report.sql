-- Side-by-side search quality report: stored live/current result snapshots and reviewer feedback.
-- The report renders from the stored JSON, so the page does not call either search while viewing.

create table if not exists search_report (
  id                bigserial primary key,
  query             text not null,
  normalized_query  text not null unique,
  live_snapshot     jsonb,
  current_snapshot  jsonb,
  live_error        text,
  current_error     text,
  live_total        integer,
  current_total     integer,
  live_count        integer not null default 0,
  current_count     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists search_report_updated_idx on search_report (updated_at desc);

create table if not exists search_report_feedback (
  report_id            bigint primary key references search_report (id) on delete cascade,
  live_result          text check (live_result in ('success', 'partial', 'failed')),
  live_freshness_issue boolean,
  live_reason          text not null default '',
  current_result       text check (current_result in ('success', 'partial', 'failed')),
  current_freshness_issue boolean,
  current_reason       text not null default '',
  updated_at           timestamptz not null default now()
);
