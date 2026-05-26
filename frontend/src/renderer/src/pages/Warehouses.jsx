import { useState, useEffect } from 'react'
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

const EMPTY = { name: '', address: '', country: '' }

export default function Warehouses() {
  const { user } = useAuth()
  const { canCreate, canEdit, canDelete } = getPermissions(user)

  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [dialog, setDialog]         = useState(null)
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  async function load() {
    setLoading(true)
    try { setWarehouses(await api.get('/warehouses')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY); setError(''); setDialog({ mode: 'add' })
  }
  function openEdit(r) {
    setForm({ name: r.name, address: r.address || '', country: r.country || '' })
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
        ...(form.address && { address: form.address.trim() }),
        ...(form.country && { country: form.country.trim() }),
      }
      if (dialog.mode === 'add') await api.post('/warehouses', body)
      else                       await api.patch(`/warehouses/${dialog.record.id}`, body)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      await api.delete(`/warehouses/${dialog.record.id}`)
      setDialog(null); load()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  function field(key, label, opts = {}) {
    return (
      <div>
        <Label>{label}</Label>
        <Input
          className="mt-1"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          {...opts}
        />
      </div>
    )
  }

  const columns = [
    { header: 'Name',    accessor: 'name' },
    { header: 'Address', render: r => r.address || '—' },
    { header: 'Country', render: r => r.country || '—' },
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
          <h1 className="text-2xl font-semibold text-gray-900">Warehouses</h1>
          <p className="mt-1 text-sm text-gray-500">Manage storage locations</p>
        </div>
        {canCreate && <Button onClick={openAdd}>Add Warehouse</Button>}
      </div>

      <DataTable columns={columns} data={warehouses} isLoading={loading} emptyMessage="No warehouses yet" />

      <Dialog open={isFormOpen} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'add' ? 'Add Warehouse' : 'Edit Warehouse'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {field('name',    'Name *',   { required: true })}
            {field('address', 'Address')}
            {field('country', 'Country')}
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
          <DialogHeader><DialogTitle>Delete Warehouse</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{dialog?.record?.name}</strong>? Warehouses with stock on hand cannot be deleted — transfer all inventory out first.
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
