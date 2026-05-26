import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { getPermissions } from '../lib/permissions'
import DataTable from '../components/ui/DataTable'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'

const EMPTY = { name: '', email: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  const { isDev, canCreate, canEdit, canDelete } = getPermissions(user)

  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [dialog, setDialog]       = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [itemsFor, setItemsFor]   = useState(null)
  const [allItems, setAllItems]   = useState([])

  async function load() {
    setLoading(true)
    try { setCustomers(await api.get('/customers')) }
    finally { setLoading(false) }
  }
  async function loadItems() {
    setAllItems(await api.get('/items'))
  }
  useEffect(() => { load(); loadItems() }, [])

  function openAdd() {
    setForm(EMPTY); setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({ name: r.name, email: r.email || '', phone: r.phone || '', address: r.address || '' })
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
        ...(form.email   && { email:   form.email.trim() }),
        ...(form.phone   && { phone:   form.phone.trim() }),
        ...(form.address && { address: form.address.trim() }),
      }
      if (dialog.mode === 'add') await api.post('/customers', body)
      else                       await api.patch(`/customers/${dialog.record.id}`, body)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/customers/${dialog.record.id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  function field(key, label, opts = {}, hint = null) {
    return (
      <div>
        <Label>{label}</Label>
        <Input
          className="mt-1"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          {...opts}
        />
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }

  const columns = [
    { header: 'Name',    accessor: 'name' },
    { header: 'Email',   render: r => r.email   || '—' },
    { header: 'Phone',   render: r => r.phone   || '—' },
    { header: 'Address', render: r => r.address || '—' },
    {
      header: 'Actions',
      render: r => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setItemsFor(r) }}>Items</Button>
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
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your customer records</p>
        </div>
        {canCreate && <Button onClick={openAdd}>Add Customer</Button>}
      </div>

      <DataTable columns={columns} data={customers} isLoading={loading} emptyMessage="No customers yet" />

      <Dialog open={isFormOpen} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'add' ? 'Add Customer' : 'Edit Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {field('name',    'Name *',   { required: true })}
            {field('email',   'Email',    { type: 'email', placeholder: 'name@example.com' }, 'Must be a valid email (e.g. name@example.com) or left blank.')}
            {field('phone',   'Phone')}
            {field('address', 'Address')}
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
          <DialogHeader><DialogTitle>Delete Customer</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{dialog?.record?.name}</strong>? Customers with open sales orders cannot be deleted.
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

      {itemsFor && (
        <CustomerItemsDialog
          customer={itemsFor}
          allItems={allItems}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setItemsFor(null)}
        />
      )}
    </div>
  )
}

// ── Customer Items dialog (per-customer item prices) ─────────────────────────

const EMPTY_CI = { item_id: '', unit_price: '', customer_sku: '', notes: '' }

function CustomerItemsDialog({ customer, allItems, canCreate, canEdit, canDelete, onClose }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null)
  const [form, setForm]     = useState(EMPTY_CI)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await api.get(`/customers/${customer.id}/items`)) }
    finally { setLoading(false) }
  }, [customer.id])
  useEffect(() => { load() }, [load])

  const linkedIds = new Set(rows.map(r => r.item_id))
  const availableItems = allItems.filter(i => !linkedIds.has(i.id))

  function openAdd() {
    setForm(EMPTY_CI); setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({
      item_id:      String(r.item_id),
      unit_price:   String(r.unit_price),
      customer_sku: r.customer_sku || '',
      notes:        r.notes        || '',
    })
    setError(''); setDialog({ mode: 'edit', record: r })
  }
  function openDelete(r) {
    setError(''); setDialog({ mode: 'delete', record: r })
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const itemId = dialog.mode === 'edit' ? dialog.record.item_id : Number(form.item_id)
      const body = {
        unit_price:   Number(form.unit_price),
        customer_sku: form.customer_sku.trim() || null,
        notes:        form.notes.trim() || null,
      }
      await api.put(`/customers/${customer.id}/items/${itemId}`, body)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/customers/${customer.id}/items/${dialog.record.item_id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { header: 'SKU',          render: r => r.sku },
    { header: 'Item',         render: r => r.item_name },
    { header: 'Price',        render: r => `$${Number(r.unit_price).toFixed(2)}` },
    { header: 'Customer SKU', render: r => r.customer_sku || '—' },
    { header: 'Notes',        render: r => r.notes        || '—' },
    ...(canEdit || canDelete ? [{
      header: 'Actions',
      render: r => (
        <div className="flex gap-2">
          {canEdit   && <Button size="sm" variant="outline"     onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</Button>}
          {canDelete && <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); openDelete(r) }}>Delete</Button>}
        </div>
      ),
    }] : []),
  ]

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Items sold — {customer.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            Prices here override the catalogue default for sales orders to this customer.
          </p>
          <div className="space-y-4">
            {canCreate && (
              <div className="flex justify-end">
                <Button size="sm" onClick={openAdd} disabled={availableItems.length === 0}>
                  {availableItems.length === 0 ? 'All items already linked' : 'Add Item'}
                </Button>
              </div>
            )}
            <DataTable columns={columns} data={rows} isLoading={loading} emptyMessage="No items linked yet" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(dialog?.mode === 'add' || dialog?.mode === 'edit') && (
        <Dialog open onOpenChange={open => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialog.mode === 'add' ? 'Link Item' : `Edit — ${dialog.record.sku} ${dialog.record.item_name}`}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {dialog.mode === 'add' && (
                <div>
                  <Label>Item *</Label>
                  <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.item_id} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} required>
                    <option value="">Select…</option>
                    {availableItems.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <Label>Unit Price *</Label>
                <Input className="mt-1" type="number" step="0.01" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} required />
              </div>
              <div>
                <Label>Customer SKU</Label>
                <Input className="mt-1" value={form.customer_sku} onChange={e => setForm(p => ({ ...p, customer_sku: e.target.value }))} placeholder="their part number" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {dialog?.mode === 'delete' && (
        <Dialog open onOpenChange={open => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Unlink Item</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
              Remove <strong>{dialog.record.sku} {dialog.record.item_name}</strong> from this customer's price list?
              SO history is not affected.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                {saving ? 'Removing…' : 'Remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
