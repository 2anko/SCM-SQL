import { format } from "date-fns";
import { Package, Truck, ShoppingCart, Users } from "lucide-react";

const activityIcons = {
  order: ShoppingCart,
  shipment: Truck,
  product: Package,
  supplier: Users
};

const activityColors = {
  order: "bg-blue-50 text-blue-600",
  shipment: "bg-purple-50 text-purple-600",
  product: "bg-emerald-50 text-emerald-600",
  supplier: "bg-amber-50 text-amber-600"
};

export default function RecentActivity({ activities }) {
  if (!activities?.length) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
        <p className="text-slate-500 text-center py-8">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity, idx) => {
          const Icon = activityIcons[activity.type] || Package;
          const colorClass = activityColors[activity.type] || "bg-slate-50 text-slate-600";
          
          return (
            <div key={idx} className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{activity.title}</p>
                <p className="text-xs text-slate-500">{activity.description}</p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {format(new Date(activity.date), "MMM d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}