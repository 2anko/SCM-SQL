import { cn } from "@/lib/utils";

const statusStyles = {
  // General
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-50 text-slate-600 border-slate-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  
  // Orders
  draft: "bg-slate-50 text-slate-600 border-slate-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  shipped: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  
  // Shipments
  in_transit: "bg-blue-50 text-blue-700 border-blue-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delayed: "bg-orange-50 text-orange-700 border-orange-200",
  returned: "bg-red-50 text-red-700 border-red-200",
  
  // Products
  discontinued: "bg-slate-50 text-slate-600 border-slate-200",
  out_of_stock: "bg-red-50 text-red-700 border-red-200"
};

export default function StatusBadge({ status, className }) {
  const style = statusStyles[status] || "bg-slate-50 text-slate-600 border-slate-200";
  const label = status?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border",
      style,
      className
    )}>
      {label}
    </span>
  );
}