import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Package, Printer, Search, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, SlidersHorizontal, ArrowUpDown, X, Flame, TrendingUp, Minus, Users, DollarSign, BoxSelect } from "lucide-react";
import { ordersApi } from "@/lib/api";
import type { InventoryShortageItem } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type PriorityFilter = "all" | "high" | "medium" | "low";
type CustomersFilter = "all" | "one" | "few" | "many";
type ValueFilter = "all" | "low" | "mid" | "high";
type SortKey = "qty" | "orders" | "revenue" | "name";
type SortDir = "desc" | "asc";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ── بطاقة ملخص علوية ──────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-1"
      style={{
        background: `linear-gradient(145deg, ${color}22 0%, ${color}0a 100%)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 4px 20px ${color}18`,
      }}
    >
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-60">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] opacity-50">{sub}</p>}
    </div>
  );
}

// ── صف منتج قابل للتوسع ───────────────────────────────────────────────────────
function ShortageRow({ item, index }: { item: InventoryShortageItem; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const urgencyColor = item.totalQty >= 10
    ? "rgb(239,68,68)"
    : item.totalQty >= 5
    ? "rgb(249,115,22)"
    : "rgb(234,179,8)";

  const variantLabel = [item.color, item.size].filter(Boolean).join(" / ");

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/10 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="py-3 px-4 text-center">
          <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-sm text-foreground">{item.product}</span>
            {variantLabel && (
              <span className="text-[10px] font-semibold text-primary/70">{variantLabel}</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          <span
            className="inline-flex items-center justify-center w-12 h-8 rounded-xl text-lg font-black"
            style={{
              color: urgencyColor,
              background: urgencyColor.replace("rgb(", "rgba(").replace(")", ",0.12)"),
            }}
          >
            {item.totalQty}
          </span>
        </td>
        <td className="py-3 px-4 text-center">
          <Badge variant="outline" className="text-xs font-bold">
            {item.orderCount} طلب
          </Badge>
        </td>
        <td className="py-3 px-4 text-center text-sm font-semibold text-muted-foreground">
          {item.customerCount} عميل
        </td>
        <td className="py-3 px-4 text-center text-sm font-bold text-primary">
          {formatCurrency(item.totalRevenue)}
        </td>
        <td className="py-3 px-4 text-center">
          <button className="p-1 rounded hover:bg-muted/30 transition-colors">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/5">
          <td colSpan={7} className="px-6 pb-3 pt-2">
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <table className="w-full text-xs" dir="rtl">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="py-2 px-3 text-right font-semibold">العميل</th>
                    <th className="py-2 px-3 text-center font-semibold">الكمية</th>
                    <th className="py-2 px-3 text-center font-semibold">رقم الفاتورة</th>
                    <th className="py-2 px-3 text-center font-semibold">تاريخ الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {item.customers.map((c) => (
                    <tr key={c.id} className="border-t border-border/20 hover:bg-muted/10">
                      <td className="py-2 px-3">
                        <div>
                          <p className="font-bold text-foreground">{c.customerName}</p>
                          {c.phone && <p className="text-muted-foreground text-[10px]">{c.phone}</p>}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-foreground">{c.quantity}</td>
                      <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[10px]">
                        {c.invoiceNumber ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-center text-muted-foreground">
                        {format(new Date(c.createdAt), "yyyy/MM/dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
export default function InventoryShortagePage() {
  const [search, setSearch]           = useState("");
  const [priority, setPriority]       = useState<PriorityFilter>("all");
  const [productFilter, setProduct]   = useState<string>("all");
  const [customersF, setCustomers]    = useState<CustomersFilter>("all");
  const [valueF, setValue]            = useState<ValueFilter>("all");
  const [sortKey, setSortKey]         = useState<SortKey>("qty");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inventory-shortage"],
    queryFn: () => ordersApi.inventoryShortage(),
    staleTime: 30_000,
  });

  // قائمة أسماء المنتجات الفريدة
  const productNames = useMemo(() => {
    if (!data?.items) return [];
    return Array.from(new Set(data.items.map(i => i.product))).sort((a, b) => a.localeCompare(b, "ar"));
  }, [data?.items]);

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    const q = search.trim().toLowerCase();

    let items = data.items.filter(item => {
      // بحث نصي
      if (q && !(
        item.product.toLowerCase().includes(q) ||
        (item.color ?? "").toLowerCase().includes(q) ||
        (item.size ?? "").toLowerCase().includes(q)
      )) return false;
      // فلتر الأولوية (حسب الكمية)
      if (priority === "high"   && item.totalQty < 10) return false;
      if (priority === "medium" && (item.totalQty < 5 || item.totalQty >= 10)) return false;
      if (priority === "low"    && item.totalQty >= 5) return false;
      // فلتر المنتج
      if (productFilter !== "all" && item.product !== productFilter) return false;
      // فلتر عدد العملاء
      if (customersF === "one"  && item.customerCount !== 1) return false;
      if (customersF === "few"  && (item.customerCount < 2 || item.customerCount > 3)) return false;
      if (customersF === "many" && item.customerCount < 4) return false;
      // فلتر القيمة
      if (valueF === "low"  && item.totalRevenue >= 500) return false;
      if (valueF === "mid"  && (item.totalRevenue < 500 || item.totalRevenue >= 2000)) return false;
      if (valueF === "high" && item.totalRevenue < 2000) return false;
      return true;
    });

    items = [...items].sort((a, b) => {
      let diff = 0;
      if (sortKey === "qty")     diff = a.totalQty - b.totalQty;
      if (sortKey === "orders")  diff = a.orderCount - b.orderCount;
      if (sortKey === "revenue") diff = a.totalRevenue - b.totalRevenue;
      if (sortKey === "name")    diff = a.product.localeCompare(b.product, "ar");
      return sortDir === "desc" ? -diff : diff;
    });

    return items;
  }, [data?.items, search, priority, productFilter, customersF, valueF, sortKey, sortDir]);

  const hasFilters = search || priority !== "all" || productFilter !== "all" || customersF !== "all" || valueF !== "all" || sortKey !== "qty" || sortDir !== "desc";
  const clearAll = () => { setSearch(""); setPriority("all"); setProduct("all"); setCustomers("all"); setValue("all"); setSortKey("qty"); setSortDir("desc"); };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="UTF-8"/>
      <title>نواقص المخزن</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111; background: #fff; direction: rtl; }
        h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; color: #1a1a1a; }
        .subtitle { font-size: 11px; color: #666; margin-bottom: 20px; }
        .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .sum-card { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px 18px; min-width: 140px; }
        .sum-card .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
        .sum-card .val { font-size: 24px; font-weight: 900; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead tr { background: #f1f3f5; }
        th { padding: 10px 12px; text-align: right; font-weight: 700; color: #444; border-bottom: 2px solid #dee2e6; font-size: 11px; }
        td { padding: 9px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
        .qty-badge { display: inline-block; min-width: 36px; text-align: center; font-weight: 900; font-size: 15px; padding: 2px 8px; border-radius: 8px; }
        .high { color: #dc2626; background: #fee2e2; }
        .med  { color: #ea580c; background: #ffedd5; }
        .low  { color: #ca8a04; background: #fef9c3; }
        .customers-list { font-size: 10px; color: #555; margin-top: 4px; }
        .customers-list span { display: block; padding: 1px 0; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>`);

    // ملخص
    const s = data?.summary;
    win.document.write(`<h1>🗂️ نواقص المخزن</h1>`);
    win.document.write(`<p class="subtitle">تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd — HH:mm")}</p>`);
    win.document.write(`<div class="summary">
      <div class="sum-card"><div class="label">إجمالي المنتجات</div><div class="val">${s?.totalDistinctProducts ?? 0}</div></div>
      <div class="sum-card"><div class="label">إجمالي الكميات</div><div class="val">${s?.totalQty ?? 0}</div></div>
      <div class="sum-card"><div class="label">الطلبات المعلقة</div><div class="val">${s?.totalPendingOrders ?? 0}</div></div>
    </div>`);

    // جدول
    win.document.write(`<table><thead><tr>
      <th>#</th><th>المنتج</th><th>اللون / المقاس</th><th>الكمية المطلوبة</th><th>عدد الطلبات</th><th>العملاء</th>
    </tr></thead><tbody>`);

    filtered.forEach((item, idx) => {
      const qClass = item.totalQty >= 10 ? "high" : item.totalQty >= 5 ? "med" : "low";
      const customers = item.customers
        .map(c => `<span>• ${c.customerName} (${c.quantity} قطعة)${c.phone ? " — " + c.phone : ""}</span>`)
        .join("");
      win.document.write(`<tr>
        <td>${idx + 1}</td>
        <td><strong>${item.product}</strong></td>
        <td>${[item.color, item.size].filter(Boolean).join(" / ") || "—"}</td>
        <td><span class="qty-badge ${qClass}">${item.totalQty}</span></td>
        <td>${item.orderCount}</td>
        <td><div class="customers-list">${customers}</div></td>
      </tr>`);
    });

    win.document.write(`</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            نواقص المخزن
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            جرد الطلبات قيد الانتظار — الكميات المطلوبة من كل منتج
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground"
            onClick={handlePrint}
            disabled={!filtered.length}
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="منتجات مختلفة"
          value={summary?.totalDistinctProducts ?? 0}
          color="rgb(239,68,68)"
        />
        <SummaryCard
          label="إجمالي الكميات"
          value={summary?.totalQty ?? 0}
          sub="قطعة مطلوبة"
          color="rgb(249,115,22)"
        />
        <SummaryCard
          label="طلبات معلقة"
          value={summary?.totalPendingOrders ?? 0}
          color="rgb(234,179,8)"
        />
        <SummaryCard
          label="إجمالي الإيرادات"
          value={formatCurrency(summary?.totalRevenue ?? 0)}
          sub="قيمة الطلبات"
          color="rgb(59,130,246)"
        />
      </div>

      {/* ── شريط الفلاتر ── */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4 space-y-3">

        {/* صف 1: بحث + مسح */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالمنتج أو اللون أو المقاس..."
              className="pr-9 bg-background/60 text-sm h-9 border-border/40 rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-xl px-3 h-9 transition-colors bg-background/60 hover:bg-muted/20 whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              مسح الكل
            </button>
          )}
        </div>

        {/* صف 2: الفلاتر الـ 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

          {/* 1. الأولوية */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
              <Flame className="w-3.5 h-3.5" />
              الأولوية
            </div>
            <div className="flex gap-1">
              {([
                { k: "all",    l: "الكل"    },
                { k: "high",   l: "🔴 عاجل ≥10" },
                { k: "medium", l: "🟠 متوسط"    },
                { k: "low",    l: "🟡 قليل <5"  },
              ] as const).map(b => (
                <button key={b.k} onClick={() => setPriority(b.k)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all duration-150 ${
                    priority === b.k
                      ? b.k === "high"   ? "bg-red-500 text-white"
                      : b.k === "medium" ? "bg-orange-500 text-white"
                      : b.k === "low"    ? "bg-yellow-500 text-white"
                      : "bg-foreground text-background"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}>
                  {b.l}
                </button>
              ))}
            </div>
          </div>

          {/* 2. المنتج */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
              <BoxSelect className="w-3.5 h-3.5" />
              المنتج
            </div>
            <select
              value={productFilter}
              onChange={e => setProduct(e.target.value)}
              className="w-full h-9 text-xs rounded-xl border border-border/40 bg-background/60 px-3 focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="all">كل المنتجات</option>
              {productNames.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 3. عدد العملاء */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
              <Users className="w-3.5 h-3.5" />
              عدد العملاء
            </div>
            <div className="flex gap-1">
              {([
                { k: "all",  l: "الكل"  },
                { k: "one",  l: "عميل ١" },
                { k: "few",  l: "2-3"   },
                { k: "many", l: "+4"    },
              ] as const).map(b => (
                <button key={b.k} onClick={() => setCustomers(b.k)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all duration-150 ${
                    customersF === b.k
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}>
                  {b.l}
                </button>
              ))}
            </div>
          </div>

          {/* 4. القيمة */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
              <DollarSign className="w-3.5 h-3.5" />
              قيمة الطلبات
            </div>
            <div className="flex gap-1">
              {([
                { k: "all",  l: "الكل"     },
                { k: "low",  l: "< 500"   },
                { k: "mid",  l: "500-2k"  },
                { k: "high", l: "+2000"   },
              ] as const).map(b => (
                <button key={b.k} onClick={() => setValue(b.k)}
                  className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all duration-150 ${
                    valueF === b.k
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}>
                  {b.l}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* صف 3: ترتيب + نتائج */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="font-bold">ترتيب حسب:</span>
            </div>
            {([
              { k: "qty",     l: "الكمية"   },
              { k: "orders",  l: "الطلبات"  },
              { k: "revenue", l: "القيمة"   },
              { k: "name",    l: "الاسم"    },
            ] as const).map(s => (
              <button key={s.k}
                onClick={() => { if (sortKey === s.k) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortKey(s.k); setSortDir("desc"); } }}
                className={`flex items-center gap-1 text-[11px] font-bold px-2.5 h-7 rounded-lg border transition-all duration-150 ${
                  sortKey === s.k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background/60 text-muted-foreground border-border/40 hover:text-foreground"
                }`}>
                {s.l}
                {sortKey === s.k && <span className="opacity-80">{sortDir === "desc" ? "↓" : "↑"}</span>}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            <span className="font-bold text-foreground">{filtered.length}</span> منتج •{" "}
            <span className="font-bold text-foreground">{filtered.reduce((s, i) => s + i.totalQty, 0)}</span> قطعة مطلوبة
          </div>
        </div>

      </div>

      {/* Table */}
      <Card className="border-border overflow-hidden" ref={printRef}>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-semibold">
              {search ? "لا توجد نتائج للبحث" : "لا توجد طلبات قيد الانتظار 🎉"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-1">كل الطلبات تمت معالجتها</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold w-12">#</th>
                  <th className="py-3 px-4 text-right text-xs text-muted-foreground font-semibold">المنتج</th>
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">الكمية المطلوبة</th>
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">عدد الطلبات</th>
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">العملاء</th>
                  <th className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">قيمة الطلبات</th>
                  <th className="py-3 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <ShortageRow
                    key={`${item.product}||${item.color ?? ""}||${item.size ?? ""}`}
                    item={item}
                    index={idx}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          إجمالي {filtered.length} منتج — اضغط على أي صف لعرض تفاصيل العملاء
        </p>
      )}
    </div>
  );
}
