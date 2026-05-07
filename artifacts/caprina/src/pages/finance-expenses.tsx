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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const EXPENSE_CATEGORIES = [
  { value: "shipping_fees",   label: "مصاريف شحن" },
  { value: "warehouse_rent",  label: "إيجار مخزن" },
  { value: "salary",          label: "مرتبات" },
  { value: "marketing",       label: "تسويق وإعلانات" },
  { value: "packaging",       label: "تغليف" },
  { value: "utilities",       label: "كهرباء / خدمات" },
  { value: "maintenance",     label: "صيانة" },
  { value: "returns_loss",    label: "خسائر مرتجعات" },
  { value: "other",           label: "أخرى" },
];

const catLabel = (v: string) => EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? v;
const fmt = (n: string | number) => new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

export default function FinanceExpenses() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "other", amount: "", referenceId: "", notes: "", expenseDate: format(new Date(), "yyyy-MM-dd") });

  const { data: expenses = [], isLoading } = useQuery<any[]>({
    queryKey: ["finance-expenses"],
    queryFn: () => apiClient.get("/finance/expenses").then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => apiClient.post("/finance/expenses", { ...form, amount: parseFloat(form.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); setOpen(false); toast({ title: "تمت إضافة المصروف" }); },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); toast({ title: "تم الحذف" }); },
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصروفات التشغيلية</h1>
          <p className="text-muted-foreground text-sm">تسجيل ومتابعة كل مصروفات الشركة</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مصروف جديد</Button>
      </div>

      <Card className="p-4 border-rose-500/30 bg-rose-500/5">
        <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
        <p className="text-2xl font-black text-rose-500">{fmt(totalExpenses)}</p>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <Card key={e.id} className="p-3 border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="font-bold text-sm">{e.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[9px]">{catLabel(e.category)}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(e.expenseDate), "yyyy/MM/dd")}</span>
                    {e.referenceId && <span className="text-[10px] text-muted-foreground">ref: {e.referenceId}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-black text-rose-500 text-sm">{fmt(e.amount)}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label className="text-xs mb-1 block">العنوان *</Label><Input className="h-9 text-sm" placeholder="مثال: إيجار مخزن يناير" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">المبلغ *</Label><Input type="number" className="h-9 text-sm" placeholder="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">التاريخ *</Label><Input type="date" className="h-9 text-sm" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رقم مرجعي</Label><Input className="h-9 text-sm" placeholder="رقم فاتورة / أمر شراء" value={form.referenceId} onChange={e => setForm(f => ({ ...f, referenceId: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs mb-1 block">ملاحظات</Label><Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate()} disabled={save.isPending || !form.title || !form.amount}>{save.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
