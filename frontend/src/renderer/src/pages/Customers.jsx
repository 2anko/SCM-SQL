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

const EMPTY = { name: '', email: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  // TODO(dev-only): remove 'dev' role checks before shipping
  const isDev     = user?.role === 'dev'
  //#########################################################
  const canCreate = isDev || user?.role === 'employee'
  const canEdit   = isDev || user?.role === 'section_manager'
  const canDelete = isDev || user?.role === 'section_manager'

  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [dialog, setDialog]       = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    try { setCustomers(await api.get('/customers')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

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
    </div>
  )
}
