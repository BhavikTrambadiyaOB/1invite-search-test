import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Hand-checked templates with the tags they should get (scripts/template-test-set.json).
 * Values may be ids or everyday words ("mortarboard", "Floral & Botanical", "girl").
 * Leave out any field you do not want checked.
 */
export type TestTemplate = {
  id: number
  note?: string
  expect: {
    occasion?: string
    gender?: string
    milestone?: number | null
    format?: string
    docType?: string
    themes?: string[]
    assets?: string[]
    styles?: string[]
    colors?: string[]
    moods?: string[]
    colorShades?: string[]
    extraOccasions?: string[]
    languages?: string[]
    hasPhoto?: boolean
  }
}

export const TEST_SET_PATH = path.join(process.cwd(), 'scripts', 'template-test-set.json')

export async function loadTestSet(): Promise<TestTemplate[]> {
  const list = JSON.parse(await readFile(TEST_SET_PATH, 'utf8')) as TestTemplate[]
  if (!Array.isArray(list)) throw new Error(`${TEST_SET_PATH} must be a JSON array`)
  return list
}
