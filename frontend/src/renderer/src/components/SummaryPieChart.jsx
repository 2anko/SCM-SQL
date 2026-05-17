import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Label } from './ui/label'

/**
 * Two pie charts from the same `data` rows — one by quantity, one by money —
 * switched via a dropdown so the chart + legend always fits in the dialog.
 * Same item gets the same colour across both views (keyed by item_id), so users
 * can mentally cross-reference qty share vs. revenue share.
 *
 * Props:
 *   data       — array of rows with shape { item_id, sku, item, total_quantity, <valueKey> }
 *   valueKey   — name of the money column on each row (e.g. 'total_cost' for PO, 'total_value' for SO)
 *   valueLabel — human label for the money axis (e.g. 'Cost', 'Revenue')
 */

// Tableau-10-ish palette. Deterministic per item_id, so a given item is always
// the same colour across both pies (and across multiple report runs).
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
]
function colorFor(itemId) {
  // Hash the id so items keep stable colours regardless of array order.
  const n = Number(itemId) || 0
  return PALETTE[Math.abs(n) % PALETTE.length]
}

function fmtMoney(v) { return `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function fmtNum(v)   { return Number(v || 0).toLocaleString() }

export default function SummaryPieChart({ data, valueKey, valueLabel }) {
  const [metric, setMetric] = useState('value') // 'quantity' | 'value'

  // Pre-compute both series. Filter out rows whose value is 0/null for that metric
  // so the chart doesn't render invisible slices that still clutter the legend.
  const { slices, total } = useMemo(() => {
    const key = metric === 'quantity' ? 'total_quantity' : valueKey
    const rows = (data ?? [])
      .map(r => ({
        item_id: r.item_id,
        label:   `${r.sku} — ${r.item}`,
        value:   Number(r[key] || 0),
      }))
      .filter(r => r.value > 0)
    const total = rows.reduce((s, r) => s + r.value, 0)
    return { slices: rows, total }
  }, [data, metric, valueKey])

  if (!data || data.length === 0) return null

  const metricLabel = metric === 'quantity' ? 'Quantity' : valueLabel
  const fmt = metric === 'quantity' ? fmtNum : fmtMoney

  return (
    <div className="rounded-md border border-gray-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Item breakdown</p>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">View</Label>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={metric}
            onChange={e => setMetric(e.target.value)}
          >
            <option value="value">{valueLabel}</option>
            <option value="quantity">Quantity</option>
          </select>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No {metricLabel.toLowerCase()} to show in this range.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-center">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={1}
                  isAnimationActive={false}
                >
                  {slices.map(s => <Cell key={s.item_id} fill={colorFor(s.item_id)} />)}
                </Pie>
                <Tooltip
                  formatter={(v, _name, ctx) => {
                    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
                    return [`${fmt(v)}  (${pct}%)`, ctx.payload.label]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="text-sm space-y-1 max-h-[260px] overflow-y-auto pr-2">
            {slices
              .slice() // don't mutate
              .sort((a, b) => b.value - a.value)
              .map(s => {
                const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'
                return (
                  <li key={s.item_id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ background: colorFor(s.item_id) }}
                    />
                    <span className="flex-1 truncate" title={s.label}>{s.label}</span>
                    <span className="tabular-nums text-gray-600">{fmt(s.value)}</span>
                    <span className="tabular-nums text-gray-400 w-12 text-right">{pct}%</span>
                  </li>
                )
              })
            }
          </ul>
        </div>
      )}
    </div>
  )
}

export { colorFor as itemColor }
