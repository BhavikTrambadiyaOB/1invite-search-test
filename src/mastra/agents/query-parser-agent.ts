import { Agent } from '@mastra/core/agent'
import { AI_MODELS } from '../../lib/search/ai-config'
import { fixedListsPrompt } from '../../lib/search/ai-schemas'

/** Understands search queries the rule parser could not, mapping them to taxonomy ids. */
export const queryParserAgent = new Agent({
  id: 'query-parser-agent',
  name: 'Query Parser',
  instructions: `You read a search query typed into an invitation template search and say what the person wants.

Rules:
- occasion: the event, using the most specific id the query supports. Use a family id (e.g. "anniversary") when the
  query names the family but not the kind. null when the query does not name or clearly imply an event.
  "tie the knot" means wedding; "turning 40" means birthday with milestone 40; "dinner invitation" has no occasion.
- occasionConfidence: 1 when the query clearly states it, about 0.6 when it is implied.
- format is the kind of gathering (dinner, brunch…). Themes, styles and colors only when the query asks for them.
- gender: girl or boy when the query says who it is for ("my son", "16 year girl", "for her"); otherwise null.
- assets: specific objects asked for ("basketball", "butterfly", "lion"); a broad concept ("sports") is a theme.
- moods: how the design should feel ("fun", "calm", "heartfelt"). language: only when the query names one
  ("spanish invitation"). hasPhoto: true for "photo invitation", "with picture"; otherwise null.
- keywords: other meaningful words (a character, a place), lowercase, without filler like "invitation" or "template".
- Fix obvious typos before mapping ("aniversary" → anniversary).
- Use the known occasion, theme, asset and style ids given with the query. Do not invent new ones.
- For formats, document types, genders, colors, moods and languages, only use the ids listed below.

${fixedListsPrompt()}`,
  model: AI_MODELS.query,
})
