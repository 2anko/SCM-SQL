import { createPortal } from 'react-dom'

/**
 * A render-target for PDF export. On screen this component renders nothing —
 * the wrapper is `display: none`. During webContents.printToPDF(), @media
 * print rules in index.css hide every other direct child of <body> and reveal
 * just this block, which is laid out as a normal flowing document so multi-
 * page output works without any positioning gymnastics.
 *
 * Renders via createPortal so the markup lives at body level (a sibling of
 * the Radix dialog portal), not inside the dialog's fixed-positioned chrome.
 *
 * Props:
 *   title       — string, big heading at the top
 *   subtitle    — optional string (e.g. "From 2026-04-17 to 2026-05-17")
 *   generatedAt — Date, shown beneath subtitle. Defaults to new Date().
 *   stats       — array of { label, value } — rendered as a row of small boxes
 *   sections    — array of { title, columns, rows, empty? } where:
 *                   columns = [{ header, accessor, align? }, …]
 *                     accessor: string property name OR (row) => ReactNode
 *                     align:    'right' for numeric columns
 *                   empty:    string to show when rows is empty (default "—")
 */
export default function PrintableReport({
  title,
  subtitle,
  generatedAt = new Date(),
  stats = [],
  sections = [],
}) {
  return createPortal(
    <div className="print-only">
      <h1>{title}</h1>
      {subtitle && <p className="pr-meta">{subtitle}</p>}
      <p className="pr-meta">Generated {generatedAt.toLocaleString()}</p>

      {stats.length > 0 && (
        <div className="pr-stats">
          {stats.map((s, i) => (
            <div key={i} className="pr-stat">
              <div className="pr-stat-label">{s.label}</div>
              <div className="pr-stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {sections.map((s, i) => (
        <section key={i}>
          <h2>{s.title}</h2>
          <PrintTable columns={s.columns} rows={s.rows} empty={s.empty} />
        </section>
      ))}
    </div>,
    document.body,
  )
}

function PrintTable({ columns, rows, empty = '—' }) {
  if (!rows || rows.length === 0) {
    return <p className="pr-empty">{empty}</p>
  }
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} style={c.align === 'right' ? { textAlign: 'right' } : null}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {columns.map((c, ci) => {
              const v = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor]
              return (
                <td key={ci} className={c.align === 'right' ? 'pr-num' : ''}>
                  {v == null || v === '' ? '—' : v}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
