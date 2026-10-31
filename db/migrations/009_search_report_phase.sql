-- Existing search report snapshots belong to the initial report phase.
alter table search_report
  add column if not exists phase integer not null default 1;
