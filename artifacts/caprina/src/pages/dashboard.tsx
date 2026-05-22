import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ChartsSection, WeeklyBars, ChartCard, StatusDonutWithOrders } from "@/components/charts-section";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, TrendingDown, DollarSign, Package, AlertCircle,
  Plus, Activity, Boxes, ArrowUpRight, ArrowDownRight,
  Star, Wallet, BarChart3, ShoppingCart, AlertTriangle, RefreshCw, Bell, Brain, Zap, Archive, Clock,
  Receipt, Building2, FileText, X, AlertOctagon, Users,
} from "lucide-react";
import {
  analyticsApi, type PeriodProfit, type ProductProfit, type FinancialSummary, type Alert,
  productsApi, cashRegistersApi,
} from "@/lib/api";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Avatar helpers ──────────────────────────────────────────────────────────
const AVATAR_COLORS_DB = [
  ["#f59e0b","#78350f"],["#10b981","#064e3b"],["#3b82f6","#1e3a8a"],
  ["#8b5cf6","#4c1d95"],["#ef4444","#7f1d1d"],["#ec4899","#831843"],
  ["#06b6d4","#164e63"],["#f97316","#7c2d12"],
];
function dbAvatarColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS_DB[Math.abs(h) % AVATAR_COLORS_DB.length];
}
function dbInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}
function DashClientAvatar({ avatar, name }: { avatar?: string|null; name: string }) {
  if (avatar && avatar.startsWith("data:"))
    return <img src={avatar} className="w-9 h-9 rounded-full object-cover border border-border/50 shrink-0" />;
  const [bg, fg] = dbAvatarColor(name || "?");
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-border/20"
      style={{ background: bg, color: fg }}>
      {name ? dbInitials(name) : "؟"}
    </div>
  );
}



// ─── Helpers ──────────────────────────────────────────────────────────────────
const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);
const fn = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));
const pct = (n: number, color = true) => {
  if (!color) return `${n}%`;
  return n;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار", in_shipping: "قيد الشحن", received: "استلم",
  delayed: "مؤجل", returned: "مرتجع", partial_received: "استلم جزئي",
  warehouse_ready: "قيد الشحن في المخزن",
};
const STATUS_CLASSES: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  warehouse_ready:  "bg-orange-50  dark:bg-orange-900/30  text-orange-700  dark:text-orange-400  border-orange-300  dark:border-orange-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

// ─── Period Card ───────────────────────────────────────────────────────────────
function PeriodCard({ label, data, accent }: { label: string; data: PeriodProfit; accent: string }) {
  const isProfit = data.netProfit >= 0;
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <Badge variant="outline" className={`text-[8px] sm:text-[9px] font-bold border shrink-0 ${
            data.returnRate > 20 ? "border-red-400 text-red-600 dark:border-red-800 dark:text-red-400" : "border-border text-muted-foreground"
          }`}>{data.returnRate}% مرتجع</Badge>
        </div>
        <div>
          <p className={`text-xl sm:text-2xl font-black ${isProfit ? accent : "text-red-600 dark:text-red-400"}`}>{fc(data.netProfit)}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">صافي الربح</p>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-border">
          <div>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground">الإيرادات</p>
            <p className="text-[10px] sm:text-xs font-bold text-primary">{fc(data.revenue)}</p>
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground">التكاليف</p>
            <p className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-400">{fc(data.cost + data.shippingCost)}</p>
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground">الطلبات</p>
            <p className="text-[10px] sm:text-xs font-bold">{fn(data.orders)}</p>
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] text-muted-foreground">المرتجعات</p>
            <p className="text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400">{fn(data.returnCount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, rank, image }: { product: ProductProfit; rank: number; image?: string | null }) {
  const isPositive = product.profit >= 0;
  return (
    <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
      {/* رقم الترتيب */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
        rank === 1 ? "bg-amber-500 text-black" : rank === 2 ? "bg-zinc-400 text-black" : rank === 3 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
      }`}>{rank}</div>
      {/* صورة المنتج */}
      {image ? (
        <img src={image} alt={product.name} className="w-10 h-10 rounded-full object-cover border-2 border-border shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      {/* اسم المنتج والتفاصيل */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[11px] sm:text-xs truncate">{product.name}</p>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground">{fn(product.quantity)} وحدة • {product.margin}% هامش</p>
      </div>
      {/* الربح والسهم */}
      <div className="flex items-center gap-1.5 shrink-0">
        <p className={`text-[11px] sm:text-xs font-black ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {fc(product.profit)}
        </p>
        {isPositive
          ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
          : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
        }
      </div>
    </div>
  );
}

// ─── Damaged Orders Modal ───────────────────────────────────────────────────
function DamagedOrdersModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-damaged-orders"],
    queryFn: () => apiFetchDashboard<{ orders: any[]; totalDamagedValue: number; totalLoss: number; count: number }>("/analytics/damaged-orders"),
    staleTime: 30000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-red-200 dark:border-red-900/50 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h2 className="text-sm font-black text-red-700 dark:text-red-400">تفاصيل التوالف</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>

        {/* Summary */}
        {data && (
          <div className="grid grid-cols-3 gap-2 p-3 border-b border-border bg-muted/20">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">عدد التوالف</p>
              <p className="text-base font-black text-red-600 dark:text-red-400">{data.count}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-[9px] text-muted-foreground">قيمة البضاعة</p>
              <p className="text-sm font-black text-red-600 dark:text-red-400">{fc(data.totalDamagedValue)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">الخسارة الكلية</p>
              <p className="text-sm font-black text-red-700 dark:text-red-300">{fc(data.totalLoss)}</p>
            </div>
          </div>
        )}

        {/* Orders List */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">جاري التحميل...</div>
          ) : !data || data.orders.length === 0 ? (
            <div className="py-10 text-center">
              <AlertOctagon className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">لا توجد توالف مسجّلة</p>
            </div>
          ) : (
            data.orders.map((o: any) => (
              <Link key={o.id} href={`/orders/${o.id}`} onClick={onClose}>
                <div className="flex items-start justify-between p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-black truncate">{o.customerName}</span>
                      {o.invoiceNumber && (
                        <span className="text-[9px] font-mono text-primary/70 shrink-0">{o.invoiceNumber}</span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-foreground/80 truncate">
                      {o.product}{o.color ? ` • ${o.color}` : ""}{o.size ? ` / ${o.size}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {o.quantity} قطعة × {fc(o.costPrice)} تكلفة
                      {o.phone && <span className="mr-2 opacity-60">{o.phone}</span>}
                    </p>
                    {(o.returnReason || o.returnNote) && (
                      <p className="text-[9px] text-red-500/70 mt-0.5 truncate">
                        {o.returnReason === "quality" ? "جودة المنتج" :
                         o.returnReason === "size_mismatch" ? "مقاس غير مناسب" :
                         o.returnReason === "customer_refused" ? "عميل غير جاد" :
                         o.returnReason === "customer_requested_return" ? "طلب العميل" :
                         o.returnReason === "delay" ? "تأخير" :
                         o.returnNote || o.returnReason || ""}
                      </p>
                    )}
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs font-black text-red-600 dark:text-red-400">{fc(o.damagedCost)}</p>
                    <p className="text-[9px] text-muted-foreground">قيمة البضاعة</p>
                    <p className="text-[10px] font-bold text-red-700 dark:text-red-300 mt-0.5">{fc(o.totalLoss)}</p>
                    <p className="text-[9px] text-muted-foreground">إجمالي الخسارة</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// helper fetch للداشبورد (خارج الـ apiFetch العام)
function apiFetchDashboard<T>(path: string): Promise<T> {
  const token = localStorage.getItem("caprina_token");
  return fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then(r => r.json());
}

// ─── Financial Row ──────────────────────────────────────────────────────────────
function FinRow({ label, value, color = "text-foreground", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border/50 last:border-0 gap-2">
      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-right min-w-0">
        <span className={`text-[10px] sm:text-xs font-bold block ${color}`}>{value}</span>
        {sub && <p className="text-[8px] sm:text-[9px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function PwaInstallBanner() {
  const { canInstall, isInstalled, install, dismiss, isDismissed } = usePwaInstall();

  if (!canInstall || isInstalled || isDismissed) return null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl sm:rounded-2xl border border-amber-500/30 px-3 py-3 sm:px-4 sm:py-3"
         style={{ background: "linear-gradient(135deg, #c9971c0d 0%, #f0b4290a 100%)" }}>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-amber-500/30">
          <img src="./logo.jpg" alt="CAPRINA" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-black text-foreground leading-tight">ثبّت التطبيق على جهازك</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">
            تجربة أسرع كتطبيق أصلي بدون متصفح
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto sm:mr-auto">
        <button type="button" onClick={dismiss}
          className="text-[10px] text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-muted/20 transition-colors">
          لاحقاً
        </button>
        <button type="button" onClick={install}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap">
          <span>⬇</span>تثبيت
        </button>
      </div>
    </div>
  );
}

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = time.getHours();
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  const mm = String(time.getMinutes()).padStart(2, "0");
  const ss = String(time.getSeconds()).padStart(2, "0");
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 select-none">
      <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: "hsl(43 74% 50%)" }} />
      <span className="font-black text-lg sm:text-xl tabular-nums" style={{ color: "hsl(43 74% 50%)" }}>{h12}:{mm}:{ss}</span>
      <span className="text-xs sm:text-sm font-bold" style={{ color: "hsl(43 74% 50%)" }}>{ampm}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type Period = "today" | "week" | "month";

export default function Dashboard() {
  const { isAdmin, canViewFinancials } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [showDamagedModal, setShowDamagedModal] = useState(false);
  const { data: summary } = useGetOrdersSummary({
    query: { queryKey: ["orders-summary"], staleTime: 30000, refetchOnWindowFocus: true, refetchInterval: 60000 },
  });
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders({
    query: { queryKey: ["recent-orders"], staleTime: 30000, refetchOnWindowFocus: true, refetchInterval: 60000 },
  });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 60000 });
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["analytics-profit", period],
    queryFn: () => analyticsApi.profit({ period }),
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    enabled: canViewFinancials,
  });
  const { data: fin, isLoading: isFinLoading } = useQuery({
    queryKey: ["analytics-financial", period],
    queryFn: () => analyticsApi.financialSummary({ period }),
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    enabled: canViewFinancials,
  });
  const { data: alertsData } = useQuery({
    queryKey: ["analytics-alerts"],
    queryFn: analyticsApi.alerts,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const { data: smartData } = useQuery({
    queryKey: ["smart-insights"],
    queryFn: analyticsApi.smartInsights,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 180000,
  });
  const { data: recentClients = [] } = useQuery<any[]>({
    queryKey: ["recent-clients-dashboard"],
    queryFn: () => apiFetchDashboard<any[]>("/finance/clients?limit=5"),
    staleTime: 60000,
  });

  const { data: saleOrders = [] } = useQuery<any[]>({
    queryKey: ["sale-orders-dashboard-chart"],
    queryFn: () => apiFetchDashboard<any[]>("/finance/sale-orders?limit=200"),
    staleTime: 60000,
  });

  const { data: chartsData } = useQuery({
    queryKey: ["analytics-charts"],
    queryFn: analyticsApi.charts,
    staleTime: 30000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  const { data: productPerf, isLoading: isPerfLoading } = useQuery({
    queryKey: ["analytics-product-performance"],
    queryFn: analyticsApi.productPerformance,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    enabled: canViewFinancials,
  });

  const { data: shippingFollowup = [] } = useQuery<any[]>({
    queryKey: ["shipping-followup-dashboard"],
    queryFn: analyticsApi.shippingFollowup,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
  });

  const { data: cashRegisters } = useQuery({
    queryKey: ["cash-registers-list"],
    queryFn: cashRegistersApi.list,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 120000,
    enabled: canViewFinancials,
  });
  const totalCash = cashRegisters?.totalBalance ?? 0;

  const highAlerts = alertsData?.alerts.filter(a => a.severity === "high" && a.type !== "HIGH_RETURN") ?? [];
  const allAlerts = alertsData?.alerts ?? [];

  const lowStockProducts = products?.filter(p =>
    (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold
  ) ?? [];

  const hasCostData = fin && (fin.cashIn > 0 || fin.inventoryAtCost > 0);
  const noCostWarning = fin && fin.cashIn > 0 && fin.costOfGoods === 0;

  return (
    <>
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-500">      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">لوحة المالية</h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs lg:text-sm mt-0.5">CAPRINA — Financial Engine Dashboard</p>
          <div className="mt-1 sm:mt-1.5">
            <LiveClock />
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Period Filter */}
          {canViewFinancials && (
            <div className="flex items-center gap-0.5 sm:gap-1 border border-border rounded-md p-0.5 bg-muted/30">
              {([
                { key: "today", label: "اليوم" },
                { key: "week",  label: "الأسبوع" },
                { key: "month", label: "الشهر" },
              ] as { key: Period; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-2 sm:px-3 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors ${
                    period === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <Link href="/smart">
            <button className="flex items-center gap-1 sm:gap-1.5 border border-primary/30 text-primary hover:bg-primary/5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold transition-colors">
              <Brain className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">ذكاء</span>
            </button>
          </Link>
          <Link href="/orders/new">
            <button className="flex items-center gap-1.5 sm:gap-2 bg-primary text-primary-foreground px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>طلب جديد</span>
            </button>
          </Link>
        </div>
      </div>

      {/* === تحذير متابعة الشحن === */}
      {shippingFollowup.length > 0 && (() => {
        const urgent   = shippingFollowup.filter((o: any) => o.daysPending >= 7);
        const delayed  = shippingFollowup.filter((o: any) => o.daysPending >= 3 && o.daysPending < 7);
        const isUrgent = urgent.length > 0;
        return (
          <div className={`flex items-start gap-2.5 sm:gap-3 rounded-xl border p-3 sm:p-4 ${
            isUrgent
              ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60"
          }`}>
            {/* أيقونة */}
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isUrgent ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/30"
            }`}>
              {isUrgent
                ? <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
                : <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
              }
            </div>
            {/* المحتوى */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-xs sm:text-sm font-black ${
                  isUrgent ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  {isUrgent ? "🚨 عاجل — شحنات تجاوزت 7 أيام!" : "⚠️ تنبيه — شحنات تحتاج متابعة"}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {urgent.length > 0 && (
                    <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">
                      {urgent.length} عاجل ≥7 أيام
                    </span>
                  )}
                  {delayed.length > 0 && (
                    <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">
                      {delayed.length} متأخر 3-7 أيام
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-[10px] sm:text-xs mt-1 ${
                isUrgent ? "text-red-600/80 dark:text-red-400/80" : "text-amber-600/80 dark:text-amber-400/80"
              }`}>
                تأكد من متابعة هذه الشحنات مع شركات الشحن وتحديث أرقام التتبع في الطلبات.
              </p>
              {/* أبرز الطلبات */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {shippingFollowup.slice(0, 4).map((o: any) => (
                  <Link key={o.id} href={`/orders/${o.id}`}>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                      o.daysPending >= 7
                        ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                        : "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                    }`}>
                      <span>{o.customerName}</span>
                      <span className="opacity-60">•</span>
                      <span>{o.daysPending}ي</span>
                    </span>
                  </Link>
                ))}
                {shippingFollowup.length > 4 && (
                  <span className="text-[9px] text-muted-foreground self-center">
                    +{shippingFollowup.length - 4} أخرى
                  </span>
                )}
              </div>
            </div>
            {/* زر متابعة */}
            <Link href="/shipping-followup" className="shrink-0">
              <button className={`text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                isUrgent
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-white"
              }`}>
                متابعة الشحنات ←
              </button>
            </Link>
          </div>
        );
      })()}

      {/* === NO COST DATA WARNING (admin only) === */}
      {canViewFinancials && noCostWarning && (
        <div className="flex items-start gap-2 sm:gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-2.5 sm:p-3">
          <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-400">تحذير: بيانات التكلفة غير مكتملة</p>
            <p className="text-[9px] sm:text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              بعض المنتجات ليس لها سعر تكلفة. أضف costPrice للمنتجات لتفعيل الحساب المالي الدقيق.
            </p>
          </div>
          <Link href="/inventory" className="text-[10px] sm:text-xs text-primary hover:underline shrink-0 self-center">المخزون</Link>
        </div>
      )}

      {/* === FINANCIAL OVERVIEW BANNER (admin only) === */}
      {canViewFinancials && fin && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/5 overflow-hidden">
          <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4">
              {/* الحاوية الكبيرة: إجمالي أرصدة جميع الخزن النشطة */}
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5 sm:mb-1">
                  إجمالي أرصدة جميع الخزن النشطة
                </p>
                <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                  <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                    {fc(totalCash)}
                  </p>
                  <Badge variant="outline" className="text-[8px] sm:text-[9px] font-bold border border-emerald-500 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                    مجموع كل الخزن
                  </Badge>
                </div>
              </div>
              {/* حاويتان صغيرتان: صافي الربح + في الطريق */}
              <div className="grid grid-cols-2 gap-2 shrink-0 self-start">
                <div className="text-left bg-background/40 border border-border rounded-lg px-3 py-2 sm:px-4 sm:py-3">
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">صافي الربح — {{ today: "اليوم", week: "الأسبوع", month: "الشهر" }[period]}</p>
                  <p className={`text-sm sm:text-lg font-black ${fin.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fc(fin.netProfit)}</p>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">{fin.netMargin}% هامش صافي</p>
                </div>
                <div className="text-left bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">في الطريق (قيد التسليم)</p>
                  <p className="text-sm sm:text-lg font-black text-primary">{fc(fin.pendingRevenue)}</p>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">إيرادات محتملة</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 p-2 sm:p-3 bg-background/30 rounded-lg border border-border/40">
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                  <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground">إجمالي المقبوض</p>
                </div>
                <p className="font-black text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-sm">{fc(fin.cashIn - fin.shippingSpend)}</p>
                <p className="text-[7px] sm:text-[8px] text-muted-foreground">إيرادات − رسوم الشحن</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                  <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-700 dark:text-amber-400" />
                  <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground">تكلفة البضاعة</p>
                </div>
                <p className="font-black text-amber-700 dark:text-amber-400 text-[11px] sm:text-sm">{fc(fin.costOfGoods)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                  <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-600 dark:text-orange-400" />
                  <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground">تكلفة الشحن</p>
                </div>
                <p className="font-black text-orange-600 dark:text-orange-400 text-[11px] sm:text-sm">{fc(fin.shippingSpend)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
                  <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-600 dark:text-red-400" />
                  <p className="text-[7px] sm:text-[9px] font-bold text-muted-foreground">خسائر المرتجعات</p>
                </div>
                <p className="font-black text-red-600 dark:text-red-400 text-[11px] sm:text-sm">{fc(fin.returnLoss)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SMART ALERTS === */}
      {allAlerts.length > 0 && (
        <div className="space-y-1.5">
          {highAlerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-2 sm:gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-2.5 sm:p-3">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-bold text-red-700 dark:text-red-400 truncate">{alert.title}</p>
                <p className="text-[9px] sm:text-[11px] text-red-600/70 dark:text-red-400/70 truncate">{alert.detail}</p>
              </div>
              {alert.type === "LOW_STOCK" && (
                <Link href="/inventory" className="text-[9px] sm:text-xs text-primary hover:underline shrink-0">إدارة</Link>
              )}
              {(alert.type === "HIGH_RETURN" || alert.type === "LOSING_PRODUCT") && (
                <Link href="/product-performance" className="text-[9px] sm:text-xs text-primary hover:underline shrink-0">تحليل</Link>
              )}
            </div>
          ))}
          {alertsData && alertsData.counts.total > highAlerts.length && (
            <div className="flex items-center gap-2 sm:gap-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-lg p-2 sm:p-2.5">
              <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-[9px] sm:text-xs text-amber-700/80 dark:text-amber-400/80 flex-1 min-w-0 truncate">
                {alertsData.counts.medium > 0 && `${alertsData.counts.medium} تنبيه متوسط`}
                {alertsData.counts.medium > 0 && alertsData.counts.low > 0 && " • "}
                {alertsData.counts.low > 0 && `${alertsData.counts.low} تنبيه منخفض`}
              </p>
              <Link href="/product-performance" className="text-[9px] sm:text-xs text-primary hover:underline shrink-0">عرض الكل ←</Link>
            </div>
          )}
        </div>
      )}

      {/* === PERIOD CARDS (admin only) === */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {isAnalyticsLoading ? (
            [1,2,3].map(i => <Card key={i} className="animate-pulse h-32 sm:h-36 border-border" />)
          ) : analytics ? (
            <>
              {([
                { key: "today" as Period, label: "اليوم",        data: analytics.today, accent: "text-primary" },
                { key: "week"  as Period, label: "هذا الأسبوع", data: analytics.week,  accent: "text-emerald-600 dark:text-emerald-400" },
                { key: "month" as Period, label: "هذا الشهر",   data: analytics.month, accent: "text-amber-700 dark:text-amber-400" },
              ]).map(({ key, label, data, accent }) => (
                <div
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-xl cursor-pointer transition-all duration-200 ${
                    period === key
                      ? "ring-2 ring-primary shadow-md scale-[1.01] sm:scale-[1.02]"
                      : "opacity-70 hover:opacity-90 hover:shadow-sm"
                  }`}
                >
                  <PeriodCard label={label} data={data} accent={period === key ? accent : "text-muted-foreground"} />
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* === PWA INSTALL BANNER === */}
      <PwaInstallBanner />

      {/* === VISUAL CHARTS === */}
      {chartsData ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <ChartCard
              title="توزيع حالات الطلبات"
              dot="#22c55e"
              liveTag
            >
              <StatusDonutWithOrders
                data={chartsData.statusBreakdown}
                total={chartsData.total}
              />
            </ChartCard>

            <ChartCard
              title="الطلبيات الأسبوعية"
              subtitle="الأسبوع الحالي والأسبوع الماضي والشهر الحالي"
              dot="#f59e0b"
              glassStyle
            >
              <WeeklyBars
                data={chartsData.weeklySales}
                monthlySales={chartsData.monthlySales}
                weekComparison={chartsData.weekComparison}
              />

              {/* مبيعات العملاء التجاريين */}
              {(() => {
                // بناء بيانات آخر 7 أيام من saleOrders
                const days: Record<string, number> = {};
                for (let i = 6; i >= 0; i--) {
                  const d = new Date(); d.setDate(d.getDate() - i);
                  const key = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
                  days[key] = 0;
                }
                saleOrders.forEach((o: any) => {
                  try {
                    const d = new Date(o.createdAt);
                    const key = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
                    if (key in days) days[key] += parseFloat(o.totalAmount ?? "0");
                  } catch {}
                });
                const clientChartData = Object.entries(days).map(([date, value]) => ({ date, value }));
                const totalSales = clientChartData.reduce((s, d) => s + d.value, 0);
                if (totalSales === 0) return null;

                return (
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                        مبيعات العملاء التجاريين
                      </p>
                    </div>
                    <p className="text-xl font-black text-primary mb-0.5">
                      {new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(totalSales)}
                    </p>
                    <p className="text-[10px] text-primary mb-2">آخر 7 أيام</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <AreaChart data={clientChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dashSalesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(43,74%,50%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(43,74%,50%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                          formatter={(v: any) => [new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(v), "المبيعات"]}
                        />
                        <Area type="monotone" dataKey="value" stroke="hsl(43,74%,50%)" strokeWidth={2} fill="url(#dashSalesGrad)" dot={{ fill: "hsl(43,74%,50%)", r: 3 }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </ChartCard>
          </div>
        </div>
      ) : (
        <ChartsSection />
      )}

      {/* === SMART QUICK INSIGHTS === */}
      {smartData && (
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">

          {/* أفضل منصة */}
          <Link href="/smart">
            <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-white">
                {!smartData.adAttribution.bestSource || smartData.adAttribution.bestSource.source === "facebook" ? (
                  <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                    <rect width="36" height="36" rx="8" fill="#1877F2"/>
                    <path d="M25 18c0-3.866-3.134-7-7-7s-7 3.134-7 7c0 3.493 2.559 6.39 5.906 6.917V20.28h-1.777V18h1.777v-1.541c0-1.754 1.045-2.722 2.643-2.722.765 0 1.566.137 1.566.137v1.722h-.882c-.869 0-1.139.54-1.139 1.094V18h1.938l-.31 2.28h-1.628v4.637C22.441 24.39 25 21.493 25 18z" fill="white"/>
                  </svg>
                ) : smartData.adAttribution.bestSource.source === "tiktok" ? (
                  <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                    <rect width="36" height="36" rx="8" fill="#010101"/>
                    <path d="M22.5 9h-2.8v12.2a2.9 2.9 0 01-2.9 2.7 2.9 2.9 0 01-2.9-2.9 2.9 2.9 0 012.9-2.9c.28 0 .55.04.8.11V15.3a6.1 6.1 0 00-.8-.05 5.95 5.95 0 00-5.95 5.95A5.95 5.95 0 0016.8 27a5.95 5.95 0 005.95-5.95V15.1a8.6 8.6 0 005.05 1.63v-2.8a5.8 5.8 0 01-5.3-4.93z" fill="white"/>
                  </svg>
                ) : smartData.adAttribution.bestSource.source === "instagram" ? (
                  <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                    <defs>
                      <linearGradient id="igGrad" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#F58529"/>
                        <stop offset="40%" stopColor="#DD2A7B"/>
                        <stop offset="100%" stopColor="#8134AF"/>
                      </linearGradient>
                    </defs>
                    <rect width="36" height="36" rx="8" fill="url(#igGrad)"/>
                    <rect x="10" y="10" width="16" height="16" rx="5" stroke="white" strokeWidth="1.8" fill="none"/>
                    <circle cx="18" cy="18" r="4" stroke="white" strokeWidth="1.8" fill="none"/>
                    <circle cx="23.5" cy="12.5" r="1.1" fill="white"/>
                  </svg>
                ) : smartData.adAttribution.bestSource.source === "whatsapp" ? (
                  <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                    <rect width="36" height="36" rx="8" fill="#25D366"/>
                    <path d="M18 9a9 9 0 00-7.8 13.5L9 27l4.7-1.2A9 9 0 1018 9zm0 16.4a7.4 7.4 0 01-3.8-1l-.27-.16-2.8.73.75-2.72-.18-.28A7.4 7.4 0 1118 25.4zm4.07-5.54c-.22-.11-1.32-.65-1.52-.72-.2-.07-.35-.11-.5.11-.15.22-.58.72-.71.87-.13.15-.26.17-.48.06-.22-.11-.93-.34-1.77-1.09-.65-.58-1.09-1.3-1.22-1.52-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.64-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.39.06-.59.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.8 3.36.53.23.95.37 1.27.47.53.17 1.02.14 1.4.09.43-.06 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.06-.09-.2-.15-.42-.26z" fill="white"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 36 36" className="w-5 h-5" fill="none">
                    <rect width="36" height="36" rx="8" fill="#16a34a"/>
                    <path d="M18 10c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3c1.2 0 2.32.35 3.26.95L13.95 21.26A4.96 4.96 0 0113 18c0-2.76 2.24-5 5-5zm0 10c-1.2 0-2.32-.35-3.26-.95l7.31-7.31c.6.94.95 2.06.95 3.26 0 2.76-2.24 5-5 5z" fill="white"/>
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] text-muted-foreground font-bold">أفضل منصة</p>
                {smartData.adAttribution.bestSource ? (
                  <>
                    <p className="text-[10px] sm:text-xs font-black truncate">
                      {smartData.adAttribution.bestSource.source === "facebook" ? "فيسبوك" :
                       smartData.adAttribution.bestSource.source === "tiktok" ? "تيك توك" :
                       smartData.adAttribution.bestSource.source === "instagram" ? "إنستجرام" :
                       smartData.adAttribution.bestSource.source === "whatsapp" ? "واتساب" :
                       smartData.adAttribution.bestSource.source === "organic" ? "عضوي" : "أخرى"}
                    </p>
                    {canViewFinancials && (
                      <p className="text-[8px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                        {new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(smartData.adAttribution.bestSource.profit)}
                      </p>
                    )}
                  </>
                ) : <p className="text-[10px] sm:text-xs text-muted-foreground">لا بيانات</p>}
              </div>
            </div>
          </Link>

          {/* نجوم / راكد */}
          <Link href="/smart">
            <div className="flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-500" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] text-muted-foreground font-bold">نجوم / راكد</p>
                <p className="text-[10px] sm:text-xs font-black">{smartData.stars.length} نجوم</p>
                <p className="text-[8px] sm:text-[10px] text-amber-600 dark:text-amber-400 truncate">{smartData.deadStock.length} منتج راكد</p>
              </div>
            </div>
          </Link>

          {/* المرتجعات */}
          <Link href="/smart">
            <div className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-xl border bg-card hover:bg-primary/5 transition-colors cursor-pointer ${
              smartData.returnInsights.highReturnProducts.length > 0 ? "border-red-300 dark:border-red-800" : "border-border"
            }`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                smartData.returnInsights.highReturnProducts.length > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
              }`}>
                <svg viewBox="0 0 24 24" className={`w-4 h-4 ${smartData.returnInsights.highReturnProducts.length > 0 ? "text-red-500" : "text-muted-foreground"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.86"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] text-muted-foreground font-bold">المرتجعات</p>
                <p className="text-[10px] sm:text-xs font-black">{smartData.returnInsights.totalReturnRate}% معدل</p>
                {smartData.returnInsights.highReturnProducts.length > 0 ? (
                  <p className="text-[8px] sm:text-[10px] text-red-600 dark:text-red-400 font-bold truncate">{smartData.returnInsights.highReturnProducts.length} تجاوز 50%</p>
                ) : (
                  <p className="text-[8px] sm:text-[10px] text-emerald-600 dark:text-emerald-400">تحت السيطرة</p>
                )}
              </div>
            </div>
          </Link>

          {/* سينفد قريباً */}
          <Link href="/smart">
            <div className={`flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-xl border bg-card hover:bg-primary/5 transition-colors cursor-pointer ${
              smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "border-red-300 dark:border-red-800" : "border-border"
            }`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "bg-red-100 dark:bg-red-900/30" : "bg-sky-100 dark:bg-sky-900/20"
              }`}>
                <svg viewBox="0 0 24 24" className={`w-4 h-4 ${smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "text-red-500" : "text-sky-500"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6M12 22v-2M4.93 4.93l4.24 4.24M16.24 16.24l1.42 1.42M2 12h2M22 12h-2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.42 1.42"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] sm:text-[10px] text-muted-foreground font-bold">سينفد قريباً</p>
                <p className="text-[10px] sm:text-xs font-black">{smartData.stockPredictor.length} منتج</p>
                {smartData.stockPredictor.length > 0 && (
                  <p className={`text-[8px] sm:text-[10px] font-bold truncate ${smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>
                    خلال 14 يوم
                  </p>
                )}
              </div>
            </div>
          </Link>

        </div>
      )}

      {/* === MAIN GRID === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
        <div className="lg:col-span-1 xl:col-span-2 2xl:col-span-3 space-y-3 sm:space-y-4">
          {canViewFinancials && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">

              {/* ── أفضل المنتجات ربحاً ───────────────────────────────── */}
              <Card className="border-border">
                <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-border">
                  <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400" />
                    أفضل المنتجات ربحاً
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-normal mr-auto">مرتبة بصافي الربح</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 px-3 sm:px-4">
                  {isAnalyticsLoading ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">جاري التحميل...</div>
                  ) : analytics?.topProducts?.length ? (
                    <div className="flex flex-col gap-2">
                      {analytics.topProducts.map((p, i) => (
                        <ProductRow
                          key={p.name}
                          product={p}
                          rank={i + 1}
                          image={products?.find(pr => pr.name === p.name)?.image ?? null}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground text-xs">
                      <Star className="w-6 h-6 mx-auto mb-2 opacity-20" />
                      أضف بيانات التكلفة للمنتجات لتفعيل هذا القسم
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── أفضل المنتجات مبيعاً ─────────────────────────────── */}
              <Card className="border-border">
                <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-border">
                  <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2">
                    <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                    أكثر المنتجات مبيعاً
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-normal mr-auto">مرتبة بعدد الطلبات</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 px-3 sm:px-4">
                  {/* رسم بياني منحني - مبيعات المنتجات */}
                  {productPerf?.products && productPerf.products.length > 0 && (() => {
                    const chartData = [...productPerf.products]
                      .sort((a, b) => b.totalOrders - a.totalOrders)
                      .slice(0, 7)
                      .map(p => ({
                        name: p.name.length > 8 ? p.name.slice(0, 8) + "…" : p.name,
                        qty: p.totalSalesQty,
                        orders: p.totalOrders,
                      }));
                    return (
                      <div className="mb-3 rounded-xl overflow-hidden border border-border bg-card/60 p-2">
                        <div className="flex items-center justify-between mb-1.5 px-1">
                          <p className="text-[9px] text-muted-foreground font-medium">الوحدات المباعة لكل منتج</p>
                          <p className="text-[10px] font-black text-amber-500">
                            {fn(productPerf.products.reduce((s, p) => s + p.totalSalesQty, 0))} وحدة
                          </p>
                        </div>
                        <ResponsiveContainer width="100%" height={100}>
                          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                            <defs>
                              <linearGradient id="salesGradientTop" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                            <YAxis hide domain={[0, 'auto']} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10, padding: "4px 8px" }}
                              formatter={(v: number, name: string) => [fn(v), name === "qty" ? "وحدة" : "طلب"]}
                              labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 9 }}
                            />
                            <Area type="monotone" dataKey="qty" stroke="#f59e0b" strokeWidth={2.5} fill="url(#salesGradientTop)" dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#f59e0b" }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                  {/* قائمة المنتجات */}
                  {isPerfLoading ? (
                    <div className="py-4 text-center text-xs text-muted-foreground">جاري التحميل...</div>
                  ) : productPerf?.products?.length ? (
                    <div className="flex flex-col gap-2">
                      {[...productPerf.products]
                        .sort((a, b) => b.totalOrders - a.totalOrders)
                        .slice(0, 5)
                        .map((p, i) => (
                          <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                              i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                            }`}>{i + 1}</div>
                            <div className="w-9 h-9 rounded-full bg-muted border-2 border-border flex items-center justify-center shrink-0 overflow-hidden">
                              {products?.find(pr => pr.name === p.name)?.image
                                ? <img src={products.find(pr => pr.name === p.name)!.image!} alt={p.name} className="w-full h-full object-cover" />
                                : <Package className="w-4 h-4 text-muted-foreground" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[11px] sm:text-xs truncate">{p.name}</p>
                              <p className="text-[9px] text-muted-foreground">{fn(p.totalOrders)} طلب • {fn(p.totalSalesQty)} وحدة</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <p className="text-[11px] font-black text-amber-600 dark:text-amber-400">{fc(p.totalRevenue)}</p>
                              <ArrowUpRight className="w-3 h-3 text-amber-500" />
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground text-xs">
                      <Package className="w-6 h-6 mx-auto mb-2 opacity-20" />
                      لا توجد بيانات
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── منتجات ذات نسبة إرجاع مرتفعة ─────────────────────────── */}
          {canViewFinancials && analytics?.losingProducts && analytics.losingProducts.length > 0 && (
            <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/5">
              <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-red-200 dark:border-red-900/30">
                <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2">
                  <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600 dark:text-red-400" />
                  منتجات ذات نسبة إرجاع مرتفعة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-3 px-3 sm:px-4">
                {analytics.losingProducts.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-1.5 sm:py-2 border-b border-red-100 dark:border-red-900/20 last:border-0 text-[10px] sm:text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-muted-foreground text-[9px] sm:text-[11px]">{p.orderCount} طلب • {p.returnCount} مرتجع</p>
                    </div>
                    <div className="text-right flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <div>
                        <Badge variant="outline" className="border-red-400 text-red-600 dark:border-red-800 dark:text-red-400 text-[8px] sm:text-[10px] block mb-0.5 sm:mb-1">{p.returnRate}% مرتجع</Badge>
                        <p className="text-red-600 dark:text-red-400 font-bold text-[9px] sm:text-[10px]">{fc(p.profit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}





          <Card className="border-border overflow-hidden">
            <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2">
                  <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />آخر الطلبات
                </CardTitle>
                <Link href="/orders" className="text-[10px] sm:text-xs text-primary hover:underline">عرض الكل ←</Link>
              </div>
            </CardHeader>
            {isRecentLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">جاري التحميل...</div>
            ) : recentOrders?.length ? (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-muted/20 transition-colors gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-[10px] sm:text-xs shrink-0">
                        {order.customerName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[11px] sm:text-sm truncate">{order.customerName}</p>
                        <p className="text-[9px] sm:text-xs text-muted-foreground truncate">#{order.id.toString().padStart(4,"0")} • {order.product}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0">
                      <span className="font-bold text-[10px] sm:text-xs text-primary">{fc(order.totalPrice)}</span>
                      <Badge variant="outline" className={`text-[7px] sm:text-[9px] font-bold border whitespace-nowrap ${STATUS_CLASSES[order.status] || ""}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center">
                <Package className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-xs sm:text-sm">لا توجد طلبات</p>
                <Link href="/orders/new" className="text-primary text-[10px] sm:text-xs mt-1 inline-block">أنشئ أول طلب</Link>
              </div>
            )}
          </Card>

          {/* أحدث العملاء */}
          {recentClients.length > 0 && (
            <Card className="border-border overflow-hidden">
              <CardHeader className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />أحدث العملاء
                  </CardTitle>
                  <Link href="/finance/clients" className="text-[10px] sm:text-xs text-primary hover:underline">عرض الكل ←</Link>
                </div>
              </CardHeader>
              <div className="divide-y divide-border">
                {recentClients.slice(0, 5).map((c: any) => (
                  <Link key={c.id} href={`/finance/clients/${c.id}`}
                    className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 hover:bg-muted/20 transition-colors">
                    <DashClientAvatar avatar={c.avatar} name={c.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">{c.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{c.email || c.phone || c.city || "—"}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0">
                      {c.createdAt ? (() => {
                        const mins = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60000);
                        if (mins < 60) return `منذ ${mins} د`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `منذ ${hrs} س`;
                        return `منذ ${Math.floor(hrs / 24)} ي`;
                      })() : "—"}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* ── مركز التحكم ─────────────────────────────────────────── */}
          {(() => {
            // ── حساب المهام والتنبيهات ──
            const pendingShip   = recentOrders?.filter((o:any) => o.status === "confirmed" || o.status === "processing") ?? [];
            const unpaidOld     = (() => {
              try {
                return (summary as any)?.unpaidOld ?? 0;
              } catch { return 0; }
            })();
            const highAlertList = highAlerts ?? [];
            const lowStock      = lowStockProducts ?? [];

            const tasks: { id:string; icon:any; color:string; bg:string; label:string; count:number; href:string; priority:"high"|"med"|"low" }[] = [
              pendingShip.length > 0 && {
                id:"ship", icon: Package, color:"text-amber-400", bg:"bg-amber-400/10",
                label:`${pendingShip.length} طلب في انتظار الشحن`, count:pendingShip.length,
                href:"/orders", priority:"high" as const,
              },
              lowStock.length > 0 && {
                id:"stock", icon: Archive, color:"text-orange-400", bg:"bg-orange-400/10",
                label:`${lowStock.length} منتج وصل للحد الأدنى`, count:lowStock.length,
                href:"/inventory", priority:"high" as const,
              },
              highAlertList.length > 0 && {
                id:"alert", icon: AlertTriangle, color:"text-red-400", bg:"bg-red-400/10",
                label:`${highAlertList.length} تنبيه يحتاج تدخل فوري`, count:highAlertList.length,
                href:"/smart", priority:"high" as const,
              },
              unpaidOld > 0 && {
                id:"unpaid", icon: Receipt, color:"text-rose-400", bg:"bg-rose-400/10",
                label:`فواتير متأخرة السداد`, count:unpaidOld,
                href:"/finance/sales", priority:"med" as const,
              },
              recentClients.length > 0 && {
                id:"newclient", icon: Users, color:"text-sky-400", bg:"bg-sky-400/10",
                label:`${recentClients.length} عميل جديد هذا الشهر`, count:recentClients.length,
                href:"/finance/clients", priority:"low" as const,
              },
            ].filter(Boolean) as any[];

            // ── مقارنة الأداء اليوم بالأمس ──
            const todaySales  = (analytics as any)?.today?.totalSales  ?? 0;
            const yestSales   = (analytics as any)?.yesterday?.totalSales ?? 0;
            const salesDiff   = yestSales > 0 ? Math.round(((todaySales - yestSales) / yestSales) * 100) : null;

            const todayOrders = (summary as any)?.todayOrders ?? 0;
            const yestOrders  = (summary as any)?.yesterdayOrders ?? 0;
            const ordersDiff  = yestOrders > 0 ? Math.round(((todayOrders - yestOrders) / yestOrders) * 100) : null;

            if (tasks.length === 0 && salesDiff === null) return null;

            return (
              <Card className="border-border overflow-hidden">
                <CardHeader className="py-2.5 px-3 sm:px-4 border-b border-border">
                  <CardTitle className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    مركز التحكم
                    {tasks.filter(t=>t.priority==="high").length > 0 && (
                      <span className="mr-auto text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                        {tasks.filter(t=>t.priority==="high").length} يحتاج تدخل
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">

                  {/* ── مقارنة اليوم بالأمس ── */}
                  {(salesDiff !== null || ordersDiff !== null) && (
                    <div className="grid grid-cols-2 gap-0 border-b border-border">
                      {[
                        { label:"المبيعات اليوم", diff:salesDiff, icon:TrendingUp },
                        { label:"الطلبات اليوم",  diff:ordersDiff, icon:ShoppingCart },
                      ].map((item,i) => (
                        <div key={i} className={`p-3 ${i===0?"border-l border-border":""} flex items-center gap-2`}>
                          <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">{item.label}</p>
                            {item.diff !== null ? (
                              <p className={`text-xs font-black ${item.diff >= 0 ? "text-emerald-400":"text-red-400"}`}>
                                {item.diff >= 0 ? "▲":"▼"} {Math.abs(item.diff)}% عن أمس
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">لا توجد بيانات أمس</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── المهام ── */}
                  {tasks.length > 0 && (
                    <div className="divide-y divide-border/50">
                      {tasks.map(task => (
                        <Link key={task.id} href={task.href}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/10 transition-colors group">
                          <div className={`w-7 h-7 rounded-lg ${task.bg} flex items-center justify-center shrink-0`}>
                            <task.icon className={`w-3.5 h-3.5 ${task.color}`} />
                          </div>
                          <p className="flex-1 text-xs text-foreground/80 group-hover:text-foreground transition-colors">
                            {task.label}
                          </p>
                          {task.priority === "high" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />
                          )}
                          {task.priority === "med" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          )}
                          <ArrowUpRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* ── كل حاجة تمام ── */}
                  {tasks.length === 0 && (
                    <div className="flex items-center gap-2 px-3 py-4 text-emerald-400">
                      <Zap className="w-4 h-4" />
                      <p className="text-xs font-semibold">كل حاجة تمام — مفيش مهام معلقة 🎉</p>
                    </div>
                  )}

                </CardContent>
              </Card>
            );
          })()}

        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <h2 className="text-xs sm:text-sm font-bold">إجراءات سريعة</h2>
            <Link href="/orders/new" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 px-4 rounded-md text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors min-h-[44px]">
              <Plus className="w-4 h-4" />إضافة طلب
            </Link>
            <Link href="/inventory" className="w-full flex items-center justify-center gap-2 border border-border bg-card text-foreground hover:bg-muted/30 transition-colors py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold min-h-[44px]">
              <Boxes className="w-4 h-4" />إدارة المخزون
            </Link>
            <Link href="/import" className="w-full flex items-center justify-center gap-2 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors py-2.5 px-4 rounded-md text-xs sm:text-sm font-semibold min-h-[44px]">
              <TrendingUp className="w-4 h-4" />استيراد Excel
            </Link>
          </div>

          {canViewFinancials && fin && (
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4 space-y-0.5 sm:space-y-1">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 sm:mb-3 flex items-center gap-1 sm:gap-1.5">
                  <Boxes className="w-2.5 h-2.5 sm:w-3 sm:h-3" />قيمة المخزون
                </p>
                <FinRow label="بسعر التكلفة" value={fc(fin.inventoryAtCost)} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="بسعر البيع" value={fc(fin.inventoryAtSell)} color="text-primary" />
                <div className="mt-1 pt-1.5 sm:pt-2 border-t border-border flex justify-between items-center">
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">الربح المحتمل</span>
                  <span className={`text-[10px] sm:text-xs font-black ${fin.potentialInventoryProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(fin.potentialInventoryProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {canViewFinancials && fin && (
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 sm:mb-3 flex items-center gap-1 sm:gap-1.5">
                  <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />التدفق النقدي الكلي
                </p>
                <FinRow label="إجمالي المقبوض" value={fc(fin.cashIn - fin.shippingSpend)} color="text-emerald-600 dark:text-emerald-400" />
                <FinRow label="تكلفة البضاعة" value={`(${fc(fin.costOfGoods)})`} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="تكلفة الشحن" value={`(${fc(fin.shippingSpend)})`} color="text-orange-600 dark:text-orange-400" />
                <FinRow label="خسائر المرتجعات" value={`(${fc(fin.returnLoss)})`} color="text-red-600 dark:text-red-400" sub={`${fin.returnCount} طلب مرتجع`} />
                <div className={`mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t-2 flex justify-between items-center ${fin.netProfit >= 0 ? "border-emerald-500 dark:border-emerald-800" : "border-red-500 dark:border-red-800"}`}>
                  <span className="text-[11px] sm:text-sm font-bold">صافي الربح</span>
                  <span className={`text-[11px] sm:text-sm font-black ${fin.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(fin.netProfit)}
                  </span>
                </div>
                {fin.grossMargin > 0 && (
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground text-center mt-1.5 sm:mt-2">
                    هامش إجمالي: {fin.grossMargin}% • هامش صافي: {fin.netMargin}%
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {summary && (
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4 space-y-0.5 sm:space-y-1">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 sm:mb-3 flex items-center gap-1 sm:gap-1.5">
                  <ShoppingCart className="w-2.5 h-2.5 sm:w-3 sm:h-3" />ملخص الطلبات
                </p>
                {[
                  { label: "قيد الانتظار", val: summary.pendingOrders, color: "text-amber-700 dark:text-amber-400" },
                  { label: "مُسلَّم", val: summary.receivedOrders, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "قيد الشحن", val: summary.shippingOrders ?? 0, color: "text-sky-600 dark:text-sky-400" },
                  { label: "في المخزن", val: summary.warehouseReadyOrders ?? 0, color: "text-orange-600 dark:text-orange-400" },
                  { label: "مرتجع", val: summary.returnedOrders ?? 0, color: "text-red-600 dark:text-red-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between text-[10px] sm:text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-bold ${color}`}>{val}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-1.5 sm:pt-2 flex justify-between text-[10px] sm:text-xs mt-1">
                  <span className="text-muted-foreground font-bold">الإجمالي</span>
                  <span className="font-bold">{summary.totalOrders}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {canViewFinancials && fin && fin.completedOrders > 0 && (
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 sm:mb-3 flex items-center gap-1 sm:gap-1.5">
                  <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3" />مقاييس الطلبات
                </p>
                <FinRow label="متوسط ربح الطلب" value={fc(fin.avgProfitPerOrder)} color={fin.avgProfitPerOrder >= 0 ? "text-primary" : "text-red-600 dark:text-red-400"} />
                <FinRow label="متوسط قيمة الطلب" value={fc(fin.avgOrderValue)} color="text-foreground" />
                <FinRow label="متوسط تكلفة الطلب" value={fc(fin.avgCostPerOrder)} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="نسبة الإرجاع الكلية" value={`${fin.returnRate}%`} color={fin.returnRate >= 20 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"} />
              </CardContent>
            </Card>
          )}

          {allAlerts.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1 sm:gap-1.5">
                    <Bell className="w-2.5 h-2.5 sm:w-3 sm:h-3" />التنبيهات الذكية
                  </p>
                  <Badge variant="outline" className={`text-[8px] sm:text-[9px] ${alertsData?.counts.high ? "border-red-400 text-red-600 dark:border-red-800 dark:text-red-400" : "border-amber-400 text-amber-700 dark:border-amber-800 dark:text-amber-400"}`}>
                    {alertsData?.counts.total}
                  </Badge>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  {allAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="flex items-start gap-1.5 sm:gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 sm:mt-1.5 shrink-0 ${
                        alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-[9px] sm:text-[10px] font-bold text-foreground truncate">{alert.title}</p>
                        <p className="text-[8px] sm:text-[9px] text-muted-foreground truncate">{alert.detail}</p>
                      </div>
                    </div>
                  ))}
                  {allAlerts.length > 5 && (
                    <Link href="/product-performance" className="text-[9px] sm:text-[10px] text-primary hover:underline block text-center mt-1">
                      +{allAlerts.length - 5} تنبيه آخر
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canViewFinancials && fin && fin.returnRevLost > 0 && (
            <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/5">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-red-500/70 dark:text-red-400/60 mb-2 sm:mb-3 flex items-center gap-1 sm:gap-1.5">
                  <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />تأثير المرتجعات
                </p>
                <FinRow label="إيرادات فُقدت" value={fc(fin.returnRevLost)} color="text-red-600 dark:text-red-400" sub="بيع كان مخطط" />
                <FinRow label="تكلفة محملة" value={fc(fin.returnLoss)} color="text-red-600 dark:text-red-400" sub="شحن + بضاعة" />
                {fin.returnDamagedValue > 0 && (
                  <div
                    className="flex items-center justify-between py-1.5 sm:py-2 border-b border-border/50 last:border-0 gap-2 cursor-pointer group hover:bg-red-50/50 dark:hover:bg-red-900/10 rounded px-1 -mx-1 transition-colors"
                    onClick={() => setShowDamagedModal(true)}
                    title="اضغط لعرض تفاصيل التوالف"
                  >
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex items-center gap-1">
                      <AlertOctagon className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                      قيمة التوالف
                    </span>
                    <div className="text-right min-w-0">
                      <span className="text-[10px] sm:text-xs font-bold block text-red-700 dark:text-red-300 group-hover:underline">{fc(fin.returnDamagedValue)}</span>
                      <p className="text-[8px] sm:text-[9px] text-muted-foreground group-hover:text-red-500/70 transition-colors">اضغط لعرض التفاصيل</p>
                    </div>
                  </div>
                )}
                <div className="mt-1.5 sm:mt-2 text-center">
                  <p className="text-[10px] sm:text-xs font-black text-red-600 dark:text-red-400">{fin.returnRate}% نسبة الإرجاع</p>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground">{fin.returnCount} من {fin.totalOrders} طلب</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>

    {showDamagedModal && <DamagedOrdersModal onClose={() => setShowDamagedModal(false)} />}
    </>
  );
}