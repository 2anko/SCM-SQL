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
import { money as fmt } from '../lib/format'

const EMPTY = { sku: '', name: '', description: '', unit_of_measure: '', value: '' }

export default function Items() {
  const { user } = useAuth()
  // TODO(dev-only): remove 'dev' role checks before shipping
  const isDev     = user?.role === 'dev'
  //#########################################################
  const canCreate = isDev || user?.role === 'employee'
  const canEdit   = isDev || user?.role === 'section_manager'
  const canDelete = isDev || user?.role === 'section_manager'

  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog]   = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [pricingFor, setPricingFor] = useState(null)

  async function load() {
    setLoading(true)
    try { setItems(await api.get('/items')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY); setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({
      sku: r.sku,
      name: r.name,
      description: r.description || '',
      unit_of_measure: r.unit_of_measure || '',
      value: r.value != null ? String(r.value) : '',
    })
    setError(''); setDialog({ mode: 'edit', record: r })
  }
  function openDelete(r) {
    setError(''); setDialog({ mode: 'delete', record: r })
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = {
        name: form.name.trim(),
        ...(form.description    && { description:     form.description.trim() }),
        ...(form.unit_of_measure && { unit_of_measure: form.unit_of_measure.trim() }),
        ...(form.value !== '' && { value: Number(form.value) }),
      }
      if (dialog.mode === 'add') { body.sku = form.sku.trim(); await api.post('/items', body) }
      else                       { await api.patch(`/items/${dialog.record.id}`, body) }
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/items/${dialog.record.id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  function f(key) { return e => setForm(prev => ({ ...prev, [key]: e.target.value })) }

  const columns = [
    { header: 'SKU',         accessor: 'sku' },
    { header: 'Name',        accessor: 'name' },
    { header: 'Description', render: r => r.description || '—' },
    { header: 'Unit',        render: r => r.unit_of_measure || '—' },
    { header: 'Value',       render: r => fmt(r.value) },
    {
      header: 'Actions',
      render: r => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setPricingFor(r) }}>Pricing</Button>
          {canEdit   && <Button size="sm" variant="outline"     onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</Button>}
          {canDelete && <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); openDelete(r) }}>Delete</Button>}
        </div>
      ),
    },
  ]

  const isFormOpen = dialog?.mode === 'add' || dialog?.mode === 'edit'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Items</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your product catalog</p>
        </div>
        {canCreate && <Button onClick={openAdd}>Add Item</Button>}
      </div>

      <DataTable columns={columns} data={items} isLoading={loading} emptyMessage="No items yet" />

      <Dialog open={isFormOpen} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'add' ? 'Add Item' : 'Edit Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {dialog?.mode === 'add' && (
              <div>
                <Label>SKU *</Label>
                <Input className="mt-1" value={form.sku} onChange={f('sku')} required />
              </div>
            )}
            <div>
              <Label>Name *</Label>
              <Input className="mt-1" value={form.name} onChange={f('name')} required />
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1" value={form.description} onChange={f('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit of Measure</Label>
                <Input className="mt-1" value={form.unit_of_measure} onChange={f('unit_of_measure')} placeholder="kg, pcs…" />
              </div>
              <div>
                <Label>Value</Label>
                <Input className="mt-1" type="number" step="0.01" min="0" value={form.value} onChange={f('value')} placeholder="$ per unit" />
                <p className="mt-1 text-xs text-gray-500">
                  Worth of one unit. Auto-updated to the weighted-average PO cost on each receipt.
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.mode === 'delete'} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{dialog?.record?.name}</strong> ({dialog?.record?.sku})?
            Items referenced by orders or inventory cannot be deleted.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pricingFor && <ItemPricingDialog item={pricingFor} onClose={() => setPricingFor(null)} />}
    </div>
  )
}

// ── Item Pricing dialog (read-only view: who sells, who buys) ───────────────

function ItemPricingDialog({ item, onClose }) {
  const [suppliers, setSuppliers] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const [s, c] = await Promise.all([
          api.get(`/items/${item.id}/suppliers`),
          api.get(`/items/${item.id}/customers`),
        ])
        if (!cancelled) { setSuppliers(s); setCustomers(c) }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [item.id])

  const minCost = suppliers.length > 0 ? Math.min(...suppliers.map(s => Number(s.unit_cost))) : null
  const maxCost = suppliers.length > 0 ? Math.max(...suppliers.map(s => Number(s.unit_cost))) : null
  const avgPrice = customers.length > 0
    ? customers.reduce((sum, c) => sum + Number(c.unit_price), 0) / customers.length
    : null

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pricing — {item.sku} · {item.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 text-sm">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Catalogue value (avg PO cost)</p>
            <p className="text-lg font-semibold">{fmt(item.value)}</p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Suppliers ({suppliers.length})</p>
            {suppliers.length > 0 && (
              <p className="text-xs text-gray-500">
                Cost range: {fmt(minCost)} – {fmt(maxCost)}
              </p>
            )}
          </div>
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Supplier</th>
                  <th className="text-right px-3 py-2">Cost</th>
                  <th className="text-left px-3 py-2">Supplier SKU</th>
                  <th className="text-right px-3 py-2">Lead Time</th>
                  <th className="text-center px-3 py-2">Preferred</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No suppliers linked. Link via the Suppliers page.</td></tr>
                ) : suppliers.map(s => (
                  <tr key={s.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">{s.supplier_name}</td>
                    <td className="px-3 py-2 text-right">${Number(s.unit_cost).toFixed(2)}</td>
                    <td className="px-3 py-2">{s.supplier_sku || '—'}</td>
                    <td className="px-3 py-2 text-right">{s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}</td>
                    <td className="px-3 py-2 text-center">{s.is_preferred ? '★' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Customers ({customers.length})</p>
            {customers.length > 0 && (
              <p className="text-xs text-gray-500">
                Avg price: {fmt(avgPrice)}
              </p>
            )}
          </div>
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-left px-3 py-2">Customer SKU</th>
                  <th className="text-left px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Loading…</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No customers linked. Link via the Customers page.</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">{c.customer_name}</td>
                    <td className="px-3 py-2 text-right">${Number(c.unit_price).toFixed(2)}</td>
                    <td className="px-3 py-2">{c.customer_sku || '—'}</td>
                    <td className="px-3 py-2">{c.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
