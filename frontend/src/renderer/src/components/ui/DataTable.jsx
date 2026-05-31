// Generic data table used by every list page.
//
// columns: [{ header, accessor?: string, render?: (row) => ReactNode }, …]
// data:    array of row objects (or undefined/empty for empty state)
//
// Optional server-side pagination:
//   pagination={{ page, pageSize, total, onPageChange }}
// When provided, a footer with the row range + Prev/Next is rendered. The page
// data itself still comes in via `data` — the parent fetches one page at a time.

const wrapCls = 'rounded-xl border border-slate-200 overflow-hidden'
const headCls = 'text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider'
const cellCls = 'px-4 py-3 text-sm text-slate-700'

function Header({ columns }) {
  return (
    <thead className="bg-slate-50">
      <tr>{columns.map((c, i) => <th key={i} className={headCls}>{c.header}</th>)}</tr>
    </thead>
  )
}

export default function DataTable({ columns, data, isLoading, onRowClick, emptyMessage = 'No data available', pagination }) {
  const rowCls = onRowClick
    ? 'border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer'
    : 'border-t border-slate-100 hover:bg-slate-50 transition-colors'

  let body
  if (isLoading) {
    body = (
      <table className="w-full">
        <Header columns={columns} />
        <tbody>
          {Array.from({ length: 5 }).map((_, r) => (
            <tr key={r} className="border-t border-slate-100">
              {columns.map((_, c) => (
                <td key={c} className={cellCls}>
                  <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  } else if (!data?.length) {
    body = (
      <>
        <table className="w-full"><Header columns={columns} /></table>
        <div className="py-12 text-center text-slate-500">{emptyMessage}</div>
      </>
    )
  } else {
    body = (
      <table className="w-full">
        <Header columns={columns} />
        <tbody>
          {data.map((row, ri) => (
            <tr key={row.id ?? ri} className={rowCls} onClick={() => onRowClick?.(row)}>
              {columns.map((c, ci) => (
                <td key={ci} className={cellCls}>
                  {c.render ? c.render(row) : row[c.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className={wrapCls}>
      {body}
      {pagination && <Pagination {...pagination} isLoading={isLoading} />}
    </div>
  )
}

function Pagination({ page, pageSize, total, onPageChange, isLoading }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)
  const canPrev = page > 1
  const canNext = page < totalPages

  const btn = 'px-3 py-1 text-sm rounded-md border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50'

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
      <span>
        {isLoading ? 'Loading…' : <>Showing <strong>{start.toLocaleString()}</strong>–<strong>{end.toLocaleString()}</strong> of <strong>{total.toLocaleString()}</strong></>}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Page {page} of {totalPages.toLocaleString()}</span>
        <button className={btn} onClick={() => onPageChange(page - 1)} disabled={!canPrev || isLoading}>Prev</button>
        <button className={btn} onClick={() => onPageChange(page + 1)} disabled={!canNext || isLoading}>Next</button>
      </div>
    </div>
  )
}
