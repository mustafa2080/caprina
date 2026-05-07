import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2, Phone, Mail, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Supplier = {
  id: number; name: string; phone?: string; email?: string;
  address?: string; category?: string; paymentTerms?: string; notes?: string;
  isActive: boolean; balance: string;
};

const CATEGORIES = [
  { value: "raw_materials", label: "خامات" },
  { value: "products",      label: "منتجات جاهزة" },
  { value: "packaging",     label: "تغليف" },
  { value: "services",      label: "خدمات" },
  { value: "other",         label: "أخرى" },
];

export default function FinanceSuppliers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", category: "products", paymentTerms: "", notes: "" });

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["finance-suppliers"],
    queryFn: () => apiClient.get("/finance/suppliers").then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (d: typeof form) => editing
      ? apiClient.patch(`/finance/suppliers/${editing.id}`, d)
      : apiClient.post("/finance/suppliers", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-suppliers"] }); setOpen(false); toast({ title: editing ? "تم التعديل" : "تمت الإضافة" }); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-suppliers"] }); toast({ title: "تم الحذف" }); },
  });

  const openNew = () => { setEditing(null); setForm({ name: "", phone: "", email: "", address: "", category: "products", paymentTerms: "", notes: "" }); setOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", category: s.category ?? "products", paymentTerms: s.paymentTerms ?? "", notes: s.notes ?? "" }); setOpen(true); };

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الموردون</h1>
          <p className="text-muted-foreground text-sm">إدارة بيانات وحسابات الموردين</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />مورد جديد</Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <Card key={s.id} className="p-4 border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{s.name}</p>
                    <Badge variant="outline" className="text-[9px] mt-0.5">{CATEGORIES.find(c => c.value === s.category)?.label ?? s.category}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {s.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                {s.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.email}</p>}
                {s.paymentTerms && <p>شروط الدفع: <span className="text-foreground font-medium">{s.paymentTerms}</span></p>}
                <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                  <span>الرصيد</span>
                  <span className={`font-bold ${parseFloat(s.balance) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(parseFloat(s.balance))}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل مورد" : "مورد جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label className="text-xs mb-1 block">اسم المورد *</Label><Input className="h-9 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">هاتف</Label><Input className="h-9 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">بريد إلكتروني</Label><Input className="h-9 text-sm" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs mb-1 block">شروط الدفع</Label><Input className="h-9 text-sm" placeholder="مثال: نقداً / 30 يوم" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
            <div><Label className="text-xs mb-1 block">العنوان</Label><Input className="h-9 text-sm" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label className="text-xs mb-1 block">ملاحظات</Label><Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}>{save.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
