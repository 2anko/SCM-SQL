import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import DataTable from '../components/ui/DataTable'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog'

const EMPTY_SUPPLIER      = { name: '', email: '', phone: '', address: '' }
const EMPTY_SUPPLIER_FORM = { ...EMPTY_SUPPLIER, factories: [] }
const EMPTY_FACTORY       = { name: '', address: '', country: '', rep_name: '', rep_email: '', rep_phone: '' }

// ── Supplier form / delete dialogs ──────────────────────────────────────────

function SupplierDialog({ dialog, form, setForm, saving, error, onSubmit, onClose }) {
  const isForm = dialog?.mode === 'add' || dialog?.mode === 'edit'
  const isAdd  = dialog?.mode === 'add'

  function f(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })) }

  function updateFactory(idx, key, value) {
    setForm(p => ({
      ...p,
      factories: p.factories.map((fac, i) => i === idx ? { ...fac, [key]: value } : fac),
    }))
  }
  function addFactoryRow() {
    setForm(p => ({ ...p, factories: [...p.factories, { ...EMPTY_FACTORY }] }))
  }
  function removeFactoryRow(idx) {
    setForm(p => ({ ...p, factories: p.factories.filter((_, i) => i !== idx) }))
  }

  return (
    <Dialog open={isForm} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add Supplier' : 'Edit Supplier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label>Company Name *</Label><Input className="mt-1" value={form.name} onChange={f('name')} required /></div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1" value={form.email} onChange={f('email')} type="email" placeholder="name@example.com" />
            <p className="mt-1 text-xs text-gray-500">Must be a valid email (e.g. name@example.com) or left blank.</p>
          </div>
          <div><Label>Phone</Label> <Input className="mt-1" value={form.phone}   onChange={f('phone')} /></div>
          <div><Label>Address</Label><Input className="mt-1" value={form.address} onChange={f('address')} /></div>

          {isAdd && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm font-semibold text-gray-700">Factories</p>
                <Button type="button" size="sm" variant="outline" onClick={addFactoryRow}>+ Add Factory</Button>
              </div>
              {form.factories.length === 0 && (
                <p className="text-xs text-gray-500">No factories yet. You can add them now or after creation via the Factories button.</p>
              )}
              {form.factories.map((fac, idx) => (
                <div key={idx} className="rounded-md border border-gray-200 p-3 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Factory #{idx + 1}</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeFactoryRow(idx)}>Remove</Button>
                  </div>
                  <div><Label>Factory Name *</Label><Input className="mt-1" value={fac.name}    onChange={e => updateFactory(idx, 'name', e.target.value)}    required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Address</Label><Input className="mt-1" value={fac.address} onChange={e => updateFactory(idx, 'address', e.target.value)} /></div>
                    <div><Label>Country</Label><Input className="mt-1" value={fac.country} onChange={e => updateFactory(idx, 'country', e.target.value)} /></div>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Representative (optional)</p>
                  <div><Label>Rep Name</Label><Input className="mt-1" value={fac.rep_name} onChange={e => updateFactory(idx, 'rep_name', e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Rep Email</Label>
                      <Input className="mt-1" value={fac.rep_email} onChange={e => updateFactory(idx, 'rep_email', e.target.value)} type="email" placeholder="name@example.com" />
                    </div>
                    <div><Label>Rep Phone</Label><Input className="mt-1" value={fac.rep_phone} onChange={e => updateFactory(idx, 'rep_phone', e.target.value)} /></div>
                  </div>
                  <p className="text-xs text-gray-500">Rep email must be valid or left blank. Rep is created only if Rep Name is filled.</p>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSupplierDialog({ dialog, saving, error, onConfirm, onClose }) {
  return (
    <Dialog open={dialog?.mode === 'delete'} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete Supplier</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete <strong>{dialog?.record?.name}</strong>? Suppliers with open purchase orders cannot be deleted.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={saving}>
            {saving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Factory form / delete dialogs ────────────────────────────────────────────

function FactoryFormDialog({ dialog, form, setForm, saving, error, onSubmit, onClose }) {
  const isOpen = dialog?.mode === 'add' || dialog?.mode === 'edit'
  function f(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })) }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.mode === 'add' ? 'Add Factory' : 'Edit Factory'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label>Factory Name *</Label><Input className="mt-1" value={form.name}    onChange={f('name')}    required /></div>
          <div><Label>Address</Label>        <Input className="mt-1" value={form.address} onChange={f('address')} /></div>
          <div><Label>Country</Label>        <Input className="mt-1" value={form.country} onChange={f('country')} /></div>

          {dialog?.mode === 'add' && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-1">Representative (optional)</p>
              <div><Label>Rep Name</Label> <Input className="mt-1" value={form.rep_name}  onChange={f('rep_name')} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Rep Email</Label>
                  <Input className="mt-1" value={form.rep_email} onChange={f('rep_email')} type="email" placeholder="name@example.com" />
                </div>
                <div><Label>Rep Phone</Label><Input className="mt-1" value={form.rep_phone} onChange={f('rep_phone')} /></div>
              </div>
              <p className="text-xs text-gray-500">Rep email must be a valid email or left blank.</p>
            </>
          )}

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

function DeleteFactoryDialog({ dialog, saving, error, onConfirm, onClose }) {
  return (
    <Dialog open={dialog?.mode === 'delete'} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete Factory</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-600">
          Delete factory <strong>{dialog?.record?.name}</strong>? Factories with open purchase orders cannot be deleted.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={saving}>
            {saving ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Factories management dialog ───────────────────────────────────────────────

function FactoriesDialog({ supplier, canCreate, canEdit, canDelete, onClose }) {
  const [factories, setFactories]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [fDialog, setFDialog]         = useState(null)
  const [fForm, setFForm]             = useState(EMPTY_FACTORY)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setFactories(await api.get(`/suppliers/${supplier.id}/factories`)) }
    finally { setLoading(false) }
  }, [supplier.id])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setFForm(EMPTY_FACTORY); setError(''); setFDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setFForm({ name: r.name, address: r.address || '', country: r.country || '', rep_name: '', rep_email: '', rep_phone: '' })
    setError(''); setFDialog({ mode: 'edit', record: r })
  }
  function openDelete(r) {
    setError(''); setFDialog({ mode: 'delete', record: r })
  }

  async function handleFactorySubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = {
        name: fForm.name.trim(),
        ...(fForm.address && { address: fForm.address.trim() }),
        ...(fForm.country && { country: fForm.country.trim() }),
      }
      if (fDialog.mode === 'add') {
        if (fForm.rep_name.trim()) {
          body.rep = {
            name: fForm.rep_name.trim(),
            ...(fForm.rep_email && { email: fForm.rep_email.trim() }),
            ...(fForm.rep_phone && { phone: fForm.rep_phone.trim() }),
          }
        }
        await api.post(`/suppliers/${supplier.id}/factories`, body)
      } else {
        await api.patch(`/suppliers/${supplier.id}/factories/${fDialog.record.id}`, body)
      }
      setFDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleFactoryDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/suppliers/${supplier.id}/factories/${fDialog.record.id}`)
      setFDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const fColumns = [
    { header: 'Factory',  accessor: 'name' },
    { header: 'Address',  render: r => r.address || '—' },
    { header: 'Country',  render: r => r.country || '—' },
    { header: 'Rep',      render: r => r.rep ? `${r.rep.name}${r.rep.phone ? ` · ${r.rep.phone}` : ''}` : '—' },
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Factories — {supplier.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {canCreate && (
              <div className="flex justify-end">
                <Button size="sm" onClick={openAdd}>Add Factory</Button>
              </div>
            )}
            <DataTable
              columns={fColumns}
              data={factories}
              isLoading={loading}
              emptyMessage="No factories yet"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FactoryFormDialog
        dialog={fDialog}
        form={fForm}
        setForm={setFForm}
        saving={saving}
        error={error}
        onSubmit={handleFactorySubmit}
        onClose={() => setFDialog(null)}
      />
      <DeleteFactoryDialog
        dialog={fDialog}
        saving={saving}
        error={error}
        onConfirm={handleFactoryDelete}
        onClose={() => setFDialog(null)}
      />
    </>
  )
}

// ── Main Suppliers page ───────────────────────────────────────────────────────

export default function Suppliers() {
  const { user } = useAuth()
  // TODO(dev-only): remove 'dev' role checks before shipping
  const isDev     = user?.role === 'dev'
  //#########################################################
  const canCreate = isDev || user?.role === 'employee'
  const canEdit   = isDev || user?.role === 'section_manager'
  const canDelete = isDev || user?.role === 'section_manager'

  const [suppliers, setSuppliers]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [dialog, setDialog]             = useState(null)
  const [form, setForm]                 = useState(EMPTY_SUPPLIER_FORM)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [factoriesFor, setFactoriesFor] = useState(null)
  const [itemsFor, setItemsFor]         = useState(null)
  const [allItems, setAllItems]         = useState([])

  async function load() {
    setLoading(true)
    try { setSuppliers(await api.get('/suppliers')) }
    finally { setLoading(false) }
  }
  async function loadItems() {
    setAllItems(await api.get('/items'))
  }
  useEffect(() => { load(); loadItems() }, [])

  function openAdd() {
    setForm({ ...EMPTY_SUPPLIER_FORM, factories: [] })
    setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({ name: r.name, email: r.email || '', phone: r.phone || '', address: r.address || '', factories: [] })
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

      if (dialog.mode === 'edit') {
        await api.patch(`/suppliers/${dialog.record.id}`, body)
        setDialog(null); load()
        return
      }

      const supplier = await api.post('/suppliers', body)

      const failures = []
      for (const [idx, fac] of form.factories.entries()) {
        const factoryBody = {
          name: fac.name.trim(),
          ...(fac.address && { address: fac.address.trim() }),
          ...(fac.country && { country: fac.country.trim() }),
          ...(fac.rep_name.trim() && {
            rep: {
              name: fac.rep_name.trim(),
              ...(fac.rep_email && { email: fac.rep_email.trim() }),
              ...(fac.rep_phone && { phone: fac.rep_phone.trim() }),
            },
          }),
        }
        try {
          await api.post(`/suppliers/${supplier.id}/factories`, factoryBody)
        } catch (err) {
          failures.push(`Factory #${idx + 1} (${fac.name || 'unnamed'}): ${err.message}`)
        }
      }

      if (failures.length > 0) {
        setError(
          `Supplier created, but some factories failed:\n${failures.join('\n')}\n\n` +
          `Use the Factories button on the row to retry.`
        )
        load()
        return
      }

      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/suppliers/${dialog.record.id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { header: 'Name',      accessor: 'name' },
    { header: 'Email',     render: r => r.email   || '—' },
    { header: 'Phone',     render: r => r.phone   || '—' },
    { header: 'Address',   render: r => r.address || '—' },
    { header: 'Factories', render: r => r.factories?.length ?? 0 },
    {
      header: 'Actions',
      render: r => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setFactoriesFor(r) }}>
            Factories
          </Button>
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setItemsFor(r) }}>
            Items
          </Button>
          {canEdit   && <Button size="sm" variant="outline"     onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</Button>}
          {canDelete && <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); openDelete(r) }}>Delete</Button>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage suppliers and their factories</p>
        </div>
        {canCreate && <Button onClick={openAdd}>Add Supplier</Button>}
      </div>

      <DataTable columns={columns} data={suppliers} isLoading={loading} emptyMessage="No suppliers yet" />

      <SupplierDialog
        dialog={dialog}
        form={form}
        setForm={setForm}
        saving={saving}
        error={error}
        onSubmit={handleSubmit}
        onClose={() => setDialog(null)}
      />
      <DeleteSupplierDialog
        dialog={dialog}
        saving={saving}
        error={error}
        onConfirm={handleDelete}
        onClose={() => setDialog(null)}
      />

      {factoriesFor && (
        <FactoriesDialog
          supplier={factoriesFor}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => { setFactoriesFor(null); load() }}
        />
      )}

      {itemsFor && (
        <SupplierItemsDialog
          supplier={itemsFor}
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

// ── Supplier Items dialog (per-supplier item costs) ──────────────────────────

const EMPTY_SI = { item_id: '', unit_cost: '', supplier_sku: '', lead_time_days: '', is_preferred: false, notes: '' }

function SupplierItemsDialog({ supplier, allItems, canCreate, canEdit, canDelete, onClose }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(null) // { mode: 'add'|'edit'|'delete', record? }
  const [form, setForm]     = useState(EMPTY_SI)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await api.get(`/suppliers/${supplier.id}/items`)) }
    finally { setLoading(false) }
  }, [supplier.id])
  useEffect(() => { load() }, [load])

  // Items not yet linked to this supplier — for the Add picker
  const linkedIds = new Set(rows.map(r => r.item_id))
  const availableItems = allItems.filter(i => !linkedIds.has(i.id))

  function openAdd() {
    setForm(EMPTY_SI); setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({
      item_id:        String(r.item_id),
      unit_cost:      String(r.unit_cost),
      supplier_sku:   r.supplier_sku   || '',
      lead_time_days: r.lead_time_days != null ? String(r.lead_time_days) : '',
      is_preferred:   !!r.is_preferred,
      notes:          r.notes          || '',
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
        unit_cost:      Number(form.unit_cost),
        supplier_sku:   form.supplier_sku.trim() || null,
        lead_time_days: form.lead_time_days === '' ? null : Number(form.lead_time_days),
        is_preferred:   form.is_preferred,
        notes:          form.notes.trim() || null,
      }
      await api.put(`/suppliers/${supplier.id}/items/${itemId}`, body)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/suppliers/${supplier.id}/items/${dialog.record.item_id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const columns = [
    { header: 'SKU',         render: r => r.sku },
    { header: 'Item',        render: r => r.item_name },
    { header: 'Cost',        render: r => `$${Number(r.unit_cost).toFixed(2)}` },
    { header: 'Supplier SKU',render: r => r.supplier_sku || '—' },
    { header: 'Lead Time',   render: r => r.lead_time_days != null ? `${r.lead_time_days}d` : '—' },
    { header: 'Preferred',   render: r => r.is_preferred ? '★' : '' },
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
            <DialogTitle>Items supplied — {supplier.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">
            Costs here override the catalogue default for purchase orders from this supplier.
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
                <Label>Unit Cost *</Label>
                <Input className="mt-1" type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Supplier SKU</Label>
                  <Input className="mt-1" value={form.supplier_sku} onChange={e => setForm(p => ({ ...p, supplier_sku: e.target.value }))} placeholder="their part number" />
                </div>
                <div>
                  <Label>Lead Time (days)</Label>
                  <Input className="mt-1" type="number" min="0" value={form.lead_time_days} onChange={e => setForm(p => ({ ...p, lead_time_days: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_preferred} onChange={e => setForm(p => ({ ...p, is_preferred: e.target.checked }))} />
                Preferred supplier for this item
              </label>
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
              Remove <strong>{dialog.record.sku} {dialog.record.item_name}</strong> from this supplier's catalogue?
              PO history is not affected.
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
