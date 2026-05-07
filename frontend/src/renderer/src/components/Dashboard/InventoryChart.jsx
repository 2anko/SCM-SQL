import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8"];

export default function InventoryChart({ products }) {
  const categoryData = products.reduce((acc, product) => {
    const category = product.category || "uncategorized";
    const existing = acc.find(item => item.name === category);
    if (existing) {
      existing.value += product.quantity_in_stock || 0;
    } else {
      acc.push({ 
        name: category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), 
        value: product.quantity_in_stock || 0 
      });
    }
    return acc;
  }, []);

  if (!categoryData.length || categoryData.every(d => d.value === 0)) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Inventory by Category</h3>
        <div className="h-64 flex items-center justify-center text-slate-500">
          No inventory data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Inventory by Category</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: "12px", 
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}