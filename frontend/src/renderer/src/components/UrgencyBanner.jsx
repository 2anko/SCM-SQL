import { urgencyPhrase } from '../lib/orderStatus'

/**
 * Top-of-page alert for orders approaching or past their expected date.
 * Used by the PO and SO list pages and the Dashboard.
 *
 * Props:
 *   urgent       — array of { po | so, level, days, ...row fields } from getDueUrgency
 *   overdueCount — number of overdue/today items (red tone)
 *   soonCount    — number of items due within 3 days (amber tone)
 *   kind         — 'PO' or 'SO' (used in the headline + item labels)
 */
export default function UrgencyBanner({ urgent, overdueCount, soonCount, kind = 'PO' }) {
  if (urgent.length === 0) return null

  // If anything is overdue, the whole banner skews red. Pure-soon is amber.
  const red = overdueCount > 0
  const bg  = red ? 'bg-red-50  border-red-200  text-red-800'  : 'bg-amber-50 border-amber-200 text-amber-800'

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${bg}`}>
      <p className="font-semibold">
        ⚠ {overdueCount > 0 && `${overdueCount} ${kind}${overdueCount === 1 ? '' : 's'} overdue`}
        {overdueCount > 0 && soonCount > 0 && ' · '}
        {soonCount > 0    && `${soonCount} due within 3 days`}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {urgent
          .slice()
          .sort((a, b) => a.days - b.days)         // most overdue first
          .slice(0, 5)                              // cap so we don't flood the screen
          .map(u => {
            const row = u.po ?? u.so ?? u
            const who = row.supplier ?? row.customer ?? ''
            return (
              <li key={row.id}>
                #{row.id}{who && ` — ${who}`}: <strong>{urgencyPhrase(u.days)}</strong>
              </li>
            )
          })
        }
        {urgent.length > 5 && (
          <li className="opacity-70">…and {urgent.length - 5} more</li>
        )}
      </ul>
    </div>
  )
}
