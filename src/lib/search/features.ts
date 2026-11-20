import type { SearchFilters } from './types'

/**
 * Free / PRO, off unless SEARCH_PRICE_FILTER_ENABLED=true. When off, "free" or "pro" in a query changes nothing
 * and the sidebar has no Free / PRO option. When on, the sidebar option filters, and "free" in a query ranks free
 * cards first (then PRO) without hiding any.
 */
export function isPriceFilterEnabled() {
  return process.env.SEARCH_PRICE_FILTER_ENABLED === 'true'
}

/** The filters without the Free / PRO choice when price filtering is off (e.g. an old link with ?price=free). */
export function withPriceFilterSetting<T extends SearchFilters>(filters: T): T {
  return isPriceFilterEnabled() || !filters.price ? filters : { ...filters, price: undefined }
}
