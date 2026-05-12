import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Package,
  Box,
  Building,
  ClipboardList,
  ClipboardCheck,
  Truck,
  Users,
  UserCog,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/',                label: 'Dashboard',       icon: LayoutDashboard, end: true },
  { to: '/inventory',       label: 'Inventory',        icon: Package },
  { to: '/items',           label: 'Items',            icon: Box },
  { to: '/warehouses',      label: 'Warehouses',       icon: Building },
  { to: '/purchase-orders', label: 'Purchase Orders',  icon: ClipboardList },
  { to: '/sales-orders',    label: 'Sales Orders',     icon: ClipboardCheck },
  { to: '/suppliers',       label: 'Suppliers',        icon: Truck },
  { to: '/customers',       label: 'Customers',        icon: Users },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-slate-700 text-white'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
        }`
      }
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const roleLabel = user?.role?.replace(/_/g, ' ') ?? ''

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 flex flex-col flex-shrink-0">
        {/* Branding */}
        <div className="px-6 py-5 border-b border-slate-700">
          <h1 className="text-white font-bold text-lg tracking-tight">SCM</h1>
          <p className="text-slate-400 text-xs mt-0.5">Supply Chain Manager</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {(user?.role === 'it_service' || user?.role === 'dev') && (
            <NavItem to="/users" label="Users" icon={UserCog} />
          )}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 capitalize truncate">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  )
}
