import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { ArrowRight, Save, Phone, MapPin, Layers, TrendingUp, DollarSign, Megaphone, Warehouse, UserCheck } from "lucide-react";
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
import { productsApi, variantsApi, shippingApi, warehousesApi, usersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const AD_SOURCES = [
  { value: "facebook", label: "📘 فيسبوك" },
  { value: "tiktok", label: "🎵 تيك توك" },
  { value: "instagram", label: "📷 إنستجرام" },
  { value: "whatsapp", label: "💬 واتساب" },
  { value: "organic", label: "🌱 عضوي" },
  { value: "other", label: "📌 أخرى" },
];

const formSchema = z.object({
  customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل."),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  product: z.string().min(1, "اسم المنتج مطلوب."),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, "الكمية يجب أن تكون 1 على الأقل."),
  unitPrice: z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
  costPrice: z.coerce.number().min(0).optional().nullable(),
  shippingCost: z.coerce.number().min(0).optional().nullable(),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  productId: z.coerce.number().optional().nullable(),
  variantId: z.coerce.number().optional().nullable(),
  warehouseId: z.coerce.number().optional().nullable(),
  assignedUserId: z.coerce.number().optional().nullable(),
  adSource: z.string().optional().nullable(),
  adCampaign: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOrder = useCreateOrder();

  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const { isAdmin, canViewFinancials } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "", phone: "", address: "", product: "", color: "", size: "",
      quantity: 1, unitPrice: 0, costPrice: null, shippingCost: 0, notes: "",
      warehouseId: null, assignedUserId: null, adSource: null, adCampaign: null,
    },
  });

  const selectedProductId = form.watch("productId");
  const selectedVariantId = form.watch("variantId");
  const quantity = form.watch("quantity") || 0;
  const unitPrice = form.watch("unitPrice") || 0;
  const costPrice = form.watch("costPrice") || 0;
  const shippingCost = form.watch("shippingCost") || 0;

  const revenue = quantity * unitPrice;
  const cost = quantity * costPrice;
  const netProfit = revenue - cost - shippingCost;
  const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

  const productVariants = allVariants?.filter(v => v.productId === Number(selectedProductId)) ?? [];
  const availableColors = [...new Set(productVariants.map(v => v.color))];
  const selectedColor = form.watch("color");
  const availableSizes = productVariants.filter(v => v.color === selectedColor).map(v => v.size);
  const selectedVariant = allVariants?.find(v => v.id === Number(selectedVariantId));
  const availableQty = selectedVariant
    ? selectedVariant.totalQuantity - selectedVariant.reservedQuantity - selectedVariant.soldQuantity
    : null;

  const onSubmit = (values: FormValues) => {
    createOrder.mutate(
      {
        data: {
          ...values,
          shippingCompanyId: values.shippingCompanyId || null,
          productId: values.productId || null,
          variantId: values.variantId || null,
          color: values.color || null,
          size: values.size || null,
          costPrice: values.costPrice ?? null,
          shippingCost: values.shippingCost ?? 0,
          warehouseId: values.warehouseId || null,
          assignedUserId: values.assignedUserId || null,
          adSource: values.adSource || null,
          adCampaign: values.adCampaign || null,
        } as any,
      },
      {
        onSuccess: (newOrder) => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["analytics-profit"] });
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
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border">
            <ArrowRight className="h-4 w-4" />
          </Button>
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

              {/* Product */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">المنتج والمقاس</CardTitle>
                    {selectedVariant && (
                      <Badge variant="outline" className={`text-[9px] font-bold border ${availableQty !== null && availableQty <= selectedVariant.lowStockThreshold ? "border-red-400 text-red-700 dark:border-red-800 dark:text-red-400" : "border-emerald-400 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"}`}>
                        متاح: {availableQty ?? 0}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-4 space-y-3">
                  <FormField control={form.control} name="productId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs flex items-center gap-1"><Layers className="w-3 h-3" />اختر من المخزون (اختياري)</FormLabel>
                      <Select value={field.value?.toString() || "none"} onValueChange={v => {
                        if (v && v !== "none") {
                          const productId = Number(v);
                          field.onChange(productId);
                          const p = products?.find(p => p.id === productId);
                          if (p) {
                            form.setValue("product", p.name);
                            if (p.costPrice) form.setValue("costPrice", p.costPrice);
                          }
                          form.setValue("variantId", null); form.setValue("color", ""); form.setValue("size", "");
                        } else {
                          field.onChange(null);
                          form.setValue("variantId", null); form.setValue("color", ""); form.setValue("size", "");
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

                  {selectedProductId && productVariants.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/10 rounded-md border border-border/40">
                      <FormField control={form.control} name="color" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">اللون *</FormLabel>
                          <Select value={field.value || "none"} onValueChange={v => {
                            field.onChange(v === "none" ? "" : v);
                            form.setValue("size", ""); form.setValue("variantId", null);
                          }}>
                            <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر لون" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">اختر لون...</SelectItem>
                              {availableColors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="size" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">المقاس *</FormLabel>
                          <Select value={field.value || "none"} onValueChange={v => {
                            field.onChange(v === "none" ? "" : v);
                            const variant = productVariants.find(pv => pv.color === selectedColor && pv.size === v);
                            if (variant) {
                              form.setValue("variantId", variant.id);
                              form.setValue("unitPrice", variant.unitPrice);
                              if ((variant as any).costPrice) form.setValue("costPrice", (variant as any).costPrice);
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

                  <FormField control={form.control} name="product" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">اسم المنتج *</FormLabel>
                      <FormControl><Input placeholder="اسم المنتج" className="h-9 text-sm" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />

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
                          <FormControl><Input placeholder="M, L, XL..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
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
                        <FormLabel className="text-xs">سعر البيع (ج.م) *</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" className="h-9 text-sm" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Cost & Profit — admin only */}
              {canViewFinancials && (
                <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/5">
                  <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      بيانات التكلفة والربح
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="costPrice" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">تكلفة الوحدة (ج.م)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" placeholder="0" className="h-9 text-sm" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="shippingCost" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">تكلفة الشحن (ج.م)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" placeholder="0" className="h-9 text-sm" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </div>
                    {costPrice > 0 && (
                      <div className="grid grid-cols-3 gap-2 p-2 bg-background/50 rounded border border-border text-center">
                        <div>
                          <p className="text-[9px] text-muted-foreground">إيرادات</p>
                          <p className="text-xs font-bold text-primary">{formatCurrency(revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">التكلفة الكلية</p>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{formatCurrency(cost + shippingCost)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">الربح الصافي</p>
                          <p className={`text-xs font-bold ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(netProfit)}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tracking */}
              <Card className="border-purple-900/40 bg-purple-900/5">
                <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5 text-purple-400" />
                    تتبع الإعلان والفريق
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="adSource" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><Megaphone className="w-3 h-3" />مصدر الطلب</FormLabel>
                        <Select value={field.value ?? "none"} onValueChange={v => field.onChange(v === "none" ? null : v)}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر المصدر" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— غير محدد —</SelectItem>
                            {AD_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="adCampaign" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">اسم الحملة</FormLabel>
                        <FormControl><Input placeholder="Summer 2025..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="warehouseId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><Warehouse className="w-3 h-3" />المخزن</FormLabel>
                        <Select value={field.value?.toString() ?? "none"} onValueChange={v => field.onChange(v === "none" ? null : Number(v))}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر مخزن" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— غير محدد —</SelectItem>
                            {warehouses?.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}{w.isDefault ? " ★" : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="assignedUserId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><UserCheck className="w-3 h-3" />الموظف المسؤول</FormLabel>
                        <Select value={field.value?.toString() ?? "none"} onValueChange={v => field.onChange(v === "none" ? null : Number(v))}>
                          <SelectTrigger className="h-9 text-sm bg-card"><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— غير محدد —</SelectItem>
                            {users?.filter(u => u.isActive).map(u => <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">ملاحظات</FormLabel>
                  <FormControl><Textarea placeholder="أي تعليمات خاصة..." className="min-h-[60px] text-sm resize-none" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
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
                    </div>
                  )}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">الكمية</span><span>{quantity}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">سعر البيع</span><span>{formatCurrency(unitPrice)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-bold">إجمالي البيع</span>
                      <span className="font-bold text-base text-primary">{formatCurrency(revenue)}</span>
                    </div>
                    {canViewFinancials && costPrice > 0 && (
                      <>
                        <div className="flex justify-between"><span className="text-muted-foreground">التكلفة</span><span className="text-amber-700 dark:text-amber-400">-{formatCurrency(cost)}</span></div>
                        {shippingCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">الشحن</span><span className="text-amber-700 dark:text-amber-400">-{formatCurrency(shippingCost)}</span></div>}
                        <div className="border-t border-border pt-2 flex justify-between">
                          <span className="font-bold">الربح الصافي</span>
                          <span className={`font-bold text-base ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(netProfit)}</span>
                        </div>
                        {revenue > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">هامش الربح</span>
                            <span className={`font-bold ${margin >= 20 ? "text-emerald-600 dark:text-emerald-400" : margin >= 10 ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{margin}%</span>
                          </div>
                        )}
                      </>
                    )}
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
