import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowRight, AlertCircle, Pencil, Save, X, Printer, Phone, MapPin, Trash2, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Lock, MessageCircle, Package, Truck, CheckCircle2, Clock, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect, useMemo } from "react";
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
import { ToastAction } from "@/components/ui/toast";
import { shippingApi, ordersApi, productsApi, variantsApi, manifestsApi } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

// ── Product Search Combobox (same as order-form) ──────────────────────────────
function ProductSearchCombobox({ products, allVariants, onSelect }: {
  products: any[]; allVariants: any[]; onSelect: (p: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const inStockProducts = useMemo(() => products.filter((p: any) => {
    const variants = allVariants.filter((v: any) => v.productId === p.id);
    if (variants.length > 0) return variants.some((v: any) => (v.totalQuantity ?? 0) > 0);
    return (p.totalQuantity ?? 0) > 0;
  }), [products, allVariants]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (q ? inStockProducts.filter((p: any) => p.name?.toLowerCase().includes(q)) : inStockProducts).slice(0, 20);
  }, [query, inStockProducts]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const getStock = (p: any) => {
    const variants = allVariants.filter((v: any) => v.productId === p.id);
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
              {query ? "لا يوجد منتج بهذا الاسم في المخزون" : "لا توجد منتجات متاحة"}
            </div>
          ) : filtered.map((p: any) => {
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

// ── Add Product Dialog ────────────────────────────────────────────────────────
function AddProductDialog({ open, onOpenChange, order, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants = [] } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { canViewFinancials } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [variantRows, setVariantRows] = useState<{ color: string; size: string; quantity: number }[]>([{ color: "", size: "", quantity: 1 }]);
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productVariants = allVariants.filter((v: any) => v.productId === selectedProduct?.id);
  const availableColors = [...new Set(productVariants.map((v: any) => v.color))] as string[];
  const hasVariants = productVariants.length > 0;

  const reset = () => {
    setSelectedProduct(null);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    setUnitPrice(0); setCostPrice(null);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    if (p.unitPrice) setUnitPrice(p.unitPrice);
    if (p.costPrice) setCostPrice(p.costPrice);
  };

  const updateRow = (i: number, key: string, val: any) => {
    setVariantRows(rows => {
      const next = rows.map((r, idx) => idx === i ? { ...r, [key]: val, ...(key === "color" ? { size: "" } : {}) } : r);
      // auto-fill price from variant
      if (key === "size") {
        const row = next[i];
        const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === val);
        if (v?.unitPrice) setUnitPrice(v.unitPrice);
        if (v?.costPrice) setCostPrice(v.costPrice);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);
    try {
      const filledRows = hasVariants ? variantRows.filter(r => r.color && r.size) : variantRows;
      if (filledRows.length === 0) {
        toast({ title: "خطأ", description: "اختر لون ومقاس على الأقل.", variant: "destructive" });
        return;
      }
      const items = filledRows.map(r => ({
        product: selectedProduct.name,
        color: r.color || null,
        size: r.size || null,
        quantity: r.quantity,
        unitPrice,
        costPrice: costPrice ?? null,
        productId: selectedProduct.id,
        variantId: hasVariants
          ? (productVariants.find((v: any) => v.color === r.color && v.size === r.size)?.id ?? null)
          : null,
      }));
      await ordersApi.batchCreate({
        invoiceNumber: order.invoiceNumber ?? undefined,
        customerName: order.customerName,
        phone: order.phone ?? null,
        city: order.city ?? null,
        address: order.address ?? null,
        shippingCompanyId: order.shippingCompanyId ?? null,
        notes: null,
        items,
      });
      toast({ title: "تم إضافة المنتج", description: `${selectedProduct.name} اتضاف للفاتورة بنجاح.` });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل الإضافة.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4 text-primary" />إضافة منتج لنفس الفاتورة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Product selector */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">اختر من المخزون *</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold">{selectedProduct.name}</span>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setVariantRows([{ color: "", size: "", quantity: 1 }]); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ProductSearchCombobox products={products} allVariants={allVariants} onSelect={handleSelectProduct} />
            )}
          </div>

          {/* Variants */}
          {selectedProduct && hasVariants && (
            <div className="space-y-2">
              {variantRows.map((row, ri) => {
                const sizesForColor = productVariants.filter((v: any) => v.color === row.color).map((v: any) => v.size);
                const rowVariant = productVariants.find((v: any) => v.color === row.color && v.size === row.size);
                const avail = rowVariant ? (rowVariant.totalQuantity ?? 0) : null;
                return (
                  <div key={ri} className="flex items-end gap-2 p-2 bg-muted/10 rounded-md border border-border/40">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">اللون</label>
                      <select value={row.color} onChange={e => updateRow(ri, "color", e.target.value)}
                        className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="">اختر لون...</option>
                        {availableColors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">المقاس</label>
                      <select value={row.size} disabled={!row.color} onChange={e => updateRow(ri, "size", e.target.value)}
                        className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                        <option value="">اختر مقاس...</option>
                        {sizesForColor.map((s: string) => {
                          const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === s);
                          const a = v ? (v.totalQuantity ?? 0) : 0;
                          return <option key={s} value={s} disabled={a === 0}>{s} {a === 0 ? "(نفد)" : `(${a})`}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">الكمية</label>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => updateRow(ri, "quantity", Math.max(1, row.quantity - 1))}
                          className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                        <span className="w-8 text-center text-sm font-bold">{row.quantity}</span>
                        <button type="button" onClick={() => updateRow(ri, "quantity", avail !== null ? Math.min(avail, row.quantity + 1) : row.quantity + 1)}
                          className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                      </div>
                    </div>
                    {variantRows.length > 1 && (
                      <button type="button" onClick={() => setVariantRows(r => r.filter((_, idx) => idx !== ri))}
                        className="mb-0.5 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {avail !== null && (
                      <span className={`text-[9px] font-bold mb-1 shrink-0 ${avail <= 5 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>متاح:{avail}</span>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={() => setVariantRows(r => [...r, { color: "", size: "", quantity: 1 }])}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 py-2 rounded-md transition-colors">
                <Plus className="w-3.5 h-3.5" />أضف لون / مقاس آخر
              </button>
            </div>
          )}

          {/* Qty (no variants) */}
          {selectedProduct && !hasVariants && (
            <div>
              <label className="text-xs font-medium mb-1.5 block">الكمية *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setVariantRows(r => [{ ...r[0], quantity: Math.max(1, r[0].quantity - 1) }])}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                <span className="w-10 text-center text-sm font-bold">{variantRows[0]?.quantity ?? 1}</span>
                <button type="button" onClick={() => setVariantRows(r => [{ ...r[0], quantity: r[0].quantity + 1 }])}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
              </div>
            </div>
          )}

          {/* Price */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
                <Input type="number" min={0} value={unitPrice || ""} onChange={e => setUnitPrice(Number(e.target.value))} className="h-9 text-sm" />
              </div>
              {canViewFinancials && (
                <div>
                  <label className="text-xs font-medium mb-1.5 block">تكلفة الوحدة (ج.م)</label>
                  <Input type="number" min={0} value={costPrice ?? ""} onChange={e => setCostPrice(e.target.value ? Number(e.target.value) : null)} className="h-9 text-sm" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }} className="flex-1">إلغاء</Button>
          <Button size="sm" onClick={handleSubmit}
            disabled={isSubmitting || !selectedProduct || unitPrice <= 0}
            className="flex-1 gap-1">
            <Plus className="w-3 h-3" />{isSubmitting ? "جاري الإضافة..." : "إضافة للفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Single Order Row Dialog ─────────────────────────────────────────────
function EditOrderRowDialog({ open, onOpenChange, order: o, shippingCompanies, products, allVariants, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any;
  shippingCompanies: any[]; products: any[]; allVariants: any[]; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateOrder = useUpdateOrder();
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [editColor, setEditColor] = useState("");

  const rowSchema = z.object({
    product: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
    unitPrice: z.coerce.number().min(0),
    notes: z.string().optional().nullable(),
  });
  const form = useForm<z.infer<typeof rowSchema>>({
    resolver: zodResolver(rowSchema),
    defaultValues: { product: o?.product || "", quantity: o?.quantity || 1, unitPrice: o?.unitPrice || 0, notes: o?.notes || "" },
  });

  useEffect(() => {
    if (o && open) {
      form.reset({ product: o.product, quantity: o.quantity, unitPrice: o.unitPrice, notes: o.notes ?? "" });
      setEditProductId(null); setEditColor("");
    }
  }, [o, open]);

  const onSubmit = (values: z.infer<typeof rowSchema>) => {
    updateOrder.mutate({ id: o.id, data: values }, {
      onSuccess: (updated: any) => {
        queryClient.setQueryData(getGetOrderQueryKey(o.id), updated);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
        toast({ title: "تم الحفظ", description: "تم تعديل المنتج بنجاح." });
        onSuccess(); onOpenChange(false);
      },
      onError: () => toast({ title: "خطأ", description: "فشل الحفظ.", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" />تعديل المنتج</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-2 p-3 bg-muted/10 rounded border border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1"><Package className="w-3 h-3" />اختر من المخزون (اختياري)</p>
              <Select value={editProductId?.toString() || "none"} onValueChange={v => {
                if (v === "none") { setEditProductId(null); setEditColor(""); }
                else {
                  const pid = Number(v); setEditProductId(pid); setEditColor("");
                  const p = products?.find((p: any) => p.id === pid);
                  if (p) form.setValue("product", p.name);
                }
              }}>
                <SelectTrigger className="h-8 text-xs bg-card"><SelectValue placeholder="اختر من المخزون..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— إدخال يدوي —</SelectItem>
                  {products?.map((p: any) => {
                    const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                    return <SelectItem key={p.id} value={String(p.id)}>{p.name} ({avail} متاح)</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {editProductId && allVariants?.some((v: any) => v.productId === editProductId) && (
                <Select value={editColor || "none"} onValueChange={v => {
                  setEditColor(v === "none" ? "" : v);
                  const variant = allVariants?.find((va: any) => va.productId === editProductId && `${va.color}-${va.size}` === v);
                  if (variant) form.setValue("unitPrice", variant.unitPrice);
                }}>
                  <SelectTrigger className="h-8 text-xs bg-card"><SelectValue placeholder="اختر لون / مقاس..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون تحديد —</SelectItem>
                    {allVariants?.filter((v: any) => v.productId === editProductId).map((v: any) => {
                      const avail = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
                      return <SelectItem key={v.id} value={`${v.color}-${v.size}`} disabled={avail === 0}>{v.color} / {v.size} — {avail === 0 ? "نفد" : `${avail} متاح`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <FormField control={form.control} name="product" render={({ field }) => (
                <FormItem className="col-span-1"><FormLabel className="text-xs">اسم المنتج *</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl><FormMessage className="text-xs" /></FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">الكمية</FormLabel><FormControl><Input type="number" min="1" className="h-8 text-sm" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="unitPrice" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">السعر</FormLabel><FormControl><Input type="number" min="0" step="0.01" className="h-8 text-sm" {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">ملاحظات</FormLabel><FormControl><Textarea className="min-h-[50px] text-sm resize-none" {...field} value={field.value ?? ""} /></FormControl></FormItem>
            )} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1">إلغاء</Button>
              <Button type="submit" size="sm" disabled={updateOrder.isPending} className="flex-1 gap-1">
                <Save className="w-3 h-3" />{updateOrder.isPending ? "جاري..." : "حفظ التعديل"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice View (multi-product) ─────────────────────────────────────────────
function InvoiceView({ orders, currentId, shippingCompanies, products, allVariants, onRefresh, isAdmin, formatCurrency }: {
  orders: any[]; currentId: number; shippingCompanies: any[]; products: any[]; allVariants: any[];
  onRefresh: () => void; isAdmin: boolean; formatCurrency: (n: number) => string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteId, setShowDeleteId] = useState<number | null>(null);

  const primaryOrder = orders.find(o => o.id === currentId) || orders[0];
  const invoiceTotal = orders.reduce((s, o) => s + (o.totalPrice ?? 0), 0);

  const handleDeleteItem = async (id: number) => {
    setDeletingId(id);
    try {
      await ordersApi.delete(id);
      queryClient.removeQueries({ queryKey: getGetOrderQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      toast({ title: "تم الحذف", description: "تم حذف المنتج من الفاتورة." });
      if (id === currentId) {
        const remaining = orders.filter(o => o.id !== id);
        if (remaining.length > 0) navigate(`/orders/${remaining[0].id}`);
        else navigate("/orders");
      } else { onRefresh(); }
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل الحذف.", variant: "destructive" });
    } finally { setDeletingId(null); setShowDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header الفاتورة */}
      <Card className="border-primary/40 bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">فاتورة</span>
                <span className="text-sm font-black text-primary">{primaryOrder.invoiceNumber}</span>
                <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">{orders.length} منتجات</Badge>
              </div>
              <p className="text-base font-bold">{primaryOrder.customerName}</p>
              {primaryOrder.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{primaryOrder.phone}</p>
              )}
              {primaryOrder.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{primaryOrder.address}</p>
              )}
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground mb-1">إجمالي الفاتورة</p>
              <p className="text-xl font-black text-primary">{formatCurrency(invoiceTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قائمة المنتجات */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />منتجات الفاتورة
          </h3>
          {isAdmin && (
            <button onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 px-3 py-1.5 rounded-md transition-colors">
              <Plus className="w-3.5 h-3.5" />إضافة منتج
            </button>
          )}
        </div>

        {orders.map(o => {
          const isThis = o.id === currentId;
          return (
            <Card key={o.id} className={`border ${isThis ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isThis && <span className="text-[9px] text-primary font-black bg-primary/10 px-1.5 py-0.5 rounded">← هذا الطلب</span>}
                      <Badge variant="outline" className={`text-[9px] font-bold ${statusClasses[o.status] || ""}`}>
                        {statusLabels[o.status] || o.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold truncate">{o.product}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {o.color && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{o.color}</Badge>}
                      {o.size && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{o.size}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{o.quantity} وحدة × {formatCurrency(o.unitPrice)}</span>
                      <span className="font-bold text-foreground">{formatCurrency(o.totalPrice)}</span>
                    </div>
                    {o.notes && <p className="text-[10px] text-muted-foreground mt-1 italic">{o.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-border"
                        onClick={() => setEditingOrder(o)}>
                        <Pencil className="w-3 h-3" />تعديل
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20"
                        onClick={() => setShowDeleteId(o.id)} disabled={deletingId === o.id}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditOrderRowDialog
        open={!!editingOrder} onOpenChange={v => { if (!v) setEditingOrder(null); }}
        order={editingOrder} shippingCompanies={shippingCompanies}
        products={products} allVariants={allVariants} onSuccess={onRefresh}
      />
      <AddProductDialog
        open={showAddProduct} onOpenChange={setShowAddProduct}
        order={primaryOrder} onSuccess={onRefresh}
      />
      <AlertDialog open={!!showDeleteId} onOpenChange={v => { if (!v) setShowDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا المنتج من الفاتورة؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDeleteId && handleDeleteItem(showDeleteId)}
              disabled={!!deletingId} className="bg-red-600 hover:bg-red-700 text-white">
              {deletingId ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function OrderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, canViewFinancials, user } = useAuth();
  const canWriteOrders = isAdmin || (user?.permissions?.includes("orders_write") ?? false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [partialQty, setPartialQty] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showWaDialog, setShowWaDialog] = useState(false);

  // Add product dialog state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductName, setAddProductName] = useState("");
  const [addProductQty, setAddProductQty] = useState(1);
  const [addProductPrice, setAddProductPrice] = useState(0);
  const [addProductColor, setAddProductColor] = useState("");
  const [addProductSize, setAddProductSize] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Return reason state
  const [showReturnInput, setShowReturnInput] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnIsDamaged, setReturnIsDamaged] = useState(false);
  const [returnReceived, setReturnReceived] = useState<boolean | null>(null); // null = لم يُحدد
  const [selectDisplayStatus, setSelectDisplayStatus] = useState<string | null>(null); // قيمة مؤقتة للـ Select

  const initializedRef = useRef(false);

  const { data: order, isLoading, error } = useGetOrder(id, { query: { enabled: !!id, queryKey: getGetOrderQueryKey(id) } });

  // جيب كل أوردرات الفاتورة (لو فيه invoiceNumber)
  const invoiceNumber = (order as any)?.invoiceNumber as string | null | undefined;
  const { data: invoiceOrders = [], refetch: refetchInvoiceOrders } = useQuery({
    queryKey: ["invoice-orders", invoiceNumber],
    queryFn: () => ordersApi.byInvoice(invoiceNumber!),
    enabled: !!invoiceNumber,
    staleTime: 0,
  });
  // كل أوردرات الفاتورة ماعدا الحالي (للعرض في القائمة)
  const otherInvoiceOrders = invoiceOrders.filter((o: any) => o.id !== id);

  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { data: manifestStatus } = useQuery({
    queryKey: ["order-manifest-status", id],
    queryFn: () => manifestsApi.getOrderManifestStatus(id),
    enabled: !!id,
    staleTime: 0,
  });
  // بيان مفتوح مرتبط بالطلب مباشرة؟
  const invoiceManifestStatus = manifestStatus?.manifestStatus === "open" ? manifestStatus : null;
  const updateOrder = useUpdateOrder();

  // Track selected product for stock display in edit mode
  const [editProductId, setEditProductId] = useState<number | null>(null);
  const [editColor, setEditColor] = useState<string>("");

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

    // ── تحقق من وجود بيان شحن مفتوح ──────────────────────────────────────
    const activeManifest = manifestStatus?.manifestStatus === "open"
      ? manifestStatus
      : invoiceManifestStatus?.manifestStatus === "open"
      ? invoiceManifestStatus
      : null;

    if (activeManifest) {
      toast({
        title: "⛔ لا يمكن تعديل حالة الطلب",
        description: `هذا الطلب مرتبط ببيان شحن مفتوح (${activeManifest.manifestNumber}). يجب تعديل حالته من داخل البيان في قسم شركات الشحن فقط.`,
        variant: "destructive",
      });
      setSelectDisplayStatus(null);
      return;
    }

    // إخفاء أي فورم مفتوح قبل أي تغيير
    setShowReturnInput(false);
    setShowPartialInput(false);
    setReturnReason("");
    setReturnNote("");
    setReturnIsDamaged(false);
    setReturnReceived(null);
    setPartialQty("");
    if (newStatus === "partial_received") {
      setSelectDisplayStatus("partial_received");
      setShowPartialInput(true);
      return;
    }
    if (newStatus === "returned") {
      setSelectDisplayStatus("returned");
      setShowReturnInput(true);
      return;
    }

    setSelectDisplayStatus(newStatus);
    updateOrder.mutate({ id, data: { status: newStatus as any } }, {
      onSuccess: (updated: any) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        setSelectDisplayStatus(null);
        invalidateAll();
        toast({ title: "تم تحديث الحالة", description: `الطلب أصبح: ${statusLabels[newStatus]}` });
      },
      onError: () => { setSelectDisplayStatus(null); toast({ title: "خطأ", description: "فشل تحديث الحالة.", variant: "destructive" }); },
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
        setSelectDisplayStatus(null);
        toast({ title: "تم التحديث", description: `تم استلام ${pQty} وحدة جزئياً.` });
      },
      onError: () => {
        setSelectDisplayStatus(null);
        toast({ title: "خطأ", description: "فشل التحديث.", variant: "destructive" });
      },
    });
  };

  const handleReturnConfirm = () => {
    if (!returnReason) { toast({ title: "خطأ", description: "اختر سبب الإرجاع.", variant: "destructive" }); return; }
    if (returnReason === "other" && !returnNote.trim()) { toast({ title: "خطأ", description: "اكتب سبب الإرجاع.", variant: "destructive" }); return; }

    // لو الطلب مش في بيان شحن → المرتجع تلقائياً في المخزن
    const inManifest = !!manifestStatus;
    const finalReturnReceived = inManifest ? returnReceived : true;
    if (inManifest && returnReceived === null) { toast({ title: "خطأ", description: "حدد هل تم استلام المرتجع أم لا.", variant: "destructive" }); return; }

    updateOrder.mutate({
      id,
      data: {
        status: "returned",
        returnReason,
        returnNote: returnReason === "other" ? returnNote.trim() : null,
        isDamaged: returnIsDamaged,
        returnReceived: finalReturnReceived,
      } as any,
    }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetOrderQueryKey(id), updated);
        // invalidate manifest-status عشان يتحدث بعد تغيير returnReceived
        queryClient.invalidateQueries({ queryKey: ["order-manifest-status", id] });
        queryClient.invalidateQueries({ queryKey: ["invoice-manifest-status"] });
        invalidateAll();
        setShowReturnInput(false);
        setReturnReason("");
        setReturnNote("");
        setReturnIsDamaged(false);
        setReturnReceived(null);
        setSelectDisplayStatus(null);
        const msg = returnReceived
          ? (returnIsDamaged ? "تم تسجيل المرتجع التالف — لم يُضاف للمخزون." : "تم استلام المرتجع وأُضيف للمخزون.")
          : "تم تسجيل المرتجع — مازال عند شركة الشحن.";
        toast({ title: "تم التسجيل", description: msg });
      },
      onError: () => {
        setSelectDisplayStatus(null);
        toast({ title: "خطأ", description: "فشل تحديث الحالة.", variant: "destructive" });
      },
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

  const handleAddProduct = async () => {
    if (!order || !addProductName.trim() || addProductPrice <= 0) return;
    setIsAddingProduct(true);
    try {
      await ordersApi.batchCreate({
        invoiceNumber: (order as any).invoiceNumber ?? undefined,
        customerName: order.customerName,
        phone: order.phone ?? null,
        city: (order as any).city ?? null,
        address: order.address ?? null,
        shippingCompanyId: order.shippingCompanyId ?? null,
        notes: null,
        items: [{
          product: addProductName.trim(),
          color: addProductColor || null,
          size: addProductSize || null,
          quantity: addProductQty,
          unitPrice: addProductPrice,
        }],
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      setShowAddProduct(false);
      setAddProductName(""); setAddProductQty(1); setAddProductPrice(0);
      setAddProductColor(""); setAddProductSize("");
      toast({ title: "تم إضافة المنتج", description: `${addProductName} اتضاف لنفس الفاتورة بنجاح.` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message || "فشل إضافة المنتج.", variant: "destructive" });
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await ordersApi.delete(id);
      // Remove this order from cache immediately so it won't show on return
      queryClient.removeQueries({ queryKey: getGetOrderQueryKey(id) });
      // Force-refetch the orders list (bypass staleTime)
      await queryClient.refetchQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["orders-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح." });
      navigate("/orders");
    } catch (err: any) {
      const msg = err?.message || "فشل حذف الطلب.";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
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
        { id, data: { status: "warehouse_ready" as any } },
        {
          onSuccess: (updated: any) => {
            queryClient.setQueryData(getGetOrderQueryKey(id), updated);
            invalidateAll();
            toast({ title: "تم إرسال واتساب ✅", description: "تم تحويل الطلب لـ «قيد الشحن في المخزن» — جاهز للبيان" });
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
  const isManifestLocked = !!invoiceManifestStatus;
  const isInvoiceMode = invoiceOrders.length > 1;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500">

      {/* ── وضع الفاتورة المتعددة: عرض مختلف تماماً ── */}
      {isInvoiceMode && (
        <>
          <div className="flex items-center gap-3">
            <Link href="/orders">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border"><ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">فاتورة {invoiceNumber}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</p>
            </div>
          </div>
          <InvoiceView
            orders={invoiceOrders}
            currentId={id}
            shippingCompanies={shippingCompanies ?? []}
            products={products ?? []}
            allVariants={allVariants ?? []}
            isAdmin={isAdmin}
            formatCurrency={formatCurrency}
            onRefresh={() => {
              refetchInvoiceOrders();
              queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
            }}
          />
        </>
      )}

      {/* ── وضع الطلب الفردي ── */}
      {!isInvoiceMode && <><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border"><ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">طلب #{order.id.toString().padStart(4,"0")}</h1>
              {!isEditing && (
                <Badge variant="outline" className={`font-bold border text-[10px] ${statusClasses[selectDisplayStatus ?? order.status] || ""}`}>
                  {statusLabels[selectDisplayStatus ?? order.status] || order.status}
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
          {!isEditing && isAdmin && (
            <>
              <div className="w-44">
                <Select value={selectDisplayStatus ?? order.status} onValueChange={handleStatusChange} disabled={updateOrder.isPending}>
                  <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="warehouse_ready">قيد الشحن في المخزن</SelectItem>
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
              <Button
                variant="outline" size="sm"
                onClick={() => setShowAddProduct(true)}
                className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="w-3 h-3" />إضافة منتج
              </Button>
              {order.status === "warehouse_ready" && (
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 border-border">
                  <Printer className="w-3 h-3" />فاتورة
                </Button>
              )}
              {(order.status === "pending" || order.status === "warehouse_ready") && (
                <Button
                  variant="outline" size="sm"
                  onClick={handleWhatsApp}
                  className="h-8 text-xs gap-1 border-green-700 text-green-400 hover:bg-green-500/10 hover:text-green-400"
                >
                  <MessageCircle className="w-3 h-3" />واتساب
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  if (isManifestLocked) {
                    toast({
                      title: "⛔ ممنوع حذف الطلب",
                      description: `هذا الطلب مرتبط ببيان شحن مفتوح (${invoiceManifestStatus?.manifestNumber}) — لا يمكن حذفه طالما البيان مفتوح. أغلق البيان أولاً ثم احذف الطلب.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!isOrderLocked) setShowDeleteDialog(true);
                }}
                disabled={isOrderLocked}
                title={
                  isManifestLocked
                    ? `ممنوع الحذف — الطلب في بيان مفتوح (${invoiceManifestStatus?.manifestNumber})`
                    : isOrderLocked
                    ? "الطلب مقفل — فقط المدير يمكنه الحذف"
                    : undefined
                }
                className="h-8 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />حذف
              </Button>
            </>
          )}
          {!isEditing && !isAdmin && order.status === "warehouse_ready" && (
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs gap-1 border-border">
              <Printer className="w-3 h-3" />فاتورة
            </Button>
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
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>إلغاء</Button>
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
            {/* هل تم استلام المرتجع؟ — يظهر فقط لو الطلب في بيان شحن */}
            {!!manifestStatus && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">هل تم استلام المرتجع؟ *</p>
              <div className="flex gap-2.5">
                {/* تم الاستلام */}
                <button type="button" onClick={() => setReturnReceived(true)}
                  className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"
                  style={{ borderRadius: 14 }}>
                  <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{
                    background: returnReceived === true ? "#085041" : "var(--color-background-secondary)",
                    border: returnReceived === true ? "none" : "1.5px solid #9FE1CB",
                  }} />
                  <div className={`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${returnReceived === true ? "mb-1" : "mb-0"}`} style={{
                    background: returnReceived === true ? "#0F6E56" : "var(--color-background-primary)",
                    border: returnReceived === true ? "none" : "1.5px solid #9FE1CB",
                    boxShadow: returnReceived === true ? "inset 0 0 0 2px rgba(159,225,203,0.4)" : "none",
                    transform: returnReceived === true ? "translateY(2px)" : "none",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke={returnReceived === true ? "#E1F5EE" : "#1D9E75"}
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 7L9 18l-5-5"/>
                    </svg>
                    <span className="text-[11px] font-semibold leading-tight" style={{ color: returnReceived === true ? "#E1F5EE" : "#0F6E56" }}>تم الاستلام</span>
                    <span className="text-[9px] leading-tight" style={{ color: returnReceived === true ? "rgba(225,245,238,0.7)" : "#5F5E5A" }}>يُعاد للمخزن</span>
                  </div>
                </button>
                {/* مازال في الشحن */}
                <button type="button" onClick={() => setReturnReceived(false)}
                  className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"
                  style={{ borderRadius: 14 }}>
                  <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{
                    background: returnReceived === false ? "#412402" : "var(--color-background-secondary)",
                    border: returnReceived === false ? "none" : "1.5px solid #FAC775",
                  }} />
                  <div className={`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${returnReceived === false ? "mb-1" : "mb-0"}`} style={{
                    background: returnReceived === false ? "#854F0B" : "var(--color-background-primary)",
                    border: returnReceived === false ? "none" : "1.5px solid #FAC775",
                    boxShadow: returnReceived === false ? "inset 0 0 0 2px rgba(250,199,117,0.4)" : "none",
                    transform: returnReceived === false ? "translateY(2px)" : "none",
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                      stroke={returnReceived === false ? "#FAEEDA" : "#BA7517"}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="3" width="15" height="13" rx="2"/>
                      <path d="M16 8h4l3 5v3h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    <span className="text-[11px] font-semibold leading-tight" style={{ color: returnReceived === false ? "#FAEEDA" : "#854F0B" }}>مازال في الشحن</span>
                    <span className="text-[9px] leading-tight" style={{ color: returnReceived === false ? "rgba(250,238,218,0.7)" : "#5F5E5A" }}>لا يؤثر على المخزن</span>
                  </div>
                </button>
              </div>
              <p className="text-[10px] text-center font-medium" style={{
                color: returnReceived === true ? "#0F6E56" : returnReceived === false ? "#854F0B" : "var(--color-text-secondary)",
              }}>
                {returnReceived === true && "✓ سيتم إرجاع البضاعة للمخزن تلقائياً"}
                {returnReceived === false && "⏳ مرتجع مازال في شركة الشحن — لن يؤثر على المخزن"}
                {returnReceived === null && "⚠ مطلوب — حدد حالة الاستلام"}
              </p>
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
              <Button size="sm" className="h-8 text-xs bg-red-700 hover:bg-red-600 text-white gap-1" onClick={handleReturnConfirm} disabled={updateOrder.isPending || (!!manifestStatus && returnReceived === null)}>
                <RotateCcw className="w-3 h-3" />{updateOrder.isPending ? "جاري..." : "تأكيد الإرجاع"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); }}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── بيانات البيان (لو الطلب في بيان شحن ومش في قيد الانتظار) ──────────────────────────── */}
      {manifestStatus && order.status !== "pending" && (
        <Card className={`border ${
          manifestStatus.deliveryStatus === "returned"
            ? "border-red-800 bg-red-900/10"
            : manifestStatus.deliveryStatus === "delivered"
            ? "border-emerald-800 bg-emerald-900/10"
            : manifestStatus.deliveryStatus === "partial_received"
            ? "border-teal-800 bg-teal-900/10"
            : manifestStatus.deliveryStatus === "postponed"
            ? "border-orange-800 bg-orange-900/10"
            : "border-border bg-muted/5"
        }`}>
          <CardContent className="p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">بيان الشحن</span>
                <Link href={`/shipping/manifests/${manifestStatus.manifestId}`}>
                  <span className="text-xs font-mono text-primary hover:underline cursor-pointer">{manifestStatus.manifestNumber}</span>
                </Link>
                <Badge variant="outline" className={`text-[9px] font-bold ${manifestStatus.manifestStatus === "open" ? "border-green-600 text-green-500" : "border-border text-muted-foreground"}`}>
                  {manifestStatus.manifestStatus === "open" ? "مفتوح" : "مغلق"}
                </Badge>
              </div>
              <Badge variant="outline" className={`text-[10px] font-bold border ${
                manifestStatus.deliveryStatus === "delivered" ? "border-emerald-600 text-emerald-400" :
                manifestStatus.deliveryStatus === "returned" ? "border-red-600 text-red-400" :
                manifestStatus.deliveryStatus === "postponed" ? "border-orange-600 text-orange-400" :
                manifestStatus.deliveryStatus === "partial_received" ? "border-teal-600 text-teal-400" :
                "border-border text-muted-foreground"
              }`}>
                {{
                  delivered: "مسلَّم ✓",
                  returned: "مرتجع",
                  postponed: "مؤجل",
                  partial_received: `استلم جزئي${manifestStatus.partialQuantity ? ` (${manifestStatus.partialQuantity})` : ""}`,
                  pending: "قيد الانتظار",
                }[manifestStatus.deliveryStatus] ?? manifestStatus.deliveryStatus}
              </Badge>
            </div>

            {/* حالة المرتجع — تظهر فقط لو حالة الطلب الفعلية = returned */}
            {manifestStatus.deliveryStatus === "returned" && order.status === "returned" && (() => {
              // اعتمد على order.returnReceived كمصدر رئيسي
              const rr = (order as any).returnReceived ?? manifestStatus.returnReceived;
              return (
                <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold ${
                  rr === 1 || rr === true
                    ? "bg-emerald-900/20 text-emerald-400 border border-emerald-700"
                    : rr === 0 || rr === false
                    ? "bg-orange-900/20 text-orange-400 border border-orange-700"
                    : "bg-muted/20 text-muted-foreground border border-border"
                }`}>
                  {(rr === 1 || rr === true) && <><CheckCircle2 className="w-3.5 h-3.5" /> تم استلام المرتجع — البضاعة رجعت للمخزن</>}
                  {(rr === 0 || rr === false) && <><Clock className="w-3.5 h-3.5" /> المرتجع مازال عند شركة الشحن — لم يُستلم بعد</>}
                </div>
              );
            })()}

            {manifestStatus.deliveryNote && (
              <p className="text-xs text-muted-foreground">ملاحظة: {manifestStatus.deliveryNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── حالة كل منتج في الفاتورة المتعددة ───────────────────────────────── */}
      {invoiceManifestStatus && invoiceManifestStatus.length > 1 && (
        <Card className="border-border bg-muted/5">
          <CardContent className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">حالة منتجات الفاتورة في البيان</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {invoiceManifestStatus.map(item => {
                const isThis = item.orderId === id;
                const ds = item.deliveryStatus;
                const dsColor =
                  ds === "delivered" ? "border-emerald-600 text-emerald-400 bg-emerald-900/10" :
                  ds === "returned" ? "border-red-600 text-red-400 bg-red-900/10" :
                  ds === "partial_received" ? "border-teal-600 text-teal-400 bg-teal-900/10" :
                  ds === "postponed" ? "border-orange-600 text-orange-400 bg-orange-900/10" :
                  "border-border text-muted-foreground bg-muted/10";
                const dsLabel: Record<string, string> = {
                  delivered: "✓ مسلَّم",
                  returned: "↩ مرتجع",
                  partial_received: `◑ استلم جزئي${item.manifestPartialQuantity != null ? ` (${item.manifestPartialQuantity}/${item.quantity})` : ""}`,
                  postponed: "⏸ مؤجل",
                  pending: "⏳ قيد الانتظار",
                };
                const subStatus = (() => {
                  if (ds === "returned") {
                    if (item.returnReceived === 1) return <span className="text-[9px] text-emerald-400">✓ المرتجع في المخزن</span>;
                    if (item.returnReceived === 0) return <span className="text-[9px] text-orange-400">🚚 المرتجع عند الشحن</span>;
                  }
                  if (ds === "partial_received") {
                    if (item.returnReceived === 0) return <span className="text-[9px] text-orange-400">🚚 الباقي عند الشحن</span>;
                    if (item.returnReceived === 1) return <span className="text-[9px] text-emerald-400">✓ الباقي في المخزن</span>;
                  }
                  return null;
                })();
                return (
                  <div key={item.orderId} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 border ${isThis ? "border-primary/40 bg-primary/5" : "border-border bg-transparent"}`}>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className={`text-xs font-semibold truncate ${isThis ? "text-primary" : "text-foreground"}`}>
                        {isThis && <span className="text-[9px] text-primary font-bold ml-1">← هذا الطلب</span>}
                        {item.product}
                      </span>
                      <span className="text-[9px] text-muted-foreground">كمية: {item.quantity}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {ds ? (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold border ${dsColor}`}>
                          {dsLabel[ds] ?? ds}
                        </span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">لا يوجد بيان</span>
                      )}
                      {subStatus}
                    </div>
                  </div>
                );
              })}
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
                    {/* Product picker from inventory */}
                    <div className="space-y-2 p-3 bg-muted/10 rounded border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1"><Package className="w-3 h-3" />اختر من المخزون (اختياري)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Product dropdown */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">المنتج</p>
                          <Select
                            value={editProductId?.toString() || "none"}
                            onValueChange={v => {
                              if (v === "none") {
                                setEditProductId(null);
                                setEditColor("");
                              } else {
                                const pid = Number(v);
                                setEditProductId(pid);
                                setEditColor("");
                                const p = products?.find(p => p.id === pid);
                                if (p) form.setValue("product", p.name);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-card"><SelectValue placeholder="اختر من المخزون..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— إدخال يدوي —</SelectItem>
                              {products?.map(p => {
                                const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                                return (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.name} ({avail} متاح)
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Color dropdown (only if product has variants) */}
                        {editProductId && allVariants?.some(v => v.productId === editProductId) && (
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">اللون / المقاس</p>
                            <Select
                              value={editColor || "none"}
                              onValueChange={v => {
                                setEditColor(v === "none" ? "" : v);
                                const variant = allVariants?.find(va => va.productId === editProductId && `${va.color}-${va.size}` === v);
                                if (variant) form.setValue("unitPrice", variant.unitPrice);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-card"><SelectValue placeholder="اختر..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— بدون تحديد —</SelectItem>
                                {allVariants
                                  ?.filter(v => v.productId === editProductId)
                                  .map(v => {
                                    const avail = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
                                    const key = `${v.color}-${v.size}`;
                                    return (
                                      <SelectItem key={v.id} value={key} disabled={avail === 0}>
                                        {v.color} / {v.size} — {avail === 0 ? "نفد" : `${avail} متاح`}
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {/* Stock badge */}
                      {editProductId && (() => {
                        const variants = allVariants?.filter(v => v.productId === editProductId) ?? [];
                        if (variants.length === 0) {
                          const p = products?.find(p => p.id === editProductId);
                          if (!p) return null;
                          const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                          return (
                            <Badge variant="outline" className={`text-[9px] font-bold border ${avail <= p.lowStockThreshold ? "border-red-700 text-red-400" : "border-emerald-700 text-emerald-400"}`}>
                              متاح في المخزون: {avail} وحدة
                            </Badge>
                          );
                        }
                        if (editColor) {
                          const variant = variants.find(v => `${v.color}-${v.size}` === editColor);
                          if (!variant) return null;
                          const avail = variant.totalQuantity - variant.reservedQuantity - variant.soldQuantity;
                          return (
                            <Badge variant="outline" className={`text-[9px] font-bold border ${avail <= variant.lowStockThreshold ? "border-red-700 text-red-400" : "border-emerald-700 text-emerald-400"}`}>
                              متاح ({variant.color} / {variant.size}): {avail} وحدة
                            </Badge>
                          );
                        }
                        const totalAvail = variants.reduce((s, v) => s + v.totalQuantity - v.reservedQuantity - v.soldQuantity, 0);
                        return (
                          <Badge variant="outline" className="text-[9px] font-bold border-primary/40 text-primary">
                            إجمالي المتاح: {totalAvail} وحدة ({variants.length} متغيرات)
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField control={form.control} name="product" render={({ field }) => (
                        <FormItem className="col-span-1"><FormLabel className="text-xs">اسم المنتج</FormLabel><FormControl><Input className="h-8 text-sm" {...field} /></FormControl></FormItem>
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

                    {/* ── إضافة منتج جوه التعديل ── */}
                    {invoiceNumber && (
                      <div className="border border-dashed border-primary/30 rounded-md p-3 bg-primary/5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                            <Package className="w-3 h-3" />منتجات الفاتورة ({invoiceOrders.length > 0 ? invoiceOrders.length : 1})
                          </p>
                          <button
                            type="button"
                            onClick={() => { setIsEditing(false); setTimeout(() => setShowAddProduct(true), 100); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded transition-colors"
                          >
                            <Plus className="w-3 h-3" />إضافة منتج للفاتورة
                          </button>
                        </div>
                        {otherInvoiceOrders.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {otherInvoiceOrders.map((o: any) => (
                              <div key={o.id} className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                <span className="font-medium">{o.product}{o.color ? ` — ${o.color}` : ""}{o.size ? ` / ${o.size}` : ""}</span>
                                <span>{o.quantity} وحدة</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" size="sm" className="h-8 text-xs gap-1" disabled={updateOrder.isPending}>
                        <Save className="w-3 h-3" />{updateOrder.isPending ? "جاري..." : "حفظ"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setIsEditing(false); initializedRef.current = false; setEditProductId(null); setEditColor(""); }}>
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
                    {/* Stock badge: show current inventory for this product/variant */}
                    {(() => {
                      const orderColor = (order as any).color as string | null;
                      const orderSize = (order as any).size as string | null;
                      const orderProductId = (order as any).productId as number | null;
                      const orderVariantId = (order as any).variantId as number | null;

                      // Match by variantId first
                      if (orderVariantId && allVariants) {
                        const v = allVariants.find(v => v.id === orderVariantId);
                        if (v) {
                          const avail = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
                          const isLow = avail <= v.lowStockThreshold;
                          return (
                            <div className="mt-1.5">
                              <Badge variant="outline" className={`text-[9px] font-bold border ${avail === 0 ? "border-red-700 text-red-400" : isLow ? "border-amber-700 text-amber-400" : "border-emerald-700 text-emerald-400"}`}>
                                <Package className="w-2.5 h-2.5 ml-1" />
                                المخزون: {avail} وحدة
                              </Badge>
                            </div>
                          );
                        }
                      }

                      // Match by productId
                      if (orderProductId && products) {
                        const p = products.find(p => p.id === orderProductId);
                        if (p) {
                          // If has color/size, try to match variant
                          if ((orderColor || orderSize) && allVariants) {
                            const v = allVariants.find(v =>
                              v.productId === orderProductId &&
                              (!orderColor || v.color === orderColor) &&
                              (!orderSize || v.size === orderSize)
                            );
                            if (v) {
                              const avail = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
                              const isLow = avail <= v.lowStockThreshold;
                              return (
                                <div className="mt-1.5">
                                  <Badge variant="outline" className={`text-[9px] font-bold border ${avail === 0 ? "border-red-700 text-red-400" : isLow ? "border-amber-700 text-amber-400" : "border-emerald-700 text-emerald-400"}`}>
                                    <Package className="w-2.5 h-2.5 ml-1" />
                                    المخزون: {avail} وحدة
                                  </Badge>
                                </div>
                              );
                            }
                          }
                          // Product-level stock (no variants)
                          if (!allVariants?.some(v => v.productId === orderProductId)) {
                            const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                            const isLow = avail <= p.lowStockThreshold;
                            return (
                              <div className="mt-1.5">
                                <Badge variant="outline" className={`text-[9px] font-bold border ${avail === 0 ? "border-red-700 text-red-400" : isLow ? "border-amber-700 text-amber-400" : "border-emerald-700 text-emerald-400"}`}>
                                  <Package className="w-2.5 h-2.5 ml-1" />
                                  المخزون: {avail} وحدة
                                </Badge>
                              </div>
                            );
                          }
                        }
                      }

                      return null;
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">الكمية</p>
                    <p className="font-semibold">{order.quantity} وحدة</p>
                    {/* حالة المنتج — المرتجع يعتمد على order مباشرة (بغض النظر عن وجود بيان شحن) */}
                    {(() => {
                      // لو الطلب مرتجع: اعتمد على order.returnReceived دائماً
                      if (order.status === "returned") {
                        const returnRec = (order as any).returnReceived;
                        return (
                          <div className="mt-1.5 flex flex-col gap-1">
                            {(returnRec === 1 || returnRec === true) ? (
                              <Badge variant="outline" className="text-[9px] font-bold border-emerald-700 text-emerald-400 w-fit">
                                <CheckCircle2 className="w-2.5 h-2.5 ml-1" />تم الاستلام — رجع للمخزن
                              </Badge>
                            ) : (
                              <>
                                <Badge variant="outline" className="text-[9px] font-bold border-red-600 text-red-400 w-fit">
                                  ↩ مرتجع
                                </Badge>
                                {(returnRec === 0 || returnRec === false) && (
                                  <Badge variant="outline" className="text-[9px] font-bold border-orange-600 text-orange-400 w-fit">
                                    <Clock className="w-2.5 h-2.5 ml-1" />مازال عند شركة الشحن
                                  </Badge>
                                )}
                                {(returnRec === 1 || returnRec === true) && (
                                  <Badge variant="outline" className="text-[9px] font-bold border-emerald-600 text-emerald-400 w-fit">
                                    <CheckCircle2 className="w-2.5 h-2.5 ml-1" />في المخزن
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }
                      // باقي الحالات تعتمد على بيان الشحن
                      if (!manifestStatus) return null;
                      const ds = manifestStatus.deliveryStatus;
                      const pQty = manifestStatus.partialQuantity;
                      if (ds === "delivered") return (
                        <div className="mt-1.5 flex flex-col gap-1">
                          <Badge variant="outline" className="text-[9px] font-bold border-emerald-600 text-emerald-400 w-fit">
                            <CheckCircle2 className="w-2.5 h-2.5 ml-1" />تم التسليم ✓
                          </Badge>
                        </div>
                      );
                      if (ds === "partial_received") return (
                        <div className="mt-1.5 flex flex-col gap-1">
                          <Badge variant="outline" className="text-[9px] font-bold border-teal-600 text-teal-400 w-fit">
                            ◑ استُلم جزئياً — {pQty ?? "؟"} من {order.quantity}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] font-bold border-amber-600 text-amber-400 w-fit">
                            🚚 الباقي ({(pQty != null ? order.quantity - pQty : "؟")}) مازال عند الشحن
                          </Badge>
                        </div>
                      );
                      if (ds === "postponed") return (
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-[9px] font-bold border-orange-600 text-orange-400 w-fit">
                            ⏳ مؤجل
                          </Badge>
                        </div>
                      );
                      if (ds === "pending") return (
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-[9px] font-bold border-blue-600 text-blue-400 w-fit">
                            🚚 قيد الشحن
                          </Badge>
                        </div>
                      );
                      return null;
                    })()}
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

                {/* ── منتجات الفاتورة الأخرى ── */}
                {otherInvoiceOrders.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Package className="w-3 h-3" />منتجات الفاتورة ({otherInvoiceOrders.length + 1} منتجات)
                      </p>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setShowAddProduct(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 px-2 py-1 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />إضافة منتج
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {/* الطلب الحالي */}
                      <div className="flex items-center justify-between rounded-md px-2.5 py-2 border border-primary/40 bg-primary/5">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-primary font-bold">← هذا الطلب</span>
                          </div>
                          <span className="text-xs font-semibold text-primary truncate">{order.product}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {(order as any).color && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{(order as any).color}</Badge>}
                            {(order as any).size && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary font-bold">{(order as any).size}</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-bold">{order.quantity} وحدة</span>
                          <span className="text-[10px] text-primary font-bold">{formatCurrency(order.totalPrice)}</span>
                        </div>
                      </div>
                      {/* باقي المنتجات في الفاتورة */}
                      {otherInvoiceOrders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between rounded-md px-2.5 py-2 border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-xs font-semibold truncate">{o.product}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {o.color && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{o.color}</Badge>}
                              {o.size && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground font-bold">{o.size}</Badge>}
                            </div>
                            <Badge variant="outline" className={`text-[9px] font-bold w-fit mt-0.5 ${statusClasses[o.status] || ""}`}>
                              {statusLabels[o.status] || o.status}
                            </Badge>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-xs font-bold">{o.quantity} وحدة</span>
                            <span className="text-[10px] text-muted-foreground font-bold">{formatCurrency(o.totalPrice)}</span>
                            <Link href={`/orders/${o.id}`}>
                              <span className="text-[9px] text-primary hover:underline cursor-pointer">عرض ←</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                      {/* إجمالي الفاتورة */}
                      <div className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-muted/20 border border-border/40 mt-1">
                        <span className="text-xs font-bold text-muted-foreground">إجمالي الفاتورة</span>
                        <span className="text-sm font-black text-primary">
                          {formatCurrency([...invoiceOrders].reduce((s: number, o: any) => s + (o.totalPrice ?? 0), 0))}
                        </span>
                      </div>
                    </div>
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
            const returnRec = (order as any).returnReceived;
            const isReturnedToStock = isReturned && (returnRec === 1 || returnRec === true);
            const isReturnedLost = isReturned && !isReturnedToStock;
            // لو رجع المخزن: لا خسارة في البضاعة (الكمية اترجعت) — بس في خسارة شحن فقط
            // لو مازال عند الشحن: خسارة كاملة
            const revenue = isReturned ? 0 : qty * order.unitPrice;
            const cost = isReturnedToStock ? 0 : qty * costPrice; // رجع المخزن = مفيش خسارة بضاعة
            const shipping = shippingCost ?? 0;
            const netProfit = revenue - cost - shipping;
            const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
            const isPositive = netProfit >= 0;
            return (
              <Card className={`border ${isReturnedLost ? "border-red-900/50 bg-red-900/5" : isReturnedToStock ? "border-amber-900/50 bg-amber-900/5" : isPositive ? "border-emerald-900/50 bg-emerald-900/5" : "border-red-900/50 bg-red-900/5"}`}>
                <CardHeader className="pb-2 pt-4 px-4 border-b border-border">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    {isReturnedToStock ? <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> : isPositive && !isReturned ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    تحليل الربحية
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-3 space-y-2 text-xs">
                  {isReturnedLost && (
                    <div className="p-2 bg-red-900/20 rounded text-red-400 text-[10px] font-semibold border border-red-900/30">
                      مرتجع — خسارة كاملة
                    </div>
                  )}
                  {isReturnedToStock && (
                    <div className="p-2 bg-amber-900/20 rounded text-amber-400 text-[10px] font-semibold border border-amber-900/30">
                      ↩ رجع للمخزن — خسارة الشحن فقط
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

      {/* ── Add Product Dialog ── */}
      <AddProductDialog
        open={showAddProduct}
        onOpenChange={setShowAddProduct}
        order={order}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["invoice-orders", invoiceNumber] });
          refetchInvoiceOrders();
        }}
      />
      </>}
    </div>
  );
}
