import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowRight, AlertCircle, Pencil, Save, X, Printer, Phone, MapPin, Trash2, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Lock, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetOrder, getGetOrderQueryKey, useUpdateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { shippingApi, ordersApi } from "@/lib/api";
import { type WhatsAppOrderData } from "@/lib/whatsapp";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { RETURN_REASONS, returnReasonLabel, STATUS_LABELS as statusLabels, STATUS_CLASSES as statusClasses } from "@/lib/order-constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const editSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  product: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type EditFormValues = z.infer<typeof editSchema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function OrderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, canViewFinancials } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialQty, setPartialQty] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showWaDialog, setShowWaDialog] = useState(false);

  // Return reason state
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnIsDamaged, setReturnIsDamaged] = useState(false);

  const initializedRef = useRef(false);

  const { data: order, isLoading, error } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const updateOrder = useUpdateOrder();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { customerName: "", phone: "", address: "", product: "", quantity: 1, unitPrice: 0, notes: "" },
  });

  useEffect(() => {
    if (order && !initializedRef.current) {
      form.reset({ customerName: order.customerName, phone: order.phone, address: order.address, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, shippingCompanyId: order.shippingCompanyId, trackingNumber: (order as any).trackingNumber ?? null, notes: order.notes });
      initializedRef.current = true;
    }
  }, [order, form]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!order || order.status === newStatus) return;
    if (newStatus === "partial_received") { setShowPartialInput(true); return; }
    if (newStatus === "returned") { setShowReturnInput(true); return; }

    updateOrder.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        invalidateAll();
        toast({ title: "تم تحديث الحالة", description: `الطلب أصبح: ${statusLabels[newStatus]}` });
      },
      onError: () => toast({ title: "خطأ", description: "فشل تحديث الحالة.", variant: "destructive" }),
    });
  };

  const handlePartialReceived = () => {
    const pQty = parseInt(partialQty);
    if (isNaN(pQty) || pQty < 1) { toast({ title: "خطأ", description: "أدخل كمية صحيحة.", variant: "destructive" }); return; }

    updateOrder.mutate({ id, data: { status: "partial_received", partialQuantity: pQty } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        invalidateAll();
        setShowPartialInput(false);
        setPartialQty("");
        toast({ title: "تم التحديث", description: `تم استلام ${pQty} وحدة جزئياً.` });
      },
      onError: () => toast({ title: "خطأ", description: "فشل التحديث.", variant: "destructive" }),
    });
  };

  const handleReturnConfirm = () => {
    if (!returnReason) { toast({ title: "خطأ", description: "اختر سبب الإرجاع.", variant: "destructive" }); return; }
    if (returnReason === "other" && !returnNote.trim()) { toast({ title: "خطأ", description: "اكتب سبب الإرجاع.", variant: "destructive" }); return; }

    updateOrder.mutate({
      id,
      data: {
        status: "returned",
        returnReason,
        returnNote: returnReason === "other" ? returnNote.trim() : null,
        isDamaged: returnIsDamaged,
      } as any,
    }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        invalidateAll();
        setShowReturnInput(false);
        setReturnReason("");
        setReturnNote("");
        setReturnIsDamaged(false);
        toast({ title: "تم التسجيل", description: returnIsDamaged ? "تم تسجيل المرتجع التالف — لم يُضاف للمخزون." : "تم تسجيل المرتجع وأُضيف للمخزون." });
      },
      onError: () => toast({ title: "خطأ", description: "فشل تحديث الحالة.", variant: "destructive" }),
    });
  };

  const onSubmitEdit = (values: EditFormValues) => {
    updateOrder.mutate({ id, data: { ...values, shippingCompanyId: values.shippingCompanyId || null } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
        setIsEditing(false);
        initializedRef.current = false;
        toast({ title: "تم الحفظ", description: "تم حفظ التعديلات بنجاح." });
      },
      onError: () => toast({ title: "خطأ", description: "فشل الحفظ.", variant: "destructive" }),
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await ordersApi.delete(id);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["orders-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح." });
      navigate("/orders");
    } catch {
      toast({ title: "خطأ", description: "فشل حذف الطلب.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePrint = () => { window.open(`/invoices?orderId=${id}`, "_blank"); };

  const handleWhatsApp = () => { setShowWaDialog(true); };

  const handleWaSent = () => {
    if (!order) return;
    if (order.status === "pending") {
      updateOrder.mutate(
        { id, data: { status: "in_shipping" } },
        {
          onSuccess: (updated) => {
            queryClient.setQueryData(getGetOrderQueryKey(id), updated);
            invalidateAll();
            toast({ title: "تم إرسال واتساب ✅", description: "تم تحويل الطلب لـ «قيد الشحن» تلقائياً" });
          },
        }
      );
    } else {
      toast({ title: "تم فتح واتساب ✅", description: "الرسالة جاهزة للإرسال" });
    }
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">جاري التحميل...</div>;
  if (error || !order) return (
    <div className="p-12 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
      <h2 className="text-lg font-bold mb-2">الطلب غير موجود</h2>
      <Link href="/orders"><Button variant="outline" className="mt-3">العودة للطلبات</Button></Link>
    </div>
  );

  const shippingCompany = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
  const orderReturnReason = (order as any).returnReason as string | null;
  const orderReturnNote = (order as any).returnNote as string | null;
  const isOrderLocked = (order.status === "received" || order.status === "partial_received") && !isAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border"><ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">طلب #{order.id.toString().padStart(4,"0")}</h1>
              {!isEditing && (
                <Badge variant="outline" className={`font-bold border text-[10px] ${statusClasses[order.status] || ""}`}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              )}
              {isOrderLocked && (
                <Badge variant="outline" className="text-[9px] font-bold border-amber-700 bg-amber-900/10 text-amber-400 gap-1 flex items-center">
                  <Lock className="w-2.5 h-2.5" /> مقفل
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <div className="w-44">
                <Select value={order.status} onValueChange={handleStatusChange} disabled={updateOrder.isPending}>
                  <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="in_shipping">قيد الشحن</SelectItem>
                    <SelectItem value="received">استلم ✓</SelectItem>
                    <SelectItem value="delayed">مؤجل</SelectItem>
                    <SelectItem value="returned">مرتجع</SelectItem>
                    <SelectItem value="partial_received">استلم جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => !isOrderLocked && setIsEditing(true)}
                disabled={isOrderLocked}
                title={isOrderLocked ? "الطلب مقفل — فقط المدير يمكنه التعديل" : undefined}
                className="h-8 text-xs gap-1 border-border disabled:opacity-40"
              >
                {isOrderLocked ? <Lock className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}تعديل
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 border-border">
                <Printer className="w-3 h-3" />فاتورة
              </Button>
              {(order.status === "pending" || order.status === "in_shipping" || order.status === "delayed") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsApp}
                  className="h-8 text-xs gap-1 border-green-700 text-green-400 hover:bg-green-500/10 hover:text-green-400"
                  title="إرسال رسالة واتساب للعميل"
                >
                  <MessageCircle className="w-3 h-3" />واتساب
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={() => !isOrderLocked && setShowDeleteDialog(true)}
                disabled={isOrderLocked}
                title={isOrderLocked ? "الطلب مقفل — فقط المدير يمكنه الحذف" : undefined}
                className="h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />حذف
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الطلب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف طلب #{order.id.toString().padStart(4,"0")} للعميل {order.customerName}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp dialog */}
      {order && (
        <WhatsAppDialog
          open={showWaDialog}
          onOpenChange={setShowWaDialog}
          order={{ id: order.id, customerName: order.customerName, product: order.product, quantity: order.quantity, totalPrice: order.totalPrice, status: order.status, phone: order.phone }}
          onSent={handleWaSent}
        />
      )}

      {/* Partial received input */}
      {showPartialInput && (
        <Card className="border-purple-800 bg-purple-900/20">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-purple-400 mb-3">استلام جزئي — كم وحدة استلمت؟</p>
            <div className="flex items-center gap-3">
              <Input type="number" min="1" max={order.quantity} placeholder={`الحد الأقصى: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>تأكيد</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); }}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return reason input */}
      {showReturnInput && (
        <Card className="border-red-800 bg-red-900/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-4 h-4 text-red-400" />
              <p className="text-sm font-bold text-red-400">تسجيل مرتجع — ما سبب الإرجاع؟</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">سبب الإرجاع *</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger className="h-9 text-sm bg-card border-red-800 focus:ring-red-700">
                  <SelectValue placeholder="اختر السبب..." />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {returnReason === "other" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">اكتب السبب *</Label>
                <Textarea
                  placeholder="اكتب سبب الإرجاع بالتفصيل..."
                  className="min-h-[70px] text-sm resize-none bg-card border-red-800 focus:ring-red-700"
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                />
              </div>
            )}
            {/* Damaged checkbox */}
            <div
              className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${returnIsDamaged ? "border-amber-700 bg-amber-900/20" : "border-border bg-card/50"}`}
              onClick={() => setReturnIsDamaged(v => !v)}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${returnIsDamaged ? "bg-amber-600 border-amber-600" : "border-muted-foreground"}`}>
                {returnIsDamaged && <X className="w-2.5 h-2.5 text-white" />}
              </div>
              <div>
                <p className={`text-xs font-bold ${returnIsDamaged ? "text-amber-400" : "text-muted-foreground"}`}>
                  <AlertTriangle className="w-3 h-3 inline ml-1" />
                  المنتج تالف / غير صالح للبيع
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {returnIsDamaged ? "⚠ لن يُضاف للمخزون — سيُسجَّل كخسارة" : "في حالة التيك، لن يُرجَع للمخزون"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-8 text-xs bg-red-700 hover:bg-red-600 text-white gap-1" onClick={handleReturnConfirm} disabled={updateOrder.isPending}>
                <RotateCcw className="w-3 h-3" />{updateOrder.isPending ? "جاري..." : "تأكيد الإرجاع"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); }}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitEdit)}>
                <Card className="border-primary/40 bg-card">
                  <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
                    <CardTitle className="text-sm font-bold text-primary">تعديل الطلب</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="customerName" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">اسم العميل</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl><FormMessage className="text-xs"/></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">الهاتف</FormLabel><FormControl><Input className="h-8 text-sm" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">العنوان</FormLabel><FormControl><Input className="h-8 text-sm" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="shippingCompanyId" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">شركة الشحن</FormLabel>
                          <Select value={field.value?.toString() || "none"} onValueChange={v => field.onChange(v === "none" ? null : Number(v))}>
                            <SelectTrigger className="h-8 text-sm bg-card"><SelectValue placeholder="بدون" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">بدون</SelectItem>
                              {shippingCompanies?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="trackingNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">رقم التتبع</FormLabel><FormControl><Input className="h-8 text-sm font-mono" placeholder="TRK-12345" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="product" render={({ field }) => (
                        <FormItem className="col-span-1"><FormLabel className="text-xs">المنتج</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="quantity" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">الكمية</FormLabel><FormControl><Input type="number" min="1" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="unitPrice" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">السعر</FormLabel><FormControl><Input type="number" min="0" step="0.01" className="h-8 text-sm" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">ملاحظات</FormLabel><FormControl><Textarea className="min-h-[60px] text-sm resize-none" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                    )} />
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" size="sm" className="h-8 text-xs gap-1" disabled={updateOrder.isPending}>
                        <Save className="w-3 h-3" />{updateOrder.isPending ? "جاري..." : "حفظ"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setIsEditing(false); initializedRef.current = false; }}>
                        <X className="w-3 h-3 ml-1" />إلغاء
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </Form>
          ) : (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
                <CardTitle className="text-sm font-bold">تفاصيل الطلب</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">اسم العميل</p>
                    <p className="font-semibold">{order.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</p>
                    <p className="font-semibold">{order.phone || <span className="text-muted-foreground">—</span>}</p>
                  </div>
                  {order.address && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان</p>
                      <p className="font-semibold">{order.address}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">المنتج</p>
                    <p className="font-semibold">{order.product}</p>
                    {((order as any).color || (order as any).size) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {(order as any).color && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{(order as any).color}</Badge>}
                        {(order as any).size && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary font-bold">{(order as any).size}</Badge>}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">الكمية</p>
                    <p className="font-semibold">{order.quantity} وحدة</p>
                  </div>
                  {order.partialQuantity && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المستلم جزئياً</p>
                      <p className="font-semibold text-purple-400">{order.partialQuantity} وحدة</p>
                    </div>
                  )}
                  {shippingCompany && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">شركة الشحن</p>
                      <p className="font-semibold">{shippingCompany.name}</p>
                    </div>
                  )}
                </div>

                {/* Return reason section */}
                {order.status === "returned" && orderReturnReason && (
                  <div className="mt-2 p-3 rounded border border-red-900 bg-red-900/10">
                    <p className="text-xs text-red-400 font-bold mb-1 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />سبب الإرجاع
                    </p>
                    <p className="text-sm font-semibold text-red-300">
                      {returnReasonLabel(orderReturnReason)}
                    </p>
                    {orderReturnNote && (
                      <p className="text-xs text-muted-foreground mt-1">{orderReturnNote}</p>
                    )}
                  </div>
                )}

                {order.notes && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                    <div className="bg-muted/20 p-3 rounded text-sm border border-border">{order.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Financial summary */}
        <div className="space-y-4">
          {/* Revenue */}
          <Card className="border-primary/30 bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold text-primary">الملخص المالي</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">الكمية</span>
                  <span>{order.quantity}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">سعر الوحدة</span>
                  <span>{formatCurrency(order.unitPrice)}</span>
                </div>
                <Separator className="border-border" />
                <div className="flex justify-between">
                  <span className="font-bold text-xs">إجمالي البيع</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profit breakdown — admin only */}
          {canViewFinancials && (() => {
            const costPrice = (order as any).costPrice as number | null;
            const shippingCost = (order as any).shippingCost as number | null;
            if (!costPrice) return null;
            const qty = order.status === "partial_received" && order.partialQuantity ? order.partialQuantity : order.quantity;
            const isReturned = order.status === "returned";
            const revenue = isReturned ? 0 : qty * order.unitPrice;
            const cost = qty * costPrice;
            const shipping = shippingCost ?? 0;
            const netProfit = revenue - cost - shipping;
            const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
            const isPositive = netProfit >= 0;
            return (
              <Card className={`border ${isReturned ? "border-red-900/50 bg-red-900/5" : isPositive ? "border-emerald-900/50 bg-emerald-900/5" : "border-red-900/50 bg-red-900/5"}`}>
                <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    {isPositive && !isReturned ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    تحليل الربحية
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3 space-y-2 text-xs">
                  {isReturned && (
                    <div className="p-2 bg-red-900/20 rounded text-red-400 text-[10px] font-semibold border border-red-900/30">
                      مرتجع — خسارة كاملة
                    </div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">الإيرادات</span><span className="text-primary font-semibold">{formatCurrency(revenue)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">تكلفة البضاعة</span><span className="text-amber-400">-{formatCurrency(cost)}</span></div>
                  {shipping > 0 && <div className="flex justify-between"><span className="text-muted-foreground">تكلفة الشحن</span><span className="text-orange-400">-{formatCurrency(shipping)}</span></div>}
                  <Separator />
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-bold">الربح الصافي</span>
                    <span className={`font-black text-base ${isPositive && !isReturned ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(netProfit)}</span>
                  </div>
                  {revenue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">هامش الربح</span>
                      <span className={`font-bold ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}>{margin}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <p className="text-[10px] text-center text-muted-foreground">
            آخر تحديث: {format(new Date(order.updatedAt), "yyyy/MM/dd HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
}
