import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Building2, Phone, Mail, Edit2, Trash2,
  Search, Download, FileSpreadsheet, X, BookOpen,
  TrendingDown, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const api = {
  get: (url: string) => apiFetch<any>(url),
  post: (url: string, body: any) => apiFetch<any>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: (url: string, body: any) => apiFetch<any>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: (url: string) => apiFetch<void>(url, { method: "DELETE" }),
};

type Supplier = {
  id: number; name: string; phone?: string; email?: string;
  address?: string; category?: string; paymentTerms?: string; notes?: string;
  isActive: boolean; isDefault: boolean; balance: string;
};

type PurchaseOrder = {
  id: number; poNumber: string; status: string; paymentStatus: string;
  totalAmount: string; paidAmount: string; createdAt: string; notes?: string;
};

type Statement = {
  supplier: Supplier;
  orders: PurchaseOrder[];
  summary: { totalOrders: number; totalAmount: number; totalPaid: number; totalUnpaid: number };
};

const CATEGORIES = [
  { value: "raw_materials", label: "خامات" },
  { value: "products",      label: "منتجات جاهزة" },
  { value: "packaging",     label: "تغليف" },
  { value: "services",      label: "خدمات" },
  { value: "other",         label: "أخرى" },
];

const PAY_BADGE: Record<string, { label: string; cls: string }> = {
  unpaid:  { label: "غير مدفوع", cls: "bg-rose-500/15 text-rose-500 border-rose-500/20" },
  partial: { label: "جزئي",      cls: "bg-amber-500/15 text-amber-500 border-amber-500/20" },
  paid:    { label: "مدفوع",     cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
};

const PO_BADGE: Record<string, { label: string; cls: string }> = {
  draft:            { label: "مسودة",        cls: "bg-slate-500/15 text-slate-400" },
  ordered:          { label: "مُرسَل",       cls: "bg-blue-500/15 text-blue-400" },
  received:         { label: "مُستلَم",      cls: "bg-emerald-500/15 text-emerald-500" },
  partial_received: { label: "مستلم جزئياً", cls: "bg-amber-500/15 text-amber-500" },
  cancelled:        { label: "ملغي",         cls: "bg-red-500/15 text-red-400" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const PAGE_SIZE = 12;

export default function FinanceSuppliers() {

  // ── Finance access guard ───────────────────────────────────────────────────
  const { user: _fUser, can: _fCan } = useAuth();
  if (_fUser?.role !== "admin" && !_fCan("finance.view")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
        <p className="text-muted-foreground text-sm max-w-xs">ليس لديك صلاحية لعرض صفحة الماليات. تواصل مع المدير.</p>
      </div>
    );
  }
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── filters ────────────────────────────────────────────────────────────────
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page,     setPage]     = useState(1);

  // ── supplier form ──────────────────────────────────────────────────────────
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "",
    category: "products", paymentTerms: "", notes: "",
  });

  // ── statement modal ────────────────────────────────────────────────────────
  const [stmtSupplier, setStmtSupplier] = useState<Supplier | null>(null);
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo,   setStmtTo]   = useState("");

  // ── queries ────────────────────────────────────────────────────────────────
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (catFilter !== "all") params.set("category", catFilter);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["finance-suppliers", search, catFilter],
    queryFn: () => api.get(`/finance/suppliers?${params}`),
  });

  const stmtParams = new URLSearchParams();
  if (stmtFrom) stmtParams.set("from", stmtFrom);
  if (stmtTo)   stmtParams.set("to",   stmtTo);

  const { data: stmtData, isLoading: stmtLoading } = useQuery<Statement>({
    queryKey: ["supplier-statement", stmtSupplier?.id, stmtFrom, stmtTo],
    queryFn: () => api.get(`/finance/suppliers/${stmtSupplier!.id}/statement?${stmtParams}`),
    enabled: !!stmtSupplier,
  });

  // ── mutations ──────────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: (d: typeof form) => editing
      ? api.patch(`/finance/suppliers/${editing.id}`, d)
      : api.post("/finance/suppliers", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-suppliers"] });
      setOpen(false);
      toast({ title: editing ? "تم التعديل" : "تمت الإضافة" });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.del(`/finance/suppliers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-suppliers"] }); toast({ title: "تم الحذف" }); },
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/finance/suppliers/${id}/set-default`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["finance-suppliers"] });
      qc.invalidateQueries({ queryKey: ["finance-suppliers-default"] });
      toast({ title: `✅ "${data.name}" أصبح المورد الافتراضي` });
    },
    onError: () => toast({ title: "خطأ", description: "فشل تعيين المورد الافتراضي", variant: "destructive" }),
  });

  // ── helpers ────────────────────────────────────────────────────────────────
  const openNew  = () => { setEditing(null); setForm({ name: "", phone: "", email: "", address: "", category: "products", paymentTerms: "", notes: "" }); setOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", category: s.category ?? "products", paymentTerms: s.paymentTerms ?? "", notes: s.notes ?? "" }); setOpen(true); };

  const exportExcel = () => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (catFilter !== "all") p.set("category", catFilter);
    window.open(`/api/finance/suppliers/export-excel?${p}`, "_blank");
  };

  const exportStatement = () => {
    if (!stmtSupplier) return;
    const p = new URLSearchParams();
    if (stmtFrom) p.set("from", stmtFrom);
    if (stmtTo)   p.set("to",   stmtTo);
    window.open(`/api/finance/suppliers/${stmtSupplier.id}/statement/export-excel?${p}`, "_blank");
  };

  // ── pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  const paged = suppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search.trim() || catFilter !== "all";

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">الموردون</h1>
          <p className="text-muted-foreground text-sm">إدارة بيانات وحسابات الموردين</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border h-9" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />تصدير Excel
          </Button>
          <Button onClick={openNew} className="gap-2 h-9"><Plus className="w-4 h-4" />مورد جديد</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 border-border">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="h-9 text-sm pr-8"
              placeholder="بحث بالاسم أو الهاتف..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={catFilter} onValueChange={v => { setCatFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 text-sm border-border w-[150px]">
              <SelectValue placeholder="كل الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground"
              onClick={() => { setSearch(""); setCatFilter("all"); setPage(1); }}>
              <X className="w-3.5 h-3.5" />مسح
            </Button>
          )}
          <span className="text-xs text-muted-foreground mr-auto">{suppliers.length} مورد</span>
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">جاري التحميل...</div>
      ) : suppliers.length === 0 ? (
        <Card className="p-10 text-center border-border">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">لا يوجد موردون{hasFilters ? " بهذه الفلاتر" : ""}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map(s => {
              const bal = parseFloat(s.balance);
              const color = bal < 0 ? "#ef4444" : "#26A69A";
              const glow  = bal < 0 ? "rgba(239,68,68,0.22)" : "rgba(38,166,154,0.20)";
              const bg    = bal < 0
                ? "linear-gradient(135deg, rgba(239,68,68,0.28) 0%, rgba(239,68,68,0.10) 52%, rgba(255,255,255,0.05) 100%)"
                : "linear-gradient(135deg, rgba(126,87,194,0.28) 0%, rgba(126,87,194,0.10) 52%, rgba(255,255,255,0.05) 100%)";
              return (
              <div key={s.id}
                className="group relative overflow-hidden rounded-[20px] p-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: bg, border: `1px solid ${glow}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.13), 0 8px 24px ${glow}`, backdropFilter: "blur(12px)" }}>
                <div className="absolute inset-x-6 top-0 h-px pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${bal < 0 ? "#ef4444" : "#7E57C2"}, transparent)` }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.10)" }}>
                      <Building2 className="w-4 h-4" style={{ color: bal < 0 ? "#ef4444" : "#7E57C2" }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm" style={{ color: "hsl(var(--foreground))" }}>{s.name}</p>
                        {s.isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: "rgba(255,183,77,0.2)", color: "#FFB74D", border: "1px solid rgba(255,183,77,0.4)" }}>
                            <Star className="w-2.5 h-2.5 fill-current" />افتراضي
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] mt-0.5 border-white/20 text-white/60">
                        {CATEGORIES.find(c => c.value === s.category)?.label ?? s.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {/* زر ⭐ ظاهر دايماً */}
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 hover:bg-amber-500/10"
                      title={s.isDefault ? "هو المورد الافتراضي" : "تعيين كمورد افتراضي"}
                      disabled={setDefault.isPending}
                      onClick={() => { if (!s.isDefault) setDefault.mutate(s.id); }}
                      style={{ color: s.isDefault ? "#FFB74D" : "hsl(var(--muted-foreground)/0.4)" }}>
                      <Star className={`w-3.5 h-3.5 ${s.isDefault ? "fill-current" : ""}`} />
                    </Button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400 hover:bg-white/10" title="كشف حساب"
                      onClick={() => { setStmtSupplier(s); setStmtFrom(""); setStmtTo(""); }}>
                      <BookOpen className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => openEdit(s)}>
                      <Edit2 className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-rose-500/10" onClick={() => { if (confirm(`حذف المورد "${s.name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) del.mutate(s.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {s.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                  {s.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{s.email}</p>}
                  {s.paymentTerms && <p>شروط الدفع: <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{s.paymentTerms}</span></p>}
                  <div className="flex items-center justify-between pt-2 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                    <span>الرصيد</span>
                    <span className="font-bold" style={{ color, textShadow: `0 0 10px ${color}88` }}>{fmt(bal)}</span>
                  </div>
                </div>
              </div>
            )})}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="icon" className="h-8 w-8 border-border"
                disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 border-border"
                disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── Supplier Form Dialog ─────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editing ? "تعديل مورد" : "مورد جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label className="text-xs mb-1 block">اسم المورد *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">هاتف</Label>
                <Input className="h-9 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">بريد إلكتروني</Label>
                <Input className="h-9 text-sm" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs mb-1 block">الفئة</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 text-sm border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">شروط الدفع</Label>
              <Input className="h-9 text-sm" placeholder="مثال: نقداً / 30 يوم" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
            <div><Label className="text-xs mb-1 block">العنوان</Label>
              <Input className="h-9 text-sm" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><Label className="text-xs mb-1 block">ملاحظات</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 font-bold" onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}>
                {save.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
              <Button variant="outline" className="h-9 border-border" onClick={() => setOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* ── Statement Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!stmtSupplier} onOpenChange={v => !v && setStmtSupplier(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                كشف حساب — {stmtSupplier?.name}
              </DialogTitle>
              <Button variant="outline" size="sm" className="gap-2 border-border h-8" onClick={exportStatement}>
                <Download className="w-3.5 h-3.5" />تصدير Excel
              </Button>
            </div>
          </DialogHeader>

          {/* Date filters */}
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <Label className="text-xs mb-1 block">من تاريخ</Label>
              <Input type="date" className="h-8 text-sm border-border w-36" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">إلى تاريخ</Label>
              <Input type="date" className="h-8 text-sm border-border w-36" value={stmtTo} onChange={e => setStmtTo(e.target.value)} />
            </div>
            {(stmtFrom || stmtTo) && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground"
                onClick={() => { setStmtFrom(""); setStmtTo(""); }}>
                <X className="w-3.5 h-3.5" />مسح
              </Button>
            )}
          </div>

          {stmtLoading ? (
            <div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : stmtData ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي الأوامر",    value: stmtData.summary.totalOrders,  isCount: true, color: "#7E57C2", glow: "rgba(126,87,194,0.28)", bg: "linear-gradient(135deg, rgba(126,87,194,0.42) 0%, rgba(126,87,194,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
                  { label: "إجمالي المشتريات", value: stmtData.summary.totalAmount,               color: "#FFB74D", glow: "rgba(255,183,77,0.28)",  bg: "linear-gradient(135deg, rgba(255,183,77,0.42) 0%, rgba(255,183,77,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
                  { label: "المدفوع",           value: stmtData.summary.totalPaid,                color: "#26A69A", glow: "rgba(38,166,154,0.28)",  bg: "linear-gradient(135deg, rgba(38,166,154,0.44) 0%, rgba(38,166,154,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
                  { label: "المتبقي",           value: stmtData.summary.totalUnpaid,              color: "#ef4444", glow: "rgba(239,68,68,0.28)",   bg: "linear-gradient(135deg, rgba(239,68,68,0.42) 0%, rgba(239,68,68,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
                ].map(c => (
                  <div key={c.label} className="relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center"
                    style={{ background: c.bg, border: `1px solid ${c.glow}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px ${c.glow}`, backdropFilter: "blur(12px)" }}>
                    <div className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
                    <p className="text-[11px] font-bold mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>{c.label}</p>
                    <p className="font-black text-base" style={{ color: c.color, textShadow: `0 0 14px ${c.color}88` }}>
                      {c.isCount ? c.value : fmt(c.value as number)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Orders table */}
              {stmtData.orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">لا توجد أوامر شراء في هذه الفترة</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">رقم الأمر</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">التاريخ</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">الحالة</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">الإجمالي</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">المدفوع</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">المتبقي</th>
                        <th className="text-right p-3 text-xs font-medium text-muted-foreground">الدفع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stmtData.orders.map(o => {
                        const total   = parseFloat(o.totalAmount ?? "0");
                        const paid    = parseFloat(o.paidAmount  ?? "0");
                        const due     = total - paid;
                        const payInfo = PAY_BADGE[o.paymentStatus ?? "unpaid"] ?? PAY_BADGE.unpaid;
                        const poInfo  = PO_BADGE[o.status ?? "draft"]  ?? PO_BADGE.draft;
                        return (
                          <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-mono text-xs text-primary">{o.poNumber}</td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "—"}
                            </td>
                            <td className="p-3"><Badge className={`text-[10px] ${poInfo.cls}`}>{poInfo.label}</Badge></td>
                            <td className="p-3 font-medium">{fmt(total)}</td>
                            <td className="p-3 text-emerald-500">{fmt(paid)}</td>
                            <td className={`p-3 font-medium ${due > 0 ? "text-rose-500" : "text-muted-foreground"}`}>{fmt(due)}</td>
                            <td className="p-3"><Badge className={`text-[10px] border ${payInfo.cls}`}>{payInfo.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
