import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Loader2, Plus, Trash2 } from "lucide-react";

const statuses = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" }
];

export default function OrderForm({ open, onClose, order, onSave, suppliers = [], products = [] }) {
  const [formData, setFormData] = useState({
    order_number: "",
    supplier_id: "",
    supplier_name: "",
    items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }],
    status: "draft",
    order_date: "",
    expected_delivery: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        order_number: order.order_number || "",
        supplier_id: order.supplier_id || "",
        supplier_name: order.supplier_name || "",
        items: order.items?.length ? order.items : [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }],
        status: order.status || "draft",
        order_date: order.order_date || "",
        expected_delivery: order.expected_delivery || "",
        notes: order.notes || ""
      });
    } else {
      const orderNum = `PO-${Date.now().toString().slice(-6)}`;
      setFormData({
        order_number: orderNum,
        supplier_id: "",
        supplier_name: "",
        items: [{ product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }],
        status: "draft",
        order_date: new Date().toISOString().split("T")[0],
        expected_delivery: "",
        notes: ""
      });
    }
  }, [order, open]);

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData({
      ...formData,
      supplier_id: supplierId,
      supplier_name: supplier?.name || ""
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === "product_id") {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].unit_price = product.unit_price || 0;
      }
    }
    
    if (field === "quantity" || field === "unit_price" || field === "product_id") {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: "", product_name: "", quantity: 1, unit_price: 0, total: 0 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      });
    }
  };

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...formData,
      total_amount: totalAmount
    });
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{order ? "Edit Order" : "Create Purchase Order"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_number">Order Number</Label>
              <Input
                id="order_number"
                value={formData.order_number}
                onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={formData.supplier_id} onValueChange={handleSupplierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected">Expected Delivery</Label>
              <Input
                id="expected"
                type="date"
                value={formData.expected_delivery}
                onChange={(e) => setFormData({ ...formData, expected_delivery: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Order Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {formData.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={item.product_id} onValueChange={(v) => handleItemChange(idx, "product_id", v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      value={item.total.toFixed(2)}
                      disabled
                      className="bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="text-xl font-bold text-slate-900">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {order ? "Update" : "Create"} Order
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}