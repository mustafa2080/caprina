import { useQuery } from "@tanstack/react-query";
import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, TrendingDown, DollarSign, Package, AlertCircle,
  Plus, Activity, Boxes, ArrowUpRight, ArrowDownRight,
  Star, Wallet, BarChart3, ShoppingCart, AlertTriangle, RefreshCw, Bell, Brain, Zap, Archive, Clock,
} from "lucide-react";
import {
  analyticsApi, type PeriodProfit, type ProductProfit, type FinancialSummary, type Alert,
  productsApi,
} from "@/lib/api";
import { ChartsSection } from "@/components/charts-section";
import { usePwaInstall } from "@/hooks/usePwaInstall";

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
};
const STATUS_CLASSES: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
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
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <Badge variant="outline" className={`text-[9px] font-bold border ${
            data.returnRate > 20 ? "border-red-400 text-red-600 dark:border-red-800 dark:text-red-400" : "border-border text-muted-foreground"
          }`}>{data.returnRate}% مرتجع</Badge>
        </div>
        <div>
          <p className={`text-2xl font-black ${isProfit ? accent : "text-red-600 dark:text-red-400"}`}>{fc(data.netProfit)}</p>
          <p className="text-[10px] text-muted-foreground">صافي الربح</p>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <p className="text-[9px] text-muted-foreground">الإيرادات</p>
            <p className="text-xs font-bold text-primary">{fc(data.revenue)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">التكاليف</p>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{fc(data.cost + data.shippingCost)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">الطلبات</p>
            <p className="text-xs font-bold">{fn(data.orders)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">المرتجعات</p>
            <p className="text-xs font-bold text-red-600 dark:text-red-400">{fn(data.returnCount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, rank }: { product: ProductProfit; rank: number }) {
  const isPositive = product.profit >= 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
        rank === 1 ? "bg-amber-500 text-black" : rank === 2 ? "bg-zinc-400 text-black" : rank === 3 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
      }`}>{rank}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs truncate">{product.name}</p>
        <p className="text-[9px] text-muted-foreground">{fn(product.quantity)} وحدة • {product.returnRate}% مرتجع</p>
      </div>
      <div className="text-left shrink-0">
        <p className={`text-xs font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{fc(product.profit)}</p>
        <p className="text-[9px] text-muted-foreground">{product.margin}% هامش</p>
      </div>
      {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />}
    </div>
  );
}

// ─── Financial Row ─────────────────────────────────────────────────────────────
function FinRow({ label, value, color = "text-foreground", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-bold ${color}`}>{value}</span>
        {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── PWA Install Banner ───────────────────────────────────────────────────────
function PwaInstallBanner() {
  const { canInstall, isInstalled, install, dismiss, isDismissed } = usePwaInstall();

  if (!canInstall || isInstalled || isDismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3"
         style={{ background: "linear-gradient(135deg, #c9971c0d 0%, #f0b4290a 100%)" }}>
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-amber-500/30">
        <img src="./logo.jpg" alt="CAPRINA" className="w-full h-full object-cover" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-foreground leading-tight">ثبّت التطبيق على جهازك</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
          تجربة أسرع كتطبيق أصلي بدون متصفح — يعمل على أي جهاز
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={dismiss}
          className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/20 transition-colors"
        >
          لاحقاً
        </button>
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <span>⬇</span>
          تثبيت
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { isAdmin, canViewFinancials } = useAuth();
  const { data: summary } = useGetOrdersSummary();
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders();
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 60000 });
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["analytics-profit"],
    queryFn: analyticsApi.profit,
    staleTime: 30000,
    enabled: canViewFinancials,
  });
  const { data: fin, isLoading: isFinLoading } = useQuery({
    queryKey: ["analytics-financial"],
    queryFn: analyticsApi.financialSummary,
    staleTime: 30000,
    enabled: canViewFinancials,
  });
  const { data: alertsData } = useQuery({
    queryKey: ["analytics-alerts"],
    queryFn: analyticsApi.alerts,
    staleTime: 30000,
  });
  const { data: smartData } = useQuery({
    queryKey: ["smart-insights"],
    queryFn: analyticsApi.smartInsights,
    staleTime: 60000,
  });

  const highAlerts = alertsData?.alerts.filter(a => a.severity === "high") ?? [];
  const allAlerts = alertsData?.alerts ?? [];

  const lowStockProducts = products?.filter(p =>
    (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold
  ) ?? [];

  const hasCostData = fin && (fin.cashIn > 0 || fin.inventoryAtCost > 0);
  const noCostWarning = fin && fin.cashIn > 0 && fin.costOfGoods === 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">لوحة المالية</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">CAPRINA — Financial Engine Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/smart">
            <button className="flex items-center gap-1.5 border border-primary/30 text-primary hover:bg-primary/5 px-3 py-2 rounded-md text-xs font-bold transition-colors">
              <Brain className="w-3.5 h-3.5" />ذكاء
            </button>
          </Link>
          <Link href="/orders/new">
            <button className="flex items-center gap-2 bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />طلب جديد
            </button>
          </Link>
        </div>
      </div>

      {/* === NO COST DATA WARNING (admin only) === */}
      {canViewFinancials && noCostWarning && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">تحذير: بيانات التكلفة غير مكتملة</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              بعض المنتجات ليس لها سعر تكلفة. أضف costPrice للمنتجات لتفعيل الحساب المالي الدقيق.
            </p>
          </div>
          <Link href="/inventory" className="text-xs text-primary hover:underline shrink-0 self-center">المخزون</Link>
        </div>
      )}

      {/* === FINANCIAL OVERVIEW BANNER (admin only) === */}
      {canViewFinancials && fin && (
        <div className={`rounded-xl border overflow-hidden ${fin.netProfit >= 0 ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/5" : "border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-900/5"}`}>
          <div className="p-4">
            {/* Main profit */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">صافي الربح الحقيقي</p>
                <div className="flex items-baseline gap-3">
                  <p className={`text-4xl font-black ${fin.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(fin.netProfit)}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className={`text-[9px] font-bold border ${
                      fin.netMargin >= 20 ? "border-emerald-500 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" : fin.netMargin >= 10 ? "border-amber-500 text-amber-700 dark:border-amber-700 dark:text-amber-400" : "border-red-500 text-red-700 dark:border-red-700 dark:text-red-400"
                    }`}>{fin.netMargin}% هامش صافي</Badge>
                    <Badge variant="outline" className="text-[9px] font-bold border border-border text-muted-foreground">
                      {fin.returnRate}% مرتجع
                    </Badge>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">بعد خصم التكلفة والشحن والمرتجعات</p>
              </div>
              {fin.pendingRevenue > 0 && (
                <div className="text-left bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                  <p className="text-[9px] text-muted-foreground">في الطريق (قيد التسليم)</p>
                  <p className="text-lg font-black text-primary">{fc(fin.pendingRevenue)}</p>
                  <p className="text-[9px] text-muted-foreground">إيرادات محتملة</p>
                </div>
              )}
            </div>

            {/* Cash flow grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-background/30 rounded-lg border border-border/40">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[9px] font-bold text-muted-foreground">إجمالي المقبوض</p>
                </div>
                <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{fc(fin.cashIn)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ArrowDownRight className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  <p className="text-[9px] font-bold text-muted-foreground">تكلفة البضاعة</p>
                </div>
                <p className="font-black text-amber-700 dark:text-amber-400 text-sm">{fc(fin.costOfGoods)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ArrowDownRight className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <p className="text-[9px] font-bold text-muted-foreground">تكلفة الشحن</p>
                </div>
                <p className="font-black text-orange-600 dark:text-orange-400 text-sm">{fc(fin.shippingSpend)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ArrowDownRight className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <p className="text-[9px] font-bold text-muted-foreground">خسائر المرتجعات</p>
                </div>
                <p className="font-black text-red-600 dark:text-red-400 text-sm">{fc(fin.returnLoss)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SMART ALERTS === */}
      {allAlerts.length > 0 && (
        <div className="space-y-1.5">
          {/* High-severity alerts shown inline */}
          {highAlerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">{alert.title}</p>
                <p className="text-[11px] text-red-600/70 dark:text-red-400/70 truncate">{alert.detail}</p>
              </div>
              {alert.type === "LOW_STOCK" && (
                <Link href="/inventory" className="text-xs text-primary hover:underline shrink-0">إدارة</Link>
              )}
              {(alert.type === "HIGH_RETURN" || alert.type === "LOSING_PRODUCT") && (
                <Link href="/product-performance" className="text-xs text-primary hover:underline shrink-0">تحليل</Link>
              )}
            </div>
          ))}
          {/* Summary row for medium/low alerts */}
          {alertsData && alertsData.counts.total > highAlerts.length && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-lg p-2.5">
              <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 flex-1">
                {alertsData.counts.medium > 0 && `${alertsData.counts.medium} تنبيه متوسط`}
                {alertsData.counts.medium > 0 && alertsData.counts.low > 0 && " • "}
                {alertsData.counts.low > 0 && `${alertsData.counts.low} تنبيه منخفض`}
              </p>
              <Link href="/product-performance" className="text-xs text-primary hover:underline shrink-0">عرض الكل ←</Link>
            </div>
          )}
        </div>
      )}

      {/* === PERIOD CARDS (admin only) === */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isAnalyticsLoading ? (
            [1,2,3].map(i => <Card key={i} className="animate-pulse h-36 border-border" />)
          ) : analytics ? (
            <>
              <PeriodCard label="اليوم" data={analytics.today} accent="text-primary" />
              <PeriodCard label="هذا الأسبوع" data={analytics.week} accent="text-emerald-600 dark:text-emerald-400" />
              <PeriodCard label="هذا الشهر" data={analytics.month} accent="text-amber-700 dark:text-amber-400" />
            </>
          ) : null}
        </div>
      )}

      {/* === PWA INSTALL BANNER === */}
      <PwaInstallBanner />

      {/* === VISUAL CHARTS === */}
      <ChartsSection />

      {/* === SMART QUICK INSIGHTS === */}
      {smartData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Best platform */}
          <Link href="/smart">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold">أفضل منصة</p>
                {smartData.adAttribution.bestSource ? (
                  <>
                    <p className="text-xs font-black truncate">
                      {smartData.adAttribution.bestSource.source === "facebook" ? "📘 فيسبوك" :
                       smartData.adAttribution.bestSource.source === "tiktok" ? "🎵 تيك توك" :
                       smartData.adAttribution.bestSource.source === "instagram" ? "📷 إنستجرام" :
                       smartData.adAttribution.bestSource.source === "whatsapp" ? "💬 واتساب" :
                       smartData.adAttribution.bestSource.source === "organic" ? "🌱 عضوي" : "📌 أخرى"}
                    </p>
                    {canViewFinancials && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(smartData.adAttribution.bestSource.profit)}
                      </p>
                    )}
                  </>
                ) : <p className="text-xs text-muted-foreground">لا بيانات</p>}
              </div>
            </div>
          </Link>

          {/* Stars & Dead Stock */}
          <Link href="/smart">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold">نجوم / راكد</p>
                <p className="text-xs font-black">{smartData.stars.length} نجوم</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{smartData.deadStock.length} منتج راكد</p>
              </div>
            </div>
          </Link>

          {/* Return alert */}
          <Link href="/smart">
            <div className={`flex items-center gap-2.5 p-3 rounded-xl border bg-card hover:bg-primary/5 transition-colors cursor-pointer ${
              smartData.returnInsights.highReturnProducts.length > 0 ? "border-red-300 dark:border-red-800" : "border-border"
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                smartData.returnInsights.highReturnProducts.length > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
              }`}>
                <Archive className={`w-4 h-4 ${smartData.returnInsights.highReturnProducts.length > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold">المرتجعات</p>
                <p className="text-xs font-black">{smartData.returnInsights.totalReturnRate}% معدل</p>
                {smartData.returnInsights.highReturnProducts.length > 0 ? (
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-bold">⚠️ {smartData.returnInsights.highReturnProducts.length} تجاوز 50%</p>
                ) : (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">تحت السيطرة</p>
                )}
              </div>
            </div>
          </Link>

          {/* Stock predictor */}
          <Link href="/smart">
            <div className={`flex items-center gap-2.5 p-3 rounded-xl border bg-card hover:bg-primary/5 transition-colors cursor-pointer ${
              smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "border-red-300 dark:border-red-800" : "border-border"
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "bg-red-100 dark:bg-red-900/30" : "bg-sky-100 dark:bg-sky-900/20"
              }`}>
                <Clock className={`w-4 h-4 ${smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold">سينفد قريباً</p>
                <p className="text-xs font-black">{smartData.stockPredictor.length} منتج</p>
                {smartData.stockPredictor.length > 0 && (
                  <p className={`text-[10px] font-bold ${smartData.stockPredictor.some(i => (i.daysUntilStockout ?? 99) <= 3) ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"}`}>
                    🚨 خلال 14 يوم
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* === MAIN GRID === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Products + Recent Orders */}
        <div className="lg:col-span-2 space-y-4">

          {/* Top products by profit (admin only) */}
          {canViewFinancials && (
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  أفضل المنتجات ربحاً
                  <span className="text-[10px] text-muted-foreground font-normal mr-auto">مرتبة بصافي الربح</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 px-4">
                {isAnalyticsLoading ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">جاري التحميل...</div>
                ) : analytics?.topProducts?.length ? (
                  analytics.topProducts.map((p, i) => <ProductRow key={p.name} product={p} rank={i + 1} />)
                ) : (
                  <div className="py-6 text-center text-muted-foreground text-xs">
                    <Star className="w-6 h-6 mx-auto mb-2 opacity-20" />
                    أضف بيانات التكلفة للمنتجات لتفعيل هذا القسم
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Losing products (admin only) */}
          {canViewFinancials && analytics?.losingProducts && analytics.losingProducts.length > 0 && (
            <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/5">
              <CardHeader className="py-3 px-4 border-b border-red-200 dark:border-red-900/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  منتجات ذات نسبة إرجاع مرتفعة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 px-4">
                {analytics.losingProducts.map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-2 border-b border-red-100 dark:border-red-900/20 last:border-0 text-xs">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-muted-foreground">{p.orderCount} طلب • {p.returnCount} مرتجع</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <Badge variant="outline" className="border-red-400 text-red-600 dark:border-red-800 dark:text-red-400 text-[10px] block mb-1">{p.returnRate}% مرتجع</Badge>
                        <p className="text-red-600 dark:text-red-400 font-bold text-[10px]">{fc(p.profit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent orders */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />آخر الطلبات
                </CardTitle>
                <Link href="/orders" className="text-xs text-primary hover:underline">عرض الكل ←</Link>
              </div>
            </CardHeader>
            {isRecentLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">جاري التحميل...</div>
            ) : recentOrders?.length ? (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-xs shrink-0">
                        {order.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">#{order.id.toString().padStart(4,"0")} • {order.product}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-xs text-primary">{fc(order.totalPrice)}</span>
                      <Badge variant="outline" className={`text-[9px] font-bold border ${STATUS_CLASSES[order.status] || ""}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">لا توجد طلبات</p>
                <Link href="/orders/new" className="text-primary text-xs mt-1 inline-block">أنشئ أول طلب</Link>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* Quick actions */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold">إجراءات سريعة</h2>
            <Link href="/orders/new" className="w-full flex items-center gap-2 bg-primary text-primary-foreground py-2.5 px-4 rounded-md text-sm font-bold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />إضافة طلب
            </Link>
            <Link href="/inventory" className="w-full flex items-center gap-2 border border-border bg-card text-foreground hover:bg-muted/30 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <Boxes className="w-4 h-4" />إدارة المخزون
            </Link>
            <Link href="/import" className="w-full flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />استيراد Excel
            </Link>
          </div>

          {/* Inventory financial value (admin only) */}
          {canViewFinancials && fin && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Boxes className="w-3 h-3" />قيمة المخزون
                </p>
                <FinRow label="بسعر التكلفة" value={fc(fin.inventoryAtCost)} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="بسعر البيع" value={fc(fin.inventoryAtSell)} color="text-primary" />
                <div className="mt-1 pt-2 border-t border-border flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">الربح المحتمل</span>
                  <span className={`text-xs font-black ${fin.potentialInventoryProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(fin.potentialInventoryProfit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full financial breakdown (admin only) */}
          {canViewFinancials && fin && (
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3 h-3" />التدفق النقدي الكلي
                </p>
                <FinRow label="إجمالي المقبوض" value={fc(fin.cashIn)} color="text-emerald-600 dark:text-emerald-400" />
                <FinRow label="تكلفة البضاعة" value={`(${fc(fin.costOfGoods)})`} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="تكلفة الشحن" value={`(${fc(fin.shippingSpend)})`} color="text-orange-600 dark:text-orange-400" />
                <FinRow label="خسائر المرتجعات" value={`(${fc(fin.returnLoss)})`} color="text-red-600 dark:text-red-400" sub={`${fin.returnCount} طلب مرتجع`} />
                <div className={`mt-2 pt-2 border-t-2 flex justify-between items-center ${fin.netProfit >= 0 ? "border-emerald-500 dark:border-emerald-800" : "border-red-500 dark:border-red-800"}`}>
                  <span className="text-sm font-bold">صافي الربح</span>
                  <span className={`text-sm font-black ${fin.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(fin.netProfit)}
                  </span>
                </div>
                {fin.grossMargin > 0 && (
                  <p className="text-[9px] text-muted-foreground text-center mt-2">
                    هامش إجمالي: {fin.grossMargin}% • هامش صافي: {fin.netMargin}%
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order status summary */}
          {summary && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShoppingCart className="w-3 h-3" />ملخص الطلبات
                </p>
                {[
                  { label: "قيد الانتظار", val: summary.pendingOrders, color: "text-amber-700 dark:text-amber-400" },
                  { label: "قيد الشحن", val: summary.shippingOrders ?? 0, color: "text-sky-600 dark:text-sky-400" },
                  { label: "استلم", val: summary.receivedOrders, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "مؤجل", val: summary.delayedOrders ?? 0, color: "text-blue-600 dark:text-blue-400" },
                  { label: "مرتجع", val: summary.returnedOrders ?? 0, color: "text-red-600 dark:text-red-400" },
                  { label: "استلم جزئي", val: summary.partialOrders ?? 0, color: "text-purple-600 dark:text-purple-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-bold ${color}`}>{val}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground font-bold">الإجمالي</span>
                  <span className="font-bold">{summary.totalOrders}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order metrics (admin only) */}
          {canViewFinancials && fin && fin.completedOrders > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />مقاييس الطلبات
                </p>
                <FinRow label="متوسط ربح الطلب" value={fc(fin.avgProfitPerOrder)} color={fin.avgProfitPerOrder >= 0 ? "text-primary" : "text-red-600 dark:text-red-400"} />
                <FinRow label="متوسط قيمة الطلب" value={fc(fin.avgOrderValue)} color="text-foreground" />
                <FinRow label="متوسط تكلفة الطلب" value={fc(fin.avgCostPerOrder)} color="text-amber-700 dark:text-amber-400" />
                <FinRow label="نسبة الإرجاع الكلية" value={`${fin.returnRate}%`} color={fin.returnRate >= 20 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"} />
              </CardContent>
            </Card>
          )}

          {/* Smart alerts detail */}
          {allAlerts.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Bell className="w-3 h-3" />التنبيهات الذكية
                  </p>
                  <Badge variant="outline" className={`text-[9px] ${alertsData?.counts.high ? "border-red-400 text-red-600 dark:border-red-800 dark:text-red-400" : "border-amber-400 text-amber-700 dark:border-amber-800 dark:text-amber-400"}`}>
                    {alertsData?.counts.total}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {allAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="flex items-start gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        alert.severity === "high" ? "bg-red-500" : alert.severity === "medium" ? "bg-amber-500" : "bg-muted-foreground"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-foreground truncate">{alert.title}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{alert.detail}</p>
                      </div>
                    </div>
                  ))}
                  {allAlerts.length > 5 && (
                    <Link href="/product-performance" className="text-[10px] text-primary hover:underline block text-center mt-1">
                      +{allAlerts.length - 5} تنبيه آخر
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Return loss detail (admin only) */}
          {canViewFinancials && fin && fin.returnRevLost > 0 && (
            <Card className="border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/5">
              <CardContent className="p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-500/70 dark:text-red-400/60 mb-3 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />تأثير المرتجعات
                </p>
                <FinRow
                  label="إيرادات فُقدت"
                  value={fc(fin.returnRevLost)}
                  color="text-red-600 dark:text-red-400"
                  sub="بيع كان مخطط"
                />
                <FinRow
                  label="تكلفة محملة"
                  value={fc(fin.returnLoss)}
                  color="text-red-600 dark:text-red-400"
                  sub="شحن + بضاعة"
                />
                <div className="mt-2 text-center">
                  <p className="text-xs font-black text-red-600 dark:text-red-400">{fin.returnRate}% نسبة الإرجاع</p>
                  <p className="text-[9px] text-muted-foreground">{fin.returnCount} من {fin.totalOrders} طلب</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
