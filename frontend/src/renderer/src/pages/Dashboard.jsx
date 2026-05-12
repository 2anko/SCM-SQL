import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

const PO_OPEN_STATUSES = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED']
const SO_OPEN_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED']

function fmtMoney(v) {
  return v != null && v !== '' ? `$${Number(v).toFixed(2)}` : '$0.00'
}
function fmtDate(s) { return s ? new Date(s).toLocaleDateString() : '—' }

function StatCard({ label, value, color, sub }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats]       = useState(null)
  const [recentPos, setRecentPos] = useState([])
  const [recentSos, setRecentSos] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [items, warehouses, suppliers, customers, pos, sos, stock] = await Promise.all([
        api.get('/items'),
        api.get('/warehouses'),
        api.get('/suppliers'),
        api.get('/customers'),
        api.get('/purchase-orders'),
        api.get('/sales-orders'),
        api.get('/inventory'),
      ])

      const openPos = pos.filter(p => PO_OPEN_STATUSES.includes(p.status))
      const openSos = sos.filter(s => SO_OPEN_STATUSES.includes(s.status))

      setStats({
        items:      items.length,
        warehouses: warehouses.length,
        suppliers:  suppliers.length,
        customers:  customers.length,
        openPos:    openPos.length,
        openSos:    openSos.length,
        openPoValue: openPos.reduce((sum, p) => sum + Number(p.total_value || 0), 0),
        openSoValue: openSos.reduce((sum, s) => sum + Number(s.total_value || 0), 0),
        stockLines:  stock.length,
        totalUnits:  stock.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      })

      setRecentPos(pos.slice(0, 5))
      setRecentSos(sos.slice(0, 5))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.role && <>Signed in as <span className="capitalize">{user.role.replace(/_/g, ' ')}</span>. </>}
            Overview of your supply chain.
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Top row: 4 primary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Items"       value={loading ? '—' : stats?.items      ?? 0} color="text-blue-600" />
        <StatCard label="Warehouses"  value={loading ? '—' : stats?.warehouses ?? 0} color="text-green-600" />
        <StatCard label="Open POs"    value={loading ? '—' : stats?.openPos    ?? 0} color="text-amber-600" sub={loading ? '' : `${fmtMoney(stats?.openPoValue)} outstanding`} />
        <StatCard label="Open SOs"    value={loading ? '—' : stats?.openSos    ?? 0} color="text-purple-600" sub={loading ? '' : `${fmtMoney(stats?.openSoValue)} outstanding`} />
      </div>

      {/* Second row: secondary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Suppliers"        value={loading ? '—' : stats?.suppliers   ?? 0} color="text-slate-700" />
        <StatCard label="Customers"        value={loading ? '—' : stats?.customers   ?? 0} color="text-slate-700" />
        <StatCard label="Stock Locations"  value={loading ? '—' : stats?.stockLines  ?? 0} color="text-slate-700" sub="warehouse × item" />
        <StatCard label="Total Units"      value={loading ? '—' : Number(stats?.totalUnits ?? 0).toLocaleString()} color="text-slate-700" sub="across all warehouses" />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-4">
        <RecentList title="Recent Purchase Orders" rows={recentPos} kind="po" loading={loading} />
        <RecentList title="Recent Sales Orders"    rows={recentSos} kind="so" loading={loading} />
      </div>
    </div>
  )
}

function RecentList({ title, rows, kind, loading }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
      </div>
      {loading ? (
        <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">No records yet</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">
                  #{r.id} — {kind === 'po' ? r.supplier : r.customer}
                </p>
                <p className="text-xs text-gray-500">
                  {r.status.replace(/_/g, ' ')} · {fmtDate(r.created_at)}
                </p>
              </div>
              <p className="text-sm font-medium text-gray-700 ml-4 whitespace-nowrap">
                {fmtMoney(r.total_value)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
