import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import {
  ArrowRight, Save, Phone, MapPin, Layers, DollarSign, Megaphone,
  Warehouse, UserCheck, Plus, Trash2, Package, ChevronDown, ChevronUp, Search, X,
} from "lucide-react";
import { getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { productsApi, variantsApi, shippingApi, warehousesApi, usersApi, ordersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect, useMemo } from "react";

const AD_SOURCES = [
  { value: "facebook",  label: "📘 فيسبوك" },
  { value: "tiktok",   label: "🎵 تيك توك" },
  { value: "instagram",label: "📷 إنستجرام" },
  { value: "whatsapp", label: "💬 واتساب" },
  { value: "organic",  label: "🌱 عضوي" },
  { value: "other",    label: "📌 أخرى" },
];

const itemSchema = z.object({
  product:     z.string().min(1, "اسم المنتج مطلوب."),
  color:       z.string().optional().nullable(),
  size:        z.string().optional().nullable(),
  quantity:    z.coerce.number().int().min(1, "الكمية 1 على الأقل."),
  unitPrice:   z.coerce.number().min(0, "السعر يجب أن يكون موجباً."),
  costPrice:   z.coerce.number().min(0).optional().nullable(),
  productId:   z.coerce.number().optional().nullable(),
  variantId:   z.coerce.number().optional().nullable(),
});

const formSchema = z.object({
  customerName:      z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل."),
  phone:             z.string().optional().nullable(),
  city:              z.string().optional().nullable(),
  address:           z.string().optional().nullable(),
  shippingCost:      z.coerce.number().min(0).optional().nullable(),
  shippingCompanyId: z.coerce.number().optional().nullable(),
  warehouseId:       z.coerce.number().optional().nullable(),
  assignedUserId:    z.coerce.number().optional().nullable(),
  adSource:          z.string().optional().nullable(),
  adCampaign:        z.string().optional().nullable(),
  notes:             z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "أضف منتجاً واحداً على الأقل."),
});

type FormValues = z.infer<typeof formSchema>;
type ItemValues = z.infer<typeof itemSchema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const emptyItem = (): ItemValues => ({
  product: "", color: "", size: "", quantity: 1,
  unitPrice: 0, costPrice: null, productId: null, variantId: null,
});

// ── Product Search Combobox ───────────────────────────────────────────────────
function ProductSearchCombobox({ products, allVariants, onSelect }: {
  products: any[]; allVariants: any[]; onSelect: (p: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const inStockProducts = useMemo(() => products.filter(p => {
    const variants = allVariants.filter(v => v.productId === p.id);
    if (variants.length > 0) return variants.some(v => (v.totalQuantity ?? 0) > 0);
    return (p.totalQuantity ?? 0) > 0;
  }), [products, allVariants]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (q ? inStockProducts.filter(p => p.name?.toLowerCase().includes(q)) : inStockProducts).slice(0, 20);
  }, [query, inStockProducts]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const getStock = (p: any) => {
    const variants = allVariants.filter(v => v.productId === p.id);
    return variants.length > 0
      ? variants.reduce((s: number, v: any) => s + (v.totalQuantity ?? 0), 0)
      : (p.totalQuantity ?? 0);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input className="h-9 text-sm pr-8 bg-card" placeholder="ابحث عن منتج من المخزون..."
          value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {query ? "لا يوجد منتج بهذا الاسم في المخزون" : "لا توجد منتجات متاحة في المخزون"}
            </div>
          ) : filtered.map(p => {
            const stock = getStock(p);
            return (
              <button key={p.id} type="button"
                className="w-full text-right flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm border-b border-border/30 last:border-0"
                onClick={() => { onSelect(p); setQuery(""); setOpen(false); }}>
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{p.name}</span>
                </div>
                <Badge variant="outline" className={`text-[9px] font-bold shrink-0 ${stock > 0 ? "border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" : "border-red-400 text-red-600"}`}>
                  {stock > 0 ? `${stock} متاح` : "نفد"}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── Single product item row ───────────────────────────────────────────────────
function ProductItem({
  index, control, watch, setValue, remove, products, allVariants, canViewFinancials, isOnly,
}: {
  index: number; control: any; watch: any; setValue: any;
  remove: () => void; products: any[]; allVariants: any[];
  canViewFinancials: boolean; isOnly: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const productId   = watch(`items.${index}.productId`);
  const qty         = watch(`items.${index}.quantity`) || 0;
  const price       = watch(`items.${index}.unitPrice`) || 0;
  const cost        = watch(`items.${index}.costPrice`) || 0;
  const productName = watch(`items.${index}.product`) || `منتج ${index + 1}`;

  const productVariants = allVariants.filter((v: any) => v.productId === Number(productId));
  const availableColors = [...new Set(productVariants.map((v: any) => v.color))] as string[];
  const selectedProduct = products.find((p: any) => p.id === Number(productId));

  // variant rows local state: [{color, size, quantity}]
  const [variantRows, setVariantRows] = useState<{color: string; size: string; quantity: number}[]>([
    { color: "", size: "", quantity: 1 }
  ]);

  const revenue   = qty * price;
  const costTotal = qty * cost;
  const profit    = revenue - costTotal;

  // sync first variant row into form fields + update total quantity
  useEffect(() => {
    const filled = variantRows.filter(r => r.color && r.size);
    if (filled.length === 0) return;
    const first = filled[0];
    const variant = productVariants.find((v: any) => v.color === first.color && v.size === first.size);
    if (variant) {
      setValue(`items.${index}.color`, first.color);
      setValue(`items.${index}.size`, first.size);
      setValue(`items.${index}.variantId`, variant.id);
      setValue(`items.${index}.unitPrice`, variant.unitPrice);
      if ((variant as any).costPrice) setValue(`items.${index}.costPrice`, (variant as any).costPrice);
    }
    const totalQty = filled.reduce((s, r) => s + r.quantity, 0);
    setValue(`items.${index}.quantity`, totalQty);
  }, [variantRows]);

  const updateRow = (i: number, key: string, val: any) => {
    setVariantRows(rows => rows.map((r, idx) => idx === i ? { ...r, [key]: val, ...(key === "color" ? { size: "" } : {}) } : r));
  };

  const addRow = () => setVariantRows(rows => [...rows, { color: "", size: "", quantity: 1 }]);
  const removeRow = (i: number) => setVariantRows(rows => rows.filter((_, idx) => idx !== i));

  const handleSelectProduct = (p: any) => {
    setValue(`items.${index}.productId`, p.id);
    setValue(`items.${index}.product`, p.name);
    if (p.costPrice) setValue(`items.${index}.costPrice`, p.costPrice);
    setValue(`items.${index}.variantId`, null);
    setValue(`items.${index}.color`, "");
    setValue(`items.${index}.size`, "");
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
  };

  const handleClearProduct = () => {
    setValue(`items.${index}.productId`, null);
    setValue(`items.${index}.product`, "");
    setValue(`items.${index}.variantId`, null);
    setValue(`items.${index}.color`, "");
    setValue(`items.${index}.size`, "");
    setValue(`items.${index}.unitPrice`, 0);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border cursor-pointer select-none bg-muted/20 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{index + 1}</div>
          <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-bold truncate max-w-[120px]">{productName}</span>
          {variantRows.filter(r => r.color && r.size).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {variantRows.filter(r => r.color && r.size).map((r, i) => (
                <Badge key={i} variant="outline" className="text-[9px] font-bold border-primary/30 text-primary">
                  {r.color} {r.size} ×{r.quantity}
                </Badge>
              ))}
            </div>
          ) : qty > 0 && price > 0 ? (
            <Badge variant="outline" className="text-[9px] font-bold border-primary/30 text-primary">
              {qty} × {formatCurrency(price)}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOnly && (
            <button type="button" onClick={e => { e.stopPropagation(); remove(); }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <CardContent className="px-4 pb-4 pt-3 space-y-3">

          {/* Product selector — stock only, no manual entry */}
          <div>
            <label className="text-xs font-medium flex items-center gap-1 mb-1.5 text-foreground">
              <Layers className="w-3 h-3" />اختر من المخزون *
            </label>
            {productId && selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold truncate">{selectedProduct.name}</span>
                </div>
                <button type="button" onClick={handleClearProduct}
                  className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors" title="تغيير المنتج">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ProductSearchCombobox products={products} allVariants={allVariants} onSelect={handleSelectProduct} />
            )}
          </div>

          {/* Color & Size (variants) */}
          {productId && productVariants.length > 0 && (
            <div className="space-y-2">
              {variantRows.map((row, ri) => {
                const sizesForColor = productVariants.filter((v: any) => v.color === row.color).map((v: any) => v.size);
                const rowVariant = productVariants.find((v: any) => v.color === row.color && v.size === row.size);
                const avail = rowVariant ? (rowVariant.totalQuantity ?? 0) : null;
                return (
                  <div key={ri} className="flex items-end gap-2 p-2 bg-muted/10 rounded-md border border-border/40">
                    {/* اللون */}
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">اللون</label>
                      <select
                        value={row.color}
                        onChange={e => updateRow(ri, "color", e.target.value)}
                        className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">اختر لون...</option>
                        {availableColors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {/* المقاس */}
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">المقاس</label>
                      <select
                        value={row.size}
                        disabled={!row.color}
                        onChange={e => updateRow(ri, "size", e.target.value)}
                        className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      >
                        <option value="">اختر مقاس...</option>
                        {sizesForColor.map((s: string) => {
                          const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === s);
                          const a = v ? (v.totalQuantity ?? 0) : 0;
                          return <option key={s} value={s} disabled={a === 0}>{s} {a === 0 ? "(نفد)" : `(${a})`}</option>;
                        })}
                      </select>
                    </div>
                    {/* الكمية */}
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">الكمية</label>
                      <div className="flex items-center gap-1">
                        <button type="button"
                          onClick={() => updateRow(ri, "quantity", Math.max(1, row.quantity - 1))}
                          className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                        <span className="w-8 text-center text-sm font-bold">{row.quantity}</span>
                        <button type="button"
                          onClick={() => updateRow(ri, "quantity", avail !== null ? Math.min(avail, row.quantity + 1) : row.quantity + 1)}
                          className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                      </div>
                    </div>
                    {/* حذف الصف */}
                    {variantRows.length > 1 && (
                      <button type="button" onClick={() => removeRow(ri)}
                        className="mb-0.5 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* متاح badge */}
                    {avail !== null && (
                      <span className={`text-[9px] font-bold mb-1 shrink-0 ${avail <= 5 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                        متاح:{avail}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* زر إضافة لون/مقاس آخر */}
              <button type="button" onClick={addRow}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 py-2 rounded-md transition-colors">
                <Plus className="w-3.5 h-3.5" />أضف لون / مقاس آخر
              </button>
            </div>
          )}

          {/* Qty & Price */}
          <div className="grid grid-cols-2 gap-3">
            <FormField control={control} name={`items.${index}.quantity`} render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">الكمية *</FormLabel>
                <FormControl><Input type="number" min="1" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />
            <FormField control={control} name={`items.${index}.unitPrice`} render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">سعر البيع (ج.م) *</FormLabel>
                <FormControl><Input type="number" min="0" step="0.01" className="h-9 text-sm" {...field} /></FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )} />
          </div>

          {/* Cost & profit (admin only) */}
          {canViewFinancials && (
            <div className="space-y-2">
              <FormField control={control} name={`items.${index}.costPrice`} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />تكلفة الوحدة (ج.م)
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="0" className="h-9 text-sm"
                      {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                  </FormControl>
                </FormItem>
              )} />
              {cost > 0 && (
                <div className="grid grid-cols-3 gap-2 p-2 bg-background/50 rounded border border-border text-center">
                  <div><p className="text-[9px] text-muted-foreground">إيرادات</p><p className="text-xs font-bold text-primary">{formatCurrency(revenue)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground">التكلفة</p><p className="text-xs font-bold text-amber-700 dark:text-amber-400">{formatCurrency(costTotal)}</p></div>
                  <div><p className="text-[9px] text-muted-foreground">الربح</p><p className={`text-xs font-bold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(profit)}</p></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [] }     = useQuery({ queryKey: ["products"],   queryFn: productsApi.list });
  const { data: allVariants = [] }  = useQuery({ queryKey: ["variants"],   queryFn: variantsApi.listAll });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"],   queryFn: shippingApi.list });
  const { data: warehouses }        = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });
  const { data: users }             = useQuery({ queryKey: ["users"],      queryFn: usersApi.list });
  const { canViewFinancials } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "", phone: "", city: "", address: "",
      shippingCost: 0, notes: "",
      warehouseId: null, assignedUserId: null, adSource: null, adCampaign: null,
      shippingCompanyId: null, items: [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items        = form.watch("items");
  const shippingCost = form.watch("shippingCost") || 0;
  const totalRevenue = items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
  const totalCost    = items.reduce((s, it) => s + (it.quantity || 0) * (it.costPrice || 0), 0);
  const totalProfit  = totalRevenue - totalCost - shippingCost;
  const totalMargin  = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const totalQty     = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const result = await ordersApi.batchCreate({
        customerName: values.customerName, phone: values.phone || null,
        city: values.city || null, address: values.address || null,
        shippingCost: values.shippingCost || null,
        shippingCompanyId: values.shippingCompanyId || null,
        warehouseId: values.warehouseId || null,
        assignedUserId: values.assignedUserId || null,
        adSource: values.adSource || null, adCampaign: values.adCampaign || null,
        notes: values.notes || null,
        items: values.items.map(item => ({
          product: item.product, color: item.color || null, size: item.size || null,
          quantity: item.quantity, unitPrice: item.unitPrice,
          costPrice: item.costPrice ?? null,
          productId: item.productId || null, variantId: item.variantId || null,
        })),
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-profit"] });
      toast({
        title: `تم إنشاء الطلب — فاتورة ${result.invoiceNumber}`,
        description: result.orders.length > 1
          ? `${result.orders.length} منتجات في فاتورة واحدة للعميل ${values.customerName}`
          : `الطلب #${result.orders[0]?.id} تم إنشاؤه بنجاح للعميل ${values.customerName}`,
      });
      setLocation(`/invoices/${encodeURIComponent(result.invoiceNumber)}`);
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل إنشاء الطلب.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
                            {shippingCompanies?.filter((c: any) => c.isActive).map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />المحافظة</FormLabel>
                        <FormControl><Input placeholder="القاهرة، الإسكندرية..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان بالتفصيل</FormLabel>
                        <FormControl><Input placeholder="الحي، الشارع، رقم المنزل..." className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              {/* Products */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />المنتجات
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                      {fields.length} {fields.length === 1 ? "منتج" : "منتجات"}
                    </Badge>
                  </h2>
                  <button type="button" onClick={() => append(emptyItem())}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-md transition-colors">
                    <Plus className="w-3.5 h-3.5" />أضف منتجاً
                  </button>
                </div>

                {fields.map((field, index) => (
                  <ProductItem key={field.id} index={index}
                    control={form.control} watch={form.watch} setValue={form.setValue}
                    remove={() => remove(index)} products={products} allVariants={allVariants}
                    canViewFinancials={canViewFinancials} isOnly={fields.length === 1} />
                ))}

                {fields.length >= 2 && (
                  <button type="button" onClick={() => append(emptyItem())}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary py-3 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />أضف منتجاً آخر
                  </button>
                )}
              </div>

              {/* Shipping cost */}
              {canViewFinancials && (
                <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/5">
                  <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />تكلفة الشحن الكلية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-3">
                    <FormField control={form.control} name="shippingCost" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">تكلفة الشحن (ج.م) — تُوزَّع على المنتجات</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" placeholder="0" className="h-9 text-sm"
                            {...field} value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 0)} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              )}

              {/* Tracking */}
              <Card className="border-purple-900/40 bg-purple-900/5">
                <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5 text-purple-400" />تتبع الإعلان والفريق
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
                            {warehouses?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}{w.isDefault ? " ★" : ""}</SelectItem>)}
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
                            {users?.filter((u: any) => u.isActive).map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.displayName}</SelectItem>)}
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

            {/* Summary sidebar */}
            <div>
              <Card className="border-primary/30 bg-card sticky top-4">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-bold text-primary">الملخص</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {items.map((it, i) => it.product && (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground truncate max-w-[100px]">{it.product}</span>
                        <span className="font-bold shrink-0">{formatCurrency((it.quantity || 0) * (it.unitPrice || 0))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 text-xs pt-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">عدد المنتجات</span><span>{fields.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الكمية</span><span>{totalQty}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-bold">إجمالي البيع</span>
                      <span className="font-bold text-base text-primary">{formatCurrency(totalRevenue)}</span>
                    </div>
                    {canViewFinancials && totalCost > 0 && (
                      <>
                        <div className="flex justify-between"><span className="text-muted-foreground">التكلفة</span><span className="text-amber-700 dark:text-amber-400">-{formatCurrency(totalCost)}</span></div>
                        {shippingCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">الشحن</span><span className="text-amber-700 dark:text-amber-400">-{formatCurrency(shippingCost)}</span></div>}
                        <div className="border-t border-border pt-2 flex justify-between">
                          <span className="font-bold">الربح الصافي</span>
                          <span className={`font-bold text-base ${totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{formatCurrency(totalProfit)}</span>
                        </div>
                        {totalRevenue > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">هامش الربح</span>
                            <span className={`font-bold ${totalMargin >= 20 ? "text-emerald-600 dark:text-emerald-400" : totalMargin >= 10 ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{totalMargin}%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <Button type="submit" className="w-full gap-2 bg-primary text-primary-foreground font-bold text-sm h-9" disabled={submitting}>
                    {submitting ? "جاري الحفظ..." : <><Save className="w-4 h-4" />{fields.length > 1 ? `إنشاء فاتورة (${fields.length} منتجات)` : "إنشاء الطلب"}</>}
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
