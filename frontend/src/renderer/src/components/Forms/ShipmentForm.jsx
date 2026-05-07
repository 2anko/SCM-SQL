import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

const carriers = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "dhl", label: "DHL" },
  { value: "usps", label: "USPS" },
  { value: "freight", label: "Freight" },
  { value: "other", label: "Other" }
];

const statuses = [
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "delayed", label: "Delayed" },
  { value: "returned", label: "Returned" }
];

export default function ShipmentForm({ open, onClose, shipment, onSave, orders = [] }) {
  const [formData, setFormData] = useState({
    tracking_number: "",
    order_id: "",
    order_number: "",
    carrier: "fedex",
    origin: "",
    destination: "",
    ship_date: "",
    estimated_arrival: "",
    actual_arrival: "",
    status: "pending",
    weight_kg: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shipment) {
      setFormData({
        tracking_number: shipment.tracking_number || "",
        order_id: shipment.order_id || "",
        order_number: shipment.order_number || "",
        carrier: shipment.carrier || "fedex",
        origin: shipment.origin || "",
        destination: shipment.destination || "",
        ship_date: shipment.ship_date || "",
        estimated_arrival: shipment.estimated_arrival || "",
        actual_arrival: shipment.actual_arrival || "",
        status: shipment.status || "pending",
        weight_kg: shipment.weight_kg?.toString() || "",
        notes: shipment.notes || ""
      });
    } else {
      setFormData({
        tracking_number: "",
        order_id: "",
        order_number: "",
        carrier: "fedex",
        origin: "",
        destination: "",
        ship_date: new Date().toISOString().split("T")[0],
        estimated_arrival: "",
        actual_arrival: "",
        status: "pending",
        weight_kg: "",
        notes: ""
      });
    }
  }, [shipment, open]);

  const handleOrderChange = (orderId) => {
    const order = orders.find(o => o.id === orderId);
    setFormData({
      ...formData,
      order_id: orderId,
      order_number: order?.order_number || ""
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...formData,
      weight_kg: parseFloat(formData.weight_kg) || null
    });
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{shipment ? "Edit Shipment" : "Create Shipment"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number *</Label>
              <Input
                id="tracking"
                value={formData.tracking_number}
                onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                placeholder="1Z999AA10123456784"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier *</Label>
              <Select value={formData.carrier} onValueChange={(v) => setFormData({ ...formData, carrier: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="order">Related Order</Label>
            <Select value={formData.order_id} onValueChange={handleOrderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select order (optional)" />
              </SelectTrigger>
              <SelectContent>
                {orders.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="Shanghai, CN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Los Angeles, US"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ship_date">Ship Date</Label>
              <Input
                id="ship_date"
                type="date"
                value={formData.ship_date}
                onChange={(e) => setFormData({ ...formData, ship_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated">Estimated Arrival</Label>
              <Input
                id="estimated"
                type="date"
                value={formData.estimated_arrival}
                onChange={(e) => setFormData({ ...formData, estimated_arrival: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                placeholder="50.5"
              />
            </div>
          </div>

          {formData.status === "delivered" && (
            <div className="space-y-2">
              <Label htmlFor="actual">Actual Arrival</Label>
              <Input
                id="actual"
                type="date"
                value={formData.actual_arrival}
                onChange={(e) => setFormData({ ...formData, actual_arrival: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Shipment notes..."
              rows={2}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {shipment ? "Update" : "Create"} Shipment
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}