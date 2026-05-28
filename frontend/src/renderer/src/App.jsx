import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { api } from './api/client'
import Layout from './components/Layout'
import Login from './pages/Login'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Items from './pages/Items'
import Warehouses from './pages/Warehouses'
import Inventory from './pages/Inventory'
import PurchaseOrders from './pages/PurchaseOrders'
import SalesOrders from './pages/SalesOrders'
import Suppliers from './pages/Suppliers'
import Customers from './pages/Customers'
import Users from './pages/Users'

function ProtectedLayout() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Layout><Outlet /></Layout>
}

/**
 * Boot routing decisions:
 *
 *   - No config saved                    → Setup wizard, step 1
 *   - Config saved + DB unreachable      → Setup wizard, step 1 (re-config)
 *   - Config saved + DB has no users     → Setup wizard, step 3 (create admin)
 *   - Config saved + DB has users        → Login → app
 *
 * The user-existence check is what catches the "config.json survived an
 * uninstall, but the DB was wiped" case. We never want to land on Login if
 * there's no possible credential that would work.
 */
export default function App() {
  const { token } = useAuth()
  const [bootState, setBootState] = useState(null)
  //   { mode: 'loading' | 'setup' | 'app', startAtStep?: 1|2|3, error?: string }

  useEffect(() => {
    async function decide() {
      // The DATABASE is the source of truth — not config.json. Ask the backend
      // whether an admin account exists. This works identically for:
      //   - the embedded backend in a packaged app (main starts it from the
      //     saved config before the window opens), and
      //   - a separately-run dev backend on :3000 (npm run dev in backend/).
      //
      // /setup/needs-first-user is unauthenticated and returns { needed }.
      //   reachable + has admin   → login
      //   reachable + no admin    → wizard step 3 (just create the admin)
      //   unreachable             → wizard step 1 (no DB configured, or it's
      //                             down — collect connection details)
      try {
        const { needed } = await api.get('/setup/needs-first-user')
        setBootState({ mode: needed ? 'setup' : 'app', startAtStep: needed ? 3 : 1 })
      } catch {
        setBootState({ mode: 'setup', startAtStep: 1 })
      }
    }
    decide()
  }, [])

  if (!bootState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (bootState.mode === 'setup') {
    return (
      <Setup
        startAtStep={bootState.startAtStep ?? 1}
        onComplete={() => window.location.reload()}
      />
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <Login />}
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/"                element={<Dashboard />} />
        <Route path="/inventory"       element={<Inventory />} />
        <Route path="/items"           element={<Items />} />
        <Route path="/warehouses"      element={<Warehouses />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/sales-orders"    element={<SalesOrders />} />
        <Route path="/suppliers"       element={<Suppliers />} />
        <Route path="/customers"       element={<Customers />} />
        <Route path="/users"           element={<Users />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
