import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, CheckCircle2, TrendingUp, Plus, RotateCcw, AlertCircle, Layers, Star, Calendar } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { productsApi, ordersApi } from "@/lib/api";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  received: "استلم",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending: "bg-amber-900/30 text-amber-400 border-amber-800",
  received: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  delayed: "bg-blue-900/30 text-blue-400 border-blue-800",
  returned: "bg-red-900/30 text-red-400 border-red-800",
  partial_received: "bg-purple-900/30 text-purple-400 border-purple-800",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(amount);

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetOrdersSummary();
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders();
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 60000 });
  const { data: stats } = useQuery({ queryKey: ["orders-stats"], queryFn: ordersApi.stats, staleTime: 30000 });

  const lowStockProducts = products?.filter(p => (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-0.5">مركز عمليات CAPRINA — WIN OR DIE</p>
        </div>
        <Link href="/orders/new">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />طلب جديد
          </button>
        </Link>
      </div>

      {/* Time-based Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">اليوم</CardTitle>
              <Calendar className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-primary">{stats.today.orders} طلب</div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(stats.today.revenue)} إيرادات</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">هذا الأسبوع</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-emerald-400">{stats.week.orders} طلب</div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(stats.week.revenue)} إيرادات</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">هذا الشهر</CardTitle>
              <Star className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-amber-400">{stats.month.orders} طلب</div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(stats.month.revenue)} إيرادات</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPI Cards */}
      {isSummaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Card key={i} className="animate-pulse h-24" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-primary">{formatCurrency(summary.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">إجمالي {summary.totalOrders} طلب</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">قيد الانتظار</CardTitle>
              <Clock className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-amber-400">{summary.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-0.5">تحتاج إجراء</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">استلم ✓</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-emerald-400">{summary.receivedOrders}</div>
              <p className="text-xs text-muted-foreground mt-0.5">مكتمل</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">مرتجع / مؤجل</CardTitle>
              <RotateCcw className="w-4 h-4 text-red-400" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl font-bold text-red-400">{(summary.returnedOrders ?? 0) + (summary.delayedOrders ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.returnedOrders} مرتجع / {summary.delayedOrders} مؤجل</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-800/40 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-400">تنبيه: مخزون منخفض</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              {lowStockProducts.map(p => p.name).join("، ")} — كميات محدودة
            </p>
          </div>
          <Link href="/inventory" className="mr-auto text-xs text-primary hover:underline shrink-0">إدارة المخزون</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">آخر الطلبات</h2>
            <Link href="/orders" className="text-xs text-primary hover:underline">عرض الكل ←</Link>
          </div>
          <Card className="border-border overflow-hidden">
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
                      <span className="font-bold text-xs text-primary">{formatCurrency(order.totalPrice)}</span>
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

        {/* Quick actions + stats */}
        <div className="space-y-4">
          <h2 className="text-base font-bold">إجراءات سريعة</h2>
          <div className="space-y-2">
            <Link href="/orders/new" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 px-4 rounded-md text-sm font-bold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />إضافة طلب
            </Link>
            <Link href="/inventory" className="w-full flex items-center justify-center gap-2 border border-border bg-card text-foreground hover:bg-muted/30 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <Layers className="w-4 h-4" />إدارة المخزون
            </Link>
            <Link href="/invoices" className="w-full flex items-center justify-center gap-2 border border-border bg-card text-foreground hover:bg-muted/30 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <Package className="w-4 h-4" />طباعة الفواتير
            </Link>
            <Link href="/import" className="w-full flex items-center justify-center gap-2 border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors py-2.5 px-4 rounded-md text-sm font-semibold">
              <TrendingUp className="w-4 h-4" />استيراد Excel
            </Link>
          </div>

          {summary && (
            <Card className="border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">ملخص الحالات</p>
                {[
                  { label: "قيد الانتظار", val: summary.pendingOrders, color: "text-amber-400" },
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
              </CardContent>
            </Card>
          )}

          {stats?.bestProduct && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">أكثر منتج مبيعاً</p>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{stats.bestProduct.name}</p>
                    <p className="text-xs text-muted-foreground">{stats.bestProduct.quantity} وحدة مجموع</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
