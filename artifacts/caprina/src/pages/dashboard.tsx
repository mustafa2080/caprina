import { useGetOrdersSummary, useGetRecentOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, Truck, CheckCircle2, TrendingUp, Plus } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "جاري التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  processing: "bg-blue-50 text-blue-800 border-blue-200",
  shipped: "bg-purple-50 text-purple-800 border-purple-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-50 text-red-800 border-red-200",
};

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetOrdersSummary();
  const { data: recentOrders, isLoading: isRecentLoading } = useGetRecentOrders();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1 text-sm">مرحباً — إليك ملخص المبيعات اليوم.</p>
      </div>

      {isSummaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-1/2"></div></CardHeader>
              <CardContent><div className="h-8 bg-muted rounded w-3/4"></div></CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المبيعات</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(summary.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">منذ البداية</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">قيد الانتظار</CardTitle>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">تحتاج إجراء</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">جاري التجهيز</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.processingOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">قيد التنفيذ</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">تم التسليم</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.deliveredOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">مكتمل</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">آخر الطلبات</h2>
            <Link href="/orders" className="text-sm text-primary hover:underline font-medium">عرض الكل</Link>
          </div>

          <Card className="shadow-sm overflow-hidden">
            {isRecentLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">جاري التحميل...</div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background font-bold text-sm shrink-0">
                        {order.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{order.customerName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>#{order.id.toString().padStart(4, "0")}</span>
                          <span>•</span>
                          <span>{order.product}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-bold text-sm text-primary">{formatCurrency(order.totalPrice)}</span>
                      <Badge variant="outline" className={`text-[10px] font-semibold border ${statusColors[order.status] || ""}`}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>لا توجد طلبات بعد.</p>
                <Link href="/orders/new" className="text-primary hover:underline mt-2 inline-block text-sm">أنشئ أول طلب</Link>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">إجراءات سريعة</h2>
          <Card className="shadow-sm">
            <div className="p-4 flex flex-col gap-3">
              <Link href="/orders/new" className="w-full flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 transition-colors py-3 px-4 rounded-md text-sm font-bold shadow-sm">
                <Plus className="w-4 h-4" />
                إضافة طلب جديد
              </Link>
              <Link href="/orders?status=pending" className="w-full flex items-center justify-center gap-2 border border-border bg-background text-foreground hover:bg-muted transition-colors py-3 px-4 rounded-md text-sm font-semibold">
                <Clock className="w-4 h-4" />
                عرض قيد الانتظار
              </Link>
              <Link href="/orders" className="w-full flex items-center justify-center gap-2 border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors py-3 px-4 rounded-md text-sm font-semibold">
                <Truck className="w-4 h-4" />
                كل الطلبات
              </Link>
            </div>
          </Card>

          {summary && (
            <Card className="shadow-sm bg-foreground text-background">
              <CardContent className="p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-background/50">ملخص الحالة</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-background/70">إجمالي الطلبات</span>
                    <span className="font-bold">{summary.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-background/70">تم الشحن</span>
                    <span className="font-bold">{summary.shippedOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-background/70">ملغي</span>
                    <span className="font-bold">{summary.cancelledOrders}</span>
                  </div>
                  <div className="border-t border-background/20 pt-2 flex justify-between">
                    <span className="text-background/70 font-semibold">الإيرادات</span>
                    <span className="font-bold text-primary">{formatCurrency(summary.totalRevenue)}</span>
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
