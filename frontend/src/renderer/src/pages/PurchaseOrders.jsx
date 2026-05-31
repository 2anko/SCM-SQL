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
import PrintableReport from '../components/PrintableReport'
import { exportPDF, defaultPdfName } from '../api/pdf'
import { money as fmt, date as fmtDate } from '../lib/format'
import { getDueUrgency, urgencyPhrase, URGENCY_TEXT, PO_IN_FLIGHT } from '../lib/orderStatus'
import { getPermissions } from '../lib/permissions'
import UrgencyBanner from '../components/UrgencyBanner'

const STATUSES = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']
const STATUS_COLORS = {
  DRAFT:              'bg-slate-100 text-slate-700',
  SENT:               'bg-blue-100 text-blue-700',
  CONFIRMED:          'bg-indigo-100 text-indigo-700',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700',
  RECEIVED:           'bg-emerald-100 text-emerald-700',
  CANCELLED:          'bg-red-100 text-red-700',
}

function StatusPill({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}
function nDaysAgoISO(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const EMPTY_ITEM_NEW    = { sku: '', name: '', description: '', unit_of_measure: '', value: '' }
const EMPTY_FACTORY_NEW = { name: '', address: '', country: '', rep_name: '', rep_email: '', rep_phone: '' }
const EMPTY_LINE        = { item_id: '', quantity_ordered: '', unit_cost: '', destination_warehouse_id: '', item_new: { ...EMPTY_ITEM_NEW } }

export default function PurchaseOrders() {
  const { user } = useAuth()
  const { canCreate, canWrite } = getPermissions(user)

  const PAGE_SIZE = 50
  const [pos, setPos]               = useState({ rows: [], total: 0 })
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [suppliers, setSuppliers]   = useState([])
  const [items, setItems]           = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [showAdd, setShowAdd]       = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [detailId, setDetailId]     = useState(null)

  async function refreshItems() {
    setItems(await api.get('/items'))
  }

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page, pageSize: PAGE_SIZE })
      if (statusFilter) qs.set('status', statusFilter)
      setPos(await api.get(`/purchase-orders?${qs}`))
    } finally { setLoading(false) }
  }
  async function loadDropdowns() {
    const [s, i, w] = await Promise.all([api.get('/suppliers'), api.get('/items'), api.get('/warehouses')])
    setSuppliers(s); setItems(i); setWarehouses(w)
  }

  useEffect(() => { loadDropdowns() }, [])
  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { load() }, [statusFilter, page])

  // Urgency among the POs on the CURRENT page (banner is a per-page view;
  // the Dashboard shows the complete cross-page urgency picture).
  const urgent = pos.rows
    .map(p => ({ po: p, ...getDueUrgency(p, PO_IN_FLIGHT) }))
    .filter(u => u.level)
  const overdueCount = urgent.filter(u => u.level === 'overdue' || u.level === 'today').length
  const soonCount    = urgent.filter(u => u.level === 'soon').length

  const columns = [
    { header: 'PO #',     render: r => {
      const { level } = getDueUrgency(r, PO_IN_FLIGHT)
      return (
        <span className="inline-flex items-center gap-1.5">
          {level && (
            <span title={urgencyPhrase(getDueUrgency(r, PO_IN_FLIGHT).days)} className={URGENCY_TEXT[level]}>⚠</span>
          )}
          #{r.id}
        </span>
      )
    }},
    { header: 'Supplier', accessor: 'supplier' },
    { header: 'Factory',  render: r => r.factory || '—' },
    { header: 'Status',   render: r => <StatusPill status={r.status} /> },
    { header: 'Lines',    accessor: 'line_count' },
    { header: 'Total',    render: r => fmt(r.total_value) },
    { header: 'Expected', render: r => {
      const { level, days } = getDueUrgency(r, PO_IN_FLIGHT)
      return (
        <span className={level ? `${URGENCY_TEXT[level]} font-medium` : ''}>
          {fmtDate(r.expected_date)}
          {level && <span className="ml-1 text-xs font-normal">({urgencyPhrase(days)})</span>}
        </span>
      )
    }},
    { header: 'Created',  render: r => fmtDate(r.created_at) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-gray-500">Create and track orders from suppliers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSummary(true)}>Summary Report</Button>
          {canCreate && <Button onClick={() => setShowAdd(true)}>New Purchase Order</Button>}
        </div>
      </div>

      {urgent.length > 0 && (
        <UrgencyBanner urgent={urgent} overdueCount={overdueCount} soonCount={soonCount} kind="PO" />
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
        data={pos.rows}
        isLoading={loading}
        emptyMessage="No purchase orders yet"
        onRowClick={r => setDetailId(r.id)}
        pagination={{ page, pageSize: PAGE_SIZE, total: pos.total, onPageChange: setPage }}
      />

      {showAdd && (
        <POFormDialog
          mode="add"
          suppliers={suppliers}
          items={items}
          warehouses={warehouses}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load() }}
        />
      )}

      {detailId && (
        <PODetailDialog
          poId={detailId}
          suppliers={suppliers}
          items={items}
          warehouses={warehouses}
          canWrite={canWrite}
          onClose={() => setDetailId(null)}
          onChange={load}
          onItemsChange={refreshItems}
        />
      )}

      {showSummary && (
        <SummaryReportDialog
          suppliers={suppliers}
          items={items}
          warehouses={warehouses}
          canWrite={canWrite}
          onChange={load}
          onItemsChange={refreshItems}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  )
}

// ── New PO dialog ─────────────────────────────────────────────────────────────

function POFormDialog({ mode, existing, suppliers, items, warehouses, onClose, onSuccess }) {
  const isEdit = mode === 'edit'
  const [supplierItems, setSupplierItems] = useState([]) // rows for the currently selected supplier
  const [form, setForm] = useState(() => {
    if (isEdit && existing) {
      return {
        supplier_id:   String(existing.supplier_id),
        factory_id:    existing.factory_id ? String(existing.factory_id) : '',
        expected_date: existing.expected_date ? existing.expected_date.split('T')[0] : '',
        factory_new:   { ...EMPTY_FACTORY_NEW },
        lines: existing.lines.map(ln => ({
          item_id:                  String(ln.item_id),
          quantity_ordered:         String(ln.quantity_ordered),
          unit_cost:                String(ln.unit_cost),
          destination_warehouse_id: ln.destination_warehouse_id ? String(ln.destination_warehouse_id) : '',
          item_new:                 { ...EMPTY_ITEM_NEW },
        })),
      }
    }
    return {
      supplier_id: '',
      factory_id: '',
      expected_date: '',
      factory_new: { ...EMPTY_FACTORY_NEW },
      lines: [{ ...EMPTY_LINE, item_new: { ...EMPTY_ITEM_NEW } }],
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  function updateLine(idx, key, value) {
    setForm(p => ({ ...p, lines: p.lines.map((ln, i) => i === idx ? { ...ln, [key]: value } : ln) }))
  }
  function updateLineItemNew(idx, key, value) {
    setForm(p => ({
      ...p,
      lines: p.lines.map((ln, i) => i === idx ? { ...ln, item_new: { ...ln.item_new, [key]: value } } : ln),
    }))
  }
  function updateFactoryNew(key, value) {
    setForm(p => ({ ...p, factory_new: { ...p.factory_new, [key]: value } }))
  }
  function addLine() {
    setForm(p => ({ ...p, lines: [...p.lines, { ...EMPTY_LINE, item_new: { ...EMPTY_ITEM_NEW } }] }))
  }
  function removeLine(idx) {
    setForm(p => ({ ...p, lines: p.lines.length === 1 ? p.lines : p.lines.filter((_, i) => i !== idx) }))
  }

  const selectedSupplier = suppliers.find(s => String(s.id) === String(form.supplier_id))
  const factories = selectedSupplier?.factories ?? []

  // When supplier changes, fetch their item costs for auto-prefill
  useEffect(() => {
    let cancelled = false
    if (!form.supplier_id) { setSupplierItems([]); return }
    api.get(`/suppliers/${form.supplier_id}/items`)
      .then(rows => { if (!cancelled) setSupplierItems(rows) })
      .catch(() => { if (!cancelled) setSupplierItems([]) })
    return () => { cancelled = true }
  }, [form.supplier_id])

  // Resolve the suggested unit cost for an item from this supplier:
  // supplier_items override → items catalogue value → blank
  function suggestedCost(itemId) {
    if (!itemId || itemId === 'NEW') return ''
    const si = supplierItems.find(r => String(r.item_id) === String(itemId))
    if (si) return String(si.unit_cost)
    const item = items.find(i => String(i.id) === String(itemId))
    if (item?.value != null) return String(item.value)
    return ''
  }

  // When user changes an item on a line, prefill that line's unit_cost
  // (but only if it's empty — don't overwrite an already-entered value)
  function handleLineItemChange(idx, newItemId) {
    setForm(p => ({
      ...p,
      lines: p.lines.map((ln, i) => {
        if (i !== idx) return ln
        const next = { ...ln, item_id: newItemId }
        if (!ln.unit_cost) next.unit_cost = suggestedCost(newItemId)
        return next
      }),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      // 1. Create new factory if requested
      let factoryId = form.factory_id
      if (factoryId === 'NEW') {
        const fNew = form.factory_new
        const facBody = {
          name: fNew.name.trim(),
          ...(fNew.address && { address: fNew.address.trim() }),
          ...(fNew.country && { country: fNew.country.trim() }),
          ...(fNew.rep_name.trim() && {
            rep: {
              name: fNew.rep_name.trim(),
              ...(fNew.rep_email && { email: fNew.rep_email.trim() }),
              ...(fNew.rep_phone && { phone: fNew.rep_phone.trim() }),
            },
          }),
        }
        const created = await api.post(`/suppliers/${form.supplier_id}/factories`, facBody)
        factoryId = created.id
      }

      // 2. Create new items where requested, then build line bodies
      const resolvedLines = []
      for (const ln of form.lines) {
        let itemId = ln.item_id
        if (itemId === 'NEW') {
          const iNew = ln.item_new
          const itemBody = {
            sku:  iNew.sku.trim(),
            name: iNew.name.trim(),
            ...(iNew.description     && { description:     iNew.description.trim() }),
            ...(iNew.unit_of_measure && { unit_of_measure: iNew.unit_of_measure.trim() }),
            ...(iNew.value !== '' && { value: Number(iNew.value) }),
          }
          const created = await api.post('/items', itemBody)
          itemId = created.id
        }
        resolvedLines.push({
          item_id:          Number(itemId),
          quantity_ordered: Number(ln.quantity_ordered),
          unit_cost:        Number(ln.unit_cost),
          ...(ln.destination_warehouse_id && { destination_warehouse_id: Number(ln.destination_warehouse_id) }),
        })
      }

      // 3. Create or update the PO
      const body = {
        supplier_id: Number(form.supplier_id),
        ...(factoryId && factoryId !== '' && { factory_id: Number(factoryId) }),
        ...(form.expected_date && { expected_date: form.expected_date }),
        lines: resolvedLines,
      }
      if (isEdit) {
        await api.patch(`/purchase-orders/${existing.id}`, body)
      } else {
        await api.post('/purchase-orders', body)
      }
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? `Edit Purchase Order #${existing.id}` : 'New Purchase Order'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Supplier *</Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value, factory_id: '' }))} required>
                <option value="">Select…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Factory</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.factory_id}
                onChange={f('factory_id')}
                disabled={!form.supplier_id}
              >
                <option value="">{form.supplier_id ? '— None —' : 'Select supplier first'}</option>
                {factories.map(fac => <option key={fac.id} value={fac.id}>{fac.name}</option>)}
                {form.supplier_id && <option value="NEW">+ Add new factory…</option>}
              </select>
            </div>
          </div>

          {form.factory_id === 'NEW' && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">New Factory</p>
              <div><Label>Factory Name *</Label><Input className="mt-1" value={form.factory_new.name}    onChange={e => updateFactoryNew('name',    e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Address</Label><Input className="mt-1" value={form.factory_new.address} onChange={e => updateFactoryNew('address', e.target.value)} /></div>
                <div><Label>Country</Label><Input className="mt-1" value={form.factory_new.country} onChange={e => updateFactoryNew('country', e.target.value)} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rep (optional)</p>
              <div><Label>Rep Name</Label><Input className="mt-1" value={form.factory_new.rep_name} onChange={e => updateFactoryNew('rep_name', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Rep Email</Label>
                  <Input className="mt-1" value={form.factory_new.rep_email} onChange={e => updateFactoryNew('rep_email', e.target.value)} type="email" placeholder="name@example.com" />
                </div>
                <div><Label>Rep Phone</Label><Input className="mt-1" value={form.factory_new.rep_phone} onChange={e => updateFactoryNew('rep_phone', e.target.value)} /></div>
              </div>
            </div>
          )}

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
                  <select
                    className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={ln.item_id}
                    onChange={e => handleLineItemChange(idx, e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {items.map(i => {
                      const si = supplierItems.find(r => r.item_id === i.id)
                      const label = si
                        ? `${i.sku} — ${i.name}  (this supplier: $${Number(si.unit_cost).toFixed(2)})`
                        : `${i.sku} — ${i.name}`
                      return <option key={i.id} value={i.id}>{label}</option>
                    })}
                    <option value="NEW">+ Add new item…</option>
                  </select>
                  {ln.item_id && ln.item_id !== 'NEW' && (
                    <p className="mt-1 text-xs text-gray-500">
                      {(() => {
                        const si = supplierItems.find(r => String(r.item_id) === String(ln.item_id))
                        if (si) return `Supplier-specific cost: $${Number(si.unit_cost).toFixed(2)}`
                        const item = items.find(i => String(i.id) === String(ln.item_id))
                        if (item?.value != null) return `Catalogue value: $${Number(item.value).toFixed(2)} (no supplier-specific cost set)`
                        return 'No reference value set — enter unit cost manually.'
                      })()}
                    </p>
                  )}
                </div>

                {ln.item_id === 'NEW' && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">New Item</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>SKU *</Label> <Input className="mt-1" value={ln.item_new.sku}  onChange={e => updateLineItemNew(idx, 'sku',  e.target.value)} required /></div>
                      <div><Label>Name *</Label><Input className="mt-1" value={ln.item_new.name} onChange={e => updateLineItemNew(idx, 'name', e.target.value)} required /></div>
                    </div>
                    <div><Label>Description</Label><Input className="mt-1" value={ln.item_new.description} onChange={e => updateLineItemNew(idx, 'description', e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Unit of Measure</Label>
                        <Input className="mt-1" value={ln.item_new.unit_of_measure} onChange={e => updateLineItemNew(idx, 'unit_of_measure', e.target.value)} placeholder="kg, pcs…" />
                      </div>
                      <div>
                        <Label>Value</Label>
                        <Input className="mt-1" type="number" step="0.01" min="0" value={ln.item_new.value} onChange={e => updateLineItemNew(idx, 'value', e.target.value)} placeholder="$ per unit" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Quantity *</Label>
                    <Input className="mt-1" type="number" step="0.01" min="0.01" value={ln.quantity_ordered} onChange={e => updateLine(idx, 'quantity_ordered', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Unit Cost *</Label>
                    <Input className="mt-1" type="number" step="0.01" min="0" value={ln.unit_cost} onChange={e => updateLine(idx, 'unit_cost', e.target.value)} required />
                  </div>
                  <div>
                    <Label>Destination</Label>
                    <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={ln.destination_warehouse_id} onChange={e => updateLine(idx, 'destination_warehouse_id', e.target.value)}>
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
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create PO')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── PO detail dialog ─────────────────────────────────────────────────────────

function PODetailDialog({ poId, suppliers, items, warehouses, canWrite, onClose, onChange, onItemsChange }) {
  const [po, setPo]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showEdit, setShowEdit]   = useState(false)
  const [costDiffs, setCostDiffs] = useState(null) // { supplierId, diffs }

  async function load() {
    setLoading(true)
    try { setPo(await api.get(`/purchase-orders/${poId}`)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [poId])

  async function changeStatus(status) {
    setBusy(true); setError('')
    try {
      await api.patch(`/purchase-orders/${poId}/status`, { status })
      await load(); onChange()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const editable    = po && po.status === 'DRAFT'
  const sendable    = po && po.status === 'DRAFT'
  const receivable  = po && ['SENT', 'PARTIALLY_RECEIVED', 'CONFIRMED'].includes(po.status)
  const cancellable = po && ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)

  // Lines missing destination warehouse — blocks receive
  const missingDest = po?.lines?.filter(ln => ln.destination_warehouse_id == null) ?? []

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Order #{poId}</DialogTitle>
        </DialogHeader>

        {loading || !po ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">Supplier: </span>{po.supplier_name}</div>
              <div><span className="text-gray-500">Factory: </span>{po.factory_name || '—'}</div>
              <div><span className="text-gray-500">Status: </span><StatusPill status={po.status} /></div>
              <div><span className="text-gray-500">Expected: </span>{fmtDate(po.expected_date)}</div>
              <div><span className="text-gray-500">Created: </span>{fmtDate(po.created_at)}</div>
            </div>

            {canWrite && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {editable    && <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} disabled={busy}>Edit</Button>}
                  {sendable    && <Button size="sm" onClick={() => changeStatus('SENT')} disabled={busy}>Mark Sent</Button>}
                  {receivable  && (
                    <Button
                      size="sm"
                      onClick={() => setShowReceive(true)}
                      disabled={busy || missingDest.length > 0}
                      title={missingDest.length > 0 ? `${missingDest.length} line(s) need a destination warehouse first` : ''}
                    >
                      Mark Received (add to inventory)
                    </Button>
                  )}
                  {cancellable && <Button size="sm" variant="destructive" onClick={() => changeStatus('CANCELLED')} disabled={busy}>Cancel PO</Button>}
                </div>
                {receivable && missingDest.length > 0 && (
                  <p className="text-xs text-amber-700">
                    ⚠ {missingDest.length} line{missingDest.length > 1 ? 's' : ''} {missingDest.length > 1 ? 'have' : 'has'} no destination warehouse set.
                    To receive this PO, edit{po.status === 'DRAFT' ? '' : ' (only available before marking Sent)'} and assign destinations per line.
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
                      <th className="text-right px-3 py-2">Received</th>
                      <th className="text-right px-3 py-2">Cost</th>
                      <th className="text-left px-3 py-2">Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map(ln => (
                      <tr key={ln.id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{ln.sku}</td>
                        <td className="px-3 py-2">{ln.item_name}</td>
                        <td className="px-3 py-2 text-right">{ln.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right">{ln.quantity_received}</td>
                        <td className="px-3 py-2 text-right">{fmt(ln.unit_cost)}</td>
                        <td className={`px-3 py-2 ${ln.destination_warehouse_id == null ? 'text-amber-700' : ''}`}>
                          {ln.destination_warehouse || <em>— not set —</em>}
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

        {showReceive && (
          <ReceivePODialog
            poId={poId}
            po={po}
            onClose={() => setShowReceive(false)}
            onSuccess={async () => {
              setShowReceive(false)
              // After receive, compute supplier_items cost diffs to offer updating the per-supplier price.
              let supplierItems = []
              try {
                supplierItems = await api.get(`/suppliers/${po.supplier_id}/items`)
              } catch { /* fall back to empty */ }

              const diffs = (po?.lines ?? [])
                .map(line => {
                  const item = items.find(i => i.id === line.item_id)
                  if (!item) return null
                  const si = supplierItems.find(r => r.item_id === line.item_id)
                  const oldCost = si ? Number(si.unit_cost) : null
                  const paid = Number(line.unit_cost)
                  if (oldCost != null && Math.abs(oldCost - paid) < 0.001) return null
                  return { line, item, supplierItem: si, oldCost, newCost: paid }
                })
                .filter(Boolean)
              if (diffs.length > 0) setCostDiffs({ supplierId: po.supplier_id, diffs })
              load(); onChange()
            }}
          />
        )}

        {costDiffs && (
          <CostUpdateDialog
            supplierId={costDiffs.supplierId}
            diffs={costDiffs.diffs}
            onClose={() => setCostDiffs(null)}
            onSuccess={() => { setCostDiffs(null); onItemsChange?.() }}
          />
        )}

        {showEdit && po && (
          <POFormDialog
            mode="edit"
            existing={po}
            suppliers={suppliers}
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

// ── Receive PO dialog (atomic, uses each line's destination warehouse) ───────

function ReceivePODialog({ poId, po, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleConfirm() {
    setSaving(true); setError('')
    try {
      await api.post(`/purchase-orders/${poId}/receive`, {})
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  // Group line quantities by destination warehouse for a clean preview
  const byWarehouse = {}
  for (const ln of po?.lines ?? []) {
    const key = ln.destination_warehouse || '— not set —'
    if (!byWarehouse[key]) byWarehouse[key] = []
    byWarehouse[key].push(ln)
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Mark Purchase Order Received</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          The following items will be added to inventory at each line's destination warehouse.
          Once marked received, this PO is locked and cannot be edited or cancelled.
        </p>
        <div className="rounded-md border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Destination</th>
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
                          {ln.sku} {ln.item_name} — <strong>{Number(ln.quantity_ordered) - Number(ln.quantity_received)}</strong>
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
          <Button onClick={handleConfirm} disabled={saving}>{saving ? 'Receiving…' : 'Confirm & Receive'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cost Update prompt (after PO is sent) ───────────────────────────────────

function CostUpdateDialog({ supplierId, diffs, onClose, onSuccess }) {
  const [selected, setSelected] = useState(() => new Set(diffs.map(d => d.item.id)))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    setSaving(true); setError('')
    try {
      const updates = diffs.filter(d => selected.has(d.item.id))
      // Upsert the supplier-specific cost (creates the link if it didn't exist)
      await Promise.all(updates.map(d =>
        api.put(`/suppliers/${supplierId}/items/${d.item.id}`, { unit_cost: d.newCost })
      ))
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Update supplier costs?</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          {diffs.length} item{diffs.length > 1 ? 's' : ''} on this PO had a different cost than what's recorded
          for this supplier. Tick the ones to update or link.
          Past PO history is not affected — each PO line keeps its own cost.
        </p>
        <div className="rounded-md border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Supplier cost</th>
                <th className="text-right px-3 py-2">Paid</th>
                <th className="text-right px-3 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map(d => {
                const delta = d.oldCost == null ? null : d.newCost - d.oldCost
                return (
                  <tr key={d.item.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(d.item.id)} onChange={() => toggle(d.item.id)} />
                    </td>
                    <td className="px-3 py-2">{d.item.sku} — {d.item.name}</td>
                    <td className="px-3 py-2 text-right">{d.oldCost == null ? <em className="text-gray-400">not linked</em> : `$${d.oldCost.toFixed(2)}`}</td>
                    <td className="px-3 py-2 text-right">${d.newCost.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right ${delta == null ? 'text-gray-400' : delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {delta == null ? <em>new link</em> : `${delta > 0 ? '+' : ''}$${delta.toFixed(2)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Skip</Button>
          <Button onClick={handleSubmit} disabled={saving || selected.size === 0}>
            {saving ? 'Saving…' : `Save ${selected.size} supplier price${selected.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Summary Report dialog ──────────────────────────────────────────────────

function SummaryReportDialog({ suppliers, items, warehouses, canWrite, onChange, onItemsChange, onClose }) {
  const [from, setFrom]       = useState(nDaysAgoISO(30))
  const [to, setTo]           = useState(todayISO())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [drillId, setDrillId] = useState(null) // PO id opened from a summary row

  async function generate(e) {
    e?.preventDefault()
    if (!from || !to) return
    if (from > to) { setError('Start date must be on or before end date.'); return }
    setLoading(true); setError(''); setData(null)
    try {
      const qs = new URLSearchParams({ from, to }).toString()
      setData(await api.get(`/purchase-orders/summary?${qs}`))
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Purchase Order Summary</DialogTitle></DialogHeader>

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
                <p className="text-sm text-gray-500">Purchase Orders (excl. cancelled)</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{data.totals.po_count}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total Spend</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{fmt(data.totals.total_cost)}</p>
              </div>
            </div>

            <SummaryPieChart data={data.by_item} valueKey="total_cost" valueLabel="Cost" />

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Items Purchased ({data.by_item.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Quantity</th>
                      <th className="text-right px-3 py-2">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_item.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No items purchased in this range.</td></tr>
                    ) : data.by_item.map(r => (
                      <tr key={r.item_id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{r.sku}</td>
                        <td className="px-3 py-2">{r.item}</td>
                        <td className="px-3 py-2 text-right">{Number(r.total_quantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Purchase Orders in range ({data.pos.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">PO #</th>
                      <th className="text-left px-3 py-2">Supplier</th>
                      <th className="text-left px-3 py-2">Factory</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Lines</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-left px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pos.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No POs in this range.</td></tr>
                    ) : data.pos.map(p => (
                      <tr
                        key={p.id}
                        className="border-t border-gray-200 cursor-pointer hover:bg-gray-50"
                        onClick={() => setDrillId(p.id)}
                        title="Click to view this PO's details"
                      >
                        <td className="px-3 py-2">#{p.id}</td>
                        <td className="px-3 py-2">{p.supplier}</td>
                        <td className="px-3 py-2">{p.factory || '—'}</td>
                        <td className="px-3 py-2"><StatusPill status={p.status} /></td>
                        <td className="px-3 py-2 text-right">{p.line_count}</td>
                        <td className="px-3 py-2 text-right">{fmt(p.total_value)}</td>
                        <td className="px-3 py-2">{fmtDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {data && (
            <Button
              variant="outline"
              onClick={() => exportPDF({ defaultFilename: defaultPdfName('po-summary', { from, to }) })
                .catch(err => alert(err.message))}
            >
              Export PDF
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

        {/* Off-screen print-only render. Hidden on screen via .print-only;
            revealed during printToPDF (see index.css). */}
        {data && (
          <PrintableReport
            title="Purchase Order Summary"
            subtitle={`From ${from} to ${to}`}
            stats={[
              { label: 'Purchase orders (excl. cancelled)', value: data.totals.po_count },
              { label: 'Total spend', value: fmt(data.totals.total_cost) },
            ]}
            sections={[
              {
                title: `Items purchased (${data.by_item.length})`,
                columns: [
                  { header: 'SKU',          accessor: 'sku' },
                  { header: 'Item',         accessor: 'item' },
                  { header: 'Quantity',     accessor: r => Number(r.total_quantity).toLocaleString(), align: 'right' },
                  { header: 'Total cost',   accessor: r => fmt(r.total_cost), align: 'right' },
                ],
                rows: data.by_item,
                empty: 'No items purchased in this range.',
              },
              {
                title: `Purchase orders in range (${data.pos.length})`,
                columns: [
                  { header: 'PO #',     accessor: r => `#${r.id}` },
                  { header: 'Supplier', accessor: 'supplier' },
                  { header: 'Factory',  accessor: r => r.factory || '—' },
                  { header: 'Status',   accessor: r => r.status.replace(/_/g, ' ') },
                  { header: 'Lines',    accessor: 'line_count', align: 'right' },
                  { header: 'Total',    accessor: r => fmt(r.total_value), align: 'right' },
                  { header: 'Created',  accessor: r => fmtDate(r.created_at) },
                ],
                rows: data.pos,
                empty: 'No POs in this range.',
              },
            ]}
          />
        )}

        {drillId && (
          <PODetailDialog
            poId={drillId}
            suppliers={suppliers}
            items={items}
            warehouses={warehouses}
            canWrite={canWrite}
            onClose={() => setDrillId(null)}
            onChange={() => {
              // Refresh the parent list AND re-run the summary so any
              // status changes (cancel/receive) appear in this report too.
              onChange?.()
              if (from && to) {
                const qs = new URLSearchParams({ from, to }).toString()
                api.get(`/purchase-orders/summary?${qs}`).then(setData).catch(() => {})
              }
            }}
            onItemsChange={onItemsChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
