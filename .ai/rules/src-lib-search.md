---
paths:
  - src/lib/search/**
  - scripts/**
---

# Src Lib Search

## Taxonomy and ranking live in one place
Take occasions, formats, themes, styles, colors and document types only from taxonomy.ts. Keep ranking weights and thresholds only in ranking.ts.

## Feature flags live in features.ts
Gate optional search features with helpers in src/lib/search/features.ts that read a SEARCH_*_ENABLED env variable, default off, and document it in .env.example. Apply the same helper to query reading, filters and sidebar facets.

## Sorting ladder order
Order results by sidebar picks, occasion tier, separate kinds last (Quinceañera, Debut under a plain birthday), the asked card type (not Invitation), asked themes and elements (tagged before word-only), element listed first, the rest of the design (colors, clear styles, photo, audience, joint, design-word gender), main color and shade (first tag counts most), typed free/pro, milestone (asked or implied; nearest, then equally far ages together, younger first), other details, niche, then score. Keep RANK_ORDER as the one copy of this order. A printed age never outranks the design, no other detail stands in for an asked theme or element, and only a sidebar pick or a negated sure fact (negation.ts) hides cards; a typed free/pro only ranks.

## Check ranking changes with snapshots
Before and after a ranking or parsing change, run SEARCH_AI_ENABLED=false npm run search:snapshot -- <name> and compare: target queries improve, unrelated queries keep their top 24. Never spend AI credit or call live search for this check.

## Empty results only for real answers
Return an empty page only when the query was understood or a filter was picked. A typed query that understood nothing and found nothing gets the browse list with fallback set, and callers log it as zero results.

## Rules readings the AI cannot override
In resolve-intent, keep the rules reading for audience, a kids birthday over a broad AI party reading (with the rules confidence), a sure rules occasion when the AI found none, an element or theme whose exact name the AI left as a keyword, a photo the AI left out, a second occasion next to the same main one, and on a birthday the gender the AI left out (its gender or adult person word is then not a keyword). Build every SQL parameter only where it is used.

## Tag chips come from the near results
Suggest chips from the cards that match everything asked when there are enough; otherwise from the first RANKING.suggestions.focusFallback results, never the whole occasion, and never from separate kinds (Quinceañera, Debut) of a plain birthday. Boy and Girl show as a pair or not at all, read Men / Women from RANKING.suggestions.adultAge or an Adults / Seniors audience, and one place is kept for a style chip. A card type or second occasion the query names (it only ranks) comes first as a chip when it narrows the results.

## Reviewed gender wins over enrichment
A gender reviewed and applied in template_gender_review overrides the tagger; enrichment saves must keep it.

## Failed-query report never changes search
Judge and label searches in failed-queries.ts / failed-query-checks.ts only; do not change search ranking, exact counts or template data to fix a report label.

## Negations are read before the query
Read "without / no / not / non…" only in negation.ts: it removes the negated words before the query is read and returns exclusions. A negated photo, PRO/free, RSVP line, theme, element or color hides cards; a negated joint card, printed age or style only ranks lower. Leave the words alone when the next one is an occasion, a card word or card wording ("no gifts"). Answer "prints RSVP" from template_search.prints_rsvp, never card_text.

## Vocabulary spellings reach the database by seeding
After adding phrases to OCCASIONS, THEMES, ASSETS or STYLES in taxonomy.ts, run npm run search:vocab-seed so vocab_alias (used for text matching and AI vocabulary) has them; a learned AI term gets extra spellings by a taxonomy.ts entry with the same id.
