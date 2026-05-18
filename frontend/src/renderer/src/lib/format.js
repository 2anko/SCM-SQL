// Shared display formatters. All return an em-dash for nullish / empty inputs
// so tables read consistently across pages.

const EMPTY = '—'

/** Money with two decimals: `$1,234.56` or `—`. */
export function money(v) {
  if (v == null || v === '') return EMPTY
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Short date string in the user's locale, or `—`. */
export function date(s) {
  if (!s) return EMPTY
  const d = new Date(s)
  return isNaN(d) ? EMPTY : d.toLocaleDateString()
}

/** Date + time, for transaction timestamps. */
export function datetime(s) {
  if (!s) return EMPTY
  const d = new Date(s)
  return isNaN(d) ? EMPTY : d.toLocaleString()
}

/** Number with thousands separators: `1,234`. */
export function num(v) {
  return Number(v || 0).toLocaleString()
}
