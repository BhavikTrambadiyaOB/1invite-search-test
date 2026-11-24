/** Gender review values shared by the server (gender-review.ts) and the review panel in the browser. */

export const GENDERS = ['girl', 'boy', 'neutral'] as const
export type Gender = (typeof GENDERS)[number]
export const GENDER_LABELS: Record<Gender, string> = { girl: 'Girl', boy: 'Boy', neutral: 'Neutral' }

/** The template's metadata as search uses it today (template_search), shown next to the AI answer. */
export type TemplateMeta = {
  occasion: string | null
  alsoOccasions: string[]
  milestone: number | null
  gender: string | null
  audience: string | null
  docType: string | null
  format: string | null
  themes: string[]
  assets: string[]
  styles: string[]
  colors: string[]
  colorShades: string[]
  moods: string[]
  languages: string[]
  hasPhoto: boolean
  isFree: boolean
}

export type GenderReviewRow = {
  templateId: number
  name: string
  occasion: string | null
  /** Gender when the AI checked the card. */
  currentGender: string | null
  aiGender: Gender
  confidence: number
  reason: string
  previewUrl: string | null
  status: 'pending' | 'reviewed'
  finalGender: Gender | null
  reviewedAt: string | null
  meta: TemplateMeta
}
