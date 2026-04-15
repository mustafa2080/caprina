import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { ArrowRight, Save, Phone, MapPin } from "lucide-react";
import { useCreateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productsApi, shippingApi } from "@/lib/api";

const formSchema = z.object({
  customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل."),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  product: z.string().min(1, "اسم المنتج مطلوب."),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل."),
  unitPrice: z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  productId: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerName: "", phone: "", address: "", product: "", quantity: 1, unitPrice: 0, notes: "" },
  });

  const onSubmit = (values: FormValues) => {
    createOrder.mutate(
      { data: { ...values, shippingCompanyId: values.shippingCompanyId || null, productId: values.productId || null } },
      {
        onSuccess: (newOrder) => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["products"] });
          toast({ title: "تم إنشاء الطلب", description: `الطلب #${newOrder.id} تم إنشاؤه بنجاح.` });
          setLocation(`/orders/${newOrder.id}`);
        },
        onError: (error: any) => {
          toast({ title: "خطأ", description: error?.error || "فشل إنشاء الطلب.", variant: "destructive" });
        },
      }
    );
  };

  const quantity = form.watch("quantity") || 0;
  const unitPrice = form.watch("unitPrice") || 0;
  const total = quantity * unitPrice;
  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  const selectedProductId = form.watch("productId");
  const selectedProduct = products?.find(p => p.id === Number(selectedProductId));
  const available = selectedProduct ? selectedProduct.totalQuantity - selectedProduct.reservedQuantity - selectedProduct.soldQuantity : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">طلب جديد</h1>
          <p className="text-muted-foreground text-xs mt-0.5">أدخل تفاصيل الطلب بسرعة.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              {/* Customer */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-bold">بيانات العميل</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">اسم العميل *</FormLabel>
                      <FormControl><Input placeholder="أحمد محمد" className="h-9 text-sm" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />رقم الهاتف</FormLabel>
                        <FormControl><Input placeholder="05xxxxxxxx" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="shippingCompanyId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">شركة الشحن</FormLabel>
                        <Select value={field.value?.toString() || ""} onValueChange={v => field.onChange(v ? Number(v) : null)}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر شركة" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">بدون</SelectItem>
                            {shippingCompanies?.filter(c => c.isActive).map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />عنوان التوصيل</FormLabel>
                      <FormControl><Input placeholder="المدينة، الحي، الشارع..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {/* Product */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-bold">تفاصيل المنتج</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="productId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">من المخزون (اختياري)</FormLabel>
                        <Select value={field.value?.toString() || ""} onValueChange={v => {
                          if (v) {
                            field.onChange(Number(v));
                            const p = products?.find(p => p.id === Number(v));
                            if (p) { form.setValue("product", p.name); form.setValue("unitPrice", p.unitPrice); }
                          } else {
                            field.onChange(null);
                          }
                        }}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">إدخال يدوي</SelectItem>
                            {products?.map(p => {
                              const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                              return <SelectItem key={p.id} value={String(p.id)}>{p.name} ({avail} متاح)</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                        {selectedProduct && available !== null && (
                          <p className={`text-[10px] mt-1 ${available <= selectedProduct.lowStockThreshold ? "text-red-400" : "text-emerald-400"}`}>
                            المتاح: {available} وحدة
                          </p>
                        )}
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="product" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">اسم المنتج *</FormLabel>
                        <FormControl><Input placeholder="اسم المنتج" className="h-9 text-sm" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="quantity" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">الكمية *</FormLabel>
                        <FormControl><Input type="number" min="1" className="h-9 text-sm" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="unitPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">سعر الوحدة (ر.س) *</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" className="h-9 text-sm" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">ملاحظات</FormLabel>
                      <FormControl><Textarea placeholder="أي تعليمات خاصة..." className="min-h-[70px] text-sm resize-none" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div>
              <Card className="border-primary/30 bg-card sticky top-4">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-bold text-primary">الملخص</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">الكمية</span><span>{quantity}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">السعر</span><span>{formatCurrency(unitPrice)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-bold">الإجمالي</span>
                      <span className="font-bold text-base text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2 bg-primary text-primary-foreground font-bold text-sm h-9" disabled={createOrder.isPending}>
                    {createOrder.isPending ? "جاري الحفظ..." : <><Save className="w-4 h-4" />إنشاء الطلب</>}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
