import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Receipt, Trash2, Wallet, Search, X, Filter,
  Download, FileSpreadsheet, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

const api = {
  get:  (url: string)            => apiFetch<any>(url.replace(/^\/api/, "")),
  post: (url: string, body: any) => apiFetch<any>(url.replace(/^\/api/, ""), { method: "POST", body: JSON.stringify(body) }),
  del:  (url: string)            => apiFetch<void>(url.replace(/^\/api/, ""), { method: "DELETE" }),
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
const fmt = (n: string | number) =>
  Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 2 }) + " ج.م";

const PAGE_LIMIT = 25;
const defaultForm = () => ({
  title: "", category: "other", amount: "",
  referenceId: "", notes: "",
  expenseDate: format(new Date(), "yyyy-MM-dd"),
  cashRegisterId: "",
});

export default function FinanceExpenses() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Dialog state ──
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const F = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // ── فلاتر ──
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [page,      setPage]      = useState(1);

  const hasFilters = search || filterCat !== "all" || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setFilterCat("all"); setDateFrom(""); setDateTo(""); setPage(1); };

  // ── بناء query params ──
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    if (search)              p.set("search",   search);
    if (filterCat !== "all") p.set("category", filterCat);
    if (dateFrom)            p.set("from",     dateFrom);
    if (dateTo)              p.set("to",       dateTo);
    return p.toString();
  }, [search, filterCat, dateFrom, dateTo, page]);

  // ── جلب البيانات ──
  const { data, isLoading } = useQuery<{ expenses: any[]; total: number; page: number; limit: number }>({
    queryKey: ["finance-expenses", params],
    queryFn:  () => api.get(`/api/finance/expenses?${params}`),
    placeholderData: prev => prev,
  });

  const expenses  = data?.expenses ?? [];
  const total     = data?.total    ?? 0;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const { data: regData } = useQuery<{ registers: any[] }>({
    queryKey: ["/api/cash-registers"],
    queryFn:  () => api.get("/api/cash-registers"),
  });
  const registers = regData?.registers ?? [];

  // ── Mutations ──
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
      setOpen(false); setForm(defaultForm());
      toast({ title: "✅ تمت إضافة المصروف" + (form.cashRegisterId ? " وتم الخصم من الخزنة" : "") });
    },
    onError: (e: any) => toast({ title: "❌ خطأ", description: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/finance/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-expenses"] }); toast({ title: "تم الحذف" }); },
  });

  // ── تصدير ──
  const buildExportParams = () => {
    const p = new URLSearchParams();
    if (search)              p.set("search",   search);
    if (filterCat !== "all") p.set("category", filterCat);
    if (dateFrom)            p.set("from",     dateFrom);
    if (dateTo)              p.set("to",       dateTo);
    return p.toString();
  };

  const handleExportCSV = () => {
    if (!expenses.length) return;
    const header = ["#", "العنوان", "التصنيف", "المبلغ", "التاريخ", "رقم مرجعي", "ملاحظات"];
    const rows = expenses.map(e => [
      e.id, e.title, catLabel(e.category), e.amount,
      e.expenseDate ? format(new Date(e.expenseDate), "yyyy/MM/dd") : "",
      e.referenceId ?? "", e.notes ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `expenses-${Date.now()}.csv`; a.click();
  };

  const handleExportExcel = () => {
    const q = buildExportParams();
    window.open(`/api/finance/expenses/export-excel${q ? "?" + q : ""}`, "_blank");
  };

  // ── ملخص الصفحة الحالية ──
  const pageTotal  = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const withCash   = expenses.filter(e => e.cashRegisterId).length;
  const selectedReg = registers.find(r => String(r.id) === form.cashRegisterId);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصروفات التشغيلية</h1>
          <p className="text-muted-foreground text-sm">تسجيل ومتابعة كل مصروفات الشركة — مع الربط التلقائي بالخزنة</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-xl" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5"/> CSV
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs rounded-xl text-black font-bold"
            style={{background:"#DEA821"}}
            onMouseEnter={e=>(e.currentTarget.style.background="#c8931c")}
            onMouseLeave={e=>(e.currentTarget.style.background="#DEA821")}
            onClick={handleExportExcel}>
            <FileSpreadsheet className="w-3.5 h-3.5"/> Excel
          </Button>
          <Button onClick={() => setOpen(true)} className="gap-2 h-8 text-sm">
            <Plus className="w-4 h-4"/>مصروف جديد
          </Button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 border-rose-500/30 bg-rose-500/5">
          <p className="text-xs text-muted-foreground">إجمالي الصفحة الحالية</p>
          <p className="text-2xl font-black text-rose-500">{fmt(pageTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{total} مصروف إجمالي</p>
        </Card>
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs text-muted-foreground">مربوطة بخزنة (الصفحة)</p>
          <p className="text-2xl font-black text-emerald-600">{withCash}</p>
          <p className="text-xs text-muted-foreground mt-1">خُصمت تلقائياً</p>
        </Card>
      </div>

      {/* ── فلاتر ── */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/> فلاتر البحث</p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              <X className="w-3 h-3"/> مسح الفلاتر
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} className="h-8 text-xs rounded-xl"/>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}} className="h-8 text-xs rounded-xl"/>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">التصنيف</Label>
            <Select value={filterCat} onValueChange={v=>{setFilterCat(v);setPage(1);}}>
              <SelectTrigger className="h-8 text-xs rounded-xl"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {EXPENSE_CATEGORIES.map(c=><SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">بحث</Label>
            <div className="relative">
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground"/>
              <Input placeholder="عنوان أو مرجع..." value={search}
                onChange={e=>{setSearch(e.target.value);setPage(1);}}
                className="h-8 text-xs rounded-xl pr-8"/>
            </div>
          </div>
        </div>
        {hasFilters && (
          <p className="text-[11px] text-muted-foreground">عرض {total} نتيجة</p>
        )}
      </div>

      {/* ── قائمة المصروفات ── */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p>{hasFilters ? "لا توجد مصروفات بهذه الفلاتر" : "لا توجد مصروفات مسجّلة بعد"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e: any) => {
            const reg = registers.find(r => r.id === e.cashRegisterId);
            return (
              <Card key={e.id} className="p-3 border-border flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-rose-500"/>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{catLabel(e.category)}</Badge>
                      <span className="text-[10px] text-muted-foreground">{e.expenseDate ? format(new Date(e.expenseDate), "yyyy/MM/dd") : ""}</span>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(e.id)}>
                    <Trash2 className="w-3.5 h-3.5"/>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} مصروف إجمالي</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4"/>
            </button>
            <span className="px-3 py-1 rounded-lg bg-muted font-semibold">
              صفحة {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* ── Dialog إضافة مصروف ── */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(defaultForm()); }}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-4 h-4"/> مصروف جديد</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs mb-1 block">العنوان *</Label>
              <Input className="h-9 text-sm" placeholder="مثال: إيجار مخزن يناير" value={form.title} onChange={e => F("title", e.target.value)}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => F("category", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">المبلغ *</Label>
                <Input type="number" className="h-9 text-sm" placeholder="0" value={form.amount} onChange={e => F("amount", e.target.value)}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">التاريخ *</Label>
                <Input type="date" className="h-9 text-sm" value={form.expenseDate} onChange={e => F("expenseDate", e.target.value)}/>
              </div>
              <div>
                <Label className="text-xs mb-1 block">رقم مرجعي</Label>
                <Input className="h-9 text-sm" placeholder="رقم فاتورة..." value={form.referenceId} onChange={e => F("referenceId", e.target.value)}/>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-500"/> خصم من خزنة (اختياري)
              </Label>
              <Select value={form.cashRegisterId} onValueChange={v => F("cashRegisterId", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="بدون ربط بخزنة"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون ربط بخزنة</SelectItem>
                  {registers.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} — رصيد: {Number(r.balance).toLocaleString("ar-EG")} ج.م
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReg && form.amount && (
                <div className={`mt-1.5 text-xs px-2 py-1 rounded flex items-center gap-1.5 ${parseFloat(selectedReg.balance ?? "0") >= parseFloat(form.amount || "0") ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                  <Wallet className="w-3 h-3"/>
                  الرصيد بعد الخصم: <strong>{(parseFloat(selectedReg.balance ?? "0") - parseFloat(form.amount || "0")).toLocaleString("ar-EG")} ج.م</strong>
                  {parseFloat(selectedReg.balance ?? "0") < parseFloat(form.amount || "0") && " ⚠️ رصيد غير كافٍ"}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs mb-1 block">ملاحظات</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => F("notes", e.target.value)}/>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate()}
                disabled={save.isPending || !form.title || !form.amount}>
                {save.isPending ? "جاري الحفظ..." : form.cashRegisterId ? "حفظ والخصم من الخزنة" : "حفظ"}
              </Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
