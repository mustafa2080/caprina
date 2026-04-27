import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowRight, AlertCircle, Printer, Trash2, RefreshCw,
  Package, Phone, MapPin, RotateCcw, Lock, MessageCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ordersApi } from "@/lib/api";
import { STATUS_LABELS as statusLabels, STATUS_CLASSES as statusClasses } from "@/lib/order-constants";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function InvoiceGroup() {
  const params = useParams<{ invoiceNumber: string }>();
  const invoiceNumber = decodeURIComponent(params.invoiceNumber ?? "");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const updateOrder = useUpdateOrder();

  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting]             = useState(false);
  const [pendingStatus, setPendingStatus]               = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus]         = useState(false);

  // ─── Fetch all orders in this invoice ─────────────────────────────────────
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["invoice-group", invoiceNumber],
    queryFn: () => ordersApi.byInvoice(invoiceNumber),
    enabled: !!invoiceNumber,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["invoice-group", invoiceNumber] });
  };

  // ─── Bulk status change for all orders in group ───────────────────────────
  const handleBulkStatusChange = async (newStatus: string) => {
    if (!orders?.length) return;
    setIsUpdatingStatus(true);
    let done = 0;
    for (const order of orders) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateOrder.mutate(
            { id: order.id, data: { status: newStatus as any } },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
        done++;
      } catch {}
    }
    invalidateAll();
    setPendingStatus(null);
    setIsUpdatingStatus(false);
    toast({ title: `تم تحديث ${done} طلب ✅`, description: `الحالة: ${statusLabels[newStatus] ?? newStatus}` });
  };

  // ─── Bulk delete all orders in group ─────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!orders?.length) return;
    setIsBulkDeleting(true);
    try {
      const token = localStorage.getItem("caprina_token");
      const ids = orders.map((o: any) => o.id);
      const res = await fetch("/api/orders/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      await queryClient.refetchQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: `تم حذف ${data.deleted} طلب ✅` });
      navigate("/orders");
    } catch {
      toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  // ─── Print invoice ────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!orders?.length) return;
    window.open(`/invoices?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, "_blank");
  };

  // ─── Loading / error states ───────────────────────────────────────────────
  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">جاري التحميل...</div>;
  if (error) return (
    <div className="p-12 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
      <h2 className="text-lg font-bold mb-2">حدث خطأ في تحميل الفاتورة</h2>
      <p className="text-sm text-muted-foreground mb-3">{(error as any)?.message || "تعذر الاتصال بالسيرفر"}</p>
      <Link href="/orders"><Button variant="outline">العودة للطلبات</Button></Link>
    </div>
  );
  if (!orders?.length) return (
    <div className="p-12 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
      <h2 className="text-lg font-bold mb-2">الفاتورة غير موجودة</h2>
      <p className="text-sm text-muted-foreground mb-3">رقم الفاتورة: {invoiceNumber}</p>
      <Link href="/orders"><Button variant="outline" className="mt-3">العودة للطلبات</Button></Link>
    </div>
  );

  const rep = orders[0];
  const totalPrice   = orders.reduce((s: number, o: any) => s + o.totalPrice, 0);
  const totalQty     = orders.reduce((s: number, o: any) => s + o.quantity, 0);
  const shippingCost = rep.shippingCost ?? 0;
  const allSameStatus = orders.every((o: any) => o.status === rep.status);
  const dominantStatus = rep.status;
  const isAnyLocked = orders.some((o: any) => (o.status === "received" || o.status === "partial_received")) && !isAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">فاتورة #{invoiceNumber}</h1>
              <Badge variant="outline" className={`font-bold border text-[10px] ${statusClasses[dominantStatus] || ""}`}>
                {allSameStatus ? statusLabels[dominantStatus] || dominantStatus : "حالات متعددة"}
              </Badge>
              {isAnyLocked && (
                <Badge variant="outline" className="text-[9px] font-bold border-amber-700 bg-amber-900/10 text-amber-400 gap-1 flex items-center">
                  <Lock className="w-2.5 h-2.5" /> مقفل جزئياً
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orders.length} منتج · {format(new Date(rep.createdAt), "yyyy/MM/dd HH:mm")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Change status for all */}
          <Select
            value=""
            onValueChange={(v) => { if (v) setPendingStatus(v); }}
            disabled={isUpdatingStatus || isAnyLocked}
          >
            <SelectTrigger className="h-8 text-xs bg-card border-border w-44">
              <div className="flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${isUpdatingStatus ? "animate-spin" : ""}`} />
                <span>تغيير حالة الكل</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="in_shipping">قيد الشحن</SelectItem>
              <SelectItem value="received">استلم ✓</SelectItem>
              <SelectItem value="delayed">مؤجل</SelectItem>
              <SelectItem value="returned">مرتجع</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 border-border">
            <Printer className="w-3 h-3" />فاتورة
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => !isAnyLocked && setShowBulkDeleteDialog(true)}
            disabled={isAnyLocked}
            className="h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" />حذف الكل
          </Button>
        </div>
      </div>


      {/* Customer info */}
      <Card className="border-border bg-card">
        <CardContent className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">العميل</p>
            <p className="font-bold">{rep.customerName}</p>
          </div>
          {rep.phone && (
            <div>
              <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</p>
              <p className="font-bold">{rep.phone}</p>
            </div>
          )}
          {rep.city && (
            <div>
              <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />المحافظة</p>
              <p className="font-bold">{rep.city}</p>
            </div>
          )}
          {rep.address && (
            <div>
              <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان</p>
              <p className="font-bold">{rep.address}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products list */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            المنتجات ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {orders.map((order: any, i: number) => (
            <div key={order.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{i + 1}</div>
                <div>
                  <p className="text-sm font-bold">{order.product}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[order.color, order.size].filter(Boolean).join(" · ")}
                    {order.color || order.size ? " · " : ""}
                    ×{order.quantity}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-primary">{new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(order.totalPrice)}</p>
                <Badge variant="outline" className={`text-[8px] font-bold border mt-0.5 ${statusClasses[order.status] || ""}`}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              </div>
            </div>
          ))}

          <Separator className="my-2" />

          <div className="flex items-center justify-between text-sm font-bold">
            <span>الإجمالي ({totalQty} قطعة)</span>
            <span className="text-primary text-base">{new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(totalPrice)}</span>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>تكلفة الشحن</span>
              <span>{new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(shippingCost)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AlertDialog open={!!pendingStatus} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هتغير حالة {orders.length} طلب إلى «{statusLabels[pendingStatus ?? ""] ?? pendingStatus}». هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingStatus && handleBulkStatusChange(pendingStatus)} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? "جاري التحديث..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الفاتورة</AlertDialogTitle>
            <AlertDialogDescription>
              هتحذف {orders.length} طلب في الفاتورة #{invoiceNumber}. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? "جاري الحذف..." : `حذف ${orders.length} طلب`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
