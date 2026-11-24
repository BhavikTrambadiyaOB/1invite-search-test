-- A person's own answer for each AI gender check, set on the gender review page. ai_gender stays as the AI said;
-- final_gender is what was decided after looking at the card. Only reviewed rows are applied to template_search.
alter table template_gender_review add column if not exists final_gender text
  check (final_gender in ('girl', 'boy', 'neutral'));
alter table template_gender_review add column if not exists reviewed_at timestamptz;

-- pending until a person decides; reviewed once final_gender is set.
alter table template_gender_review drop constraint if exists template_gender_review_status_check;
update template_gender_review set status = 'pending' where status not in ('pending', 'reviewed');
alter table template_gender_review add constraint template_gender_review_status_check
  check (status in ('pending', 'reviewed'));
