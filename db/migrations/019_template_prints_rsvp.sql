-- True when the printed card has a reply line ("RSVP to Sue", "Reply by June 1"). card_text drops contact lines
-- (phone numbers, addresses), which usually carry the RSVP word too, so it cannot answer "without rsvp".
-- Filled from every text layer at sync (and once by npm run search:fill-rsvp).
alter table template_search add column if not exists prints_rsvp boolean not null default false;
