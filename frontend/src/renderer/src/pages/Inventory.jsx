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

const TXN_TYPES = ['ADJUSTMENT', 'RETURN_IN', 'RETURN_OUT']
const TXN_LABELS = {
  ADJUSTMENT:   'Adjustment (+ stock)',
  RETURN_IN:    'Return In (+ stock)',
  RETURN_OUT:   'Return Out (− stock)',
}

function fmtDate(s) {
  return s ? new Date(s).toLocaleString() : '—'
}

export default function Inventory() {
  const { user } = useAuth()
  // TODO(dev-only): remove 'dev' role checks before shipping
  const isDev     = user?.role === 'dev'
  const canCreate = isDev || user?.role === 'employee'

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
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)}>Transfer Stock</Button>
            <Button onClick={() => setTxnOpen(true)}>Record Transaction</Button>
          </div>
        )}
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
    </div>
  )
}

// ── Transfer Stock dialog ─────────────────────────────────────────────────────

function TransferDialog({ warehouses, items, onClose, onSuccess }) {
  const [form, setForm] = useState({ item_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (form.from_warehouse_id === form.to_warehouse_id) {
        throw new Error('Source and destination warehouses must differ')
      }
      await api.post('/inventory/transfer', {
        item_id:           Number(form.item_id),
        from_warehouse_id: Number(form.from_warehouse_id),
        to_warehouse_id:   Number(form.to_warehouse_id),
        quantity:          Number(form.quantity),
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
          </div>
          <div>
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={f('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Transferring…' : 'Transfer'}</Button>
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

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.post('/inventory/transaction', {
        txn_type:     form.txn_type,
        item_id:      Number(form.item_id),
        warehouse_id: Number(form.warehouse_id),
        quantity:     Number(form.quantity),
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
          </div>
          <div>
            <Label>Notes</Label>
            <Input className="mt-1" value={form.notes} onChange={f('notes')} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
