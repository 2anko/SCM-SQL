import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Label } from './ui/label'
import { money, num } from '../lib/format'

/**
 * Pie chart that breaks a metric (quantity / value) into slices across one or
 * more groupings. The dropdown shows every {metric × group} combination so the
 * single chart + legend always fits in a dialog without overflow.
 *
 * Two ways to use it:
 *
 *   1. Single grouping (PO / SO summaries):
 *      <SummaryPieChart data={rows} valueKey="total_cost" valueLabel="Cost" />
 *
 *      Equivalent to passing one group keyed by `item_id` with SKU + name labels.
 *
 *   2. Multiple groupings (Inventory summary — by item, by warehouse):
 *      <SummaryPieChart
 *        valueKey="total_value"
 *        valueLabel="Value"
 *        groups={[
 *          { id: 'item',      label: 'by item',      data: byItem,
 *            idKey: 'item_id',      labelFor: r => `${r.sku} — ${r.item}` },
 *          { id: 'warehouse', label: 'by warehouse', data: byWarehouse,
 *            idKey: 'warehouse_id', labelFor: r => r.warehouse },
 *        ]}
 *      />
 *
 * Slice colour is derived from the row's id, so the same item (or warehouse) is
 * always the same colour — across metric switches AND across separate reports.
 */

// Tableau-10-ish palette. Deterministic per id so a given entity keeps its
// colour regardless of array order.
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
]
function colorFor(id) {
  const n = Number(id) || 0
  return PALETTE[Math.abs(n) % PALETTE.length]
}

export default function SummaryPieChart({ data, valueKey, valueLabel, groups }) {
  // Normalise: if `groups` isn't given, build one from the (data, valueKey) tuple.
  // The default grouping mirrors the original PO/SO behaviour: keyed by item_id,
  // with SKU + name in the legend.
  const resolvedGroups = useMemo(() => {
    if (groups && groups.length > 0) return groups
    return [{
      id:       'default',
      label:    '',
      data:     data ?? [],
      idKey:    'item_id',
      labelFor: r => `${r.sku ?? ''} — ${r.item ?? ''}`.trim().replace(/^—\s*/, ''),
    }]
  }, [groups, data])

  const hasMultipleGroups = resolvedGroups.length > 1

  // Build the dropdown choices: every (metric × group) pair.
  const options = useMemo(() => {
    const opts = []
    for (const g of resolvedGroups) {
      const suffix = g.label ? ` ${g.label}` : ''
      opts.push({ id: `${g.id}:value`,    label: `${valueLabel}${suffix}`,  groupId: g.id, metric: 'value' })
      opts.push({ id: `${g.id}:quantity`, label: `Quantity${suffix}`,       groupId: g.id, metric: 'quantity' })
    }
    return opts
  }, [resolvedGroups, valueLabel])

  const [selectedId, setSelectedId] = useState(options[0]?.id)
  const selected = options.find(o => o.id === selectedId) ?? options[0]
  const group    = resolvedGroups.find(g => g.id === selected?.groupId) ?? resolvedGroups[0]
  const metric   = selected?.metric ?? 'value'

  const { slices, total } = useMemo(() => {
    const key = metric === 'quantity' ? 'total_quantity' : valueKey
    const rows = (group?.data ?? [])
      .map(r => ({
        id:    r[group.idKey],
        label: group.labelFor(r),
        value: Number(r[key] || 0),
      }))
      .filter(r => r.value > 0)
    const total = rows.reduce((s, r) => s + r.value, 0)
    return { slices: rows, total }
  }, [group, metric, valueKey])

  // No data at all in any group? render nothing.
  const anyData = resolvedGroups.some(g => (g.data?.length ?? 0) > 0)
  if (!anyData) return null

  const fmt = metric === 'quantity' ? num : money

  return (
    <div className="rounded-md border border-gray-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">
          {hasMultipleGroups ? 'Breakdown' : 'Item breakdown'}
        </p>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">View</Label>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Nothing to show for this view.
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
                  {slices.map(s => <Cell key={s.id} fill={colorFor(s.id)} />)}
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
              .slice()
              .sort((a, b) => b.value - a.value)
              .map(s => {
                const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0'
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ background: colorFor(s.id) }}
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
