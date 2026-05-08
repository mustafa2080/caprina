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
import { Plus, Receipt, Trash2, Wallet, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const api = {
  get: (url: string) => fetch(url, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  post: (url: string, body: any) => fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async r => { if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error ?? r.statusText); } return r.json(); }),
  del: (url: string) => fetch(url, { method: "DELETE", credentials: "include" }).then(r => { if (!r.ok) throw new Error(r.statusText); }),
};

const EXPENSE_CATEGORIES = [
  { value: "shipping_fees",  label: "مصاريف شحن" },
  { value: "warehouse_rent", label: "إيجار مخزن" },
  { value: "salary",         label: "مرتبات" },
  { value: "marketing",      label: "تسويق وإعلانات" },
  { value: "packaging",      label: "تغليف" },
  { value: "utilities",      label: "كهرباء / خدمات" },
  { value: "maintenance",    label: "صيانة" },
  { value: "returns_loss",   label: "خسائر مرتجعات" },
  { value: "other",          label: "أخرى" },
];

const catLabel = (v: string) => EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? v;
const fmt = (n: string | number) => Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";

const defaultForm = () => ({
  title: "", category: "other", amount: "",
  referenceId: "", notes: "",
  expenseDate: format(new Date(), "yyyy-MM-dd"),
  cashRegisterId: "",
});

export default function FinanceExpenses() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const F = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: expenses = [], isLoading } = useQuery<any[]>({
    queryKey: ["finance-expenses"],
    queryFn: () => api.get("/api/finance/expenses"),
  });

  const { data: regData } = useQuery<{ registers: any[] }>({
    queryKey: ["/api/cash-registers"],
    queryFn: () => api.get("/api/cash-registers"),
  });
  const registers = regData?.registers ?? [];

  const save = useMutation({
    mutationFn: () => api.post("/api/finance/expenses", {
      ...form,
      amount: parseFloat(form.amount),
      cashRegisterId: form.cashRegisterId ? parseInt(form.cashRegisterId) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-expenses"] });
      qc.invalidateQueries({ queryKey: ["/api/cash-registers"] });
      qc.invalidateQueries({ queryKey: ["/api/cash-registers/alerts"] });
      setOpen(false);
      setForm(defaultForm());
      toast({ title: "✅ تمت إضافة المصروف" + (form.cashRegisterId ? " وتم الخصم من الخزنة" : "") });
    },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); toast({ title: "تم الحذف" }); },
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const withCash = expenses.filter(e => e.cashRegisterId).length;

  const selectedReg = registers.find(r => String(r.id) === form.cashRegisterId);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصروفات التشغيلية</h1>
          <p className="text-muted-foreground text-sm">تسجيل ومتابعة كل مصروفات الشركة — مع الربط التلقائي بالخزنة</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" />مصروف جديد</Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 border-rose-500/30 bg-rose-500/5">
          <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
          <p className="text-2xl font-black text-rose-500">{fmt(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{expenses.length} مصروف مسجّل</p>
        </Card>
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs text-muted-foreground">مصروفات مربوطة بخزنة</p>
          <p className="text-2xl font-black text-emerald-600">{withCash}</p>
          <p className="text-xs text-muted-foreground mt-1">خُصمت تلقائياً من الخزنة</p>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p>لا توجد مصروفات مسجّلة بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e: any) => {
            const reg = registers.find(r => r.id === e.cashRegisterId);
            return (
              <Card key={e.id} className="p-3 border-border flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{catLabel(e.category)}</Badge>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(e.expenseDate), "yyyy/MM/dd")}</span>
                      {e.referenceId && <span className="text-[10px] text-muted-foreground">#{e.referenceId}</span>}
                      {reg && (
                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                          <Wallet className="w-2.5 h-2.5"/> {reg.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-black text-rose-500 text-sm">{fmt(e.amount)}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if(!v) setForm(defaultForm()); }}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-4 h-4"/> مصروف جديد</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label className="text-xs mb-1 block">العنوان *</Label>
              <Input className="h-9 text-sm" placeholder="مثال: إيجار مخزن يناير" value={form.title} onChange={e=>F("title",e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v=>F("category",v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c=><SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">المبلغ *</Label>
                <Input type="number" className="h-9 text-sm" placeholder="0" value={form.amount} onChange={e=>F("amount",e.target.value)}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">التاريخ *</Label>
                <Input type="date" className="h-9 text-sm" value={form.expenseDate} onChange={e=>F("expenseDate",e.target.value)}/>
              </div>
              <div><Label className="text-xs mb-1 block">رقم مرجعي</Label>
                <Input className="h-9 text-sm" placeholder="رقم فاتورة..." value={form.referenceId} onChange={e=>F("referenceId",e.target.value)}/>
              </div>
            </div>

            {/* ربط الخزنة — الجديد */}
            <div>
              <Label className="text-xs mb-1 block flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-500"/> خصم من خزنة (اختياري)
              </Label>
              <Select value={form.cashRegisterId} onValueChange={v=>F("cashRegisterId",v==="none"?"":v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="بدون ربط بخزنة"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط بخزنة</SelectItem>
                  {registers.map(r=>(
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} — رصيد: {Number(r.balance).toLocaleString("ar-EG")} ج.م
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReg && form.amount && (
                <div className={`mt-1.5 text-xs px-2 py-1 rounded flex items-center gap-1.5 ${parseFloat(selectedReg.balance??'0') >= parseFloat(form.amount||'0') ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                  <Wallet className="w-3 h-3"/>
                  رصيد "{selectedReg.name}" بعد الخصم:{" "}
                  <strong>{(parseFloat(selectedReg.balance??'0') - parseFloat(form.amount||'0')).toLocaleString("ar-EG")} ج.م</strong>
                  {parseFloat(selectedReg.balance??'0') < parseFloat(form.amount||'0') && " ⚠️ رصيد غير كافٍ"}
                </div>
              )}
            </div>

            <div><Label className="text-xs mb-1 block">ملاحظات</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e=>F("notes",e.target.value)}/>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={()=>save.mutate()} disabled={save.isPending || !form.title || !form.amount}>
                {save.isPending ? "جاري الحفظ..." : form.cashRegisterId ? "حفظ والخصم من الخزنة" : "حفظ"}
              </Button>
              <Button variant="outline" className="h-9 border-border" onClick={()=>setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
