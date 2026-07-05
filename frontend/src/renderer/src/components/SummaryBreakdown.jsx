import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { money, num } from '../lib/format'
import { itemColor } from './SummaryPieChart'

/**
 * Two-level breakdown of a PO/SO summary: each ITEM split by a secondary
 * dimension (supplier for POs, customer for SOs).
 *
 * Data (`rows`) is a flat array of one row per (item × secondary):
 *   { item_id, sku, item, <secondaryIdKey>, <secondaryLabelKey>,
 *     total_quantity, <valueKey> }
 *
 * Controls:
 *   - metric toggle: Value (money) vs Quantity
 *   - viz toggle: Pie vs Bar (only one shown at a time to keep the page calm)
 *
 * Pie:  top-level pie by item; click a slice to drill into that item's
 *       secondary breakdown; a Back button returns to the item view.
 * Bar:  one stacked bar per item, segments coloured by secondary; hover shows
 *       the item's full breakdown. Fills the width when few items, scrolls
 *       horizontally when many.
 *
 * A text summary table (always shown) gives the exact organised totals.
 * Colour is deterministic per id, so a supplier/customer keeps the same colour
 * across the drill pie, the bar segments, and the text chips.
 */
export default function SummaryBreakdown({
  rows,
  valueKey,
  valueLabel,
  secondaryIdKey,
  secondaryLabelKey,
  secondaryNoun,
}) {
  const [metric, setMetric] = useState('value') // 'value' | 'quantity'
  const [viz, setViz]       = useState('pie')    // 'pie' | 'bar'
  const [drillId, setDrillId] = useState(null)   // item_id being drilled into (pie)

  const metricKey   = metric === 'quantity' ? 'total_quantity' : valueKey
  const fmt         = metric === 'quantity' ? num : money
  const metricLabel = metric === 'quantity' ? 'Quantity' : valueLabel

  // ── Aggregations ──────────────────────────────────────────────────────────
  // Items, summed over their secondaries, sorted by the active metric.
  const items = useMemo(() => {
    const map = new Map()
    for (const r of rows ?? []) {
      const v = Number(r[metricKey] || 0)
      if (!map.has(r.item_id)) map.set(r.item_id, { id: r.item_id, label: `${r.sku} — ${r.item}`, value: 0 })
      map.get(r.item_id).value += v
    }
    return [...map.values()].filter(x => x.value > 0).sort((a, b) => b.value - a.value)
  }, [rows, metricKey])

  const grandTotal = items.reduce((s, x) => s + x.value, 0)

  // Secondary breakdown for a single item.
  function secondariesFor(itemId) {
    const map = new Map()
    for (const r of rows ?? []) {
      if (r.item_id !== itemId) continue
      const v = Number(r[metricKey] || 0)
      if (v <= 0) continue
      const id = r[secondaryIdKey]
      if (!map.has(id)) map.set(id, { id, label: r[secondaryLabelKey], value: 0 })
      map.get(id).value += v
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }

  // Bar data: one object per item with sec_<id> keys; plus the distinct
  // secondaries so we can emit one <Bar> per secondary.
  const { barData, barSecondaries } = useMemo(() => {
    const secSet  = new Map()
    const perItem = new Map()
    for (const r of rows ?? []) {
      const v = Number(r[metricKey] || 0)
      if (v <= 0) continue
      secSet.set(r[secondaryIdKey], r[secondaryLabelKey])
      if (!perItem.has(r.item_id)) {
        perItem.set(r.item_id, { __label: `${r.sku} — ${r.item}`, __total: 0 })
      }
      const row = perItem.get(r.item_id)
      const key = `sec_${r[secondaryIdKey]}`
      row[key] = (row[key] || 0) + v
      row.__total += v
    }
    const data = [...perItem.values()].sort((a, b) => b.__total - a.__total)
    const secondaries = [...secSet.entries()].map(([id, label]) => ({ id, label }))
    return { barData: data, barSecondaries: secondaries }
  }, [rows, metricKey, secondaryIdKey, secondaryLabelKey])

  // Measure the wrapper so the bar chart fills the page when items are few and
  // scrolls when there are many.
  const wrapRef = useRef(null)
  const [wrapW, setWrapW] = useState(0)
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(entries => setWrapW(entries[0].contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])
  const PER_BAR = 90
  const chartW  = Math.max(barData.length * PER_BAR, wrapW || 600)

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 p-4 bg-white text-sm text-gray-400 text-center">
        Nothing to break down for this range.
      </div>
    )
  }

  const drillItem = drillId != null ? items.find(i => i.id === drillId) : null
  const drillSecs = drillItem ? secondariesFor(drillItem.id) : []
  const drillTotal = drillSecs.reduce((s, x) => s + x.value, 0)

  function axisTick(v) {
    if (metric === 'quantity') return num(v)
    if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
    return `$${v}`
  }

  function BarTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const entries = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value)
    const total = entries.reduce((s, p) => s + p.value, 0)
    return (
      <div className="rounded-md border border-gray-200 bg-white shadow-md px-3 py-2 text-xs max-w-xs">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        <p className="text-gray-500 mb-1.5">Total {metricLabel.toLowerCase()}: {fmt(total)}</p>
        <ul className="space-y-0.5">
          {entries.map(p => {
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0.0'
            return (
              <li key={p.dataKey} className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto pl-2 tabular-nums whitespace-nowrap">{fmt(p.value)} ({pct}%)</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white min-w-0">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-b border-gray-100 no-print">
        <p className="text-sm font-semibold text-gray-700">
          Breakdown by {secondaryNoun.toLowerCase()}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-gray-500">Metric</Label>
            <select
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              value={metric}
              onChange={e => setMetric(e.target.value)}
            >
              <option value="value">{valueLabel}</option>
              <option value="quantity">Quantity</option>
            </select>
          </div>
          <div className="inline-flex rounded-md border border-input overflow-hidden">
            {['pie', 'bar'].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setViz(v)}
                className={`px-3 h-8 text-sm capitalize ${viz === v ? 'bg-gray-900 text-white' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="p-4">
        {viz === 'pie' ? (
          drillItem ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setDrillId(null)}>← All items</Button>
                <p className="text-sm font-semibold text-gray-700">
                  {secondaryNoun} breakdown — {drillItem.label}
                </p>
              </div>
              <PieBlock slices={drillSecs} total={drillTotal} fmt={fmt} />
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">Click a slice to see its {secondaryNoun.toLowerCase()} breakdown.</p>
              <PieBlock
                slices={items}
                total={grandTotal}
                fmt={fmt}
                onSliceClick={id => setDrillId(id)}
              />
            </div>
          )
        ) : (
          <div ref={wrapRef} className="min-w-0">
            <div className="overflow-x-auto max-w-full">
              <BarChart
                width={chartW}
                height={340}
                data={barData}
                margin={{ top: 8, right: 12, bottom: 60, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="__label" interval={0} angle={-30} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={axisTick} tick={{ fontSize: 11 }} width={54} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                {barSecondaries.map(s => (
                  <Bar key={s.id} dataKey={`sec_${s.id}`} name={s.label} stackId="a" fill={itemColor(s.id)} isAnimationActive={false} />
                ))}
              </BarChart>
            </div>
            <p className="text-xs text-gray-400 mt-1">Hover a bar to see its {secondaryNoun.toLowerCase()} split. Scroll sideways if there are many items.</p>
          </div>
        )}
      </div>

      {/* Text summary — always shown, and the part that prints in the PDF */}
      <div className="px-4 pb-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Detailed totals</p>
        <div className="rounded-md border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Item / {secondaryNoun}</th>
                <th className="text-right px-3 py-2">{metricLabel}</th>
                <th className="text-right px-3 py-2">% of item</th>
                <th className="text-right px-3 py-2">% of total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const secs = secondariesFor(it.id)
                const itemPctTotal = grandTotal > 0 ? (it.value / grandTotal) * 100 : 0
                return (
                  <Fragment key={it.id}>
                    <tr className="border-t border-gray-200 bg-gray-50/60 font-medium">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: itemColor(it.id) }} />
                          {it.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(it.value)}</td>
                      <td className="px-3 py-2 text-right text-gray-400">—</td>
                      <td className="px-3 py-2 text-right tabular-nums">{itemPctTotal.toFixed(1)}%</td>
                    </tr>
                    {secs.map(s => {
                      const pctItem  = it.value > 0    ? (s.value / it.value)  * 100 : 0
                      const pctTotal = grandTotal > 0  ? (s.value / grandTotal) * 100 : 0
                      return (
                        <tr key={s.id} className="border-t border-gray-100 text-gray-600">
                          <td className="px-3 py-1.5 pl-8">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: itemColor(s.id) }} />
                              {s.label}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(s.value)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pctItem.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pctTotal.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Donut pie + legend list, shared by the item view and the drill view.
function PieBlock({ slices, total, fmt, onSliceClick }) {
  if (slices.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Nothing to show.</p>
  }
  return (
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
              onClick={onSliceClick ? (d => onSliceClick(d?.id ?? d?.payload?.id)) : undefined}
              style={onSliceClick ? { cursor: 'pointer' } : undefined}
            >
              {slices.map(s => <Cell key={s.id} fill={itemColor(s.id)} />)}
            </Pie>
            <Tooltip
              formatter={(v, _n, ctx) => {
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'
                return [`${fmt(v)}  (${pct}%)`, ctx.payload.label]
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-sm space-y-1 max-h-[260px] overflow-y-auto pr-2">
        {slices.map(s => {
          const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 ${onSliceClick ? 'cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1' : ''}`}
              onClick={onSliceClick ? () => onSliceClick(s.id) : undefined}
            >
              <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: itemColor(s.id) }} />
              <span className="flex-1 truncate" title={s.label}>{s.label}</span>
              <span className="tabular-nums text-gray-600">{fmt(s.value)}</span>
              <span className="tabular-nums text-gray-400 w-12 text-right">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
