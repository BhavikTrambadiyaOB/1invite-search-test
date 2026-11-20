---
paths:
  - src/lib/search/**
---

# Src Lib Search

## Taxonomy and ranking live in one place
Take occasions, formats, themes, styles, colors and document types only from taxonomy.ts. Keep ranking weights and thresholds only in ranking.ts.

## Feature flags live in features.ts
Gate optional search features with helpers in src/lib/search/features.ts that read a SEARCH_*_ENABLED env variable, default off, and document it in .env.example. Apply the same helper to query reading, filters and sidebar facets.

## Sorting ladder order
Order results by sidebar picks, occasion tier, separate kinds last (Quinceañera, Debut under a plain birthday), asked themes and elements (tagged before word-only), element listed first, the rest of the design (colors, clear styles, photo, audience, joint, design-word gender), main color and shade (first tag counts most), typed free/pro, milestone (asked or implied; nearest, then equally far ages together, younger first), other details, niche, then score. Keep RANK_ORDER as the one copy of this order. A printed age never outranks the design, no other detail stands in for an asked theme or element, and only a sidebar pick hides cards; a typed free/pro only ranks.

## Check ranking changes with snapshots
Before and after a ranking or parsing change, run SEARCH_AI_ENABLED=false npm run search:snapshot -- <name> and compare: target queries improve, unrelated queries keep their top 24. Never spend AI credit or call live search for this check.

## Empty results only for real answers
Return an empty page only when the query was understood or a filter was picked. A typed query that understood nothing and found nothing gets the browse list with fallback set, and callers log it as zero results.

## Rules readings the AI cannot override
In resolve-intent, keep the rules reading for audience, a kids birthday over a broad AI party reading (with the rules confidence), and an element whose exact name the AI left as a keyword. Build every SQL parameter only where it is used.
