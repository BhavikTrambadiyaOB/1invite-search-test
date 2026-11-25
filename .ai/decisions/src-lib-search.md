---
paths:
  - src/lib/search/**
  - src/components/search/**
  - src/app/search/**
---

# Src Lib Search decisions

## 2026-11-25 · Negated parts are left out of search ("no photo", "non pro", "without rsvp")
- **Why:** Testers: "birthday without rsvp" still showed RSVP cards, and the user asked that without / no / not filter out what follows for every such query. Checking the test sheet showed several were read backwards: "no photo" and "without photo" asked for a photo, "non pro" and "without pro" ranked PRO first, "not twins" asked for joint cards. In Gujarati and Hindi "no" means "of" ("mara bhai no birthday"), so a blanket rule was ruled out.
- **What:** negation.ts reads without, with out, w/o, no, not, non, except, excluding, avoid, minus, skip, dont want (plus "rsvp free / rsvpless") followed by one understood thing, and removes those words before the query is read. Hidden: photo (not has_photo), PRO or free (when Free / PRO filtering is on), RSVP line (prints_rsvp), theme, element and color tags. Ranked lower only: joint card, printed age ("no year"), style ("not so simple"). An occasion, card word or card wording after it ("bhai no birthday", "no card", "no gifts", "no host") leaves the query unchanged. The intent carries exclude, report tags show dashed "No photo" chips, and Explain numbers counts without the hidden cards and lists them as left out. Replaces the 2026-11-18 card_text no-RSVP rule. Snapshot: only "birthday without rsvp" (2988→577, all without RSVP) and "birthday which is not in pro" (0→235 direct, all free) changed; the reports were logged again.
- **Files:** `src/lib/search/negation.ts`, `src/lib/search/search-templates.ts`, `src/lib/search/failed-query-checks.ts`, `src/lib/search/query-tags.ts`, `src/lib/search/types.ts`, `src/lib/search/taxonomy.ts`, `src/components/search/count-explanation.tsx`, `src/components/search/report-query-tags.tsx`

## 2026-11-25 · Seniors audience: old lady, old men, senior citizen rank 60+ birthdays first
- **Why:** Tester feedback: "old lady birthday party" and "senior citizen birthday party" showed cards with no age or kids cards. The user asked that it work for men and women and other words too (old men, old gentlemen, old brother), not only lady.
- **What:** New query audience Seniors (ages 60–110), read from old/elderly/aged/senior/retired plus a person word (lady, men, gentlemen, brother, mother…), senior citizen, elderly, old age, retiree, grandma/grandpa/granny/nani/dadi. Like Toddlers it only ranks: 60th–100th birthdays first, and the gender word still sets the gender. "old" or "senior" alone, older brother, elder sister and old friends are not read (5 years old, old school, senior prom). Seniors counts as adult for the Men/Women chips. Snapshot: only the target queries changed (old lady 1265→48 direct, grandpa 608→13, top 10 all 60+).
- **Files:** `src/lib/search/taxonomy.ts`, `src/lib/search/suggest-tags.ts`

## 2026-11-24 · Failed queries: case type filter
- **Why:** User wants to check failed and passed report queries by test-sheet case type, as on the Search report page.
- **What:** Each failed-query row gets the case types of its query from search_report_import (same version as its report, matched by normalized query) and shows them under the query; a Case type filter lists the chosen version types (all versions when none). Also fixed a duplicate React key when a theme and an element share an id (rainbow).
- **Files:** `src/lib/search/failed-queries.ts`, `src/lib/search/failed-query-filters.ts`, `src/app/search/insights/page.tsx`

## 2026-11-24 · Failed queries page lists passed searches as No gap
- **Why:** User wants to check every report query on the page, not only the failed ones (v3 phase 2: 846 searches, 332 failed).
- **What:** getFailedQueries({ includePassed }) also returns searches with no failed visit, gap type no_gap (green "No gap" badge, Explain numbers says why it passed). The page lists them by default; a Gap filter picks All, Failed only, No gap, Content gap, Search gap or Not chosen. The daily report still saves failed searches only.
- **Files:** `src/lib/search/failed-queries.ts`, `src/lib/search/failed-query-filters.ts`, `src/app/search/insights/page.tsx`, `src/components/search/count-explanation.tsx`

## 2026-11-23 · Failed queries from report runs; new filters
- **Why:** User wants every failed query of a search report run (version / phase) on the Failed queries page, with the report filters, more sorts and a number condition; the date range, gap and minimum-visit filters were removed on request.
- **What:** search_log.report_id (migration 018) links a log row to its report; saveSearchReport logs the current search of every capture, and npm run search:report:log -- --version=N [--phase=N] [--again] backfills older reports (v1, v2, v3 p1 and p2 logged with todays search, cached readings, no AI calls). Report searches are judged on results only (no click is skipped). Page filters: search query, version (all / search page only / vN report), phase, sort (latest first default, oldest, priority, visits, fewest direct, most/fewest templates, lowest relevance, A-Z) and one condition column op number (=, >, <, >=, <=). Rows link to their report; the Why column keeps only Explain numbers, whose modal now holds the reasons and the collection direction. The daily failed-query report covers search-page searches only.
- **Files:** `db/migrations/018_search_log_report.sql`, `src/lib/search/report-search-log.ts`, `src/lib/search/report.ts`, `scripts/log-report-searches.ts`, `src/lib/search/failed-queries.ts`, `src/lib/search/failed-query-filters.ts`, `src/app/search/insights/page.tsx`, `src/components/search/count-explanation.tsx`

## 2026-11-23 · Failed queries: Not chosen, recount by tags, missing-tag hints
- **Why:** User review of Failed queries: "holy cow im one birthday" (5 exact, 100% relevance) and the Cocomelon toddler search (0 exact because "toddler" is not printed on cards, though the toddlers audience covers it) were labelled content gaps. Search logic is approved and must not change, so only the report was improved.
- **What:** Report only, search unchanged. 1) Exact-match reasons use the larger of the logged exact count and a recount where typed words covered by an understood tag (audience, theme, element, occasion, color, style, format; not gender) count through the tag; when only that wording is missing the visit gets the note "Typed words not on cards", not "No exact match". 2) New gap type not_chosen: understood, failed only by no click / bounce / searching again, with a strong best match. 3) Amber hint when cards name an asked theme or element but lack its tag (name only, broad themes skipped).
- **Files:** `src/lib/search/failed-queries.ts`, `src/lib/search/failed-query-checks.ts`, `src/app/search/insights/page.tsx`

## 2026-11-20 · Reviewed gender applied to birthday templates
- **Why:** The AI gender check plus a person review of all 1,604 neutral birthday cards (/search/gender-review) found 278 girl and 205 boy cards wrongly tagged neutral, so girl/boy searches missed them.
- **What:** template_search.gender now uses final_gender from template_gender_review (applied_at set; current_gender keeps the old value as backup). Enrichment saves keep an applied reviewed gender instead of the tagger value. Embeddings of the 483 changed cards are stale until search:embed runs.
- **Files:** `src/lib/search/enrichment-store.ts`, `db/migrations/016_template_gender_review.sql`

## 2026-11-20 · Asked shade counts as much as a first color tag
- **Why:** Retest of approved v3 phase 1 queries: after the first color tag became worth 2 points, "birthday mauve" put plain purple-first cards above cards with the mauve shade (approved order dropped to 13/24).
- **What:** A match on the asked shade ("mauve", "sky blue", "fuchsia") now counts RANKING.mainColorTags points, the same as the color being first. Mauve back to 19/24 of the approved order; fuchsia, hot pink and sky blue unchanged.
- **Files:** `src/lib/search/search-templates.ts`

## 2026-11-20 · Tag chip fixes from tester tags reasons
- **Why:** Testers added a tags reason on 41 v3 phase 1 reports: kids tags for a 47th, Girl without Boy, Boy/Girl on a 35th or 60th, one or two chips for small searches (coraline, voucher, ticket), no style chips, Quinceañera/Crown/Dress on "birthday reminder", "4 pics of baby" with no photo, and "thank you" ignored in "birthday thank you invitation".
- **What:** Chips fall back to the first 40 results also when no card has every asked detail; separate kinds never decide birthday chips; Boy/Girl as a pair (partner needs 2 cards) and Men/Women from age 18 or "adult"; minCountSmall 3 when 40 results or fewer; one slot for the best style; resolve-intent keeps the rules photo and second occasion when the AI left them out. Result order of 50 approved queries unchanged beyond the earlier intended changes.
- **Files:** `src/lib/search/suggest-tags.ts`, `src/lib/search/search-templates.ts`, `src/lib/search/ranking.ts`, `src/lib/search/resolve-intent.ts`

## 2026-11-20 · Nine ranking fixes from v3 phase 1 Major feedback
- **Why:** Tester Major feedback on v3 phase 1: red-with-some-black cards among black results, debutante balls for "maroon birthday", 5th/6th tags and 4th-10th cards for "toddler", 70th/80th and 80th/100th cards mixed, birthdays with no age before nearby ages for "free debutante", farm cards before the sheep card and Eid/Passover cards for "shawn the sheep, party, kids", and every 11th birthday before trampoline cards for "eleventh birthday at jump place".
- **What:** 1) Main color: first color tag 2 points, second 1. 2) RANKING.separateKinds (quinceanera, debut) rank after other cards of a plain birthday unless their age is asked. 3) Tag chips fall back to the first 40 results (RANKING.suggestions.focusFallback), not the whole tier. 4) Equally far ages stay together, younger first (age_tie). 5) "toddler" is an audience of ages 1-3. 6) An implied age ranks other birthdays nearest first, then no age (the tier still puts the occasion first). 7) An asked element in a card first two element tags ranks first (RANKING.mainElementTags). 8) The rules kids birthday (and its confidence) wins over a themed_party/birthday/none AI reading. 9) New trampoline element ("jump place", "jump party", "bounce house"…); a rules element is added to the AI reading only when the AI kept its exact name as a keyword ("gift card" is not a gift). Also: the parent-occasion check is built lazily (an unused parameter broke weak kids occasions). Checked on 50 approved v3 phase 1 queries: unchanged except the intended ones.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/ranking.ts`, `src/lib/search/taxonomy.ts`, `src/lib/search/parse-query.ts`, `src/lib/search/resolve-intent.ts`

## 2026-11-19 · Tags feedback reason shown directly in the report table
- **Why:** User asked to see the tag feedback reason straight in the report list instead of opening the feedback dialog per row.
- **What:** The report table has a Tags reason column (desktop) and a Tags line in the mobile card showing the current version notes (currentTagsReason), with an em dash when empty.
- **Files:** `src/components/search/report-table.tsx`

## 2026-11-19 · Typed "free" ranks free first instead of hiding PRO
- **Why:** User: for "aqiqa invitation free, child" only the 18 free aqiqa cards showed and the relevant PRO aqiqa cards were hidden; show the PRO ones after the free ones run out. Testers had also expected PRO matches for "birthday gorl pink free".
- **What:** With SEARCH_PRICE_FILTER_ENABLED on, "free" (or "pro"/"premium") in a query is a ranking step (price_match) after the occasion, subject, design and main color, before the age: matching cards first, then the others. The sidebar Free / PRO option is still a hard filter. With the setting off, nothing changes.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/features.ts`, `.env.example`, `src/components/search/how-it-works/explainer.tsx`

## 2026-11-19 · Optional tags reason in report feedback (current version only)
- **Why:** Testers need to note problems with the current version's suggested tags, but often the tags are fine and there is nothing to add.
- **What:** The feedback form has an optional "Suggested tags reason" in the Current version part only (not Live). Empty is saved as null (search_report_feedback.current_tags_reason, migration 015). It shows as "Tags:" in the feedback summary and as a "V2 Tags reason" column in the CSV export.
- **Files:** `db/migrations/015_search_report_tags_reason.sql`, `src/components/search/report-feedback-dialog.tsx`, `src/components/search/report-feedback-summary.tsx`, `src/lib/search/report.ts`, `src/lib/search/report-export.ts`, `src/app/api/search/report/feedback/route.ts`

## 2026-11-18 · Without RSVP ranks cards with no reply line first
- **Why:** Tester basic issue 5: "birthday without rsvp" should show cards without RSVP first, but AI read "no rsvp" as a keyword, so cards that print RSVP ranked first (24 of the top 24).
- **What:** NO_RSVP_QUERY ("without/no rsvp", "rsvp free") adds a detail: card text present with no RSVP_CARD_TEXT line; the words without/no/rsvp are dropped from text matching. With an occasion it ranks, without one it filters. The browse branch now references the query vector so a query with nothing left to score cannot fail on an untyped parameter.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/taxonomy.ts`, `src/components/search/how-it-works/explainer.tsx`

## 2026-11-18 · Generic themes are not the subject
- **Why:** After subject-first ranking, "happy birthday sky blue, celebration, decor" put teal and purple cards tagged "celebration" above the sky blue ones (tester color issue 9); the word "celebration" is on 5,728 cards (51%).
- **What:** Themes in RANKING.broadThemes (celebration) still count as design but not as the asked subject, so they never outrank an asked color. Other themes are unchanged.
- **Files:** `src/lib/search/ranking.ts`, `src/lib/search/search-templates.ts`

## 2026-11-18 · Asked theme or element ranks before the rest of the design
- **Why:** v3 phase 1, "Make a colorful dinosaur-themed birthday invitation for a 3-year-old boy": Toy Story 3rd (Rex is tagged as a dinosaur element) was #1, and 36 colorful 3rd birthdays without a dinosaur ranked above dinosaur 4th/2nd cards, because every design detail counted the same and "colorful" could stand in for the dinosaur. User: theme, style and element come first; the milestone is editable and should only order cards within the same design.
- **What:** Inside the design rung, the asked themes and elements (subject_hits, elements still count double) rank first, then cards tagged with them (subject_tags) before cards that only mention them, then the rest of the design (colors, styles, photo, audience, joint), then main color, then age. Queries without a theme or element are unchanged.
- **Files:** `src/lib/search/search-templates.ts`, `src/components/search/how-it-works/explainer.tsx`

## 2026-11-18 · Browse list when nothing is understood or found
- **Why:** v2 phase 1: 24 Empty/Unrelated/Invalid queries (asdfghjkl, null, [NBSP], OR 1=1 --) showed an empty page while live showed templates; the user asked for a template list on random queries, but an understood or filtered search that finds nothing should stay empty.
- **What:** When a typed query returns 0, nothing in it was understood (no occasion, age, design, type, format, language or audience) and no sidebar filter is picked, search returns the browse list with fallback: not_understood. The page shows a notice above it and logs the search as 0 results; report snapshots keep the flag.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/parse-query.ts`, `src/app/search/page.tsx`, `src/lib/search/report.ts`, `src/components/search/report-grid.tsx`

## 2026-11-17 · Gender from a design word is part of the design
- **Why:** Feedback: "cowgirl invitations for 13 year olds" showed a neutral Western Cowboy card at #3, because gender was only a late tie-break and that card was closer in age.
- **What:** When the gender comes from a design word (cowgirl, cowboy, princess, prince, ballerina, queen, king) it counts in the design rung; from event words (quinceanera, bride, groom) it stays a tie-break.
- **Files:** `src/lib/search/search-templates.ts`

## 2026-11-17 · Occasions imply their age; debut is an 18th
- **Why:** Feedback: 21st debut cards showed among 18th ones; testers expect 18th birthday cards after the debut cards ("debut" was only a learned occasion and "debutante" an element).
- **What:** Debut is a built-in Birthday occasion (debut, debutante, debutante ball). With no age typed, OCCASION_AGES applies (debut 18, quinceanera 15, sweet 16, first birthday 1): that age first, then no age, then other ages; a card of the occasion with another age ranks after parent-occasion cards with the right age (debut 18 -> no-age debut -> 18th birthdays -> 21st debut).
- **Files:** `src/lib/search/taxonomy.ts`, `src/lib/search/search-templates.ts`

## 2026-11-17 · Save the date for another occasion, kids words
- **Why:** Feedback: "save the date kid birthday" showed wedding save-the-dates although 24 birthday ones exist; "joint kids party" mixed in adult cards.
- **What:** "save the date" next to another (non-wedding) occasion becomes that occasion with card type save-the-date. "kid/kids/child/children/toddler" with "birthday" or "party" reads as Kids Birthday. Joint words count as understood, so these queries no longer need AI.
- **Files:** `src/lib/search/parse-query.ts`, `src/lib/search/taxonomy.ts`

## 2026-11-17 · Main color and shades rank first
- **Why:** Color feedback: cards where the color is a small detail ("brown" boots on a light blue card) were called "not brown"; "fuchsia", "sky blue" and "mauve" matched the whole color family. Tag order proved to show prominence (97% of name-stated colors are in the first two tags).
- **What:** Inside the design rung, a card scores one point per asked color in its first two color tags (RANKING.mainColorTags) and per asked shade in color_shades (COLOR_SHADES). It only orders cards; result counts and queries without a color are unchanged. "fucsia" and "rosegold" are known spellings.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/taxonomy.ts`, `src/lib/search/ranking.ts`

## 2026-11-17 · Free / PRO filter behind a setting
- **Why:** Product: Free / PRO filtering is not offered yet; "free" in a query showed only free templates and hid good PRO matches.
- **What:** SEARCH_PRICE_FILTER_ENABLED (default off). Off: "free"/"pro" in a query change nothing and the sidebar has no Free / PRO option. On: both work as filters.
- **Files:** `src/lib/search/features.ts`, `src/lib/search/search-templates.ts`, `src/components/search/filter-sidebar.tsx`, `src/app/search/page.tsx`, `.env.example`

## 2026-11-16 · Query reading fixes from tester feedback
- **Why:** v2 phase 1 feedback: "birthday reminder" showed horoscope cards, "birthday card" showed invitations, "cowgirl for 13 year olds" lost its occasion, a date and times in "birthday 47 november 21 5:00" polluted matching, aqiqa spellings missed.
- **What:** "reminder" means a save-the-date; "card" with a birthday means greeting cards first (not with "invitation"); an age with "year old"/"turning" and no event is a birthday; dates and times are removed before word matching; aqiqa/aqiqah spellings and "15 anos" are known.
- **Files:** `src/lib/search/taxonomy.ts`, `src/lib/search/parse-query.ts`, `src/lib/search/text.ts`

## 2026-11-16 · Adult and teen age ranges, joint cards, zodiac last
- **Why:** v2 phase 1 feedback: 70th-100th cards in adult searches, 20th-30th in teen searches, joint kids cards buried, zodiac cards in "my birthday".
- **What:** "adult" ranks ages 18-64 (or audience adults) first, "teen" 13-19; "joint"/"twins"/"triple" rank cards for two or more people first; zodiac cards go after equal matches unless asked.
- **Files:** `src/lib/search/taxonomy.ts`, `src/lib/search/parse-query.ts`, `src/lib/search/search-templates.ts`

## 2026-11-16 · Design ranks before the printed age
- **Why:** Tester rule: for "red 9th birthday" show red 9th cards, then red cards, then other 9th cards; a printed age is text the user can edit, the design is not.
- **What:** Themes, elements, clear styles, colors, photo, other occasions, audience and joint now form the design rung above milestone; broad styles (elegant, modern, typography...) rank after the age.
- **Files:** `src/lib/search/search-templates.ts`, `src/lib/search/ranking.ts`
