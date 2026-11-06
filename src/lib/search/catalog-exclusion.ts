/** Catalogs whose templates are not suitable: hidden from search results and tag suggestions. */
export const EXCLUDED_CATALOG_IDS = [1058, 1079, 1081, 1082, 1083, 1084, 1088, 2186] as const

/** SQL condition that is true when the template (by its table alias) is not in an excluded catalog. */
export function catalogExclusion(templateAlias: string) {
  return `not exists (
    select 1 from images i
     where i.id = ${templateAlias}.template_id
       and i.catalog_id = any(array[${EXCLUDED_CATALOG_IDS.join(', ')}]::int[])
  )`
}
