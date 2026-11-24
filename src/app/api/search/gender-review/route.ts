import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GENDERS, saveGenderReview } from '@/lib/search/gender-review'

const bodySchema = z.object({
  templateId: z.number().int().positive(),
  // null clears the answer: the card goes back to "to review".
  finalGender: z.enum(GENDERS).nullable(),
})

/** Saves a person's gender answer for one card in template_gender_review. Template data is not changed. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid gender review' }, { status: 400 })

  const saved = await saveGenderReview(parsed.data.templateId, parsed.data.finalGender)
  if (!saved) return NextResponse.json({ error: 'Unknown template' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
