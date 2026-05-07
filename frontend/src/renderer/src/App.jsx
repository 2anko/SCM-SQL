import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
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
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export default function App() {
  const { token } = useAuth()

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
