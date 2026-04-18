import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertTriangle, Phone, Package, Truck, Link2, RefreshCw, Hash } from "lucide-react";
import { analyticsApi, ordersApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useState } from "react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function urgencyColor(days: number) {
  if (days >= 10) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
  if (days >= 7)  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800";
  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
}

function urgencyLabel(days: number) {
  if (days >= 10) return "عاجل جداً";
  if (days >= 7)  return "عاجل";
  return "متأخر";
}

export default function ShippingFollowupPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["shipping-followup"],
    queryFn: analyticsApi.shippingFollowup,
    staleTime: 2 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const critical = orders.filter(o => o.daysPending >= 10);
  const urgent   = orders.filter(o => o.daysPending >= 7 && o.daysPending < 10);
  const late     = orders.filter(o => o.daysPending >= 3 && o.daysPending < 7);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">متابعة الشحن</h1>
          <p className="text-sm text-muted-foreground">طلبات قيد الشحن منذ أكثر من 3 أيام</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <Badge variant="outline">{orders.length} طلب</Badge>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Summary Tiles */}
      {!isLoading && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{critical.length}</div>
            <div className="text-xs text-red-700 dark:text-red-300 mt-1">عاجل جداً (+10 أيام)</div>
          </div>
          <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{urgent.length}</div>
            <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">عاجل (7-10 أيام)</div>
          </div>
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{late.length}</div>
            <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">متأخر (3-7 أيام)</div>
          </div>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
          <Truck className="h-8 w-8 animate-bounce" />
          <p className="text-sm">جاري التحميل...</p>
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <div className="text-4xl">✅</div>
            <p className="font-medium">كل الشحنات في الوقت المناسب!</p>
            <p className="text-sm text-center">لا توجد طلبات شحن متأخرة أكثر من 3 أيام</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o: any) => (
            <div
              key={o.id}
              className={`rounded-xl border p-4 space-y-3 ${urgencyColor(o.daysPending)}`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-60">#{o.id}</span>
                  <Badge
                    variant="outline"
                    className="text-xs border-current"
                  >
                    {urgencyLabel(o.daysPending)} — {o.daysPending} يوم
                  </Badge>
                </div>
                <Link href={`/orders/${o.id}`}>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-current bg-white/50 dark:bg-black/20">
                    <Link2 className="h-3 w-3" />
                    فتح الطلب
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{o.customerName}</div>
                    {o.city && <div className="text-xs opacity-70">{o.city}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <a href={`tel:${o.phone}`} className="text-sm hover:underline truncate">{o.phone || "—"}</a>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="text-sm truncate">{o.shippingCompany ?? "—"}</span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="text-sm font-mono truncate">{o.trackingNumber || <span className="opacity-50">لا يوجد تتبع</span>}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs opacity-70 pt-1 border-t border-current/20">
                <span>{o.product}</span>
                <span className="font-medium">{formatCurrency(o.totalPrice)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>تأكد من متابعة هذه الشحنات مع شركات الشحن وتحديث أرقام التتبع في الطلبات.</p>
        </div>
      )}
    </div>
  );
}
