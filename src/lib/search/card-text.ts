/**
 * Pulls the printed text out of a template's `json_data`.
 *
 * `json_data` is stored as JSON with escaped quotes ({\"123\":{\"text_json\":[...]}}),
 * keyed by page id. Each page has text layers in `text_json` and `curved_text_json`.
 */

type TextLayer = {
  text?: unknown
  yPos?: unknown
  xPos?: unknown
  is_brand_address?: unknown
  is_company_address?: unknown
  is_brand_phone?: unknown
  is_contact_number?: unknown
  is_brand_contact_detail?: unknown
}

type Page = { text_json?: TextLayer[]; curved_text_json?: TextLayer[] }

// Layers flagged as contact details are sample data, not template wording.
const PLACEHOLDER_FLAGS = [
  'is_brand_address',
  'is_company_address',
  'is_brand_phone',
  'is_contact_number',
  'is_brand_contact_detail',
] as const

// Sample contact lines used across many templates.
const PLACEHOLDER_PATTERNS = [
  /\+?\d[\d\s().-]{7,}\d/, // phone numbers
  /\b\d{2,5}\s+\w+(\s\w+)?\s+(lane|street|st|avenue|ave|road|rd|drive|dr|blvd|way)\b/i, // street addresses
  /@[\w.-]+\.\w+/, // emails
  /\bwww\.|https?:\/\//i, // urls
]

export function parseTemplateJson(raw: string | null | undefined): Record<string, Page> | null {
  if (!raw) return null
  try {
    // Escaped form: decode it as a JSON string first, then as an object.
    const decoded = raw.startsWith('{\\"') ? (JSON.parse(`"${raw}"`) as string) : raw
    const value: unknown = JSON.parse(decoded)
    return value && typeof value === 'object' ? (value as Record<string, Page>) : null
  } catch {
    return null
  }
}

function isPlaceholder(layer: TextLayer, text: string) {
  if (PLACEHOLDER_FLAGS.some((flag) => Number(layer[flag]) === 1)) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Returns the card text in reading order (top to bottom, page by page),
 * with contact placeholders removed and whitespace collapsed.
 */
export function extractCardText(raw: string | null | undefined, pageOrder?: string | null): string {
  const pages = parseTemplateJson(raw)
  if (!pages) return ''

  const order = (pageOrder ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id in pages)
  const pageIds = order.length > 0 ? order : Object.keys(pages)

  const lines: string[] = []
  for (const pageId of pageIds) {
    const page = pages[pageId]
    if (!page || typeof page !== 'object') continue
    const layers = [...(page.text_json ?? []), ...(page.curved_text_json ?? [])]
      .filter((layer): layer is TextLayer => !!layer && typeof layer === 'object')
      .sort((a, b) => Number(a.yPos ?? 0) - Number(b.yPos ?? 0) || Number(a.xPos ?? 0) - Number(b.xPos ?? 0))

    for (const layer of layers) {
      if (typeof layer.text !== 'string') continue
      const text = layer.text.replace(/\s+/g, ' ').trim()
      if (!text || isPlaceholder(layer, text)) continue
      lines.push(text)
    }
  }

  return [...new Set(lines)].join(' | ')
}

// Image layers that the user fills with their own photo.
const PHOTO_LAYER_KEYS = ['frame_image_sticker_json', 'sticker_json', 'image_sticker_json'] as const

/**
 * True when the template has a place for the user's photo: a photo frame layer,
 * or a sticker flagged as a personal photo.
 */
export function hasPhotoSlot(raw: string | null | undefined): boolean {
  const pages = parseTemplateJson(raw)
  if (!pages) return false
  for (const page of Object.values(pages) as Record<string, unknown>[]) {
    if (!page || typeof page !== 'object') continue
    const frames = page.frame_image_sticker_json
    if (Array.isArray(frames) && frames.length > 0) return true
    for (const key of PHOTO_LAYER_KEYS) {
      const layers = page[key]
      if (Array.isArray(layers) && layers.some((l) => l && Number((l as { is_personal_photo?: unknown }).is_personal_photo) === 1)) {
        return true
      }
    }
  }
  return false
}
