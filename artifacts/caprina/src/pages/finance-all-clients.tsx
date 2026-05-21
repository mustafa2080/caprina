import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users, Search, Filter, ChevronLeft, ChevronRight,
  ArrowRight, TrendingUp, ShoppingCart, Receipt,
  MapPin, Phone, CheckCircle2, XCircle, X,
  ArrowUpDown, Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

// ── types ──────────────────────────────────────────────────────────────────
type Client = {
  id: number; name: string; phone: string | null; phone2: string | null;
  email: string | null; address: string | null; city: string | null; region: string | null;
  taxNumber: string | null; commercialReg: string | null; paymentTerms: string | null;
  creditLimit: string; totalOrders: number; totalSales: string; totalPaid: string;
  notes: string | null; isActive: boolean; createdAt: string;
};

// ── ColumnFilter ───────────────────────────────────────────────────────────
function ColumnFilter({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ref    = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}
        className={`flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5 transition-colors ${
          selected.length > 0 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
        }`}>
        <Filter className="w-2.5 h-2.5" />{label}
        {selected.length > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-black">
            {selected.length}
          </span>
        )}
      </button>
      {open && (
        <div ref={ref} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-card border border-border rounded-lg shadow-xl w-48 py-1 max-h-64 overflow-y-auto">
          {options.length === 0
            ? <p className="text-[11px] text-muted-foreground text-center py-3">لا يوجد خيارات</p>
            : options.map(o => (
              <label key={o.value}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/20 cursor-pointer">
                <input type="checkbox" checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="w-3 h-3 accent-primary" />
                <span className="text-[11px] text-foreground">{o.label}</span>
              </label>
            ))}
          {selected.length > 0 && (
            <button onClick={() => onChange([])}
              className="w-full text-[10px] text-destructive hover:underline py-1.5 border-t border-border mt-1">
              مسح الفلتر
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
const PER_PAGE = 15;

export default function AllClientsPage() {
  const [, navigate] = useLocation();
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const [sortBy,      setSortBy]      = useState<"name"|"totalSales"|"totalOrders"|"createdAt">("totalSales");
  const [sortDir,     setSortDir]     = useState<"asc"|"desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity,         setFilterCity]         = useState<string[]>([]);
  const [filterStatus,       setFilterStatus]       = useState<string[]>([]);
  const [filterPaymentTerms, setFilterPaymentTerms] = useState<string[]>([]);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["finance-clients"],
    queryFn: () => apiFetch<Client[]>("/finance/clients"),
    staleTime: 30_000,
  });

  // ── options ──────────────────────────────────────────────────────────────
  const cityOptions         = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))].map(v => ({ value: v!, label: v! })), [clients]);
  const paymentTermsOptions = useMemo(() => [...new Set(clients.map(c => c.paymentTerms).filter(Boolean))].map(v => ({ value: v!, label: v! })), [clients]);
  const statusOptions       = [{ value: "true", label: "نشط" }, { value: "false", label: "موقف" }];

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalSales   = useMemo(() => clients.reduce((s, c) => s + parseFloat(c.totalSales ?? "0"), 0), [clients]);
  const totalPaid    = useMemo(() => clients.reduce((s, c) => s + parseFloat(c.totalPaid  ?? "0"), 0), [clients]);
  const totalOrders  = useMemo(() => clients.reduce((s, c) => s + (c.totalOrders ?? 0), 0), [clients]);
  const activeCount  = useMemo(() => clients.filter(c => c.isActive).length, [clients]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = clients.filter(c => {
      if (search && !c.name.includes(search) && !(c.phone ?? "").includes(search) && !(c.city ?? "").includes(search)) return false;
      if (filterCity.length         && !filterCity.includes(c.city ?? ""))                 return false;
      if (filterStatus.length       && !filterStatus.includes(String(c.isActive)))         return false;
      if (filterPaymentTerms.length && !filterPaymentTerms.includes(c.paymentTerms ?? "")) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "name")        { va = a.name;                            vb = b.name; }
      else if (sortBy === "totalSales")   { va = parseFloat(a.totalSales ?? "0"); vb = parseFloat(b.totalSales ?? "0"); }
      else if (sortBy === "totalOrders")  { va = a.totalOrders ?? 0;             vb = b.totalOrders ?? 0; }
      else                                { va = a.createdAt;                    vb = b.createdAt; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
    return r;
  }, [clients, search, filterCity, filterStatus, filterPaymentTerms, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageData   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeFiltersCount = filterCity.length + filterStatus.length + filterPaymentTerms.length;

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const SortBtn = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <button onClick={() => toggleSort(col)}
      className={`flex items-center gap-0.5 text-[10px] font-bold transition-colors ${
        sortBy === col ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}>
      {label}
      <ArrowUpDown className={`w-2.5 h-2.5 ${sortBy === col ? "text-primary" : ""}`} />
    </button>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/finance/clients")}
            className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">جميع العملاء التجاريين</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isLoading ? "جاري التحميل..." : `${filtered.length} عميل من أصل ${clients.length}`}
            </p>
          </div>
        </div>
        <Button onClick={() => navigate("/finance/clients")}
          className="gap-2 bg-primary text-primary-foreground font-bold text-sm h-9">
          <Users className="w-4 h-4" />إدارة العملاء
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي العملاء",    value: clients.length, sub: `${activeCount} نشط`, icon: <Users className="w-5 h-5" />,       color: "text-foreground" },
          { label: "إجمالي المبيعات",   value: fmt(totalSales), sub: `محصَّل ${fmt(totalPaid)}`, icon: <TrendingUp className="w-5 h-5" />, color: "text-primary" },
          { label: "إجمالي الطلبات",    value: totalOrders,     sub: `متوسط ${clients.length ? Math.round(totalOrders / clients.length) : 0} طلب/عميل`, icon: <ShoppingCart className="w-5 h-5" />, color: "text-foreground" },
          { label: "المتبقي غير محصَّل", value: fmt(totalSales - totalPaid), sub: `${clients.length ? Math.round((totalPaid / totalSales) * 100) || 0 : 0}% نسبة التحصيل`, icon: <Receipt className="w-5 h-5" />, color: "text-amber-400" },
        ].map((k, i) => (
          <Card key={i} className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground">{k.icon}</div>
            </div>
            <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-primary mt-1">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* Table Card */}
      <Card className="border-border bg-card">

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-border gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو التليفون أو المدينة..."
                className="h-8 text-xs bg-background pr-8 w-56"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Button variant="outline" size="sm"
              className={`h-8 text-xs gap-1 border-border relative ${showFilters || activeFiltersCount > 0 ? "border-primary text-primary" : ""}`}
              onClick={() => setShowFilters(v => !v)}>
              <Filter className="w-3 h-3" />فلتر
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full text-[9px] text-primary-foreground flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            {activeFiltersCount > 0 && (
              <button onClick={() => { setFilterCity([]); setFilterStatus([]); setFilterPaymentTerms([]); }}
                className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
                <X className="w-3 h-3" />مسح الفلاتر
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            عرض {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} من {filtered.length}
          </p>
        </div>

        {/* Col Headers */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-border bg-muted/5 text-[10px] font-bold text-muted-foreground">
          <div className="col-span-3 flex items-center gap-1">
            {showFilters
              ? <ColumnFilter label="اسم العميل" options={clients.map(c => ({ value: c.name, label: c.name }))} selected={[]} onChange={() => {}} />
              : <SortBtn col="name" label="اسم العميل" />}
          </div>
          <div className="col-span-2 flex items-center gap-1">
            {showFilters
              ? <ColumnFilter label="الحالة" options={statusOptions} selected={filterStatus} onChange={v => { setFilterStatus(v); setPage(1); }} />
              : <span>الحالة</span>}
          </div>
          <div className="col-span-2 flex items-center gap-1">
            {showFilters
              ? <ColumnFilter label="المدينة" options={cityOptions} selected={filterCity} onChange={v => { setFilterCity(v); setPage(1); }} />
              : <span>المدينة</span>}
          </div>
          <div className="col-span-2 flex items-center gap-1">
            {showFilters
              ? <ColumnFilter label="شروط الدفع" options={paymentTermsOptions} selected={filterPaymentTerms} onChange={v => { setFilterPaymentTerms(v); setPage(1); }} />
              : <span>شروط الدفع</span>}
          </div>
          <div className="col-span-1 flex items-center gap-1">
            <SortBtn col="totalOrders" label="الطلبات" />
          </div>
          <div className="col-span-1 flex items-center gap-1">
            <SortBtn col="totalSales" label="المبيعات" />
          </div>
          <div className="col-span-1 text-left">إجراءات</div>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm animate-pulse">جاري التحميل...</div>
        ) : pageData.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا يوجد عملاء مطابقون</p>
          </div>
        ) : pageData.map((c, idx) => {
          const sales  = parseFloat(c.totalSales ?? "0");
          const paid   = parseFloat(c.totalPaid  ?? "0");
          const unpaid = Math.max(0, sales - paid);
          const pct    = sales > 0 ? Math.round((paid / sales) * 100) : 0;
          return (
            <div key={c.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/50 hover:bg-muted/10 transition-colors items-center group">

              {/* اسم + تليفون */}
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-black text-xs">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{c.name}</p>
                  {c.phone && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Phone className="w-2.5 h-2.5" />{c.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* الحالة */}
              <div className="col-span-2">
                <Badge variant="outline"
                  className={`text-[9px] border ${c.isActive
                    ? "border-emerald-700 bg-emerald-900/20 text-emerald-400"
                    : "border-border text-muted-foreground"}`}>
                  {c.isActive
                    ? <><CheckCircle2 className="w-2.5 h-2.5 ml-0.5" />نشط</>
                    : <><XCircle     className="w-2.5 h-2.5 ml-0.5" />موقف</>}
                </Badge>
              </div>

              {/* المدينة */}
              <div className="col-span-2">
                {c.city
                  ? <span className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{c.city}</span>
                  : <span className="text-[10px] text-muted-foreground">—</span>}
              </div>

              {/* شروط الدفع */}
              <div className="col-span-2">
                <span className="text-[10px] bg-muted/30 rounded-full px-2 py-0.5">{c.paymentTerms ?? "—"}</span>
              </div>

              {/* الطلبات */}
              <div className="col-span-1">
                <span className="text-xs font-bold">{c.totalOrders ?? 0}</span>
              </div>

              {/* المبيعات + نسبة تحصيل */}
              <div className="col-span-1">
                <p className="text-xs font-black text-primary">{fmt(sales)}</p>
                {sales > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{pct}%</span>
                  </div>
                )}
              </div>

              {/* إجراءات */}
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigate(`/finance/clients/${c.id}`)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1
                  : page <= 3 ? i + 1
                  : page >= totalPages - 2 ? totalPages - 4 + i
                  : page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                      page === p ? "bg-primary text-primary-foreground" : "hover:bg-muted/30 text-muted-foreground"
                    }`}>{p}</button>
                );
              })}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
