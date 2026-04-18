import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { manifestsApi, type ShippingManifestDetail } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRight, Truck, Package, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, RotateCcw, Clock, Printer, Lock, Unlock, Trash2 } from "lucide-react";
import { format } from "date-fns";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_shipping: "قيد الشحن",
  received: "استلم ✓",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending: "border-amber-700 bg-amber-900/20 text-amber-400",
  in_shipping: "border-blue-700 bg-blue-900/20 text-blue-400",
  received: "border-emerald-700 bg-emerald-900/20 text-emerald-400",
  delayed: "border-orange-700 bg-orange-900/20 text-orange-400",
  returned: "border-red-700 bg-red-900/20 text-red-400",
  partial_received: "border-teal-700 bg-teal-900/20 text-teal-400",
};

export default function ShippingManifestPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: manifest, isLoading, error } = useQuery({
    queryKey: ["shipping-manifest", id],
    queryFn: () => manifestsApi.get(id),
    enabled: !isNaN(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status: "open" | "closed" }) => manifestsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-manifest", id] });
      queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
      toast({ title: "تم التحديث" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => manifestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-manifests"] });
      toast({ title: "تم الحذف" });
      window.history.back();
    },
    onError: () => toast({ title: "خطأ", description: "فشل حذف البيان", variant: "destructive" }),
  });

  const handlePrint = () => window.print();

  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">جاري التحميل...</div>;
  if (error || !manifest) return (
    <div className="p-12 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
      <h2 className="text-lg font-bold mb-2">البيان غير موجود</h2>
      <Link href="/shipping"><Button variant="outline" className="mt-3">العودة لشركات الشحن</Button></Link>
    </div>
  );

  const s = manifest.stats;

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-500" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/shipping">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{manifest.manifestNumber}</h1>
              <Badge variant="outline" className={`text-[10px] font-bold border ${manifest.status === "open" ? "border-blue-700 bg-blue-900/20 text-blue-400" : "border-emerald-700 bg-emerald-900/20 text-emerald-400"}`}>
                {manifest.status === "open" ? "مفتوح" : "مغلق"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Truck className="w-3 h-3" />{manifest.companyName}
              </p>
              <p className="text-xs text-muted-foreground">{format(new Date(manifest.createdAt), "yyyy/MM/dd")}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-border" onClick={handlePrint}>
            <Printer className="w-3 h-3" />طباعة
          </Button>
          {manifest.status === "open" ? (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-emerald-800 text-emerald-400 hover:bg-emerald-900/20" onClick={() => updateMutation.mutate({ status: "closed" })} disabled={updateMutation.isPending}>
              <Lock className="w-3 h-3" />إغلاق البيان
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-amber-800 text-amber-400 hover:bg-amber-900/20" onClick={() => updateMutation.mutate({ status: "open" })} disabled={updateMutation.isPending}>
              <Unlock className="w-3 h-3" />فتح البيان
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-3 h-3" />حذف
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الطلبيات</p>
          <p className="text-2xl font-black">{s.total}</p>
        </Card>
        <Card className="border-emerald-900/50 bg-emerald-900/10 p-4">
          <p className="text-xs text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />مُسلَّم</p>
          <p className="text-2xl font-black text-emerald-400">{s.delivered}</p>
          <p className="text-xs text-emerald-600 mt-0.5 font-bold">{s.deliveryRate}% نسبة التسليم</p>
        </Card>
        <Card className="border-red-900/50 bg-red-900/10 p-4">
          <p className="text-xs text-red-400 mb-1 flex items-center gap-1"><RotateCcw className="w-3 h-3" />مُرتجَع</p>
          <p className="text-2xl font-black text-red-400">{s.returned}</p>
          <p className="text-xs text-red-600 mt-0.5 font-bold">
            {s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0}% نسبة الإرجاع
          </p>
        </Card>
        <Card className="border-amber-900/50 bg-amber-900/10 p-4">
          <p className="text-xs text-amber-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />معلّق</p>
          <p className="text-2xl font-black text-amber-400">{s.pending}</p>
          <p className="text-xs text-amber-600 mt-0.5 font-bold">
            {s.total > 0 ? Math.round((s.pending / s.total) * 100) : 0}% من الإجمالي
          </p>
        </Card>
      </div>

      {/* Delivery Rate Bar */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">نسبة التسليم الكلية</p>
          <p className={`text-xl font-black ${s.deliveryRate >= 70 ? "text-emerald-400" : s.deliveryRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
            {s.deliveryRate}%
          </p>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${s.deliveryRate >= 70 ? "bg-emerald-500" : s.deliveryRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${s.deliveryRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>مُسلَّم: {s.delivered} طلب</span>
          <span>مُرتجَع: {s.returned} طلب</span>
          <span>معلّق: {s.pending} طلب</span>
        </div>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
          <p className="text-lg font-black text-emerald-400">{formatCurrency(s.totalRevenue)}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">تكلفة الشحن</p>
          <p className="text-lg font-black text-amber-400">{formatCurrency(s.totalShippingCost)}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">خسائر الإرجاع</p>
          <p className="text-lg font-black text-red-400">{formatCurrency(s.returnLosses)}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">تكلفة البضاعة</p>
          <p className="text-lg font-black">{formatCurrency(s.totalCost)}</p>
        </Card>
        <Card className={`col-span-2 p-4 border ${s.netProfit >= 0 ? "border-emerald-900/50 bg-emerald-900/10" : "border-red-900/50 bg-red-900/10"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs mb-1 font-bold ${s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {s.netProfit >= 0 ? "صافي الربح" : "صافي الخسارة"}
              </p>
              <p className={`text-2xl font-black ${s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(Math.abs(s.netProfit))}
              </p>
            </div>
            {s.netProfit >= 0
              ? <TrendingUp className="w-10 h-10 text-emerald-400 opacity-30" />
              : <TrendingDown className="w-10 h-10 text-red-400 opacity-30" />}
          </div>
          {s.totalRevenue > 0 && (
            <p className={`text-xs mt-2 font-bold ${s.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              هامش الربح: {Math.round((s.netProfit / s.totalRevenue) * 100)}%
            </p>
          )}
        </Card>
      </div>

      {/* Orders Table */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            الطلبيات في البيان
            <Badge variant="outline" className="text-[9px]">{manifest.orders.length}</Badge>
          </h2>
        </div>
        {manifest.orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">لا توجد طلبيات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">#</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">العميل</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">المنتج</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">الكمية</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">الإجمالي</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5">الحالة</th>
                  <th className="text-right font-semibold text-muted-foreground px-3 py-2.5 print:hidden">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {manifest.orders.map((order, idx) => (
                  <tr key={order.id} className={`border-b border-border/50 hover:bg-muted/10 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {order.id.toString().padStart(4, "0")}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{order.customerName}</p>
                      {order.phone && <p className="text-muted-foreground text-[10px]">{order.phone}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p>{order.product}</p>
                      {(order.color || order.size) && (
                        <p className="text-muted-foreground text-[10px]">
                          {[order.color, order.size].filter(Boolean).join(" / ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {order.status === "partial_received" && order.partialQuantity
                        ? <><span className="text-teal-400 font-bold">{order.partialQuantity}</span><span className="text-muted-foreground">/{order.quantity}</span></>
                        : order.quantity
                      }
                    </td>
                    <td className="px-3 py-2.5 font-bold">
                      {formatCurrency(order.totalPrice)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 print:hidden">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-primary hover:text-primary">عرض</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف البيان</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف بيان الشحن {manifest.manifestNumber}؟ لن يتم حذف الطلبيات المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
