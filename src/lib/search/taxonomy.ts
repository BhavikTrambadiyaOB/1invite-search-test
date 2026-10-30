/**
 * The single list of allowed search values. Template enrichment (rules and AI),
 * query parsing and the filters all use these ids.
 *
 * Phrases are matched against normalized text (lowercase, no accents, punctuation
 * turned into spaces, see `normalizeText`). Plural "s" is matched automatically.
 */

export type OccasionDef = {
  id: string
  label: string
  group: string
  /** A query for the parent also matches its children (e.g. birthday → first_birthday). */
  parent?: string
  /** Strong phrases: clearly name this occasion. */
  phrases: string[]
  /** Weak phrases: hint at it but are shared with other occasions. */
  weak?: string[]
  /** If any of these appear in the template name or card text, this occasion is ruled out. */
  blockers?: string[]
  /** At least one of these must appear in the template name or card text. */
  requires?: string[]
  /** Broad occasions (Dinner Party, Thank You…) lose ties to specific ones (Thanksgiving, Birthday…). */
  generic?: boolean
  /** Not assigned to templates; only used to search a family (e.g. "anniversary"). */
  abstract?: boolean
}

/** A birthday with one of these milestones is its own occasion (a 1st birthday is a First Birthday). */
export const MILESTONE_BIRTHDAYS: Record<number, string> = { 1: 'first_birthday', 16: 'sweet_16' }

/**
 * Words with one meaning in search, for wording the vocabulary has no term for. "wedding time line" also
 * finds a "Wedding Program": both are the order of the day. Not a card type, since "Business Opportunity
 * Program" or "Election Programme" use the same word for an event.
 */
export const KEYWORD_SYNONYMS: string[][] = [
  ['afterparty', 'after party', 'after-party'],
  ['timeline', 'time line', 'program', 'programme', 'itinerary', 'schedule', 'agenda', 'order of service', 'order of events', 'order of the day', 'run of show'],
]

/** Occasions that are for one age, so they do not fit a search for another age ("5th birthday" is no Quinceañera). */
export const OCCASION_AGES: Record<string, number> = { first_birthday: 1, sweet_16: 16, quinceanera: 15, debut: 18 }

export const OCCASION_GROUPS = [
  'Birthday',
  'Baby & Kids',
  'Wedding',
  'Anniversary',
  'Holidays',
  'Parties',
  'Religious & Cultural',
  'Milestones',
  'Business & Community',
  'Memorial',
  'Greetings',
] as const

// Words that mark an organisation (not a couple). Venue words such as church, hotel
// or community center are left out because they often appear on wedding anniversary cards.
const BUSINESS_WORDS = [
  'company', 'companys', 'business', 'corporate', 'corporation', 'firm', 'agency', 'brand',
  'enterprise', 'organization', 'organisation', 'llc', 'inc', 'ltd', 'employees', 'store', 'boutique',
  'salon', 'clinic', 'years in business', 'years of service', 'founding', 'founded', 'established since',
  'serving you', 'our customers', 'valued customers', 'clients', 'shop', 'shop name', 'business name',
  'brand name', 'store name', 'company name', 'your logo', 'logo', 'tagline', 'choir', 'congregation', 'ministry', 'pastor', 'pastoral', 'pastors',
]

export const OCCASIONS: OccasionDef[] = [
  // Birthday
  { id: 'birthday', label: 'Birthday', group: 'Birthday', phrases: ['birthday', 'bday', 'b day', 'cumpleanos', 'anniversaire de naissance', 'birthday bash'], weak: ['turning'] },
  { id: 'first_birthday', label: 'First Birthday', group: 'Birthday', parent: 'birthday', phrases: ['first birthday', '1st birthday', 'one year old', 'wild one', 'onederful', 'our little one is turning one', 'turning one', 'mi primer ano', 'primer cumpleanos'] },
  { id: 'kids_birthday', label: 'Kids Birthday', group: 'Birthday', parent: 'birthday', phrases: ['kids birthday', 'kid birthday', 'children birthday', 'childrens birthday', 'toddler birthday'] },
  { id: 'sweet_16', label: 'Sweet 16', group: 'Birthday', parent: 'birthday', phrases: ['sweet 16', 'sweet sixteen', '16th birthday', 'sixteenth birthday'] },
  { id: 'quinceanera', label: 'Quinceañera', group: 'Birthday', parent: 'birthday', phrases: ['quinceanera', 'quince anos', 'quince', 'xv anos', 'mis xv', 'mis quince'] },
  { id: 'surprise_party', generic: true, label: 'Surprise Party', group: 'Birthday', parent: 'birthday', phrases: ['surprise party', 'surprise birthday', 'shh its a surprise', 'its a surprise'] },

  // Baby & Kids
  { id: 'baby_shower', label: 'Baby Shower', group: 'Baby & Kids', phrases: ['baby shower', 'baby sprinkle', 'sip and see', 'sip see', 'oh baby', 'baby is on the way', 'baby on the way', 'ready to pop', 'bebe en camino', 'srimant', 'seemantham', 'simantham', 'godh bharai', 'dohale jevan'], weak: ['mom to be', 'mommy to be', 'little one is on the way'] },
  { id: 'gender_reveal', label: 'Gender Reveal', group: 'Baby & Kids', phrases: ['gender reveal', 'he or she', 'boy or girl', 'pink or blue', 'touchdowns or tutus', 'bows or bowties', 'guns or glitter', 'what will baby be'] },
  { id: 'birth_announcement', label: 'Birth Announcement', group: 'Baby & Kids', phrases: ['birth announcement', 'baby announcement', 'its a boy', 'its a girl', 'welcome baby', 'pregnancy announcement', 'were expecting', 'we are expecting', 'newborn'] },
  { id: 'naming_ceremony', label: 'Naming Ceremony', group: 'Baby & Kids', phrases: ['naming ceremony', 'name ceremony', 'namkaran', 'naamkaran', 'barsala', 'cradle ceremony', 'aqiqah'] },
  { id: 'baptism', label: 'Baptism & Christening', group: 'Religious & Cultural', phrases: ['baptism', 'baptismal', 'christening', 'bautizo', 'bautismo', 'dedication ceremony', 'baby dedication'] },
  { id: 'first_communion', label: 'First Communion', group: 'Religious & Cultural', phrases: ['first communion', 'holy communion', 'primera comunion'] },
  { id: 'confirmation', label: 'Confirmation', group: 'Religious & Cultural', phrases: ['confirmation', 'confirmacion', 'holy confirmation'] },
  { id: 'school_event', generic: true, label: 'School Event', group: 'Baby & Kids', phrases: ['100th day of school', 'back to school', 'school party', 'class party', 'field trip', 'school play', 'school fair', 'sunday school', 'vacation bible school', 'vbs', 'last day of school', 'first day of school', 'parent teacher'] },

  // Wedding
  { id: 'wedding', label: 'Wedding', group: 'Wedding', phrases: ['wedding', 'boda', 'mariage', 'nikah', 'shaadi', 'vivah', 'marriage ceremony', 'tie the knot', 'tying the knot', 'getting married', 'mr and mrs', 'bride and groom', 'together with their families', 'request the pleasure', 'request the honor', 'nikkah', 'nikah nama', 'nikkah nama', 'casamento'], blockers: ['anniversary', 'anniversaries', 'save the date', 'rehearsal', 'bridal shower', 'engagement'] },
  { id: 'save_the_date', label: 'Save the Date', group: 'Wedding', parent: 'wedding', phrases: ['save the date', 'save our date', 'reserva la fecha', 'save the day'] },
  { id: 'engagement', label: 'Engagement', group: 'Wedding', phrases: ['engagement', 'engaged', 'she said yes', 'he said yes', 'roka', 'ring ceremony', 'sagai', 'compromiso', 'put a ring on it'], blockers: ['anniversary', 'anniversaries'] },
  { id: 'bridal_shower', label: 'Bridal Shower', group: 'Wedding', phrases: ['bridal shower', 'bride to be', 'bridal brunch', 'bridal tea', 'miss to mrs', 'couples shower', 'wedding shower', 'bridal party', 'kitchen tea', 'lingerie shower'] },
  { id: 'bachelorette', label: 'Bachelorette & Bachelor', group: 'Wedding', phrases: ['bachelorette', 'bachelor party', 'hen party', 'hen do', 'stag party', 'stag do', 'last fling before the ring', 'final fiesta', 'despedida de soltera'] },
  { id: 'rehearsal_dinner', label: 'Rehearsal Dinner', group: 'Wedding', phrases: ['rehearsal dinner', 'wedding rehearsal', 'rehearsal'] },
  { id: 'wedding_reception', label: 'Wedding Reception', group: 'Wedding', parent: 'wedding', phrases: ['wedding reception', 'elopement party', 'wedding after party', 'wedding brunch', 'mehndi', 'mehendi', 'haldi', 'sangeet', 'walima', 'valima'] },

  // Anniversary
  { id: 'anniversary', label: 'Anniversary', group: 'Anniversary', abstract: true, phrases: ['anniversary', 'aniversario'] },
  { id: 'wedding_anniversary', label: 'Wedding Anniversary', group: 'Anniversary', parent: 'anniversary', phrases: ['wedding anniversary', 'marriage anniversary', 'anniversary of marriage', 'years of marriage', 'years of love', 'years together', 'happily married', 'vow renewal', 'renewal of vows', 'renew our vows', 'renewing their vows', 'golden anniversary', 'silver anniversary', 'ruby anniversary', 'pearl anniversary', 'diamond anniversary', 'aniversario de bodas', 'bodas de oro', 'bodas de plata'], weak: ['anniversary', 'anniversaries', 'aniversario', 'happy anniversary'], blockers: [...BUSINESS_WORDS, 'death', 'death anniversary', 'in loving memory', 'memorial'] },
  { id: 'engagement_anniversary', label: 'Engagement Anniversary', group: 'Anniversary', parent: 'anniversary', phrases: ['engagement anniversary', 'anniversary of our engagement', 'years since we got engaged', 'engagementversary'] },
  { id: 'company_anniversary', label: 'Company Anniversary', group: 'Anniversary', parent: 'anniversary', phrases: ['company anniversary', 'business anniversary', 'corporate anniversary', 'store anniversary', 'shop anniversary', 'work anniversary', 'years in business', 'years of service', 'years of excellence', 'founding anniversary', 'church anniversary', 'school anniversary', 'club anniversary', 'agency anniversary', 'clinic anniversary', 'restaurant anniversary', 'salon anniversary', 'studio anniversary', 'center anniversary'], weak: ['anniversary', 'anniversaries', 'aniversario'], requires: [...BUSINESS_WORDS, 'company anniversary', 'business anniversary', 'corporate anniversary', 'store anniversary', 'shop anniversary', 'work anniversary', 'church anniversary', 'school anniversary', 'club anniversary', 'agency anniversary', 'clinic anniversary', 'restaurant anniversary', 'salon anniversary', 'studio anniversary', 'center anniversary', 'years of excellence', 'founding anniversary'] },

  // Holidays
  { id: 'christmas', label: 'Christmas', group: 'Holidays', phrases: ['christmas', 'xmas', 'x mas', 'merry and bright', 'holly jolly', 'ugly sweater', 'santa', 'navidad', 'noel', 'feliz navidad', 'nativity'] },
  { id: 'holiday_party', generic: true, label: 'Holiday Party', group: 'Holidays', phrases: ['holiday party', 'holiday gathering', 'holiday celebration', 'holiday dinner', 'season greetings', 'seasons greetings', 'happy holidays', 'winter party', 'winter wonderland', 'office holiday'] },
  { id: 'new_year', label: 'New Year', group: 'Holidays', phrases: ['new year', 'new years', 'nye', 'ano nuevo', 'countdown party', 'hello 20'] , blockers: ['chinese new year', 'lunar new year', 'rosh hashanah', 'diwali', 'nowruz'] },
  { id: 'lunar_new_year', label: 'Lunar New Year', group: 'Holidays', phrases: ['lunar new year', 'chinese new year', 'spring festival', 'year of the dragon', 'year of the snake', 'year of the horse', 'year of the rabbit'] },
  { id: 'thanksgiving', label: 'Thanksgiving', group: 'Holidays', phrases: ['thanksgiving', 'friendsgiving', 'turkey day', 'give thanks', 'gobble'] },
  { id: 'halloween', label: 'Halloween', group: 'Holidays', phrases: ['halloween', 'trick or treat', 'spooky', 'boo bash', 'monster mash', 'haunted', 'dia de los muertos', 'day of the dead', 'pumpkin carving'] },
  { id: 'easter', label: 'Easter', group: 'Holidays', phrases: ['easter', 'egg hunt', 'hoppy', 'bunny brunch', 'he is risen', 'resurrection sunday'] },
  { id: 'valentines', label: "Valentine's Day", group: 'Holidays', phrases: ['valentine', 'valentines', 'galentine', 'galentines', 'palentine', 'be my valentine'] },
  { id: 'mothers_day', label: "Mother's Day", group: 'Holidays', phrases: ['mothers day', 'mother day', 'mom day', 'dia de las madres'] },
  { id: 'fathers_day', label: "Father's Day", group: 'Holidays', phrases: ['fathers day', 'father day', 'dad day', 'dia del padre'] },
  { id: 'memorial_day', label: 'Memorial Day', group: 'Holidays', phrases: ['memorial day', 'memorial day weekend', 'honor the fallen', 'remember and honor'] },
  { id: 'independence_day', label: 'Independence Day', group: 'Holidays', phrases: ['4th of july', 'fourth of july', 'independence day', 'july 4th', 'labor day', 'labour day', 'veterans day', 'republic day', 'canada day', 'patriotic'] },
  { id: 'st_patricks', label: "St. Patrick's Day", group: 'Holidays', phrases: ['st patrick', 'st patricks', 'saint patrick', 'st paddy', 'lucky charm', 'shamrock'] },
  { id: 'diwali', label: 'Diwali', group: 'Religious & Cultural', phrases: ['diwali', 'deepavali', 'festival of lights', 'dhanteras', 'bhai dooj'] },
  { id: 'eid', label: 'Eid & Ramadan', group: 'Religious & Cultural', phrases: ['eid', 'ramadan', 'ramzan', 'iftar', 'eid al fitr', 'eid ul fitr', 'eid al adha', 'eid mubarak', 'suhoor', 'bakrid', 'bakri', 'bakra eid', 'bakra', 'tabaski'] },
  { id: 'hanukkah', label: 'Hanukkah & Jewish Holidays', group: 'Religious & Cultural', phrases: ['hanukkah', 'chanukah', 'rosh hashanah', 'yom kippur', 'passover', 'seder', 'purim', 'sukkot', 'shabbat'] },
  { id: 'bar_mitzvah', label: 'Bar & Bat Mitzvah', group: 'Religious & Cultural', phrases: ['bar mitzvah', 'bat mitzvah', 'bnai mitzvah', 'b mitzvah'] },
  { id: 'indian_festival', label: 'Indian Festivals & Ceremonies', group: 'Religious & Cultural', phrases: ['holi', 'navratri', 'garba', 'dandiya', 'ganesh chaturthi', 'ganpati', 'janmashtami', 'raksha bandhan', 'rakhi', 'onam', 'pongal', 'lohri', 'makar sankranti', 'karwa chauth', 'durga puja', 'annaprashan', 'annaprasan', 'mundan', 'upanayana', 'thread ceremony', 'janeu', 'satyanarayan', 'puja', 'pooja', 'poojan', 'dhoti ceremony', 'kuan poojan', 'chola ceremony', 'ugadi', 'gudi padwa', 'baisakhi', 'vaisakhi', 'bihu', 'chhath', 'havan', 'kirtan', 'bhajan', 'jagran', 'mata ki chowki', 'godh bharai', 'seemantham', 'baby shower puja'] },
  { id: 'religious_service', generic: true, label: 'Church & Religious Service', group: 'Religious & Cultural', phrases: ['church service', 'worship', 'revival', 'prayer meeting', 'bible study', 'prayer breakfast', 'ordination', 'pastor appreciation', 'church picnic', 'gospel', 'mass', 'praise and worship', 'youth group', 'ministry'] },

  // Parties
  { id: 'dinner_party', generic: true, label: 'Dinner Party', group: 'Parties', phrases: ['dinner party', 'supper club', 'dinner gathering', 'candlelight dinner', 'dinner under the stars', 'dinner date', 'potluck', 'pot luck', 'family dinner'] },
  { id: 'cocktail_party', generic: true, label: 'Cocktail Party', group: 'Parties', phrases: ['cocktail party', 'cocktail hour', 'wine tasting', 'wine night', 'happy hour', 'champagne', 'mixer', 'drinks night'] },
  { id: 'brunch', generic: true, label: 'Brunch', group: 'Parties', phrases: ['brunch', 'mimosa', 'bottomless brunch'] },
  { id: 'tea_party', generic: true, label: 'Tea Party', group: 'Parties', phrases: ['tea party', 'high tea', 'afternoon tea', 'garden party', 'tea time'] },
  { id: 'pool_party', generic: true, label: 'Pool & Beach Party', group: 'Parties', phrases: ['pool party', 'beach party', 'splash party', 'pool bash', 'luau', 'swim party', 'summer splash'] },
  { id: 'bbq', generic: true, label: 'BBQ & Picnic', group: 'Parties', phrases: ['bbq', 'barbecue', 'barbeque', 'cookout', 'cook out', 'picnic', 'grill', 'block party', 'crawfish boil', 'fish fry', 'cookoff', 'cook off', 'pitmaster'] },
  { id: 'game_night', generic: true, label: 'Game & Movie Night', group: 'Parties', phrases: ['game night', 'movie night', 'trivia night', 'karaoke', 'poker night', 'bingo', 'casino night', 'murder mystery', 'super bowl', 'superbowl', 'watch party', 'game day', 'tailgate'] },
  { id: 'kitty_party', generic: true, label: 'Kitty Party', group: 'Parties', phrases: ['kitty party', 'ladies night', 'girls night', 'girls night out', 'ladies party', 'gals night'] },
  { id: 'themed_party', generic: true, label: 'Themed Party', group: 'Parties', phrases: ['themed party', 'costume party', 'masquerade', 'disco party', 'neon party', 'glow party', 'throwback party', '80s party', '90s party', '70s party', 'roaring 20s', 'great gatsby', 'white party', 'toga party', 'pajama party', 'slumber party', 'sleepover', 'dance party', 'rave', 'fiesta', 'paint party', 'sip and paint'] },
  { id: 'housewarming', label: 'Housewarming', group: 'Parties', phrases: ['housewarming', 'house warming', 'new home', 'new house', 'open house', 'griha pravesh', 'grih pravesh', 'griha pooja', 'home sweet home', 'we moved', 'weve moved', 'moving party', 'newhome'] },
  { id: 'farewell', label: 'Farewell & Going Away', group: 'Parties', phrases: ['farewell', 'going away', 'goodbye party', 'bon voyage', 'see you soon', 'see you again', 'send off', 'sendoff', 'maternity leave'] },
  { id: 'reunion', generic: true, label: 'Reunion', group: 'Parties', phrases: ['reunion', 'class of', 'alumni', 'homecoming', 'get together', 'family gathering'] },
  { id: 'welcome_party', generic: true, label: 'Welcome Party', group: 'Parties', phrases: ['welcome party', 'welcome home', 'welcome back', 'coming home', 'homecoming party'] },

  // Milestones
  { id: 'graduation', label: 'Graduation', group: 'Milestones', phrases: ['graduation', 'graduate', 'grad party', 'class of', 'commencement', 'convocation', 'graduacion', 'congrats grad', 'kindergarten graduation', 'preschool graduation', 'pre k graduation', 'prek graduation', '12th grade', 'she did it', 'he did it'] },
  { id: 'retirement', label: 'Retirement', group: 'Milestones', phrases: ['retirement', 'retiring', 'retired', 'happily retired', 'jubilacion'] },
  { id: 'sobriety', label: 'Sobriety & Recovery', group: 'Milestones', phrases: ['sobriety', 'sober', 'recovery', 'clean and sober'] },
  { id: 'promotion', generic: true, label: 'Promotion & Achievement', group: 'Milestones', phrases: ['promotion', 'achievement', 'award ceremony', 'awards ceremony', 'awards night', 'honor roll', 'scholarship', 'recognition', 'appreciation'] },

  // Business & Community
  { id: 'grand_opening', label: 'Grand Opening', group: 'Business & Community', phrases: ['grand opening', 'soft opening', 'ribbon cutting', 'now open', 'launch party', 'store opening', 'opening ceremony', 'grand reopening', 'opening soon', 'coming soon', 'inauguration', 'inaugural'] },
  { id: 'corporate_event', generic: true, label: 'Corporate Event', group: 'Business & Community', phrases: ['conference', 'seminar', 'webinar', 'workshop', 'summit', 'expo', 'trade show', 'networking', 'meeting', 'symposium', 'corporate', 'company party', 'office party', 'team building', 'product launch', 'annual general', 'agm', 'client appreciation', 'business dinner', 'job fair', 'hiring', 'recruitment', 'training'] },
  { id: 'fundraiser', generic: true, label: 'Fundraiser & Charity', group: 'Business & Community', phrases: ['fundraiser', 'fundraising', 'charity', 'benefit', 'gala', 'auction', 'donation', 'raffle', 'bake sale', 'walkathon', 'telethon', 'nonprofit', 'non profit', 'volunteer', 'drive'] },
  { id: 'community_event', generic: true, label: 'Community Event', group: 'Business & Community', phrases: ['festival', 'fair', 'carnival', 'concert', 'market', 'farmers market', 'craft fair', 'yard sale', 'garage sale', 'community', 'town hall', 'parade', 'fun run', 'marathon', 'exhibition', 'art show', 'book club', 'book launch', 'open mic', 'talent show', 'recital'] },
  { id: 'sports_event', generic: true, label: 'Sports Event', group: 'Business & Community', phrases: ['tournament', 'golf', 'tryouts', 'sports day', 'match day', 'championship', 'league', 'soccer game', 'football game', 'basketball game', 'baseball game', 'race day', 'yoga class', 'fitness'] },

  { id: 'sale_promotion', label: 'Sale & Promotion', group: 'Business & Community', generic: true, phrases: ['sale', 'black friday', 'cyber monday', 'special offer', 'discount', 'promo', 'promotion offer', 'flash sale', 'clearance', 'buy one get one', 'percent off', 'free shipping', 'limited offer', 'business opportunity', 'new arrivals', 'new collection'] },
  { id: 'observance_day', label: 'Awareness & Observance Days', group: 'Holidays', generic: true, phrases: ['womens day', 'international womens day', 'teachers day', 'doctors day', 'nurses day', 'earth day', 'environment day', 'world environment day', 'mental health day', 'world health day', 'childrens day', 'savings day', 'yoga day', 'international yoga day', 'world day', 'international day', 'awareness day', 'awareness month', 'pride', 'pride month', 'black history month', 'juneteenth', 'mlk day', 'grandparents day', 'siblings day', 'boss day', 'bosses day', 'employee appreciation day'] },

  // Memorial
  { id: 'memorial', label: 'Memorial & Funeral', group: 'Memorial', phrases: ['death anniversary', 'barsi', 'punyatithi', 'memorial', 'funeral', 'celebration of life', 'in loving memory', 'remembrance', 'rest in peace', 'rip', 'tribute', 'condolence', 'condolences', 'sympathy', 'shok sandesh', 'prayer meet', 'uthamna', 'besna', 'chautha', 'tervi', 'shraddh'] },

  // Greetings
  { id: 'thank_you', generic: true, label: 'Thank You', group: 'Greetings', phrases: ['thank you', 'thanks', 'thankyou', 'gracias', 'grateful'] },
  { id: 'congratulations', generic: true, label: 'Congratulations', group: 'Greetings', phrases: ['congratulations', 'congrats', 'well done', 'felicidades'] },
  { id: 'get_well', generic: true, label: 'Get Well & Thinking of You', group: 'Greetings', phrases: ['get well', 'feel better', 'thinking of you', 'miss you', 'missing you', 'speedy recovery'] },
  { id: 'friendship', generic: true, label: 'Friendship & Love', group: 'Greetings', phrases: ['friendship day', 'best friend', 'love you', 'i love you', 'proposal', 'will you marry me', 'date night', 'apology', 'sorry', 'love declaration', 'love letter'] },
]

export const OCCASION_BY_ID = new Map(OCCASIONS.map((o) => [o.id, o]))

/** The occasion and all of its descendants. */
export function occasionFamily(id: string): string[] {
  const out = [id]
  for (const o of OCCASIONS) if (o.parent === id) out.push(...occasionFamily(o.id))
  return out
}

/**
 * Parents for occasions learned by AI that had none, only where the child is a kind of the parent
 * (Dussehra is an Indian festival). A parent search then includes them ("religious service" finds Palm Sunday).
 */
export const LEARNED_OCCASION_PARENTS: Record<string, string> = {
  // Religious services and festivals.
  epiphany: 'religious_service', palm_sunday: 'religious_service', three_kings_day: 'religious_service',
  dia_de_las_velita: 'religious_service', virgin_of_guadalupe_feast: 'religious_service', bris_milah: 'religious_service',
  kirtan_darbar: 'religious_service', navchandi_yagna: 'religious_service', langar: 'religious_service',
  dussehra: 'indian_festival', ganesh_darshan: 'indian_festival', maha_shivaratri: 'indian_festival',
  hanuman_jayanti: 'indian_festival', hariyali_teej: 'indian_festival', sharad_purnima: 'indian_festival',
  vasant_panchami: 'indian_festival', guru_purnima: 'indian_festival', bhogi_pallu: 'indian_festival',
  laxmi_pujan: 'diwali', roza_kushai: 'eid', godparent_proposal: 'baptism', dedication: 'baptism',
  // Classes, shows and exhibitions are community events; work events are corporate.
  art_workshop: 'community_event', painting_workshop: 'community_event', drawing_workshop: 'community_event',
  pottery_workshop: 'community_event', cooking_workshop: 'community_event', makeup_workshop: 'community_event',
  dance_workshop: 'community_event', yoga_workshop: 'community_event', mindfulness_workshop: 'community_event',
  candle_making_workshop: 'community_event', writing_workshop: 'community_event', science_workshop: 'community_event',
  art_exhibition: 'community_event', agriculture_exhibition: 'community_event', auto_exhibition: 'community_event',
  interior_exhibition: 'community_event', jewellery_exhibition: 'community_event', science_exhibition: 'community_event',
  stationery_exhibition: 'community_event', dance_competition: 'community_event', dance_performance: 'community_event',
  dance_recital: 'community_event', music_recital: 'community_event', music_festival: 'community_event',
  film_festival: 'community_event', fashion_show: 'community_event', fashion_event: 'community_event',
  food_festival: 'community_event', election_campaign: 'community_event', medical_program: 'community_event',
  meet_and_greet: 'community_event', author_event: 'community_event', blogger_meetup: 'community_event',
  business_fair: 'corporate_event', job_opening: 'corporate_event', staff_appreciation: 'corporate_event',
  annual_dinner: 'corporate_event', holiday_shopping_event: 'sale_promotion',
  // Parties, holidays, milestones, greetings and memorials.
  potluck_party: 'dinner_party', bowling_party: 'themed_party', clothing_swap: 'themed_party',
  appreciation_luncheon: 'brunch', indian_republic_day: 'observance_day', parents_day: 'observance_day',
  columbus_day: 'observance_day', white_coat_ceremony: 'graduation', heavenly_birthday: 'memorial',
  morning_greeting: 'casual_greeting', afternoon_greeting: 'casual_greeting', good_night: 'casual_greeting',
}

/**
 * Learned occasions that only repeat a seed one with a few designs: "Lunch Party" (2 designs) took the
 * words "lunch party" from Brunch & Luncheon (118). Their templates and spellings move to the seed occasion.
 */
/** Extra spellings for learned occasions (seed ones keep theirs in OCCASIONS above). */
export const LEARNED_OCCASION_ALIASES: Record<string, string> = {
  maiyan: 'haldi_mehendi', maaiyan: 'haldi_mehendi', mayian: 'haldi_mehendi',
}

export const LEARNED_OCCASION_MERGES: Record<string, string> = {
  lunch_party: 'brunch', lunch_date: 'brunch', summer_luncheon: 'brunch', breakfast_party: 'brunch',
}

/** The guests are adults even though the event is about a baby, so these cards are not for kids. */
export const ADULT_GUEST_OCCASIONS = new Set(['baby_shower', 'gender_reveal'])

/**
 * Words that are part of a date, never something a design must show ("birthday 10 juin", "june 7").
 * They are dropped from the words a template must match; the meaning search still sees the whole query.
 */
export const DATE_WORDS = new Set([
  'jan', 'january', 'feb', 'february', 'march', 'apr', 'april', 'may', 'jun', 'june', 'jul', 'july',
  'aug', 'august', 'sep', 'sept', 'september', 'oct', 'october', 'nov', 'november', 'dec', 'december',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  'janeiro', 'fevereiro', 'abril', 'maio', 'junho', 'julho', 'setembro', 'outubro', 'novembro', 'dezembro',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'today', 'tomorrow', 'tonight',
  'am', 'pm', 'du', 'le', 'el',
])

/** A pasted chat line's prefix: "[27/05, 1:14 pm] tassu _delighti: …". */
export const CHAT_PREFIX = /\[\s*\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?,?\s*\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?\s*\]\s*[^:\n]{0,40}:\s*/gi

// ---- Formats (what kind of gathering) -------------------------------------

export type SimpleDef = { id: string; label: string; phrases: string[] }

export const FORMATS: SimpleDef[] = [
  { id: 'dinner', label: 'Dinner', phrases: ['dinner', 'supper', 'feast', 'banquet', 'potluck', 'pot luck', 'cena', 'hibachi'] },
  { id: 'brunch', label: 'Brunch', phrases: ['brunch', 'mimosa'] },
  { id: 'lunch', label: 'Lunch', phrases: ['lunch', 'luncheon'] },
  { id: 'breakfast', label: 'Breakfast', phrases: ['breakfast', 'pancake'] },
  { id: 'tea', label: 'Tea Party', phrases: ['tea party', 'high tea', 'afternoon tea', 'tea time'] },
  { id: 'cocktail', label: 'Cocktails & Drinks', phrases: ['cocktail', 'cocktails', 'happy hour', 'wine', 'champagne', 'drinks', 'beer', 'margarita'] },
  { id: 'bbq', label: 'BBQ & Picnic', phrases: ['bbq', 'barbecue', 'barbeque', 'cookout', 'picnic', 'grill'] },
  { id: 'gala', label: 'Gala', phrases: ['gala', 'black tie', 'ball'] },
  { id: 'party', label: 'Party', phrases: ['party', 'bash', 'fiesta', 'celebration'] },
  { id: 'ceremony', label: 'Ceremony', phrases: ['ceremony', 'service', 'ritual'] },
  { id: 'reception', label: 'Reception', phrases: ['reception'] },
  { id: 'gathering', label: 'Gathering', phrases: ['gathering', 'get together', 'meetup', 'meet up', 'open house'] },
]

// ---- Document types ---------------------------------------------------------

/** Occasion groups where "card" usually means a greeting card ("christmas card", "diwali card"), not an invitation. */
export const CARD_MEANS_GREETING_GROUPS = ['Holidays', 'Religious & Cultural', 'Greetings'] as const

export const DOC_TYPES: SimpleDef[] = [
  { id: 'save_the_date', label: 'Save the Date', phrases: ['save the date', 'save our date'] },
  { id: 'greeting', label: 'Greeting Card', phrases: ['greeting', 'greetings', 'greeting card', 'greeting cards', 'wishes', 'wish', 'thank you card', 'ecard', 'e card', 'ecards'] },
  { id: 'announcement', label: 'Announcement', phrases: ['announcement', 'announcing', 'flyer', 'poster', 'notice', 'folleto', 'folletos'] },
  { id: 'invitation', label: 'Invitation', phrases: ['invitation', 'invite', 'invites', 'invitations', 'invitacion', 'plantilla de invitacion', 'rsvp', 'join us', 'you are invited', 'youre invited'] },
]

// ---- Audiences --------------------------------------------------------------

export const AUDIENCES: SimpleDef[] = [
  { id: 'kids', label: 'Kids', phrases: ['kids', 'kid', 'children', 'childrens', 'toddler', 'boy', 'girl', 'little', 'baby', 'first birthday', '1st birthday'] },
  { id: 'teens', label: 'Teens', phrases: ['teen', 'teens', 'sweet 16', 'sweet sixteen', 'quinceanera', 'prom', 'homecoming'] },
  { id: 'couple', label: 'Couple', phrases: ['couple', 'mr and mrs', 'bride and groom', 'husband and wife', 'wedding', 'anniversary', 'engagement'] },
  { id: 'corporate', label: 'Corporate', phrases: ['company', 'corporate', 'business', 'office', 'team', 'conference', 'employees', 'client'] },
  { id: 'adults', label: 'Adults', phrases: ['adult', 'adults only', '21st', '30th', '40th', '50th', '60th', '70th', '80th', '90th', 'ladies', 'gentlemen', 'cocktail'] },
]

// ---- Themes (the overall concept of the design) -----------------------------
// Objects in the design (butterfly, basketball, lion…) are assets, below. Each asset
// links to the theme(s) it belongs to, so a template with a basketball is also Sports.

export const THEMES: SimpleDef[] = [
  { id: 'floral', label: 'Floral & Botanical', phrases: ['floral', 'florals', 'botanical', 'blooms', 'blossom', 'flower theme', 'flowers theme'] },
  { id: 'garden', label: 'Garden & Nature', phrases: ['garden', 'nature', 'meadow', 'enchanted garden', 'secret garden', 'spring garden'] },
  { id: 'under_the_sea', label: 'Under the Sea', phrases: ['under the sea', 'ocean', 'sea', 'nautical', 'mermaid theme', 'beach theme ocean'] },
  { id: 'safari', label: 'Safari & Jungle', phrases: ['safari', 'jungle', 'wild one', 'zoo', 'wild animals', 'wildlife'] },
  { id: 'woodland', label: 'Woodland', phrases: ['woodland', 'forest', 'enchanted forest', 'woods'] },
  { id: 'farm', label: 'Farm & Barnyard', phrases: ['farm', 'barnyard', 'barn', 'ranch animals'] },
  { id: 'pets', label: 'Animals & Pets', phrases: ['animal', 'animals', 'pet', 'pets', 'puppy party', 'kitty'] },
  { id: 'dinosaurs', label: 'Dinosaurs', phrases: ['dinosaur', 'dinosaurs', 'dino', 'jurassic', 'prehistoric'] },
  { id: 'fairy_magic', label: 'Fairy & Magic', phrases: ['fairy', 'fairies', 'magic', 'magical', 'enchanted', 'fairytale', 'fairy tale', 'wizard'] },
  { id: 'princess', label: 'Princess & Royal', phrases: ['princess', 'prince', 'royal', 'royalty', 'queen', 'king'] },
  { id: 'toys', label: 'Toys & Teddy Bears', phrases: ['toys', 'toy', 'teddy bear theme', 'toy story'] },
  { id: 'superhero', label: 'Superhero', phrases: ['superhero', 'super hero', 'superheroes', 'hero'] },
  { id: 'space', label: 'Space', phrases: ['space', 'outer space', 'galaxy', 'cosmic', 'planets'] },
  { id: 'celestial', label: 'Stars & Celestial', phrases: ['celestial', 'starry', 'twinkle twinkle', 'stars and moon', 'over the moon'] },
  { id: 'rainbow', label: 'Rainbow', phrases: ['rainbow', 'rainbows'] },
  { id: 'sports', label: 'Sports', phrases: ['sport', 'sports', 'athletic', 'athletics', 'game day', 'all star', 'mvp'] },
  { id: 'vehicles', label: 'Cars & Vehicles', phrases: ['vehicle', 'vehicles', 'race car theme', 'transportation', 'construction'] },
  { id: 'travel', label: 'Travel & Adventure', phrases: ['travel', 'adventure', 'vacation', 'road trip', 'camping', 'explore', 'wanderlust'] },
  { id: 'tropical', label: 'Tropical', phrases: ['tropical', 'aloha', 'luau', 'hawaiian', 'paradise'] },
  { id: 'beach', label: 'Beach & Summer', phrases: ['beach', 'summer', 'seaside', 'coastal', 'sunshine'] },
  { id: 'winter', label: 'Winter & Snow', phrases: ['winter', 'snow', 'winter wonderland', 'frozen'] },
  { id: 'autumn', label: 'Autumn & Fall', phrases: ['autumn', 'fall', 'harvest'] },
  { id: 'spring', label: 'Spring', phrases: ['spring', 'springtime'] },
  { id: 'christmas_decor', label: 'Christmas Decor', phrases: ['christmas decor', 'holiday decor'] },
  { id: 'spooky', label: 'Spooky', phrases: ['spooky', 'haunted', 'creepy', 'horror'] },
  { id: 'retro', label: 'Retro & Disco', phrases: ['disco', 'retro', '70s', '80s', '90s', 'y2k', 'groovy', 'hippie', 'throwback'] },
  { id: 'neon', label: 'Neon & Glow', phrases: ['neon', 'glow', 'glow in the dark', 'blacklight'] },
  { id: 'western', label: 'Western & Cowboy', phrases: ['western', 'cowboy', 'cowgirl', 'rodeo', 'country', 'yeehaw', 'wild west'] },
  { id: 'gatsby', label: 'Gatsby & Art Deco', phrases: ['gatsby', 'art deco', 'roaring 20s', 'roaring twenties', 'jazz age'] },
  { id: 'hollywood', label: 'Hollywood & Movies', phrases: ['hollywood', 'red carpet', 'movie', 'cinema', 'film', 'oscars'] },
  { id: 'music', label: 'Music', phrases: ['music', 'musical', 'rock and roll', 'jazz', 'karaoke', 'concert'] },
  { id: 'food', label: 'Food & Sweets', phrases: ['food', 'sweets', 'dessert', 'candy land', 'sweet treats', 'bakery'] },
  { id: 'gaming', label: 'Video Games', phrases: ['video game', 'video games', 'gaming', 'gamer', 'minecraft', 'roblox', 'fortnite', 'arcade', 'level up'] },
  { id: 'anime', label: 'Anime & Cartoon', phrases: ['anime', 'cartoon', 'kawaii', 'manga'] },
  { id: 'faith', label: 'Faith & Religious', phrases: ['faith', 'religious', 'christian', 'biblical', 'spiritual', 'blessed', 'blessing'] },
  { id: 'ethnic', label: 'Ethnic & Traditional', phrases: ['ethnic', 'traditional', 'mandala', 'paisley', 'henna', 'desi'] },
  { id: 'lights', label: 'Lights & Lanterns', phrases: ['lights', 'lanterns', 'candlelight', 'string lights', 'fairy lights'] },
  { id: 'love', label: 'Love & Hearts', phrases: ['love', 'romance', 'romantic', 'hearts'] },
  { id: 'celebration', label: 'Party & Celebration', phrases: ['confetti', 'balloons', 'cheers', 'party decor'] },
]

// ---- Assets (visible objects in the design) ----------------------------------

export type AssetDef = SimpleDef & { themes: string[] }

const a = (id: string, label: string, themes: string[], phrases: string[] = []): AssetDef => ({
  id,
  label,
  themes,
  phrases: [label.toLowerCase(), ...phrases],
})

export const ASSETS: AssetDef[] = [
  // Garden & nature
  a('butterfly', 'Butterfly', ['garden'], ['butterflies', 'mariposa', 'mariposas']),
  a('bee', 'Bee', ['garden'], ['bees', 'honeybee', 'bumblebee', 'bumble bee', 'mommy to bee', 'honey']),
  a('ladybug', 'Ladybug', ['garden'], ['ladybugs', 'ladybird']),
  a('dragonfly', 'Dragonfly', ['garden']),
  a('bird', 'Bird', ['garden'], ['birds', 'hummingbird', 'songbird']),
  a('mushroom', 'Mushroom', ['woodland', 'garden'], ['mushrooms', 'fungi', 'toadstool']),
  // Flowers & plants
  a('flower', 'Flower', ['floral'], ['flowers', 'wildflower', 'wildflowers', 'blossoms']),
  a('rose', 'Rose', ['floral'], ['roses']),
  a('sunflower', 'Sunflower', ['floral'], ['sunflowers']),
  a('tulip', 'Tulip', ['floral'], ['tulips']),
  a('daisy', 'Daisy', ['floral'], ['daisies']),
  a('peony', 'Peony', ['floral'], ['peonies']),
  a('lily', 'Lily', ['floral'], ['lilies']),
  a('orchid', 'Orchid', ['floral'], ['orchids']),
  a('lotus', 'Lotus', ['floral', 'ethnic']),
  a('marigold', 'Marigold', ['floral', 'ethnic'], ['marigolds', 'genda']),
  a('cherry_blossom', 'Cherry Blossom', ['floral', 'spring'], ['sakura']),
  a('lavender', 'Lavender', ['floral']),
  a('poppy', 'Poppy', ['floral'], ['poppies']),
  a('hibiscus', 'Hibiscus', ['floral', 'tropical']),
  a('greenery', 'Greenery', ['floral', 'garden'], ['eucalyptus', 'leaves', 'leaf', 'foliage', 'fern', 'ivy', 'olive branch']),
  a('palm_tree', 'Palm Tree', ['tropical', 'beach'], ['palm trees', 'palm', 'palms']),
  a('cactus', 'Cactus', ['western', 'travel'], ['cacti']),
  a('succulent', 'Succulent', ['garden'], ['succulents']),
  // Sea
  a('mermaid', 'Mermaid', ['under_the_sea', 'fairy_magic'], ['mermaids']),
  a('fish', 'Fish', ['under_the_sea']),
  a('whale', 'Whale', ['under_the_sea'], ['whales']),
  a('octopus', 'Octopus', ['under_the_sea']),
  a('shell', 'Seashell', ['under_the_sea', 'beach'], ['shell', 'shells', 'seashells']),
  a('starfish', 'Starfish', ['under_the_sea', 'beach']),
  a('anchor', 'Anchor', ['under_the_sea'], ['anchors', 'sailor']),
  a('sailboat', 'Sailboat', ['under_the_sea', 'beach'], ['sailboats', 'sail boat', 'ship', 'boat']),
  a('turtle', 'Turtle', ['under_the_sea'], ['sea turtle']),
  // Safari & jungle
  a('lion', 'Lion', ['safari'], ['lions']),
  a('tiger', 'Tiger', ['safari'], ['tigers']),
  a('elephant', 'Elephant', ['safari'], ['elephants']),
  a('giraffe', 'Giraffe', ['safari'], ['giraffes']),
  a('zebra', 'Zebra', ['safari'], ['zebras']),
  a('monkey', 'Monkey', ['safari'], ['monkeys']),
  a('hippo', 'Hippo', ['safari'], ['hippopotamus']),
  a('panda', 'Panda', ['safari'], ['pandas']),
  // Woodland
  a('fox', 'Fox', ['woodland'], ['foxes']),
  a('deer', 'Deer', ['woodland'], ['fawn']),
  a('reindeer', 'Reindeer', ['winter', 'christmas_decor'], ['rudolph']),
  a('owl', 'Owl', ['woodland'], ['owls']),
  a('bear', 'Bear', ['woodland'], ['bears']),
  a('hedgehog', 'Hedgehog', ['woodland']),
  a('raccoon', 'Raccoon', ['woodland']),
  // Farm
  a('cow', 'Cow', ['farm'], ['cows']),
  a('pig', 'Pig', ['farm'], ['pigs', 'piglet']),
  a('horse', 'Horse', ['farm', 'western'], ['horses', 'pony', 'ponies']),
  a('chicken', 'Chicken', ['farm'], ['chick', 'chicks', 'hen', 'rooster']),
  a('sheep', 'Sheep', ['farm'], ['lamb']),
  a('tractor', 'Tractor', ['farm', 'vehicles']),
  // Pets
  a('dog', 'Dog', ['pets'], ['dogs', 'puppy', 'puppies', 'doggy', 'pup']),
  a('cat', 'Cat', ['pets'], ['cats', 'kitten', 'kittens']),
  a('bunny', 'Bunny', ['pets', 'spring'], ['bunnies', 'rabbit', 'rabbits']),
  a('duck', 'Duck', ['pets', 'farm'], ['ducks', 'duckling', 'rubber duck']),
  // Fantasy
  a('dinosaur', 'Dinosaur', ['dinosaurs'], ['dinosaurs', 'dino', 't rex', 'trex']),
  a('unicorn', 'Unicorn', ['fairy_magic'], ['unicorns']),
  a('fairy', 'Fairy', ['fairy_magic'], ['fairies']),
  a('dragon', 'Dragon', ['fairy_magic'], ['dragons']),
  a('castle', 'Castle', ['princess', 'fairy_magic']),
  a('crown', 'Crown', ['princess'], ['crowns', 'tiara', 'tiaras']),
  a('wand', 'Magic Wand', ['fairy_magic'], ['wand']),
  // Toys
  a('teddy_bear', 'Teddy Bear', ['toys'], ['teddy', 'teddy bears', 'we can bearly wait']),
  a('balloon', 'Balloon', ['celebration'], ['balloons', 'hot air balloon']),
  a('confetti', 'Confetti', ['celebration'], ['sprinkles']),
  a('gift', 'Gift Box', ['celebration'], ['gift', 'gifts', 'present', 'presents']),
  a('party_hat', 'Party Hat', ['celebration'], ['party hats']),
  a('cake', 'Cake', ['food', 'celebration'], ['cakes', 'birthday cake', 'smash cake']),
  // Space & sky
  a('rocket', 'Rocket', ['space'], ['rockets', 'spaceship']),
  a('planet', 'Planet', ['space'], ['planets', 'saturn']),
  a('astronaut', 'Astronaut', ['space'], ['astronauts']),
  a('star', 'Star', ['celestial'], ['stars', 'twinkle']),
  a('moon', 'Moon', ['celestial'], ['crescent moon']),
  a('rainbow', 'Rainbow', ['rainbow'], ['rainbows']),
  a('cloud', 'Cloud', ['celestial'], ['clouds']),
  a('sun', 'Sun', ['beach'], ['sunshine']),
  // Sports
  a('football', 'Football', ['sports'], ['american football', 'touchdown']),
  a('soccer_ball', 'Soccer Ball', ['sports'], ['soccer']),
  a('basketball', 'Basketball', ['sports']),
  a('baseball', 'Baseball', ['sports'], ['baseball bat', 'softball']),
  a('hockey', 'Hockey Stick', ['sports'], ['hockey', 'hockey puck', 'puck', 'ice hockey']),
  a('tennis', 'Tennis Racket', ['sports'], ['tennis', 'racket', 'pickleball']),
  a('golf', 'Golf Club', ['sports'], ['golf', 'golf ball']),
  a('volleyball', 'Volleyball', ['sports']),
  a('bowling', 'Bowling Pin', ['sports'], ['bowling']),
  a('trophy', 'Trophy', ['sports'], ['trophies', 'medal']),
  a('cricket', 'Cricket Bat', ['sports'], ['cricket']),
  // Vehicles
  a('car', 'Car', ['vehicles'], ['cars', 'race car', 'racecar']),
  a('truck', 'Truck', ['vehicles'], ['trucks', 'monster truck', 'fire truck', 'firetruck', 'dump truck']),
  a('train', 'Train', ['vehicles'], ['trains']),
  a('airplane', 'Airplane', ['vehicles', 'travel'], ['plane', 'aeroplane', 'airplanes']),
  // Seasons & holidays
  a('snowflake', 'Snowflake', ['winter'], ['snowflakes']),
  a('snowman', 'Snowman', ['winter'], ['snowmen']),
  a('pumpkin', 'Pumpkin', ['autumn', 'spooky'], ['pumpkins', 'jack o lantern']),
  a('maple_leaf', 'Maple Leaf', ['autumn'], ['fall leaves', 'autumn leaves']),
  a('christmas_tree', 'Christmas Tree', ['christmas_decor']),
  a('ornament', 'Ornament', ['christmas_decor'], ['ornaments', 'bauble', 'baubles']),
  a('santa', 'Santa', ['christmas_decor'], ['santa claus']),
  a('gingerbread', 'Gingerbread', ['christmas_decor', 'food'], ['gingerbread man']),
  a('candy_cane', 'Candy Cane', ['christmas_decor'], ['candy canes']),
  a('wreath', 'Wreath', ['christmas_decor'], ['holly', 'mistletoe']),
  a('ghost', 'Ghost', ['spooky'], ['ghosts']),
  a('skull', 'Skull', ['spooky'], ['skulls', 'skeleton', 'sugar skull']),
  a('bat', 'Bat', ['spooky'], ['bats']),
  a('witch', 'Witch', ['spooky'], ['witches', 'witch hat']),
  a('spider', 'Spider', ['spooky'], ['spiders', 'spiderweb', 'spider web']),
  a('easter_egg', 'Easter Egg', ['spring'], ['easter eggs', 'egg hunt']),
  a('shamrock', 'Shamrock', ['spring'], ['clover', 'four leaf clover']),
  a('flag', 'Flag', ['celebration'], ['flags', 'american flag']),
  a('fireworks', 'Fireworks', ['celebration', 'lights']),
  // Food
  a('pizza', 'Pizza', ['food']),
  a('cupcake', 'Cupcake', ['food'], ['cupcakes']),
  a('ice_cream', 'Ice Cream', ['food'], ['ice cream cone', 'popsicle']),
  a('donut', 'Donut', ['food'], ['doughnut', 'donuts', 'doughnuts']),
  a('candy', 'Candy', ['food'], ['lollipop', 'sweets', 'lollipops']),
  a('cookie', 'Cookie', ['food'], ['cookies']),
  a('sushi', 'Sushi', ['food']),
  a('taco', 'Taco', ['food'], ['tacos']),
  a('burger', 'Burger', ['food'], ['hamburger', 'burgers']),
  a('fruit', 'Fruit', ['food'], ['fruits', 'fruity']),
  // Fruits are separate assets: "lemon" must find lemon designs, not every fruit. Citrus and cherry
  // branches are usually drawn botanically, so they count as Floral & Botanical as well as Food.
  a('lemon', 'Lemon', ['floral', 'food'], ['lemons', 'citrus', 'lime', 'limes', 'lemonade']),
  a('orange', 'Orange Fruit', ['floral', 'food'], ['oranges', 'clementine', 'tangerine']),
  a('cherry', 'Cherry', ['floral', 'food'], ['cherries']),
  a('strawberry', 'Strawberry', ['food'], ['strawberries']),
  a('watermelon', 'Watermelon', ['food', 'beach'], ['watermelons']),
  a('avocado', 'Avocado', ['food'], ['avocados']),
  a('peach', 'Peach', ['food'], ['peaches']),
  a('pineapple', 'Pineapple', ['tropical', 'food'], ['pineapples']),
  a('flamingo', 'Flamingo', ['tropical'], ['flamingos', 'flamingoes']),
  a('champagne', 'Champagne', ['celebration'], ['champagne glass', 'wine glass', 'prosecco', 'bubbly']),
  a('coffee', 'Coffee', ['food'], ['coffee cup', 'latte']),
  // Music & fun
  a('guitar', 'Guitar', ['music'], ['guitars']),
  a('music_note', 'Music Note', ['music'], ['music notes', 'musical notes']),
  a('microphone', 'Microphone', ['music'], ['mic']),
  a('disco_ball', 'Disco Ball', ['retro'], ['mirror ball']),
  a('roller_skate', 'Roller Skate', ['retro'], ['roller skates', 'skates']),
  a('game_controller', 'Game Controller', ['gaming'], ['controller', 'joystick']),
  a('camera', 'Camera', ['hollywood', 'travel']),
  a('popcorn', 'Popcorn', ['hollywood', 'food']),
  // Western & travel
  a('cowboy_hat', 'Cowboy Hat', ['western']),
  a('cowboy_boot', 'Cowboy Boot', ['western'], ['cowboy boots', 'boots', 'boot']),
  a('horseshoe', 'Horseshoe', ['western'], ['horseshoes']),
  a('map', 'Map', ['travel'], ['maps']),
  a('globe', 'Globe', ['travel'], ['globes']),
  a('compass', 'Compass', ['travel']),
  a('passport', 'Passport', ['travel'], ['passports']),
  a('suitcase', 'Suitcase', ['travel'], ['suitcases', 'luggage']),
  a('tent', 'Tent', ['travel'], ['tents']),
  a('campfire', 'Campfire', ['travel'], ['bonfire', 'smores']),
  a('mountain', 'Mountain', ['travel'], ['mountains']),
  // Faith & culture
  a('cross', 'Cross', ['faith']),
  a('dove', 'Dove', ['faith'], ['doves']),
  a('angel', 'Angel', ['faith'], ['angels', 'cherub']),
  a('diya', 'Diya', ['ethnic', 'lights'], ['diyas', 'oil lamp']),
  a('rangoli', 'Rangoli', ['ethnic']),
  a('ganesha', 'Ganesha', ['ethnic', 'faith'], ['ganesh', 'ganpati']),
  a('kalash', 'Kalash', ['ethnic']),
  // Lights & love
  a('lantern', 'Lantern', ['lights'], ['lanterns']),
  a('candle', 'Candle', ['lights'], ['candles']),
  a('heart', 'Heart', ['love'], ['hearts']),
  a('ring', 'Ring', ['love'], ['rings', 'wedding ring', 'engagement ring']),
  // Baby
  a('baby_bottle', 'Baby Bottle', [], ['bottle', 'baby bottles']),
  a('pacifier', 'Pacifier', [], ['pacifiers', 'dummy']),
  a('onesie', 'Onesie', [], ['onesies', 'baby onesie', 'baby clothes']),
  a('rattle', 'Rattle', ['toys'], ['rattles', 'baby rattle']),
  a('stroller', 'Stroller', [], ['strollers', 'baby carriage', 'pram', 'pushchair']),
  a('baby_bundle', 'Baby Bundle', [], ['bundle', 'swaddle']),
  a('stork', 'Stork', ['garden']),
  // Graduation & school
  a('grad_cap', 'Graduation Cap', ['celebration'], ['grad cap', 'mortarboard', 'graduation hat']),
  a('scroll', 'Scroll', ['celebration'], ['diploma', 'certificate', 'rolled diploma']),
  a('school', 'School Supplies', [], ['school bus']),
  a('pencil', 'Pencil', [], ['pencils']),
  a('book', 'Book', [], ['books', 'storybook']),
  a('apple', 'Apple', ['food'], ['apples']),
  // Wedding & party things AI tagging often sees
  a('bouquet', 'Bouquet', ['floral'], ['bouquets', 'flower bouquet', 'bridal bouquet']),
  a('grill', 'Grill', ['food'], ['bbq grill', 'barbecue grill']),
]

export const ASSET_BY_ID = new Map(ASSETS.map((d) => [d.id, d]))

// ---- Gender target --------------------------------------------------------------

export const GENDERS: SimpleDef[] = [
  {
    id: 'girl',
    label: 'Girl',
    phrases: [
      'girl', 'girls', 'its a girl', 'baby girl', 'little girl', 'she', 'her', 'hers', 'herself', 'daughter',
      'princess', 'little lady', 'ballerina', 'quinceanera', 'quince', 'bat mitzvah', 'sister', 'mom', 'mommy',
      'mother', 'wife', 'woman', 'women', 'mujer', 'mujeres', 'femme', 'femmes', 'ladies', 'lady', 'queen', 'bride', 'galentine', 'niece', 'granddaughter',
      'grandma', 'grandmother', 'aunt', 'nina', 'mis xv',
    ],
  },
  {
    id: 'boy',
    label: 'Boy',
    phrases: [
      'boy', 'boys', 'its a boy', 'baby boy', 'little boy', 'he', 'his', 'him', 'himself', 'son', 'prince',
      'little man', 'lil man', 'bar mitzvah', 'brother', 'dad', 'daddy', 'father', 'husband', 'man', 'men', 'hombre', 'hombres', 'homme', 'hommes',
      'gentleman', 'gentlemen', 'king', 'groom', 'nephew', 'grandson', 'grandpa', 'grandfather', 'uncle',
    ],
  },
  { id: 'neutral', label: 'Gender-neutral', phrases: ['gender neutral', 'unisex'] },
]

/** Gender words that also describe the design (a princess card), so they stay usable as themes and elements. */
export const DESIGN_GENDER_WORDS = new Set(['princess', 'prince', 'queen', 'king', 'ballerina', 'quinceanera', 'quince', 'bride', 'groom'])

/**
 * Words AI tagging may not turn into new themes, elements or styles: who the card is for (girl, baby, kids)
 * is read as gender or audience, so as a theme or element it would change how searches are read.
 */
export const RESERVED_TERM_WORDS = new Set([
  ...GENDERS.flatMap((g) => g.phrases).filter((p) => !DESIGN_GENDER_WORDS.has(p)),
  'baby', 'babies', 'kid', 'kids', 'child', 'children', 'toddler', 'teen', 'teens', 'adult', 'adults',
  'people', 'person', 'guest', 'guests', 'family', 'couple',
])

export const GENDER_BY_ID = new Map(GENDERS.map((d) => [d.id, d]))

/** Words about adults. On baby events they describe the parents, not the baby's gender. */
export const ADULT_GENDER_WORDS = new Set([
  'she', 'her', 'hers', 'herself', 'mom', 'mommy', 'mother', 'wife', 'woman', 'women', 'ladies', 'lady', 'queen',
  'he', 'his', 'him', 'himself', 'dad', 'daddy', 'father', 'husband', 'man', 'men', 'gentleman', 'gentlemen', 'king',
  'grandma', 'grandmother', 'grandpa', 'grandfather', 'aunt', 'uncle',
])

/** Occasion groups about a couple or a group, where a single gender target does not apply. */
export const GENDERLESS_GROUPS = new Set(['Wedding', 'Anniversary', 'Business & Community', 'Holidays'])

/** Asset words that card text often uses figuratively ("with happy hearts"); only trusted in names and images. */
export const FIGURATIVE_ASSETS = new Set(['heart', 'star', 'sun', 'ring', 'cloud', 'gift', 'flag', 'school', 'map', 'candle', 'cake', 'bird', 'bee', 'tree'])

// ---- Styles -----------------------------------------------------------------

export const STYLES: SimpleDef[] = [
  { id: 'elegant', label: 'Elegant', phrases: ['elegant', 'classy', 'sophisticated', 'luxury', 'luxurious', 'glamorous', 'glam', 'chic', 'black tie', 'formal'] },
  { id: 'modern', label: 'Modern', phrases: ['modern', 'contemporary', 'sleek'] },
  { id: 'minimalist', label: 'Minimalist', phrases: ['minimal', 'minimalist', 'minimalistic', 'simple', 'clean'] },
  { id: 'rustic', label: 'Rustic', phrases: ['rustic', 'kraft', 'burlap', 'wood', 'wooden', 'barn', 'farmhouse'] },
  { id: 'vintage', label: 'Vintage & Classic', phrases: ['vintage', 'classic', 'antique', 'old fashioned', 'victorian', 'retro'] },
  { id: 'boho', label: 'Boho', phrases: ['boho', 'bohemian', 'pampas', 'macrame', 'terracotta'] },
  { id: 'whimsical', label: 'Whimsical & Cute', phrases: ['whimsical', 'cute', 'adorable', 'charming', 'colorful', 'colourful', 'bright'] },
  { id: 'watercolor', label: 'Watercolor', phrases: ['watercolor', 'watercolour', 'painted', 'hand painted', 'brush'] },
  { id: 'romantic', label: 'Romantic', phrases: ['romantic', 'love'] },
  { id: 'traditional', label: 'Traditional', phrases: ['traditional', 'cultural', 'heritage', 'royal'] },
  { id: 'festive', label: 'Festive', phrases: ['festive', 'merry', 'jolly'] },
  { id: 'photo', label: 'Photo', phrases: ['photo', 'photograph', 'picture', 'add your photo', 'with photo'] },
  { id: 'illustrated', label: 'Illustrated', phrases: ['illustrated', 'illustration', 'cartoon', 'hand drawn', 'doodle'] },
  { id: 'typography', label: 'Typography', phrases: ['typography', 'typographic', 'lettering', 'calligraphy', 'script'] },
]

// ---- Themes that only repeat the occasion ---------------------------------------
// A theme is a design concept. These add nothing to the occasion itself (Party & Celebration
// on a birthday card), so AI tagging drops them. Keys are occasion groups or occasion ids.

export const OCCASION_THEME_REPEATS: Record<string, string[]> = {
  Birthday: ['celebration'],
  Parties: ['celebration'],
  Milestones: ['celebration', 'school'],
  // Love is the occasion itself on wedding and anniversary cards; hearts on the card are still listed as elements.
  Wedding: ['love'],
  Anniversary: ['love'],
  graduation: ['celebration', 'school'],
  school_event: ['school'],
  christmas: ['christmas_decor'],
  holiday_party: ['christmas_decor'],
  halloween: ['spooky'],
  valentines: ['love'],
}

/**
 * Words too general to be an occasion on their own ("Shower" could be a baby, bridal or couples shower).
 * AI tagging may not create these as new occasions.
 */
export const RESERVED_OCCASION_WORDS = new Set([
  'shower', 'party', 'celebration', 'event', 'ceremony', 'gathering', 'reception', 'day', 'night', 'announcement',
  'invitation', 'greeting', 'get together', 'meetup', 'festival', 'holiday',
])

/** Most themes a template keeps after AI tagging, most important first. */
export const MAX_THEMES = 3
/** A theme taken from elements needs this many visible elements that share it. */
export const MIN_ASSETS_FOR_THEME = 2

// ---- Moods ------------------------------------------------------------------
// How the design feels. Styles say how it is made (watercolor, rustic, photo…).

export const MOODS: SimpleDef[] = [
  { id: 'fun', label: 'Fun & Playful', phrases: ['fun', 'playful', 'funny', 'silly', 'cheerful', 'cheery', 'joyful', 'lively'] },
  { id: 'calm', label: 'Calm & Soft', phrases: ['calm', 'soft', 'serene', 'peaceful', 'gentle', 'dreamy', 'subtle'] },
  { id: 'heartfelt', label: 'Heartfelt', phrases: ['heartfelt', 'sentimental', 'touching', 'warm hearted'] },
  { id: 'bold', label: 'Bold & Energetic', phrases: ['bold', 'energetic', 'exciting', 'dramatic', 'striking', 'vibrant', 'loud'] },
  { id: 'cozy', label: 'Cozy', phrases: ['cozy', 'cosy', 'homey', 'snug'] },
  { id: 'solemn', label: 'Solemn', phrases: ['solemn', 'somber', 'sombre', 'respectful', 'dignified'] },
]

// ---- Languages --------------------------------------------------------------
// Printed languages. Queries match only the language names (not words written in that language).

export const LANGUAGES: SimpleDef[] = [
  { id: 'english', label: 'English', phrases: ['in english', 'english language'] },
  { id: 'spanish', label: 'Spanish', phrases: ['spanish', 'espanol', 'en espanol'] },
  { id: 'portuguese', label: 'Portuguese', phrases: ['portuguese', 'portugues'] },
  { id: 'french', label: 'French', phrases: ['french', 'francais', 'en francais'] },
  { id: 'german', label: 'German', phrases: ['german', 'deutsch'] },
  { id: 'italian', label: 'Italian', phrases: ['italian', 'italiano'] },
  { id: 'hindi', label: 'Hindi', phrases: ['hindi', 'sanskrit'] },
  { id: 'marathi', label: 'Marathi', phrases: ['marathi'] },
  { id: 'gujarati', label: 'Gujarati', phrases: ['gujarati'] },
  { id: 'punjabi', label: 'Punjabi', phrases: ['punjabi', 'gurmukhi'] },
  { id: 'bengali', label: 'Bengali', phrases: ['bengali', 'bangla'] },
  { id: 'tamil', label: 'Tamil', phrases: ['tamil'] },
  { id: 'telugu', label: 'Telugu', phrases: ['telugu'] },
  { id: 'urdu', label: 'Urdu', phrases: ['urdu'] },
  { id: 'arabic', label: 'Arabic', phrases: ['arabic', 'arabe', 'bil arabi'] },
  { id: 'zulu', label: 'Zulu & Xhosa', phrases: ['zulu', 'isizulu', 'xhosa', 'isixhosa'] },
  { id: 'other', label: 'Other', phrases: [] },
]

/** Scripts that name one language, for tagging cards by the letters they are printed in. */
export const SCRIPT_LANGUAGES: [RegExp, string][] = [
  [/\p{Script=Gujarati}/u, 'gujarati'],
  [/\p{Script=Gurmukhi}/u, 'punjabi'],
  [/\p{Script=Bengali}/u, 'bengali'],
  [/\p{Script=Tamil}/u, 'tamil'],
  [/\p{Script=Telugu}/u, 'telugu'],
]
/** Letters only Urdu (and Persian) use; Arabic-script text without them is Arabic. */
export const URDU_LETTERS = /[ٹڈڑںےۓھ]/u
/** Common Marathi words; Devanagari text with more of these than Hindi words is Marathi. */
export const MARATHI_WORDS = ['आहे', 'आणि', 'आपण', 'आपली', 'आपल्या', 'सोहळा', 'सस्नेह', 'नक्की', 'यांचा', 'यांच्या', 'यांची', 'करण्यात', 'येत', 'समारंभ', 'शुभविवाह', 'उपस्थित', 'राहावे', 'आमच्या', 'मुलगा', 'मुलगी', 'कृपया', 'चे', 'ची', 'ला']
export const HINDI_WORDS = ['है', 'हैं', 'और', 'में', 'की', 'का', 'के', 'आपको', 'आपका', 'पधारें', 'सादर', 'आमंत्रित', 'हमारे', 'हमारी', 'कृपया', 'साथ']
/** Zulu and Xhosa words printed on traditional ceremony cards. */
export const ZULU_WORDS = /\b(umemulo|umgidi|umembeso|isimemo|umndeni|uyanimema|ukumema|nguwo|umshado|isifanekiso)\b/i

// ---- Colors -----------------------------------------------------------------

export const COLORS: SimpleDef[] = [
  { id: 'pink', label: 'Pink', phrases: ['pink', 'blush', 'rose pink', 'hot pink', 'magenta', 'fuchsia', 'rosa'] },
  { id: 'red', label: 'Red', phrases: ['red', 'crimson', 'scarlet', 'ruby', 'cherry', 'rojo'] },
  { id: 'burgundy', label: 'Burgundy', phrases: ['burgundy', 'maroon', 'wine', 'marsala'] },
  { id: 'orange', label: 'Orange', phrases: ['orange', 'coral', 'peach', 'apricot', 'tangerine'] },
  { id: 'yellow', label: 'Yellow', phrases: ['yellow', 'mustard', 'lemon', 'amarillo'] },
  { id: 'gold', label: 'Gold', phrases: ['gold', 'golden', 'dorado', 'champagne gold'] },
  { id: 'green', label: 'Green', phrases: ['green', 'sage', 'emerald', 'olive', 'mint', 'forest green', 'verde'] },
  { id: 'teal', label: 'Teal', phrases: ['teal', 'turquoise', 'aqua', 'cyan'] },
  { id: 'blue', label: 'Blue', phrases: ['blue', 'sky blue', 'baby blue', 'dusty blue', 'cobalt', 'azul'] },
  { id: 'navy', label: 'Navy', phrases: ['navy', 'navy blue', 'midnight blue', 'royal blue'] },
  { id: 'purple', label: 'Purple', phrases: ['purple', 'lavender', 'lilac', 'violet', 'plum', 'mauve', 'morado'] },
  { id: 'black', label: 'Black', phrases: ['black', 'dark', 'noir', 'negro'] },
  { id: 'white', label: 'White', phrases: ['white', 'ivory', 'cream', 'blanco'] },
  { id: 'silver', label: 'Silver', phrases: ['silver', 'grey', 'gray', 'platinum', 'metallic'] },
  { id: 'brown', label: 'Brown & Neutral', phrases: ['brown', 'beige', 'tan', 'neutral', 'nude', 'kraft', 'taupe', 'earthy'] },
  { id: 'rose_gold', label: 'Rose Gold', phrases: ['rose gold'] },
  { id: 'pastel', label: 'Pastel', phrases: ['pastel', 'pastels'] },
  { id: 'multicolor', label: 'Multicolor', phrases: ['rainbow', 'multicolor', 'multicolour', 'colorful', 'colourful'] },
]

export const FORMAT_BY_ID = new Map(FORMATS.map((d) => [d.id, d]))
export const DOC_TYPE_BY_ID = new Map(DOC_TYPES.map((d) => [d.id, d]))
export const THEME_BY_ID = new Map(THEMES.map((d) => [d.id, d]))
export const STYLE_BY_ID = new Map(STYLES.map((d) => [d.id, d]))
export const COLOR_BY_ID = new Map(COLORS.map((d) => [d.id, d]))
export const AUDIENCE_BY_ID = new Map(AUDIENCES.map((d) => [d.id, d]))
export const MOOD_BY_ID = new Map(MOODS.map((d) => [d.id, d]))
export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((d) => [d.id, d]))
