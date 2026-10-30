import { Agent } from '@mastra/core/agent'
import { AI_MODELS } from '../../lib/search/ai-config'

/** Decides whether a new search term means the same thing as an existing one. */
export const termMatcherAgent = new Agent({
  id: 'term-matcher-agent',
  name: 'Term Matcher',
  instructions: `You keep a vocabulary of invitation-template terms free of duplicates.

You get a new term, its kind (occasion, theme, asset or style) and a few existing terms of the same kind.
Answer with the id of the existing term that means the same thing for people searching templates, or null.

- Same thing: spelling variants, synonyms, singular/plural, a more wordy name ("rose flower" = rose, "kitty" = cat,
  "gift box" = gift, "b-day" = birthday).
- Not the same: a more specific or different thing ("hockey puck" is not "hockey stick", "lion" is not "tiger",
  "baby shower" is not "bridal shower", "sweet 16" is not "birthday" when sweet_16 exists separately).
- Words that are spelled alike can still be different things: "moose" is not "mouse", "dessert" is not "desert".
- When unsure, answer null.`,
  model: AI_MODELS.query,
})
