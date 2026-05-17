import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/ui/DataTable'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'
import SummaryPieChart from '../components/SummaryPieChart'

const STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
const STATUS_COLORS = {
  DRAFT:             'bg-slate-100 text-slate-700',
  CONFIRMED:         'bg-indigo-100 text-indigo-700',
  PARTIALLY_SHIPPED: 'bg-amber-100 text-amber-700',
  SHIPPED:           'bg-purple-100 text-purple-700',
  DELIVERED:         'bg-emerald-100 text-emerald-700',
  CANCELLED:         'bg-red-100 text-red-700',
}

function StatusPill({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

function fmt(v) { return v != null && v !== '' ? `$${Number(v).toFixed(2)}` : '—' }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString() : '—' }

/**
 * An SO is overdue when it's still DRAFT and its expected_date is at least
 * one full calendar day in the past. Mirrors the PO overdue logic.
 */
function isOverdue(so) {
  if (so.status !== 'DRAFT' || !so.expected_date) return false
  const expected = new Date(so.expected_date)
  if (isNaN(expected)) return false
  expected.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return (today - expected) / (1000 * 60 * 60 * 24) >= 1
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}
function nDaysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const EMPTY_LINE = { item_id: '', quantity_ordered: '', unit_price: '', source_warehouse_id: '' }

export default function SalesOrders() {
  const { user } = useAuth()
  // TODO(dev-only): remove 'dev' role checks before shipping
  const isDev     = user?.role === 'dev'
  const canCreate = isDev || user?.role === 'employee'
  const canWrite  = isDev || user?.role === 'section_manager'

  const [sos, setSos]               = useState([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [customers, setCustomers]   = useState([])
  const [items, setItems]           = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [showAdd, setShowAdd]       = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [detailId, setDetailId]     = useState(null)

  async function load() {
    setLoading(true)
    try {
      const path = `/sales-orders${statusFilter ? `?status=${statusFilter}` : ''}`
      setSos(await api.get(path))
    } finally { setLoading(false) }
  }
  async function loadDropdowns() {
    const [c, i, w] = await Promise.all([api.get('/customers'), api.get('/items'), api.get('/warehouses')])
    setCustomers(c); setItems(i); setWarehouses(w)
  }

  useEffect(() => { loadDropdowns() }, [])
  useEffect(() => { load() }, [statusFilter])

  const overdueCount = sos.filter(isOverdue).length

  const columns = [
    { header: 'SO #',     render: r => (
      <span className="inline-flex items-center gap-1.5">
        {isOverdue(r) && <span title="Overdue: still in DRAFT past expected date" className="text-red-600">⚠</span>}
        #{r.id}
      </span>
    )},
    { header: 'Customer', accessor: 'customer' },
    { header: 'Status',   render: r => <StatusPill status={r.status} /> },
    { header: 'Lines',    accessor: 'line_count' },
    { header: 'Total',    render: r => fmt(r.total_value) },
    { header: 'Expected', render: r => (
      <span className={isOverdue(r) ? 'text-red-600 font-medium' : ''}>{fmtDate(r.expected_date)}</span>
    )},
    { header: 'Created',  render: r => fmtDate(r.created_at) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Orders</h1>
          <p className="mt-1 text-sm text-gray-500">Create and track orders to customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSummary(true)}>Summary Report</Button>
          {canCreate && <Button onClick={() => setShowAdd(true)}>New Sales Order</Button>}
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>⚠ {overdueCount} sales order{overdueCount > 1 ? 's are' : ' is'} overdue</strong>
          {' '}— still in DRAFT status more than a day past its expected date.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Label className="text-xs text-gray-500">Status</Label>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={sos}
        isLoading={loading}
        emptyMessage="No sales orders yet"
        onRowClick={r => setDetailId(r.id)}
      />

      {showAdd && (
        <SOFormDialog
          mode="add"
          customers={customers}
          items={items}
          warehouses={warehouses}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load() }}
        />
      )}

      {detailId && (
        <SODetailDialog
          soId={detailId}
          customers={customers}
          items={items}
          warehouses={warehouses}
          canWrite={canWrite}
          onClose={() => setDetailId(null)}
          onChange={load}
        />
      )}

      {showSummary && (
        <SummaryReportDialog
          customers={customers}
          items={items}
          warehouses={warehouses}
          canWrite={canWrite}
          onChange={load}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}

// ── SO form dialog (add + edit) ───────────────────────────────────────────────

function SOFormDialog({ mode, existing, customers, items, warehouses, onClose, onSuccess }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState(() => {
    if (isEdit && existing) {
      return {
        customer_id:      String(existing.customer_id),
        shipping_address: existing.shipping_address || '',
        expected_date:    existing.expected_date ? existing.expected_date.split('T')[0] : '',
        lines: existing.lines.map(ln => ({
          item_id:             String(ln.item_id),
          quantity_ordered:    String(ln.quantity_ordered),
          unit_price:          String(ln.unit_price),
          source_warehouse_id: ln.source_warehouse_id ? String(ln.source_warehouse_id) : '',
        })),
      }
    }
    return { customer_id: '', shipping_address: '', expected_date: '', lines: [{ ...EMPTY_LINE }] }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [customerItems, setCustomerItems] = useState([])

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  function updateLine(idx, key, value) {
    setForm(p => ({ ...p, lines: p.lines.map((ln, i) => i === idx ? { ...ln, [key]: value } : ln) }))
  }

  // Fetch per-customer price list when customer changes
  useEffect(() => {
    let cancelled = false
    if (!form.customer_id) { setCustomerItems([]); return }
    api.get(`/customers/${form.customer_id}/items`)
      .then(rows => { if (!cancelled) setCustomerItems(rows) })
      .catch(() => { if (!cancelled) setCustomerItems([]) })
    return () => { cancelled = true }
  }, [form.customer_id])

  function suggestedPrice(itemId) {
    if (!itemId) return ''
    const ci = customerItems.find(r => String(r.item_id) === String(itemId))
    if (ci) return String(ci.unit_price)
    const item = items.find(i => String(i.id) === String(itemId))
    if (item?.unit_price != null) return String(item.unit_price)
    return ''
  }

  function handleLineItemChange(idx, newItemId) {
    setForm(p => ({
      ...p,
      lines: p.lines.map((ln, i) => {
        if (i !== idx) return ln
        const next = { ...ln, item_id: newItemId }
        if (!ln.unit_price) next.unit_price = suggestedPrice(newItemId)
        return next
      }),
    }))
  }
  function addLine()    { setForm(p => ({ ...p, lines: [...p.lines, { ...EMPTY_LINE }] })) }
  function removeLine(idx) {
    setForm(p => ({ ...p, lines: p.lines.length === 1 ? p.lines : p.lines.filter((_, i) => i !== idx) }))
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = {
        customer_id: Number(form.customer_id),
        ...(form.shipping_address && { shipping_address: form.shipping_address.trim() }),
        ...(form.expected_date    && { expected_date:    form.expected_date }),
        lines: form.lines.map(ln => ({
          item_id:          Number(ln.item_id),
          quantity_ordered: Number(ln.quantity_ordered),
          unit_price:       Number(ln.unit_price),
          ...(ln.source_warehouse_id && { source_warehouse_id: Number(ln.source_warehouse_id) }),
        })),
      }
      if (isEdit) {
        await api.patch(`/sales-orders/${existing.id}`, body)
      } else {
        await api.post('/sales-orders', body)
      }
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? `Edit Sales Order #${existing.id}` : 'New Sales Order'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Customer *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.customer_id} onChange={f('customer_id')} required>
              <option value="">Select…</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Shipping Address</Label>
            <Input className="mt-1" value={form.shipping_address} onChange={f('shipping_address')} />
          </div>
          <div>
            <Label>Expected Date</Label>
            <Input className="mt-1" type="date" value={form.expected_date} onChange={f('expected_date')} />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm font-semibold text-gray-700">Line Items</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>+ Add Line</Button>
            </div>
            {form.lines.map((ln, idx) => (
              <div key={idx} className="rounded-md border border-gray-200 p-3 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Line #{idx + 1}</p>
                  {form.lines.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(idx)}>Remove</Button>
                  )}
                </div>
                <div>
                  <Label>Item *</Label>
                  <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={ln.item_id} onChange={e => handleLineItemChange(idx, e.target.value)} required>
                    <option value="">Select…</option>
                    {items.map(i => {
                      const ci = customerItems.find(r => r.item_id === i.id)
                      const label = ci
                        ? `${i.sku} — ${i.name}  (this customer: $${Number(ci.unit_price).toFixed(2)})`
                        : `${i.sku} — ${i.name}`
                      return <option key={i.id} value={i.id}>{label}</option>
                    })}
                  </select>
                  {ln.item_id && (
                    <p className="mt-1 text-xs text-gray-500">
                      {(() => {
                        const ci = customerItems.find(r => String(r.item_id) === String(ln.item_id))
                        if (ci) return `Customer-specific price: $${Number(ci.unit_price).toFixed(2)}`
                        const item = items.find(i => String(i.id) === String(ln.item_id))
                        if (item?.unit_price != null) return `Catalogue default price: $${Number(item.unit_price).toFixed(2)} (no customer-specific price set)`
                        return 'No reference price set — enter unit price manually.'
                      })()}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Quantity *</Label>
                    <Input className="mt-1" type="number" step="0.01" min="0.01" value={ln.quantity_ordered} onChange={e => updateLine(idx, 'quantity_ordered', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Unit Price *</Label>
                    <Input className="mt-1" type="number" step="0.01" min="0" value={ln.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Source</Label>
                    <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={ln.source_warehouse_id} onChange={e => updateLine(idx, 'source_warehouse_id', e.target.value)}>
                      <option value="">— None —</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create SO')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── SO detail dialog ─────────────────────────────────────────────────────────

function SODetailDialog({ soId, customers, items, warehouses, canWrite, onClose, onChange }) {
  const [so, setSo]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [showShip, setShowShip] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  async function load() {
    setLoading(true)
    try { setSo(await api.get(`/sales-orders/${soId}`)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [soId])

  async function changeStatus(status) {
    setBusy(true); setError('')
    try {
      await api.patch(`/sales-orders/${soId}/status`, { status })
      await load(); onChange()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const editable    = so && so.status === 'DRAFT'
  const confirmable = so && so.status === 'DRAFT'
  const shippable   = so && ['CONFIRMED', 'PARTIALLY_SHIPPED'].includes(so.status)
  const cancellable = so && ['DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED'].includes(so.status)

  const missingSource = so?.lines?.filter(ln => ln.source_warehouse_id == null) ?? []

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sales Order #{soId}</DialogTitle></DialogHeader>

        {loading || !so ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">Customer: </span>{so.customer_name}</div>
              <div><span className="text-gray-500">Status: </span><StatusPill status={so.status} /></div>
              <div className="col-span-2"><span className="text-gray-500">Ship to: </span>{so.shipping_address || '—'}</div>
              <div><span className="text-gray-500">Expected: </span>{fmtDate(so.expected_date)}</div>
              <div><span className="text-gray-500">Created: </span>{fmtDate(so.created_at)}</div>
            </div>

            {canWrite && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {editable    && <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} disabled={busy}>Edit</Button>}
                  {confirmable && <Button size="sm" onClick={() => changeStatus('CONFIRMED')} disabled={busy}>Mark Confirmed</Button>}
                  {shippable   && (
                    <Button
                      size="sm"
                      onClick={() => setShowShip(true)}
                      disabled={busy || missingSource.length > 0}
                      title={missingSource.length > 0 ? `${missingSource.length} line(s) need a source warehouse first` : ''}
                    >
                      Mark Shipped (deduct from inventory)
                    </Button>
                  )}
                  {cancellable && <Button size="sm" variant="destructive" onClick={() => changeStatus('CANCELLED')} disabled={busy}>Cancel SO</Button>}
                </div>
                {shippable && missingSource.length > 0 && (
                  <p className="text-xs text-amber-700">
                    ⚠ {missingSource.length} line{missingSource.length > 1 ? 's' : ''} {missingSource.length > 1 ? 'have' : 'has'} no source warehouse set.
                    To ship this SO, edit (only available before marking Confirmed) and assign sources per line.
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Lines</p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Ordered</th>
                      <th className="text-right px-3 py-2">Shipped</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-left px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {so.lines.map(ln => (
                      <tr key={ln.id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{ln.sku}</td>
                        <td className="px-3 py-2">{ln.item_name}</td>
                        <td className="px-3 py-2 text-right">{ln.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right">{ln.quantity_shipped}</td>
                        <td className="px-3 py-2 text-right">{fmt(ln.unit_price)}</td>
                        <td className={`px-3 py-2 ${ln.source_warehouse_id == null ? 'text-amber-700' : ''}`}>
                          {ln.source_warehouse || <em>— not set —</em>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

        {showShip && (
          <ShipSODialog
            soId={soId}
            so={so}
            onClose={() => setShowShip(false)}
            onSuccess={() => { setShowShip(false); load(); onChange() }}
          />
        )}

        {showEdit && so && (
          <SOFormDialog
            mode="edit"
            existing={so}
            customers={customers}
            items={items}
            warehouses={warehouses}
            onClose={() => setShowEdit(false)}
            onSuccess={() => { setShowEdit(false); load(); onChange() }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Ship SO dialog (atomic, uses each line's source warehouse) ──────────────

function ShipSODialog({ soId, so, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleConfirm() {
    setSaving(true); setError('')
    try {
      await api.post(`/sales-orders/${soId}/ship`, {})
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const byWarehouse = {}
  for (const ln of so?.lines ?? []) {
    const key = ln.source_warehouse || '— not set —'
    if (!byWarehouse[key]) byWarehouse[key] = []
    byWarehouse[key].push(ln)
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Mark Sales Order Shipped</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          The following items will be deducted from inventory at each line's source warehouse.
          Once shipped, this SO is locked and cannot be edited or cancelled.
          Insufficient stock at any source will fail the whole operation.
        </p>
        <div className="rounded-md border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-left px-3 py-2">Items</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byWarehouse).map(([wh, lns]) => (
                <tr key={wh} className="border-t border-gray-200">
                  <td className="px-3 py-2 align-top font-medium">{wh}</td>
                  <td className="px-3 py-2">
                    <ul className="space-y-0.5">
                      {lns.map(ln => (
                        <li key={ln.id} className="text-sm">
                          {ln.sku} {ln.item_name} — <strong>{Number(ln.quantity_ordered) - Number(ln.quantity_shipped)}</strong>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving}>{saving ? 'Shipping…' : 'Confirm & Ship'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Summary Report dialog ──────────────────────────────────────────────────

function SummaryReportDialog({ customers, items, warehouses, canWrite, onChange, onClose }) {
  const [from, setFrom]       = useState(nDaysAgoISO(30))
  const [to, setTo]           = useState(todayISO())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [drillId, setDrillId] = useState(null) // SO id opened from a summary row

  async function generate(e) {
    e?.preventDefault()
    if (!from || !to) return
    if (from > to) { setError('Start date must be on or before end date.'); return }
    setLoading(true); setError(''); setData(null)
    try {
      const qs = new URLSearchParams({ from, to }).toString()
      setData(await api.get(`/sales-orders/summary?${qs}`))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sales Order Summary</DialogTitle></DialogHeader>

        <form onSubmit={generate} className="flex items-end gap-3 flex-wrap">
          <div>
            <Label>From</Label>
            <Input className="mt-1" type="date" value={from} onChange={e => setFrom(e.target.value)} required />
          </div>
          <div>
            <Label>To</Label>
            <Input className="mt-1" type="date" value={to}   onChange={e => setTo(e.target.value)}   required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>{loading ? 'Generating…' : 'Generate'}</Button>
            <Button type="button" variant="outline" onClick={() => { setFrom(nDaysAgoISO(7));  setTo(todayISO()) }}>Last 7 days</Button>
            <Button type="button" variant="outline" onClick={() => { setFrom(nDaysAgoISO(30)); setTo(todayISO()) }}>Last 30 days</Button>
            <Button type="button" variant="outline" onClick={() => { setFrom(nDaysAgoISO(90)); setTo(todayISO()) }}>Last 90 days</Button>
          </div>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Sales Orders shipped</p>
                <p className="text-2xl font-bold mt-1 text-purple-600">{data.totals.so_count}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{fmt(data.totals.total_value)}</p>
              </div>
            </div>

            <SummaryPieChart data={data.by_item} valueKey="total_value" valueLabel="Revenue" />

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Items Sold ({data.by_item.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Quantity</th>
                      <th className="text-right px-3 py-2">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_item.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No items sold in this range.</td></tr>
                    ) : data.by_item.map(r => (
                      <tr key={r.item_id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{r.sku}</td>
                        <td className="px-3 py-2">{r.item}</td>
                        <td className="px-3 py-2 text-right">{Number(r.total_quantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Sales Orders in range ({data.sos.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">SO #</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Lines</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-left px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sos.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No SOs in this range.</td></tr>
                    ) : data.sos.map(s => (
                      <tr
                        key={s.id}
                        className="border-t border-gray-200 cursor-pointer hover:bg-gray-50"
                        onClick={() => setDrillId(s.id)}
                        title="Click to view this SO's details"
                      >
                        <td className="px-3 py-2">#{s.id}</td>
                        <td className="px-3 py-2">{s.customer}</td>
                        <td className="px-3 py-2"><StatusPill status={s.status} /></td>
                        <td className="px-3 py-2 text-right">{s.line_count}</td>
                        <td className="px-3 py-2 text-right">{fmt(s.total_value)}</td>
                        <td className="px-3 py-2">{fmtDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

        {drillId && (
          <SODetailDialog
            soId={drillId}
            customers={customers}
            items={items}
            warehouses={warehouses}
            canWrite={canWrite}
            onClose={() => setDrillId(null)}
            onChange={() => {
              // Refresh parent list AND re-run this summary so status changes
              // (ship/cancel) reflect immediately in the report.
              onChange?.()
              if (from && to) {
                const qs = new URLSearchParams({ from, to }).toString()
                api.get(`/sales-orders/summary?${qs}`).then(setData).catch(() => {})
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
