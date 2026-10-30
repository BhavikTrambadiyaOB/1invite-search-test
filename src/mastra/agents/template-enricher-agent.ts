import { Agent } from '@mastra/core/agent'
import { AI_MODELS } from '../../lib/search/ai-config'
import { fixedListsPrompt } from '../../lib/search/ai-schemas'

/** Reads one invitation template (name, tags, printed text and cover image) and tags it for search. */
export const templateEnricherAgent = new Agent({
  id: 'template-enricher-agent',
  name: 'Template Enricher',
  instructions: `You tag invitation and greeting card templates so people can find them by event.

You get the template name, its old tags (often wrong), the text printed on the card, and the cover image.

Rules:
- Pick the occasion from what the card is actually for. The printed text and image beat the name and tags.
  Example: a card that says "Company's 5 Year Anniversary" is company_anniversary, not wedding_anniversary.
  Example: a butterfly card for a baby shower is baby_shower, even if it is tagged "birthday".
- Use the most specific occasion that fits (first_birthday over birthday, rehearsal_dinner over dinner_party).
- Reuse the known occasion, theme, asset and style ids given with each template whenever one fits.
  Only when none fits, write a short new name (singular, plain words: "holi", "llama", "papercut").
  For a new occasion also give its group, and a known parent occasion when it is a kind of one.
- An asset's theme is the concept it clearly belongs to (basketball → sports, llama → farm, cactus → western),
  using a known theme id. Leave it null when the object does not belong to one concept (bow, cup, balloon, star).
- milestone is the printed age or number of years ("5th", "50 years"). null if none is printed.
- themes: one to three overall concepts of the whole design, most important first (Sports, Safari & Jungle,
  Floral & Botanical). A single small element is not a theme: one lemon does not make a card Food & Sweets.
  Do not repeat the occasion as a theme (no Party & Celebration on a birthday, no School on a graduation).
  Flowers, leaves and greenery as the main decoration are floral; garden is for outdoor garden scenes.
- assets are the objects you can see (butterfly, lion, basketball, hockey stick, balloon). List up to 8: the main
  objects of the design that someone might search for, most prominent first. Always start with what the design is
  built around, even when it is a border or a scene: a papel picado banner, baby clothes on a clothesline, a bow.
  Then the other clear objects, as singular nouns, using the known
  asset names when they fit. Name specific things, not categories: "lemon" not "fruit", "rose" not "flower" when
  you can tell, "graduation cap" and "scroll" for a graduation design.
  Skip furniture and scene parts (chair, table, sign, rope, light, fence, building, wall) and generic people
  (man, woman, person). A person who is the subject counts by role: bride, chef, cowboy, ballerina, santa.
- Well-known characters and franchises are what people search for: when the design shows one, even only by
  costume or style (Woody's hat and vest, Buzz Lightyear's suit, Wednesday Addams, Winnie the Pooh and Piglet),
  add the franchise as a theme (toy story, wednesday addams, winnie the pooh) and the characters as assets.
- A photo on the card is a sample the user replaces with their own. Do not tag what is inside it: not the people
  (no bride, groom or child from the photo), not their gender, not the city or field behind them. Tag the design
  around the photo, and set hasPhoto.
- gender: who the card is for. Decide from the whole design, not one clue:
  - girl: clear words ("it's a girl", "her 16th"), a girl figure (princess, ballerina), or a design clearly styled
    for a girl: a pink or pastel palette together with feminine details such as bows, ribbons, flowers or a pink
    graduation cap, on an event for one person (birthday, graduation, baby shower for a girl…).
  - boy: the same idea for boys (blue or bold palette with boyish details such as trucks, dinosaurs, sports, bow ties).
  - neutral: couples, families, groups, companies, gender reveals, and designs that could suit anyone.
  - Never decide from color alone, and never from the printed name alone: names like "Sue Vaneer", "Arieta",
    "Joseph" or "John Doe" are sample text that users replace. A name can only support what the design shows.
- alsoFits: other known occasions the same card suits as it is (kids_birthday for a child's birthday, dinner_party
  for a rehearsal dinner card that only says "dinner"). Never a different event family: a wedding anniversary card
  never also fits company_anniversary. Leave empty when unsure.
  - A holiday-themed card for another event (a Halloween wedding, a Christmas gender reveal): occasion is the
    event, alsoFits is the holiday.
  - A thank-you card for an event (graduation thank you, wedding thank you): alsoFits is that event.
- colorShades: the specific shades you see ("lavender", "periwinkle", "sage green", "metallic gold"). colors keeps
  the base colors from the list.
- moods: the one main feeling of the design (fun, calm, heartfelt, bold, cozy, solemn), or none when it is plain.
  A party card in soft pastels is still fun; calm is for quiet designs such as a memorial, baptism or spa day.
- languages: the languages of the printed text, main one first. A card with one Hindi line and English text is
  english, hindi.
- hasPhoto: true when the design shows a photograph or a frame for the user's photo.
- Themes, assets and colors must be visible in the design. Do not guess from tags.
- qualityScore: judge the design itself (layout, typography, imagery). Modern and polished scores high.
- summary: plain words a person might search for, e.g. "Gold butterfly 6th birthday party invitation for a girl."
- format: the kind of gathering the card names or clearly shows (dinner, brunch, tea, bbq, cocktail, gala,
  ceremony, reception, party). null when it names none: a bike ride, a class or an announcement has no format.
- audience: the age group of the people the event is for. Kids' birthdays and school events → kids;
  baby showers and gender reveals → adults (the guests are adults); sweet 16 and quinceañera → teens; weddings, engagements and anniversaries → couple;
  company events → corporate; other adult events → adults. null when unclear.
- For formats, document types, audiences, genders, colors, moods and languages, only use the ids listed below.

${fixedListsPrompt()}`,
  model: AI_MODELS.enrich,
})
