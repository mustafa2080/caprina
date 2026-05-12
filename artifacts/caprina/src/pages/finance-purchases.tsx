import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShoppingCart, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

const api = {
  get: (url: string) => apiFetch<any>(url),
  post: (url: string, body: any) => apiFetch<any>(url, { method: "POST", body: JSON.stringify(body) }),
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: "مسودة",          color: "bg-gray-100 text-gray-600 border-gray-300" },
  ordered:          { label: "تم الطلب",        color: "bg-blue-50 text-blue-700 border-blue-300" },
  received:         { label: "تم الاستلام",     color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  partial_received: { label: "استلام جزئي",     color: "bg-purple-50 text-purple-700 border-purple-300" },
  cancelled:        { label: "ملغي",            color: "bg-red-50 text-red-700 border-red-300" },
};

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع", color: "text-rose-500" },
  partial: { label: "مدفوع جزئياً", color: "text-amber-500" },
  paid:    { label: "مدفوع بالكامل", color: "text-emerald-500" },
};

const fmt = (n: string | number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

export default function FinancePurchases() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([{ productName: "", quantity: 1, unitCost: 0, color: "", size: "" }]);
  const [form, setForm] = useState({ supplierId: "", warehouseId: "", shippingCost: "0", taxAmount: "0", discountAmount: "0", notes: "", expectedDate: "" });

  const { data: purchases = [], isLoading } = useQuery<any[]>({
    queryKey: ["finance-purchases"],
    queryFn: () => api.get("/finance/purchases"),
  });
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["finance-suppliers"],
    queryFn: () => api.get("/finance/suppliers"),
  });

  const addItem = () => setItems(prev => [...prev, { productName: "", quantity: 1, unitCost: 0, color: "", size: "" }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const totalItems = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const grandTotal = totalItems + parseFloat(form.shippingCost || "0") + parseFloat(form.taxAmount || "0") - parseFloat(form.discountAmount || "0");

  const save = useMutation({
    mutationFn: () => api.post("/finance/purchases", {
      supplierId: form.supplierId ? parseInt(form.supplierId) : undefined,
      warehouseId: form.warehouseId ? parseInt(form.warehouseId) : undefined,
      shippingCost: parseFloat(form.shippingCost) || 0,
      taxAmount: parseFloat(form.taxAmount) || 0,
      discountAmount: parseFloat(form.discountAmount) || 0,
      notes: form.notes,
      expectedDate: form.expectedDate || undefined,
      items,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-purchases"] }); setOpen(false); toast({ title: "تم إنشاء أمر الشراء" }); },
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">أوامر الشراء</h1>
          <p className="text-muted-foreground text-sm">إدارة عمليات الشراء من الموردين</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />أمر شراء جديد</Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-3">
          {purchases.map(p => {
            const supplier = suppliers.find((s: any) => s.id === p.supplierId);
            const st = STATUS_LABELS[p.status] ?? { label: p.status, color: "" };
            const py = PAY_LABELS[p.paymentStatus] ?? { label: p.paymentStatus, color: "" };
            return (
              <Card key={p.id} className="p-4 border-border">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{p.poNumber}</p>
                      <p className="text-xs text-muted-foreground">{supplier?.name ?? p.supplierName ?? "—"} · {format(new Date(p.createdAt), "yyyy/MM/dd")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] border ${st.color}`}>{st.label}</Badge>
                    <span className={`text-[10px] font-bold ${py.color}`}>{py.label}</span>
                    <p className="font-black text-primary text-sm">{fmt(p.totalAmount)}</p>
                  </div>
                </div>
                {p.notes && <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{p.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>أمر شراء جديد</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pl-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">المورد</Label>
                <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">تاريخ الاستلام المتوقع</Label><Input type="date" className="h-9 text-sm" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} /></div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">البنود *</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}><Plus className="w-3 h-3 mr-1" />إضافة بند</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5 items-center bg-muted/20 rounded-lg p-2">
                    <div className="col-span-4"><Input className="h-8 text-xs" placeholder="اسم المنتج *" value={item.productName} onChange={e => updateItem(i, "productName", e.target.value)} /></div>
                    <div className="col-span-2"><Input className="h-8 text-xs" placeholder="لون" value={item.color} onChange={e => updateItem(i, "color", e.target.value)} /></div>
                    <div className="col-span-1"><Input className="h-8 text-xs" placeholder="مقاس" value={item.size} onChange={e => updateItem(i, "size", e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" className="h-8 text-xs" placeholder="كمية" value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} /></div>
                    <div className="col-span-2"><Input type="number" className="h-8 text-xs" placeholder="سعر الوحدة" value={item.unitCost} onChange={e => updateItem(i, "unitCost", parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1 flex justify-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3" /></Button></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs mb-1 block">تكلفة الشحن</Label><Input type="number" className="h-9 text-sm" value={form.shippingCost} onChange={e => setForm(f => ({ ...f, shippingCost: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">الضرائب</Label><Input type="number" className="h-9 text-sm" value={form.taxAmount} onChange={e => setForm(f => ({ ...f, taxAmount: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">الخصم</Label><Input type="number" className="h-9 text-sm" value={form.discountAmount} onChange={e => setForm(f => ({ ...f, discountAmount: e.target.value }))} /></div>
            </div>

            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex justify-between text-sm font-bold">
                <span>الإجمالي الكلي</span>
                <span className="text-primary">{fmt(grandTotal)}</span>
              </div>
            </Card>

            <div><Label className="text-xs mb-1 block">ملاحظات</Label><Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate()} disabled={save.isPending || !items.some(i => i.productName)}>{save.isPending ? "جاري الحفظ..." : "إنشاء أمر الشراء"}</Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
