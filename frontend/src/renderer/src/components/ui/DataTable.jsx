// Generic data table used by every list page.
//
// columns: [{ header, accessor?: string, render?: (row) => ReactNode }, …]
// data:    array of row objects (or undefined/empty for empty state)

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

export default function DataTable({ columns, data, isLoading, onRowClick, emptyMessage = 'No data available' }) {
  if (isLoading) {
    return (
      <div className={wrapCls}>
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
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className={wrapCls}>
        <table className="w-full"><Header columns={columns} /></table>
        <div className="py-12 text-center text-slate-500">{emptyMessage}</div>
      </div>
    )
  }

  const rowCls = onRowClick
    ? 'border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer'
    : 'border-t border-slate-100 hover:bg-slate-50 transition-colors'

  return (
    <div className={wrapCls}>
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
    </div>
  )
}
