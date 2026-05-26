import { useState } from 'react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

// First-run setup wizard.
//
// Step 1: collect Postgres connection details, run a Test Connection probe.
// Step 2: save the config, start the embedded backend, run migrations.
// Step 3: create the first it_service admin user.
// On finish: mark setup complete in the main process and reload the app.
//
// The DB-config form fields map directly to node-pg's Pool options so we
// don't need conversion either side.

const DEFAULTS = {
  host:     'localhost',
  port:     '5432',
  database: 'scm',
  user:     '',
  password: '',
}

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(1)
  const [db, setDb]     = useState(DEFAULTS)
  const [admin, setAdmin] = useState({ email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [testedOk, setTestedOk] = useState(false)

  function f(target, key) {
    return e => {
      const v = e.target.value
      if (target === 'db')    { setTestedOk(false); setDb(p => ({ ...p, [key]: v })) }
      else                    setAdmin(p => ({ ...p, [key]: v }))
    }
  }

  function dbPayload() {
    return {
      host:     db.host.trim(),
      port:     Number(db.port),
      database: db.database.trim(),
      user:     db.user.trim(),
      password: db.password,
    }
  }

  async function handleTest() {
    setBusy(true); setError(''); setTestedOk(false)
    try {
      const r = await window.electron.setup.testConnection(dbPayload())
      if (r.ok) setTestedOk(true)
      else      setError(r.error || 'Connection failed.')
    } finally { setBusy(false) }
  }

  async function handleSaveAndStart() {
    setBusy(true); setError('')
    try {
      const r = await window.electron.setup.saveAndStart({ db: dbPayload() })
      if (!r.ok) { setError(r.error || 'Failed to start backend.'); return }
      setStep(3)
    } finally { setBusy(false) }
  }

  async function handleCreateAdmin(e) {
    e.preventDefault()
    if (admin.password !== admin.confirm) { setError('Passwords do not match.'); return }
    if (admin.password.length < 8)        { setError('Password must be at least 8 characters.'); return }
    setBusy(true); setError('')
    try {
      await api.post('/setup/first-user', { email: admin.email.trim(), password: admin.password })
      await window.electron.setup.markComplete()
      onComplete?.()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-lg border border-gray-200 shadow-sm p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Set up SCM</h1>
          <p className="mt-1 text-sm text-gray-500">
            Step {step} of 3 ·{' '}
            {step === 1 && 'Connect to your PostgreSQL database'}
            {step === 2 && 'Save configuration and prepare the schema'}
            {step === 3 && 'Create your administrator account'}
          </p>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Host *</Label><Input className="mt-1" value={db.host}     onChange={f('db', 'host')}     required /></div>
              <div><Label>Port *</Label><Input className="mt-1" type="number" value={db.port} onChange={f('db', 'port')} required /></div>
            </div>
            <div><Label>Database *</Label> <Input className="mt-1" value={db.database} onChange={f('db', 'database')} required /></div>
            <div><Label>User *</Label>     <Input className="mt-1" value={db.user}     onChange={f('db', 'user')}     required /></div>
            <div><Label>Password</Label>   <Input className="mt-1" type="password" value={db.password} onChange={f('db', 'password')} /></div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {testedOk && <p className="text-sm text-emerald-700">✓ Connection successful</p>}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleTest} disabled={busy}>
                {busy ? 'Testing…' : 'Test Connection'}
              </Button>
              <Button onClick={() => setStep(2)} disabled={!testedOk || busy}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Save these connection details and apply any pending database migrations.
              This is safe to re-run — already-applied migrations are skipped.
            </p>
            <ul className="text-xs text-gray-500 space-y-0.5 pl-4 list-disc">
              <li>Host: <code>{db.host}:{db.port}</code></li>
              <li>Database: <code>{db.database}</code></li>
              <li>User: <code>{db.user}</code></li>
            </ul>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>Back</Button>
              <Button onClick={handleSaveAndStart} disabled={busy}>
                {busy ? 'Working…' : 'Save & apply migrations'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleCreateAdmin} className="space-y-3">
            <p className="text-sm text-gray-700">
              Create the first user. They'll be assigned the <strong>dev</strong> role,
              which has full access — they can manage data and create everyone else from
              the Users page.
            </p>
            <div><Label>Email *</Label>           <Input className="mt-1" type="email"    value={admin.email}    onChange={f('admin', 'email')}    required /></div>
            <div><Label>Password *</Label>        <Input className="mt-1" type="password" value={admin.password} onChange={f('admin', 'password')} required minLength={8} /></div>
            <div><Label>Confirm password *</Label><Input className="mt-1" type="password" value={admin.confirm}  onChange={f('admin', 'confirm')}  required minLength={8} /></div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={busy}>Back</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create admin & finish'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map(n => (
        <div key={n} className="flex-1 flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            n  <  step ? 'bg-emerald-600 text-white'
            : n === step ? 'bg-gray-900 text-white'
            : 'bg-gray-200 text-gray-500'
          }`}>{n < step ? '✓' : n}</div>
          {n < 3 && <div className={`flex-1 h-px ${n < step ? 'bg-emerald-600' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}
