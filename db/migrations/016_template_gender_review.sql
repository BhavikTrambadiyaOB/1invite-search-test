-- AI gender check of neutral birthday cards, kept apart from template_search until reviewed.
-- template_search is changed only after the answers are checked and approved; current_gender keeps the value
-- the card had when it was checked, so any change can be undone.
create table if not exists template_gender_review (
  template_id     integer primary key,
  name            text not null,
  occasion        text,
  current_gender  text,
  ai_gender       text not null check (ai_gender in ('girl', 'boy', 'neutral')),
  confidence      real not null,
  reason          text not null default '',
  preview_url     text,
  model           text not null,
  -- pending until a person decides (see 017: reviewed rows are applied to template_search later).
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  checked_at      timestamptz not null default now(),
  applied_at      timestamptz
);

create index if not exists template_gender_review_answer on template_gender_review (ai_gender, confidence desc);
