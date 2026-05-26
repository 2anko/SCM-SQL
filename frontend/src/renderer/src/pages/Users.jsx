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
import { date as fmtDate } from '../lib/format'

const ROLES = ['dev', 'head_manager', 'section_manager', 'employee', 'it_service']
const ROLE_LABELS = {
  dev:             'Dev (full access)',
  head_manager:    'Head Manager (read-only)',
  section_manager: 'Section Manager (read, add, edit, delete)',
  employee:        'Employee (read, add, edit)',
  it_service:      'IT Service (read & manage users)',
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog]   = useState(null) // { mode: 'add'|'edit', record? }
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setUsers(await api.get('/users')) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd()  { setDialog({ mode: 'add'  }) }
  function openEdit(r) { setDialog({ mode: 'edit', record: r }) }

  const columns = [
    { header: 'Email',    accessor: 'email' },
    { header: 'Role',     render: r => r.role.replace(/_/g, ' ') },
    { header: 'Status',   render: r => (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
        {r.is_active ? 'Active' : 'Disabled'}
      </span>
    )},
    { header: 'Created',  render: r => fmtDate(r.created_at) },
    {
      header: 'Actions',
      render: r => (
        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">Manage employee accounts and roles</p>
        </div>
        <Button onClick={openAdd}>Add User</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable columns={columns} data={users} isLoading={loading} emptyMessage="No users yet" />

      {dialog?.mode === 'add' && (
        <AddUserDialog
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); load() }}
        />
      )}
      {dialog?.mode === 'edit' && (
        <EditUserDialog
          user={dialog.record}
          isSelf={currentUser?.userId === dialog.record.id}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); load() }}
        />
      )}
    </div>
  )
}

// ── Add User dialog ──────────────────────────────────────────────────────────

function AddUserDialog({ onClose, onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'employee' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (form.password.length < 8) throw new Error('Password must be at least 8 characters.')
      await api.post('/users', {
        email:    form.email.trim(),
        password: form.password,
        role:     form.role,
      })
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Email *</Label>
            <Input className="mt-1" type="email" value={form.email} onChange={f('email')} placeholder="name@example.com" required />
          </div>
          <div>
            <Label>Password *</Label>
            <Input className="mt-1" type="password" minLength={8} value={form.password} onChange={f('password')} required />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
          </div>
          <div>
            <Label>Role *</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.role} onChange={f('role')} required>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit User dialog ─────────────────────────────────────────────────────────

function EditUserDialog({ user, isSelf, onClose, onSuccess }) {
  const [form, setForm] = useState({
    role:      user.role,
    is_active: user.is_active,
    password:  '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function f(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = {}
      if (form.role      !== user.role)      body.role      = form.role
      if (form.is_active !== user.is_active) body.is_active = form.is_active
      if (form.password.trim()) {
        if (form.password.length < 8) throw new Error('Password must be at least 8 characters.')
        body.password = form.password
      }
      if (Object.keys(body).length === 0) {
        onClose(); return
      }
      await api.patch(`/users/${user.id}`, body)
      onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit User — {user.email}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Role</Label>
            <select className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.role} onChange={f('role')} disabled={isSelf}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {isSelf && <p className="mt-1 text-xs text-amber-600">You can't change your own role.</p>}
          </div>

          <div>
            <Label>Status</Label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  disabled={isSelf}
                />
                Account active
              </label>
            </div>
            {isSelf && <p className="mt-1 text-xs text-amber-600">You can't disable your own account.</p>}
          </div>

          <div>
            <Label>Reset Password</Label>
            <Input className="mt-1" type="password" minLength={8} value={form.password} onChange={f('password')} placeholder="Leave blank to keep current" />
            <p className="mt-1 text-xs text-gray-500">Min 8 characters. Leave blank to keep current password.</p>
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
