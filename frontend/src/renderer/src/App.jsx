import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
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

export default function App() {
  const { token } = useAuth()
  const [setupState, setSetupState] = useState(null)  // null = still loading

  // On boot, ask the main process whether a saved DB config exists.
  // If not, show the wizard before anything else.
  useEffect(() => {
    if (!window.electron?.setup) {
      // Running in a browser tab without the preload bridge — assume already
      // configured (dev backend started via `npm run dev` in backend/).
      setSetupState({ configured: true })
      return
    }
    window.electron.setup.getState().then(setSetupState).catch(() => {
      setSetupState({ configured: true })   // fail open
    })
  }, [])

  if (!setupState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (!setupState.configured) {
    // Reload after wizard completes so the now-running backend serves /auth/login.
    return <Setup onComplete={() => window.location.reload()} />
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
