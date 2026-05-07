export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your supply chain</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Items',      color: 'text-blue-600' },
          { label: 'Warehouses', color: 'text-green-600' },
          { label: 'Open POs',   color: 'text-amber-600' },
          { label: 'Open SOs',   color: 'text-purple-600' },
        ].map(({ label, color }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>—</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">Dashboard widgets coming soon</p>
      </div>
    </div>
  )
}
