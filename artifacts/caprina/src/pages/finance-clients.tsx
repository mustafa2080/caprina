import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Edit2, Trash2, Phone, ToggleLeft, ToggleRight,
  Users, MapPin, Target, ShoppingBag, FileText, TrendingUp,
  Eye, BarChart2, Search, Filter, ChevronLeft, ChevronRight, ChevronDown,
  ShoppingCart, Receipt, ListFilter, X,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell,
} from "recharts";

// ── helpers ───────────────────────────────────────────────────────────────
const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

// ── types ─────────────────────────────────────────────────────────────────
type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  taxNumber: string | null; commercialReg: string | null; paymentTerms: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

type SaleOrder = {
  id: number; soNumber: string; status: string; paymentStatus: string;
  totalAmount: string; paidAmount: string; clientName: string;
  createdAt: string;
};

const emptyForm = {
  name: "", phone: "", phone2: "", email: "", address: "", city: "", region: "",
  taxNumber: "", commercialReg: "", paymentTerms: "فوري",
  creditLimit: "0", notes: "", isActive: true,
};

// ── Column Filter Dropdown ────────────────────────────────────────────────
function ColumnFilter({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref    = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const hasFilter = selected.length > 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  return (
    <div className="relative flex items-center gap-1">
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`relative p-0.5 rounded transition-colors ${hasFilter ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ListFilter className={`w-3 h-3 ${hasFilter ? "text-primary" : ""}`} />
        {hasFilter && (
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full text-[8px] text-primary-foreground flex items-center justify-center font-black">
            {selected.length}
          </span>
        )}
      </button>

      {open && typeof window !== "undefined" && (
        <div
          ref={ref}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="min-w-[170px] bg-card border border-border rounded-xl shadow-2xl p-2"
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] font-bold text-muted-foreground">فلتر {label}</span>
            {hasFilter && (
              <button onClick={() => onChange([])} className="text-[9px] text-destructive hover:underline flex items-center gap-0.5">
                <X className="w-2.5 h-2.5" />مسح
              </button>
            )}
          </div>
          {options.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-2 py-1">لا توجد خيارات</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {options.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="accent-primary w-3 h-3 shrink-0"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Form ───────────────────────────────────────────────────────────
function ClientForm({ open, onClose, editClient, onSuccess }: {
  open: boolean; onClose: () => void; editClient: Client | null; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!editClient;
  const [form, setForm] = useState(() => editClient ? {
    name: editClient.name, phone: editClient.phone ?? "", phone2: editClient.phone2 ?? "",
    email: editClient.email ?? "", address: editClient.address ?? "",
    city: editClient.city ?? "", region: editClient.region ?? "",
    taxNumber: editClient.taxNumber ?? "", commercialReg: editClient.commercialReg ?? "",
    paymentTerms: editClient.paymentTerms ?? "فوري",
    creditLimit: String(editClient.creditLimit ?? "0"),
    notes: editClient.notes ?? "", isActive: editClient.isActive,
  } : { ...emptyForm });

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, phone: form.phone || null, phone2: form.phone2 || null,
        email: form.email || null, address: form.address || null,
        city: form.city || null, region: form.region || null,
        taxNumber: form.taxNumber || null, commercialReg: form.commercialReg || null,
        paymentTerms: form.paymentTerms || null,
        creditLimit: parseFloat(form.creditLimit) || 0,
        notes: form.notes || null, isActive: form.isActive,
      };
      if (isEdit) return apiFetch<any>(`/finance/clients/${editClient!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      return apiFetch<any>("/finance/clients", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { toast({ title: isEdit ? "تم تحديث العميل" : "تمت إضافة العميل" }); onSuccess(); onClose(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? `تعديل — ${editClient?.name}` : "إضافة عميل تجاري جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div><Label className="text-xs mb-1.5 block">الاسم / الشركة *</Label>
            <Input placeholder="شركة النور للتجارة" className="h-9 text-sm bg-background" value={form.name} onChange={e => f("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1.5 block">الهاتف</Label>
              <Input placeholder="01xxxxxxxxx" className="h-9 text-sm bg-background" value={form.phone} onChange={e => f("phone", e.target.value)} /></div>
            <div><Label className="text-xs mb-1.5 block">هاتف إضافي</Label>
              <Input placeholder="01xxxxxxxxx" className="h-9 text-sm bg-background" value={form.phone2} onChange={e => f("phone2", e.target.value)} /></div>
          </div>
          <div><Label className="text-xs mb-1.5 block">العنوان</Label>
            <Input placeholder="الشارع والحي" className="h-9 text-sm bg-background" value={form.address} onChange={e => f("address", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1.5 block">المدينة</Label>
              <Input placeholder="القاهرة" className="h-9 text-sm bg-background" value={form.city} onChange={e => f("city", e.target.value)} /></div>
            <div><Label className="text-xs mb-1.5 block">المحافظة</Label>
              <Input placeholder="الجيزة" className="h-9 text-sm bg-background" value={form.region} onChange={e => f("region", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1.5 block">شروط الدفع</Label>
              <Select value={form.paymentTerms} onValueChange={v => f("paymentTerms", v)}>
                <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["فوري","آجل 15 يوم","آجل 30 يوم","آجل 60 يوم","آجل 90 يوم"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs mb-1.5 block flex items-center gap-1"><Target className="w-3 h-3" />الهدف</Label>
              <Input type="number" min={0} placeholder="1000000" className="h-9 text-sm bg-background" value={form.creditLimit} onChange={e => f("creditLimit", e.target.value)} /></div>
          </div>
          <div><Label className="text-xs mb-1.5 block">ملاحظات</Label>
            <Textarea placeholder="أي ملاحظات..." className="min-h-[60px] text-sm resize-none bg-background" value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} /></div>
          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-md">
            <span className="text-xs font-medium">حالة العميل</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 mr-auto" onClick={() => f("isActive", !form.isActive)}>
              {form.isActive ? <><ToggleRight className="w-4 h-4 text-emerald-400" />نشط</> : <><ToggleLeft className="w-4 h-4" />غير نشط</>}
            </Button>
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
            <Button variant="outline" className="h-9 text-sm border-border" onClick={onClose}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function FinanceClients() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showColFilters, setShowColFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"clients"|"invoices"|"orders">("clients");
  const [chartView,     setChartView]     = useState<"area"|"bar">("area");
  const [chartDropOpen, setChartDropOpen] = useState(false);
  const chartDropRef = useRef<HTMLDivElement>(null);

  // إغلاق dropdown لو ضغط بره
  useEffect(() => {
    if (!chartDropOpen) return;
    const h = (e: MouseEvent) => {
      if (chartDropRef.current && chartDropRef.current.contains(e.target as Node)) return;
      setChartDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [chartDropOpen]);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  // ── فلاتر الأعمدة ────────────────────────────────────────────────────────
  const [filterCity,         setFilterCity]         = useState<string[]>([]);
  const [filterStatus,       setFilterStatus]       = useState<string[]>([]);
  const [filterPaymentTerms, setFilterPaymentTerms] = useState<string[]>([]);
  const [filterName,         setFilterName]         = useState<string[]>([]);
  const PER_PAGE = 10;

  const { data: clients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["finance-clients"],
    queryFn: () => apiFetch<Client[]>("/finance/clients"),
    staleTime: 30_000,
  });

  const { data: allOrders = [] } = useQuery<SaleOrder[]>({
    queryKey: ["finance-sale-orders-all"],
    queryFn: () => apiFetch<SaleOrder[]>("/finance/sale-orders"),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch<any>(`/finance/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-clients"] }); setDeleteClient(null); toast({ title: "تم حذف العميل" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (c: Client) =>
    apiFetch<any>(`/finance/clients/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) })
      .then(() => qc.invalidateQueries({ queryKey: ["finance-clients"] }));

  // ── KPI ─────────────────────────────────────────────────────────────────
  const totalSales   = clients.reduce((s, c) => s + parseFloat(c.totalSales ?? "0"), 0);
  const totalOrders  = allOrders.length;
  const totalClients = clients.length;
  const totalInvoices = clients.reduce((s, c) => s + (c.totalOrders ?? 0), 0);

  // ── أفضل العملاء ────────────────────────────────────────────────────────
  const topClients = useMemo(() =>
    [...clients].sort((a, b) => parseFloat(b.totalSales ?? "0") - parseFloat(a.totalSales ?? "0")).slice(0, 5),
    [clients]
  );

  // ── رسم بياني — مبيعات آخر 7 أيام من الأوردرات ─────────────────────────
  const chartData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[format(d, "MM/dd")] = 0;
    }
    allOrders.forEach(o => {
      const key = format(new Date(o.createdAt), "MM/dd");
      if (key in days) days[key] += parseFloat(o.totalAmount ?? "0");
    });
    return Object.entries(days).map(([date, value]) => ({ date, value }));
  }, [allOrders]);

  // ── خيارات الفلتر — تُستخرج من البيانات الفعلية ────────────────────────
  const cityOptions         = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))] .map(v => ({ value: v!, label: v! })), [clients]);
  const statusOptions       = [{ value: "true", label: "نشط" }, { value: "false", label: "موقف" }];
  const paymentTermsOptions = useMemo(() => [...new Set(clients.map(c => c.paymentTerms).filter(Boolean))].map(v => ({ value: v!, label: v! })), [clients]);
  const nameOptions         = useMemo(() => clients.map(c => ({ value: c.name, label: c.name })), [clients]);

  // ── فلترة العملاء بكل الفلاتر معاً ─────────────────────────────────────
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (search && !c.name.includes(search) && !(c.phone ?? "").includes(search)) return false;
      if (filterName.length         && !filterName.includes(c.name))                             return false;
      if (filterCity.length         && !filterCity.includes(c.city ?? ""))                     return false;
      if (filterStatus.length       && !filterStatus.includes(String(c.isActive)))             return false;
      if (filterPaymentTerms.length && !filterPaymentTerms.includes(c.paymentTerms ?? ""))     return false;
      return true;
    });
  }, [clients, search, filterCity, filterStatus, filterPaymentTerms]);

  const activeFiltersCount = filterCity.length + filterStatus.length + filterPaymentTerms.length + filterName.length;
  const filteredOrders = useMemo(() =>
    allOrders.filter(o => !search || o.clientName.includes(search) || o.soNumber.includes(search)),
    [allOrders, search]
  );

  const tableData = activeTab === "clients" ? filteredClients : activeTab === "invoices" ? allOrders : filteredOrders;
  const totalPages = Math.ceil(tableData.length / PER_PAGE);
  const pageData   = tableData.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openAdd  = () => { setEditClient(null); setFormOpen(true); };
  const openEdit = (c: Client) => { setEditClient(c); setFormOpen(true); };

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء التجاريون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة عملائك التجاريين وكل ما يتعلق بمبيعاتك</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary text-primary-foreground font-bold text-sm">
          <Plus className="w-4 h-4" />إضافة عميل تجاري
        </Button>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي العملاء",    value: totalClients, sub: `+${clients.filter(c => { const d = new Date(c.createdAt); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} هذا الشهر`, icon: <Users className="w-6 h-6" />, color: "text-foreground" },
          { label: "إجمالي أوامر البيع", value: totalOrders,  sub: `+${allOrders.filter(o => { const d = new Date(o.createdAt); const now = new Date(); return d.getMonth() === now.getMonth(); }).length} هذا الشهر`, icon: <ShoppingCart className="w-6 h-6" />, color: "text-foreground" },
          { label: "إجمالي الفواتير",   value: totalInvoices, sub: `+${Math.round(totalInvoices * 0.15)} هذا الشهر`, icon: <Receipt className="w-6 h-6" />, color: "text-foreground" },
          { label: "إجمالي المبيعات",   value: fmt(totalSales), sub: `+15% هذا الشهر`, icon: <TrendingUp className="w-6 h-6" />, color: "text-primary" },
        ].map((kpi, i) => (
          <Card key={i} className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <div className="w-9 h-9 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground">
                {kpi.icon}
              </div>
            </div>
            <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[11px] text-primary mt-1">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── أفضل العملاء + الرسم البياني ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* أفضل العملاء */}
        <Card className="border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">أفضل العملاء</h2>
            <span className="text-[10px] text-muted-foreground">هذا الشهر</span>
          </div>
          <div className="space-y-3">
            {topClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا يوجد بيانات بعد</p>
            ) : topClients.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  i === 0 ? "bg-primary text-primary-foreground" :
                  i === 1 ? "bg-muted-foreground/20 text-muted-foreground" :
                  i === 2 ? "bg-amber-900/30 text-amber-400" :
                  "bg-muted/20 text-muted-foreground"
                }`}>{i + 1}</div>
                <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{c.name}</p>
                </div>
                <p className="text-xs font-black text-primary shrink-0">{fmt(c.totalSales ?? 0)}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => navigate("/finance/all-clients")}>
            عرض جميع العملاء
          </Button>
        </Card>

        {/* الرسم البياني */}
        <Card className="border-border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-sm">المبيعات</h2>
            {/* Dropdown اختيار نوع الرسم */}
            <div className="relative" ref={chartDropRef}>
              <button
                onClick={() => setChartDropOpen(o => !o)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                {chartView === "area" ? (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <polyline points="1,11 4,7 7,9 10,4 13,2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    <polygon points="1,11 4,7 7,9 10,4 13,2 13,13 1,13" fill="currentColor" opacity="0.2"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="6" width="3" height="7" rx="1" fill="currentColor" opacity="0.6"/>
                    <rect x="5.5" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                    <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.6"/>
                  </svg>
                )}
                {chartView === "area" ? "خطي" : "بياني"}
                <ChevronDown className="w-3 h-3" />
              </button>

              {chartDropOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-36 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {[
                    {
                      key: "area", label: "خطي تدرجي",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <polyline points="1,11 4,7 7,9 10,4 13,2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          <polygon points="1,11 4,7 7,9 10,4 13,2 13,13 1,13" fill="currentColor" opacity="0.2"/>
                        </svg>
                      )
                    },
                    {
                      key: "bar", label: "أعمدة",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="1" y="6" width="3" height="7" rx="1" fill="currentColor" opacity="0.6"/>
                          <rect x="5.5" y="3" width="3" height="10" rx="1" fill="currentColor"/>
                          <rect x="10" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.6"/>
                        </svg>
                      )
                    },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setChartView(opt.key as "area"|"bar"); setChartDropOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] transition-colors
                        ${chartView === opt.key
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`}
                    >
                      {opt.icon}
                      {opt.label}
                      {chartView === opt.key && <span className="mr-auto text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-2xl font-black text-primary mb-0.5">{fmt(totalSales)}</p>
          <p className="text-[11px] text-primary mb-3">آخر 7 أيام</p>
          <ResponsiveContainer width="100%" height={160}>
            {chartView === "area" ? (
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43,74%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(43,74%,50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any) => [fmt(v), "المبيعات"]}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(43,74%,50%)" strokeWidth={2} fill="url(#salesGrad)" dot={{ fill: "hsl(43,74%,50%)", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any) => [fmt(v), "المبيعات"]}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? "hsl(43,74%,50%)" : "hsl(43,74%,50%)"} opacity={0.5 + (i / chartData.length) * 0.5} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── إجراءات سريعة ── */}
      <Card className="border-border bg-card p-4">
        <h2 className="font-bold text-sm mb-3">إجراءات سريعة</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: "إضافة عميل",    icon: <Users className="w-5 h-5" />,       action: openAdd },
            { label: "أمر بيع جديد",  icon: <ShoppingCart className="w-5 h-5" />, action: () => navigate("/finance/sales/new") },
            { label: "فاتورة بيع",    icon: <Receipt className="w-5 h-5" />,      action: () => navigate("/finance/sales") },
            { label: "عرض العملاء",   icon: <Eye className="w-5 h-5" />,          action: () => navigate("/finance/all-clients") },
            { label: "تقرير المبيعات",icon: <BarChart2 className="w-5 h-5" />,   action: () => navigate("/finance/sales-report") },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-muted/10 hover:bg-primary/10 hover:border-primary/30 transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-full bg-muted/30 group-hover:bg-primary/20 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                {btn.icon}
              </div>
              <span className="text-[11px] font-medium text-center text-muted-foreground group-hover:text-primary">{btn.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* ── الجدول الرئيسي ── */}
      <Card id="clients-table" className="border-border bg-card">
        {/* Tabs + Search */}
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {[
              { key: "clients", label: "العملاء التجاريون" },
              { key: "invoices", label: "الفواتير" },
              { key: "orders", label: "أوامر البيع" },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key as any); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >{tab.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="بحث عن عميل..." className="h-8 text-xs bg-background pr-8 w-44"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1 border-border relative ${showColFilters || activeFiltersCount > 0 ? "border-primary text-primary" : ""}`}
              onClick={() => setShowColFilters(v => !v)}
            >
              <Filter className="w-3 h-3" />فلتر
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[9px] text-primary-foreground flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Table Headers */}
        {activeTab === "clients" && (
          <>
            <div className="grid grid-cols-6 gap-2 px-4 py-2 border-b border-border bg-muted/5">
              {/* اسم العميل */}
              <div className="col-span-2 flex items-center gap-1">
                {showColFilters ? (
                  <ColumnFilter label="اسم العميل" options={nameOptions} selected={filterName} onChange={v => { setFilterName(v); setPage(1); }} />
                ) : <span className="text-[10px] font-bold text-muted-foreground">اسم العميل</span>}
              </div>
              {/* الحالة */}
              <div className="flex items-center gap-1">
                {showColFilters ? (
                  <ColumnFilter label="الحالة" options={statusOptions} selected={filterStatus} onChange={v => { setFilterStatus(v); setPage(1); }} />
                ) : <span className="text-[10px] font-bold text-muted-foreground">الحالة</span>}
              </div>
              {/* المدينة */}
              <div className="flex items-center gap-1">
                {showColFilters ? (
                  <ColumnFilter label="المدينة" options={cityOptions} selected={filterCity} onChange={v => { setFilterCity(v); setPage(1); }} />
                ) : <span className="text-[10px] font-bold text-muted-foreground">المدينة</span>}
              </div>
              {/* شروط الدفع */}
              <div className="flex items-center gap-1">
                {showColFilters ? (
                  <ColumnFilter label="شروط الدفع" options={paymentTermsOptions} selected={filterPaymentTerms} onChange={v => { setFilterPaymentTerms(v); setPage(1); }} />
                ) : <span className="text-[10px] font-bold text-muted-foreground">شروط الدفع</span>}
              </div>
              {/* إجراءات */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground">الرصيد / إجراءات</span>
                {showColFilters && activeFiltersCount > 0 && (
                  <button onClick={() => { setFilterCity([]); setFilterStatus([]); setFilterPaymentTerms([]); setFilterName([]); }}
                    className="text-[9px] text-destructive hover:underline flex items-center gap-0.5">
                    <X className="w-2.5 h-2.5" />مسح
                  </button>
                )}
              </div>
            </div>

            <div>
              {loadingClients ? (
                <div className="py-10 text-center text-muted-foreground text-sm animate-pulse">جاري التحميل...</div>
              ) : (pageData as Client[]).length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">لا يوجد عملاء</div>
              ) : (pageData as Client[]).map(c => {
                const sales  = parseFloat(c.totalSales ?? "0");
                const paid   = parseFloat(c.totalPaid  ?? "0");
                const unpaid = Math.max(0, sales - paid);
                return (
                  <div key={c.id} className="grid grid-cols-6 gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/10 transition-colors items-center">
                    {/* اسم العميل */}
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">{c.name}</p>
                        {c.phone && <p className="text-[10px] text-muted-foreground">{c.phone}</p>}
                      </div>
                    </div>
                    {/* الحالة */}
                    <div>
                      <Badge variant="outline" className={`text-[9px] border ${c.isActive ? "border-emerald-700 bg-emerald-900/20 text-emerald-400" : "border-border text-muted-foreground"}`}>
                        {c.isActive ? "نشط" : "موقف"}
                      </Badge>
                    </div>
                    {/* المدينة */}
                    <span className="text-xs text-muted-foreground">{c.city ?? "—"}</span>
                    {/* شروط الدفع */}
                    <span className="text-xs">{c.paymentTerms ?? "—"}</span>
                    {/* الرصيد + إجراءات */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold ${unpaid > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {unpaid > 0 ? fmt(unpaid) : "✓ مسدد"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-primary" onClick={() => openEdit(c)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setDeleteClient(c)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <Link href={`/finance/clients/${c.id}`}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-primary">
                            <Eye className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "orders" && (
          <>
            <div className="grid grid-cols-5 gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground border-b border-border">
              <span>رقم الأمر</span><span>العميل</span><span>الإجمالي</span><span>الحالة</span><span>التاريخ</span>
            </div>
            <div>
              {(pageData as SaleOrder[]).map(o => (
                <div key={o.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/10 items-center">
                  <span className="text-xs font-bold">{o.soNumber}</span>
                  <span className="text-xs">{o.clientName}</span>
                  <span className="text-xs font-bold text-primary">{fmt(o.totalAmount)}</span>
                  <Badge variant="outline" className={`text-[9px] w-fit ${o.status === "delivered" ? "border-emerald-700 text-emerald-400" : o.status === "processing" ? "border-amber-700 text-amber-400" : "border-border text-muted-foreground"}`}>
                    {o.status === "delivered" ? "تم التسليم" : o.status === "processing" ? "قيد التجهيز" : o.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(o.createdAt), "yyyy-MM-dd")}</span>
                </div>
              ))}
              {(pageData as SaleOrder[]).length === 0 && <div className="py-10 text-center text-muted-foreground text-sm">لا توجد أوامر</div>}
            </div>
          </>
        )}

        {activeTab === "invoices" && (
          <>
            {/* headers */}
            <div className="grid grid-cols-6 gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground border-b border-border bg-muted/5">
              <span>رقم الفاتورة</span>
              <span className="col-span-2">العميل</span>
              <span>الإجمالي</span>
              <span>حالة الدفع</span>
              <span>التاريخ</span>
            </div>
            <div>
              {(pageData as SaleOrder[]).length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>لا توجد فواتير</p>
                </div>
              ) : (pageData as SaleOrder[]).map(o => {
                const paid = o.paymentStatus === "paid";
                const partial = o.paymentStatus === "partial";
                const unpaid = Math.max(0, parseFloat(o.totalAmount) - (paid ? parseFloat(o.totalAmount) : parseFloat(o.paidAmount ?? "0")));
                return (
                  <div key={o.id} className="grid grid-cols-6 gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/10 transition-colors items-center">
                    <span className="text-xs font-bold text-primary">{o.soNumber}</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center shrink-0">
                        <Users className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-bold">{o.clientName}</span>
                    </div>
                    <span className="text-xs font-bold">{fmt(o.totalAmount)}</span>
                    <div>
                      {paid ? (
                        <Badge variant="outline" className="text-[9px] border-emerald-700 bg-emerald-900/20 text-emerald-400">مدفوع</Badge>
                      ) : partial ? (
                        <div>
                          <Badge variant="outline" className="text-[9px] border-amber-700 bg-amber-900/20 text-amber-400 mb-0.5">جزئي</Badge>
                          <p className="text-[9px] text-red-400">{fmt(unpaid)} متبقي</p>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-red-700 bg-red-900/20 text-red-400">غير مدفوع</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "—"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <Button key={p} variant={page === p ? "default" : "outline"} size="sm"
                className={`h-7 w-7 text-xs ${page === p ? "bg-primary text-primary-foreground" : "border-border"}`}
                onClick={() => setPage(p)}>{p}</Button>
            ))}
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* عرض جميع العملاء */}
        {activeTab === "clients" && clients.length > 0 && (
          <div className="p-4 border-t border-border">
            <Button variant="outline" className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10" onClick={() => navigate("/finance/all-clients")}>
              عرض جميع العملاء ({clients.length})
            </Button>
          </div>
        )}
      </Card>

      {/* Forms & Dialogs */}
      {formOpen && (
        <ClientForm open={formOpen} onClose={() => { setFormOpen(false); setEditClient(null); }}
          editClient={editClient} onSuccess={() => qc.invalidateQueries({ queryKey: ["finance-clients"] })} />
      )}
      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف العميل "{deleteClient?.name}"؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteClient && deleteMutation.mutate(deleteClient.id)} className="bg-red-600 hover:bg-red-700 text-white">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
