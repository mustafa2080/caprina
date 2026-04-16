import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { ArrowRight, Save, Phone, MapPin, Layers } from "lucide-react";
import { useCreateOrder, getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { productsApi, variantsApi, shippingApi } from "@/lib/api";

const formSchema = z.object({
  customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل."),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  product: z.string().min(1, "اسم المنتج مطلوب."),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل."),
  unitPrice: z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  productId: z.coerce.number().optional().nullable(),
  variantId: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { customerName: "", phone: "", address: "", product: "", color: "", size: "", quantity: 1, unitPrice: 0, notes: "" },
  });

  const selectedProductId = form.watch("productId");
  const selectedVariantId = form.watch("variantId");
  const quantity = form.watch("quantity") || 0;
  const unitPrice = form.watch("unitPrice") || 0;
  const total = quantity * unitPrice;

  // Variants for the selected product
  const productVariants = allVariants?.filter(v => v.productId === Number(selectedProductId)) ?? [];
  // Unique colors for selected product
  const availableColors = [...new Set(productVariants.map(v => v.color))];
  const selectedColor = form.watch("color");
  // Sizes for selected color
  const availableSizes = productVariants.filter(v => v.color === selectedColor).map(v => v.size);
  // Selected variant info
  const selectedVariant = allVariants?.find(v => v.id === Number(selectedVariantId));
  const availableQty = selectedVariant ? selectedVariant.totalQuantity - selectedVariant.reservedQuantity - selectedVariant.soldQuantity : null;

  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  const onSubmit = (values: FormValues) => {
    createOrder.mutate(
      { data: { ...values, shippingCompanyId: values.shippingCompanyId || null, productId: values.productId || null, variantId: values.variantId || null, color: values.color || null, size: values.size || null } as any },
      {
        onSuccess: (newOrder) => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["variants"] });
          toast({ title: "تم إنشاء الطلب", description: `الطلب #${newOrder.id} تم إنشاؤه بنجاح.` });
          setLocation(`/orders/${newOrder.id}`);
        },
        onError: (error: any) => {
          toast({ title: "خطأ", description: error?.error || "فشل إنشاء الطلب.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border"><ArrowRight className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">طلب جديد</h1>
          <p className="text-muted-foreground text-xs mt-0.5">أدخل تفاصيل الطلب</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-4">
              {/* Customer */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-sm font-bold">بيانات العميل</CardTitle></CardHeader>
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
                        <Select value={field.value?.toString() || "none"} onValueChange={v => field.onChange(v === "none" ? null : Number(v))}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر شركة" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">بدون</SelectItem>
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

              {/* Product + Variants */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">المنتج والمقاس</CardTitle>
                    {selectedVariant && (
                      <Badge variant="outline" className={`text-[9px] font-bold border ${availableQty !== null && availableQty <= selectedVariant.lowStockThreshold ? "border-red-800 text-red-400" : "border-emerald-800 text-emerald-400"}`}>
                        متاح: {availableQty ?? 0}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-4 space-y-3">
                  {/* Step 1: Choose product from inventory OR type manually */}
                  <FormField control={form.control} name="productId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs flex items-center gap-1"><Layers className="w-3 h-3" />اختر من المخزون (اختياري)</FormLabel>
                      <Select value={field.value?.toString() || "none"} onValueChange={v => {
                        if (v && v !== "none") {
                          const productId = Number(v);
                          field.onChange(productId);
                          const p = products?.find(p => p.id === productId);
                          if (p) { form.setValue("product", p.name); }
                          // Reset variant selects
                          form.setValue("variantId", null);
                          form.setValue("color", "");
                          form.setValue("size", "");
                        } else {
                          field.onChange(null);
                          form.setValue("variantId", null);
                          form.setValue("color", "");
                          form.setValue("size", "");
                        }
                      }}>
                        <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر منتج من المخزون..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— إدخال يدوي —</SelectItem>
                          {products?.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {/* Cascading color/size (only if product from inventory selected) */}
                  {selectedProductId && productVariants.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/10 rounded-md border border-border/40">
                      <FormField control={form.control} name="color" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">اللون *</FormLabel>
                          <Select value={field.value || "none"} onValueChange={v => {
                            field.onChange(v === "none" ? "" : v);
                            form.setValue("size", "");
                            form.setValue("variantId", null);
                          }}>
                            <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر لون" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">اختر لون...</SelectItem>
                              {availableColors.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="size" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">المقاس *</FormLabel>
                          <Select value={field.value || "none"} onValueChange={v => {
                            field.onChange(v === "none" ? "" : v);
                            // Find matching variant
                            const variant = productVariants.find(pv => pv.color === selectedColor && pv.size === v);
                            if (variant) {
                              form.setValue("variantId", variant.id);
                              form.setValue("unitPrice", variant.unitPrice);
                            }
                          }} disabled={!selectedColor}>
                            <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder={selectedColor ? "اختر مقاس" : "اختر لون أولاً"} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">اختر مقاس...</SelectItem>
                              {availableSizes.map(s => {
                                const variant = productVariants.find(v => v.color === selectedColor && v.size === s);
                                const avail = variant ? variant.totalQuantity - variant.reservedQuantity - variant.soldQuantity : 0;
                                return (
                                  <SelectItem key={s} value={s} disabled={avail === 0}>
                                    {s} {avail === 0 ? "(نفد)" : `(${avail} متاح)`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                  )}

                  {/* Manual product name */}
                  <FormField control={form.control} name="product" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">اسم المنتج *</FormLabel>
                      <FormControl><Input placeholder="اسم المنتج" className="h-9 text-sm" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />

                  {/* Manual color/size (if no inventory product selected) */}
                  {!selectedProductId && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="color" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">اللون</FormLabel>
                          <FormControl><Input placeholder="أسود، بيج..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="size" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">المقاس</FormLabel>
                          <FormControl><Input placeholder="M, L, XL, 32..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  )}

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
                      <FormControl><Textarea placeholder="أي تعليمات خاصة..." className="min-h-[60px] text-sm resize-none" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div>
              <Card className="border-primary/30 bg-card sticky top-4">
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-sm font-bold text-primary">الملخص</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {selectedVariant && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/20 space-y-1">
                      <p className="text-[9px] font-bold text-primary uppercase tracking-wider">SKU محدد</p>
                      <p className="text-xs font-bold">{selectedVariant.productName || form.watch("product")}</p>
                      <p className="text-xs text-muted-foreground">{selectedVariant.color} — {selectedVariant.size}</p>
                      {selectedVariant.sku && <p className="text-[9px] font-mono text-muted-foreground">{selectedVariant.sku}</p>}
                    </div>
                  )}
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
