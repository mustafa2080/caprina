import { useQuery } from "@tanstack/react-query";
import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, DollarSign, Package, AlertCircle,
  Plus, RotateCcw, Layers, Star, Activity, Boxes,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { productsApi, ordersApi, analyticsApi, type PeriodProfit, type ProductProfit } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const fn = (n: number) => new Intl.NumberFormat("ar-EG").format(Math.round(n));

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار", in_shipping: "قيد الشحن", received: "استلم",
  delayed: "مؤجل", returned: "مرتجع", partial_received: "استلم جزئي",
};
const statusClasses: Record<string, string> = {
  pending: "bg-amber-900/30 text-amber-400 border-amber-800",
  in_shipping: "bg-sky-900/30 text-sky-400 border-sky-800",
  received: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  delayed: "bg-blue-900/30 text-blue-400 border-blue-800",
  returned: "bg-red-900/30 text-red-400 border-red-800",
  partial_received: "bg-purple-900/30 text-purple-400 border-purple-800",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProfitCard({ label, data, accent }: { label: string; data: PeriodProfit; accent: string }) {
  const isProfit = data.netProfit >= 0;
  return (
    <Card className={`border-border bg-card overflow-hidden`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <Badge variant="outline" className={`text-[9px] font-bold border ${
            data.returnRate > 20 ? "border-red-800 text-red-400" : "border-border text-muted-foreground"
          }`}>
            {data.returnRate}% مرتجع
          </Badge>
        </div>

        <div>
          <p className={`text-2xl font-black ${isProfit ? accent : "text-red-400"}`}>{fc(data.netProfit)}</p>
          <p className="text-[10px] text-muted-foreground">صافي الربح</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
          <div>
            <p className="text-[9px] text-muted-foreground">الإيرادات</p>
            <p className="text-xs font-bold text-primary">{fc(data.revenue)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">التكلفة الكلية</p>
            <p className="text-xs font-bold text-amber-400">{fc(data.cost + data.shippingCost)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">الطلبات</p>
            <p className="text-xs font-bold">{fn(data.orders)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">المرتجعات</p>
            <p className="text-xs font-bold text-red-400">{fn(data.returnCount)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
        <p className={`text-xs font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{fc(product.profit)}</p>
        <p className="text-[9px] text-muted-foreground">{product.margin}% هامش</p>
      </div>
      {isPositive
        ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        : <ArrowDownRight className="w-3.5 h-3.5 text-red-400 shrink-0" />
      }
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary } = useGetOrdersSummary();
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders();
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 60000 });
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["analytics-profit"],
    queryFn: analyticsApi.profit,
    staleTime: 30000,
  });

  const lowStockProducts = products?.filter(p =>
    (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold
  ) ?? [];

  const allTimeProfit = analytics?.allTime;
  const margin = allTimeProfit && allTimeProfit.revenue > 0
    ? Math.round((allTimeProfit.netProfit / allTimeProfit.revenue) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة الأرباح</h1>
          <p className="text-muted-foreground text-sm mt-0.5">CAPRINA — Profit Engine Dashboard</p>
        </div>
        <Link href="/orders/new">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />طلب جديد
          </button>
        </Link>
      </div>

      {/* === ALL-TIME PROFIT BAR === */}
      {allTimeProfit && (
        <Card className={`border ${allTimeProfit.netProfit >= 0 ? "border-emerald-800 bg-emerald-900/10" : "border-red-800 bg-red-900/10"} overflow-hidden`}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">إجمالي الأرباح الكلية</p>
                <div className="flex items-baseline gap-3">
                  <p className={`text-4xl font-black ${allTimeProfit.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fc(allTimeProfit.netProfit)}
                  </p>
                  <Badge variant="outline" className={`text-xs border ${margin >= 20 ? "border-emerald-700 text-emerald-400" : margin >= 10 ? "border-amber-700 text-amber-400" : "border-red-700 text-red-400"}`}>
                    {margin}% هامش
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">إجمالي الإيرادات</p>
                  <p className="font-bold text-primary">{fc(allTimeProfit.revenue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">إجمالي التكلفة</p>
                  <p className="font-bold text-amber-400">{fc(allTimeProfit.cost)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">تكلفة الشحن</p>
                  <p className="font-bold text-orange-400">{fc(allTimeProfit.shippingCost)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground">نسبة المرتجعات</p>
                  <p className={`font-bold ${allTimeProfit.returnRate > 20 ? "text-red-400" : "text-muted-foreground"}`}>
                    {allTimeProfit.returnRate}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === PERIOD PROFIT CARDS === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isAnalyticsLoading ? (
          [1,2,3].map(i => <Card key={i} className="animate-pulse h-36 border-border" />)
        ) : analytics ? (
          <>
            <ProfitCard label="اليوم" data={analytics.today} accent="text-primary" />
            <ProfitCard label="هذا الأسبوع" data={analytics.week} accent="text-emerald-400" />
            <ProfitCard label="هذا الشهر" data={analytics.month} accent="text-amber-400" />
          </>
        ) : null}
      </div>

      {/* === LOW STOCK ALERT === */}
      {lowStockProducts.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-400">تنبيه: مخزون منخفض</p>
            <p className="text-xs text-amber-400/70 mt-0.5">{lowStockProducts.map(p => p.name).join("، ")}</p>
          </div>
          <Link href="/inventory" className="text-xs text-primary hover:underline shrink-0 self-center">إدارة المخزون</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* TOP PRODUCTS + LOSING PRODUCTS */}
        <div className="lg:col-span-2 space-y-4">

          {/* Top products by profit */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                أفضل المنتجات ربحاً
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
                  لم يتم تسجيل بيانات تكلفة بعد
                </div>
              )}
            </CardContent>
          </Card>

          {/* Losing products */}
          {analytics?.losingProducts && analytics.losingProducts.length > 0 && (
            <Card className="border-red-900/40 bg-red-900/5">
              <CardHeader className="py-3 px-4 border-b border-red-900/30">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  منتجات خاسرة (نسبة إرجاع مرتفعة)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 px-4">
                {analytics.losingProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between py-2 border-b border-red-900/20 last:border-0 text-xs">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-muted-foreground">{p.orderCount} طلب • {p.returnCount} مرتجع</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="border-red-800 text-red-400 text-[10px]">{p.returnRate}% مرتجع</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Orders */}
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
                      <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                        {statusLabels[order.status] || order.status}
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
            <Link href="/movements" className="w-full flex items-center gap-2 border border-border bg-card text-foreground hover:bg-muted/30 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <Activity className="w-4 h-4" />حركات المخزون
            </Link>
            <Link href="/import" className="w-full flex items-center gap-2 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />استيراد Excel
            </Link>
          </div>

          {/* Order status summary */}
          {summary && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-3">ملخص الطلبات</p>
                {[
                  { label: "قيد الانتظار", val: summary.pendingOrders, color: "text-amber-400" },
                  { label: "قيد الشحن", val: summary.shippingOrders ?? 0, color: "text-sky-400" },
                  { label: "استلم", val: summary.receivedOrders, color: "text-emerald-400" },
                  { label: "مؤجل", val: summary.delayedOrders ?? 0, color: "text-blue-400" },
                  { label: "مرتجع", val: summary.returnedOrders ?? 0, color: "text-red-400" },
                  { label: "استلم جزئي", val: summary.partialOrders ?? 0, color: "text-purple-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-bold ${color}`}>{val}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground font-bold">الإجمالي</span>
                  <span className="font-bold">{summary.totalOrders}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inventory value */}
          {analytics?.inventoryValue && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">قيمة المخزون</p>
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-bold text-sm">{fc(analytics.inventoryValue.byProduct)}</p>
                    <p className="text-[9px] text-muted-foreground">{fn(analytics.inventoryValue.totalUnits)} وحدة متاحة</p>
                  </div>
                </div>
                {analytics.inventoryValue.lowStock?.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-900/20 rounded text-[10px] text-amber-400">
                    {analytics.inventoryValue.lowStock.length} منتج في مستوى منخفض
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
