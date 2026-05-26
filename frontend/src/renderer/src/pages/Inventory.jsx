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
import { getPermissions } from '../lib/permissions'
import { money as fmtMoney, datetime as fmtDate } from '../lib/format'

const TXN_TYPES = ['ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT']
const TXN_LABELS = {
  ADJUSTMENT:   'Adjustment (+ stock)',
  RETURN_IN:    'Return In (+ stock)',
  RETURN_OUT:   'Return Out (− stock)',
}

export default function Inventory() {
  const { user } = useAuth()
  const { canCreate } = getPermissions(user)

  const [tab, setTab]                 = useState('stock')
  const [stock, setStock]             = useState([])
  const [history, setHistory]         = useState([])
  const [warehouses, setWarehouses]   = useState([])
  const [items, setItems]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [warehouseId, setWarehouseId] = useState('')
  const [itemId, setItemId]           = useState('')

  const [transferOpen, setTransferOpen] = useState(false)
  const [txnOpen, setTxnOpen]           = useState(false)
  const [summaryOpen, setSummaryOpen]   = useState(false)

  async function loadStock() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (warehouseId) qs.set('warehouseId', warehouseId)
      if (itemId)      qs.set('itemId',      itemId)
      const path = `/inventory${qs.toString() ? '?' + qs.toString() : ''}`
      setStock(await api.get(path))
    } finally { setLoading(false) }
  }
  async function loadHistory() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (warehouseId) qs.set('warehouseId', warehouseId)
      if (itemId)      qs.set('itemId',      itemId)
      const path = `/inventory/history${qs.toString() ? '?' + qs.toString() : ''}`
      setHistory(await api.get(path))
    } finally { setLoading(false) }
  }
  async function loadDropdowns() {
    const [w, i] = await Promise.all([api.get('/warehouses'), api.get('/items')])
    setWarehouses(w); setItems(i)
  }

  useEffect(() => { loadDropdowns() }, [])
  useEffect(() => {
    if (tab === 'stock') loadStock()
    else                 loadHistory()
  }, [tab, warehouseId, itemId])

  const stockColumns = [
    { header: 'Warehouse', accessor: 'warehouse' },
    { header: 'SKU',       accessor: 'sku' },
    { header: 'Item',      accessor: 'item' },
    { header: 'Quantity',  render: r => `${r.quantity} ${r.unit_of_measure || ''}`.trim() },
    { header: 'Updated',   render: r => fmtDate(r.updated_at) },
  ]

  const historyColumns = [
    { header: 'When',      render: r => fmtDate(r.created_at) },
    { header: 'Type',      accessor: 'txn_type' },
    { header: 'SKU',       accessor: 'sku' },
    { header: 'Item',      accessor: 'item' },
    { header: 'Warehouse', accessor: 'warehouse' },
    { header: 'Qty',       accessor: 'quantity' },
    { header: 'Ref',       render: r => r.purchase_order_id ? `PO #${r.purchase_order_id}` : r.sales_order_id ? `SO #${r.sales_order_id}` : '—' },
    { header: 'Notes',     render: r => r.notes || '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">Stock levels, movements, and transfers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSummaryOpen(true)}>Summary Report</Button>
          {canCreate && <Button variant="outline" onClick={() => setTransferOpen(true)}>Transfer Stock</Button>}
          {canCreate && <Button onClick={() => setTxnOpen(true)}>Record Transaction</Button>}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'stock' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('stock')}
        >Stock Levels</button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'history' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('history')}
        >Transaction History</button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 max-w-xs">
          <Label className="text-xs text-gray-500">Warehouse</Label>
          <select
            className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
          >
            <option value="">All warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="flex-1 max-w-xs">
          <Label className="text-xs text-gray-500">Item</Label>
          <select
            className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={itemId}
            onChange={e => setItemId(e.target.value)}
          >
            <option value="">All items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
          </select>
        </div>
      </div>

      {tab === 'stock' ? (
        <DataTable columns={stockColumns} data={stock} isLoading={loading} emptyMessage="No stock recorded" />
      ) : (
        <DataTable columns={historyColumns} data={history} isLoading={loading} emptyMessage="No transactions yet" />
      )}

      {transferOpen && (
        <TransferDialog
          warehouses={warehouses}
          items={items}
          onClose={() => setTransferOpen(false)}
          onSuccess={() => { setTransferOpen(false); if (tab === 'stock') loadStock(); else loadHistory() }}
        />
      )}
      {txnOpen && (
        <TransactionDialog
          warehouses={warehouses}
          items={items}
          onClose={() => setTxnOpen(false)}
          onSuccess={() => { setTxnOpen(false); if (tab === 'stock') loadStock(); else loadHistory() }}
        />
      )}
      {summaryOpen && (
        <InventorySummaryDialog onClose={() => setSummaryOpen(false)} />
      )}
    </div>
  )
}

// ── Transfer Stock dialog ─────────────────────────────────────────────────────

function TransferDialog({ warehouses, items, onClose, onSuccess }) {
  const [form, setForm] = useState({ item_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [available, setAvailable] = useState(null) // null until both source + item are picked

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  // Look up current stock at the source warehouse for the chosen item.
  useEffect(() => {
    let cancelled = false
    if (!form.item_id || !form.from_warehouse_id) { setAvailable(null); return }
    const qs = new URLSearchParams({ warehouseId: form.from_warehouse_id, itemId: form.item_id }).toString()
    api.get(`/inventory?${qs}`)
      .then(rows => { if (!cancelled) setAvailable(Number(rows[0]?.quantity ?? 0)) })
      .catch(() => { if (!cancelled) setAvailable(0) })
    return () => { cancelled = true }
  }, [form.item_id, form.from_warehouse_id])

  const qtyNum     = Number(form.quantity)
  const overdraft  = available != null && qtyNum > 0 && qtyNum > available
  const unitLabel  = items.find(i => String(i.id) === String(form.item_id))?.unit_of_measure || ''

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (form.from_warehouse_id === form.to_warehouse_id) {
        throw new Error('Source and destination warehouses must differ')
      }
      if (overdraft) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${qtyNum}`)
      }
      await api.post('/inventory/transfer', {
        item_id:           Number(form.item_id),
        from_warehouse_id: Number(form.from_warehouse_id),
        to_warehouse_id:   Number(form.to_warehouse_id),
        quantity:          qtyNum,
        ...(form.notes && { notes: form.notes.trim() }),
      })
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Item *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.item_id} onChange={f('item_id')} required>
              <option value="">Select an item…</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From *</Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.from_warehouse_id} onChange={f('from_warehouse_id')} required>
                <option value="">Source…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <Label>To *</Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.to_warehouse_id} onChange={f('to_warehouse_id')} required>
                <option value="">Destination…</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input className="mt-1" type="number" step="0.01" min="0.01" value={form.quantity} onChange={f('quantity')} required />
            {available != null && (
              <p className={`mt-1 text-xs ${overdraft ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                Available at source: {available} {unitLabel}
                {overdraft && ` — cannot transfer more than this`}
              </p>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={f('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || overdraft}>{saving ? 'Transferring…' : 'Transfer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Record manual transaction dialog ─────────────────────────────────────────

function TransactionDialog({ warehouses, items, onClose, onSuccess }) {
  const [form, setForm] = useState({ txn_type: 'ADJUSTMENT', item_id: '', warehouse_id: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [available, setAvailable] = useState(null)

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  // Only outbound types need a stock check (RETURN_OUT today; the schema also
  // accepts SHIPMENT / TRANSFER_OUT but the UI doesn't expose them).
  const OUTBOUND = new Set(['RETURN_OUT', 'SHIPMENT', 'TRANSFER_OUT'])
  const isOutbound = OUTBOUND.has(form.txn_type)

  // Look up current stock at the chosen warehouse for the chosen item.
  // We always fetch (cheap) so the user sees their starting balance for
  // adjustments too, not only when removing.
  useEffect(() => {
    let cancelled = false
    if (!form.item_id || !form.warehouse_id) { setAvailable(null); return }
    const qs = new URLSearchParams({ warehouseId: form.warehouse_id, itemId: form.item_id }).toString()
    api.get(`/inventory?${qs}`)
      .then(rows => { if (!cancelled) setAvailable(Number(rows[0]?.quantity ?? 0)) })
      .catch(() => { if (!cancelled) setAvailable(0) })
    return () => { cancelled = true }
  }, [form.item_id, form.warehouse_id])

  const qtyNum    = Number(form.quantity)
  const overdraft = isOutbound && available != null && qtyNum > 0 && qtyNum > available
  const unitLabel = items.find(i => String(i.id) === String(form.item_id))?.unit_of_measure || ''

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (overdraft) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${qtyNum}`)
      }
      await api.post('/inventory/transaction', {
        txn_type:     form.txn_type,
        item_id:      Number(form.item_id),
        warehouse_id: Number(form.warehouse_id),
        quantity:     qtyNum,
        ...(form.notes && { notes: form.notes.trim() }),
      })
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.txn_type} onChange={f('txn_type')} required>
              {TXN_TYPES.map(t => <option key={t} value={t}>{TXN_LABELS[t]}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500">Adjustment / Return In add stock; Return Out removes stock.</p>
          </div>
          <div>
            <Label>Item *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.item_id} onChange={f('item_id')} required>
              <option value="">Select an item…</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Warehouse *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.warehouse_id} onChange={f('warehouse_id')} required>
              <option value="">Select a warehouse…</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input className="mt-1" type="number" step="0.01" min="0.01" value={form.quantity} onChange={f('quantity')} required />
            {available != null && (
              <p className={`mt-1 text-xs ${overdraft ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                Current stock: {available} {unitLabel}
                {isOutbound && overdraft && ' — cannot remove more than this'}
              </p>
            )}
          </div>
          <div>
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={f('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || overdraft}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Inventory Summary dialog ──────────────────────────────────────────────────

function InventorySummaryDialog({ onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/inventory/summary')
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Inventory Summary</DialogTitle></DialogHeader>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total inventory value</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{fmtMoney(data.totals.total_value)}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Distinct items in stock</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{data.totals.item_count}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Warehouses with stock</p>
                <p className="text-2xl font-bold mt-1 text-indigo-600">{data.totals.warehouse_count}</p>
              </div>
            </div>

            <SummaryPieChart
              valueKey="total_value"
              valueLabel="Value"
              groups={[
                {
                  id:       'item',
                  label:    'by item',
                  data:     data.by_item,
                  idKey:    'item_id',
                  labelFor: r => `${r.sku} — ${r.item}`,
                },
                {
                  id:       'warehouse',
                  label:    'by warehouse',
                  data:     data.by_warehouse,
                  idKey:    'warehouse_id',
                  labelFor: r => r.warehouse,
                },
              ]}
            />

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                By item ({data.by_item.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-right px-3 py-2">Quantity</th>
                      <th className="text-right px-3 py-2">Unit value</th>
                      <th className="text-right px-3 py-2">Total value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_item.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No stock on hand.</td></tr>
                    ) : data.by_item.map(r => (
                      <tr key={r.item_id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{r.sku}</td>
                        <td className="px-3 py-2">{r.item}</td>
                        <td className="px-3 py-2 text-right">{Number(r.total_quantity).toLocaleString()} {r.unit_of_measure || ''}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(r.unit_value)}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                By warehouse ({data.by_warehouse.length})
              </p>
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Warehouse</th>
                      <th className="text-right px-3 py-2">Distinct items</th>
                      <th className="text-right px-3 py-2">Total quantity</th>
                      <th className="text-right px-3 py-2">Total value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_warehouse.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No stock on hand.</td></tr>
                    ) : data.by_warehouse.map(r => (
                      <tr key={r.warehouse_id} className="border-t border-gray-200">
                        <td className="px-3 py-2">{r.warehouse}</td>
                        <td className="px-3 py-2 text-right">{r.item_count}</td>
                        <td className="px-3 py-2 text-right">{Number(r.total_quantity).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(r.total_value)}</td>
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
              onClick={() => exportPDF({ defaultFilename: defaultPdfName('inventory-summary') })
                .catch(err => alert(err.message))}
            >
              Export PDF
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>

        {data && (
          <PrintableReport
            title="Inventory Summary"
            subtitle="Current stock on hand"
            stats={[
              { label: 'Total inventory value',     value: fmtMoney(data.totals.total_value) },
              { label: 'Distinct items in stock',   value: data.totals.item_count },
              { label: 'Warehouses with stock',     value: data.totals.warehouse_count },
            ]}
            sections={[
              {
                title: `By item (${data.by_item.length})`,
                columns: [
                  { header: 'SKU',         accessor: 'sku' },
                  { header: 'Item',        accessor: 'item' },
                  { header: 'Quantity',    accessor: r => `${Number(r.total_quantity).toLocaleString()} ${r.unit_of_measure || ''}`.trim(), align: 'right' },
                  { header: 'Unit value',  accessor: r => fmtMoney(r.unit_value), align: 'right' },
                  { header: 'Total value', accessor: r => fmtMoney(r.total_value), align: 'right' },
                ],
                rows: data.by_item,
                empty: 'No stock on hand.',
              },
              {
                title: `By warehouse (${data.by_warehouse.length})`,
                columns: [
                  { header: 'Warehouse',      accessor: 'warehouse' },
                  { header: 'Distinct items', accessor: 'item_count', align: 'right' },
                  { header: 'Total quantity', accessor: r => Number(r.total_quantity).toLocaleString(), align: 'right' },
                  { header: 'Total value',    accessor: r => fmtMoney(r.total_value), align: 'right' },
                ],
                rows: data.by_warehouse,
                empty: 'No stock on hand.',
              },
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
