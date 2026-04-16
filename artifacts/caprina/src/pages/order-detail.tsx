import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { ArrowRight, AlertCircle, Pencil, Save, X, Printer, Phone, MapPin } from "lucide-react";
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
import { shippingApi } from "@/lib/api";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  received: "استلم ✓",
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

const editSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  product: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type EditFormValues = z.infer<typeof editSchema>;

export default function OrderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialQty, setPartialQty] = useState("");
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
      form.reset({ customerName: order.customerName, phone: order.phone, address: order.address, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, shippingCompanyId: order.shippingCompanyId, notes: order.notes });
      initializedRef.current = true;
    }
  }, [order, form]);

  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  const handleStatusChange = (newStatus: string) => {
    if (!order || order.status === newStatus) return;
    if (newStatus === "partial_received") { setShowPartialInput(true); return; }

    updateOrder.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["products"] });
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
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["products"] });
        setShowPartialInput(false);
        setPartialQty("");
        toast({ title: "تم التحديث", description: `تم استلام ${pQty} وحدة جزئياً.` });
      },
      onError: () => toast({ title: "خطأ", description: "فشل التحديث.", variant: "destructive" }),
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

  const handlePrint = () => {
    window.open(`/invoices?orderId=${id}`, "_blank");
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
                    <SelectItem value="received">استلم ✓</SelectItem>
                    <SelectItem value="delayed">مؤجل</SelectItem>
                    <SelectItem value="returned">مرتجع</SelectItem>
                    <SelectItem value="partial_received">استلم جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 text-xs gap-1 border-border">
                <Pencil className="w-3 h-3" />تعديل
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 border-border">
                <Printer className="w-3 h-3" />فاتورة
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Partial received input */}
      {showPartialInput && (
        <Card className="border-purple-800 bg-purple-900/20">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-purple-400 mb-3">استلام جزئي — كم وحدة استلمت؟</p>
            <div className="flex items-center gap-3">
              <Input type="number" min="1" max={order.quantity} placeholder={`الحد الأقصى: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>
                تأكيد
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); }}>
                إلغاء
              </Button>
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
                  <span className="font-bold text-xs">الإجمالي</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <p className="text-[10px] text-center text-muted-foreground">
            آخر تحديث: {format(new Date(order.updatedAt), "yyyy/MM/dd HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
}
