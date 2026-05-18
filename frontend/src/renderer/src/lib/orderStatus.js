// Urgency calculations for orders we're waiting on — POs sent to a supplier
// that haven't been received yet, and SOs committed to a customer that haven't
// shipped yet. DRAFT orders are NOT flagged: we haven't committed externally,
// so a late expected date is just our own planning, not a problem with anyone.
//
// Warning window: starts 3 days before expected_date, escalates to red on the
// expected day, and stays red afterwards.

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Statuses where an order is "in flight" — we've made an external commitment
 * but the goods haven't moved yet. These are the statuses the urgency check
 * cares about.
 */
export const PO_IN_FLIGHT = ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED']
export const SO_IN_FLIGHT = ['CONFIRMED', 'PARTIALLY_SHIPPED']

/** Calendar days from today to dateStr (signed). null if dateStr is empty/invalid. */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (isNaN(target)) return null
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / MS_PER_DAY)
}

/**
 * Urgency for an order { status, expected_date }. Returns { level, days }:
 *   level: 'overdue' (days < 0) | 'today' (days === 0) | 'soon' (1-3) | null
 *   days:  signed integer; null when status disqualifies the order
 *
 * Pass the array of statuses that should be considered "in flight" — typically
 * PO_IN_FLIGHT or SO_IN_FLIGHT. DRAFT and terminal statuses are not flagged.
 */
export function getDueUrgency({ status, expected_date }, inFlightStatuses) {
  if (!inFlightStatuses.includes(status)) return { level: null, days: null }
  const days = daysUntil(expected_date)
  if (days == null) return { level: null, days: null }
  if (days < 0)     return { level: 'overdue', days }
  if (days === 0)   return { level: 'today',   days }
  if (days <= 3)    return { level: 'soon',    days }
  return { level: null, days }
}

/** Plain-English phrase: "due today" / "in 2 days" / "1 day overdue". */
export function urgencyPhrase(days) {
  if (days == null) return ''
  if (days === 0)   return 'due today'
  if (days > 0)     return `in ${days} day${days === 1 ? '' : 's'}`
  return `${-days} day${days === -1 ? '' : 's'} overdue`
}

/** Tailwind text-colour class for an urgency level. */
export const URGENCY_TEXT = {
  overdue: 'text-red-600',
  today:   'text-red-600',
  soon:    'text-amber-600',
}
