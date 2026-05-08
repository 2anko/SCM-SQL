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

const EMPTY = { sku: '', name: '', description: '', unit_of_measure: '', unit_cost: '', unit_price: '' }

function fmt(val) {
  return val != null && val !== '' ? `$${Number(val).toFixed(2)}` : '—'
}

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
      unit_cost:  r.unit_cost  != null ? String(r.unit_cost)  : '',
      unit_price: r.unit_price != null ? String(r.unit_price) : '',
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
        ...(form.unit_cost  !== '' && { unit_cost:  Number(form.unit_cost) }),
        ...(form.unit_price !== '' && { unit_price: Number(form.unit_price) }),
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
    { header: 'Cost',        render: r => fmt(r.unit_cost) },
    { header: 'Price',       render: r => fmt(r.unit_price) },
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unit of Measure</Label>
                <Input className="mt-1" value={form.unit_of_measure} onChange={f('unit_of_measure')} placeholder="kg, pcs…" />
              </div>
              <div>
                <Label>Unit Cost</Label>
                <Input className="mt-1" type="number" step="0.01" min="0" value={form.unit_cost} onChange={f('unit_cost')} />
              </div>
              <div>
                <Label>Unit Price</Label>
                <Input className="mt-1" type="number" step="0.01" min="0" value={form.unit_price} onChange={f('unit_price')} />
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
    </div>
  )
}
