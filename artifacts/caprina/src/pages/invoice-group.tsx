import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowRight, AlertCircle, Printer, Trash2, RefreshCw,
  Package, Phone, MapPin, RotateCcw, Lock, MessageCircle,
  Pencil, Plus, Save, X, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateOrder, getGetOrderQueryKey, getListOrdersQueryKey, getGetOrdersSummaryQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ordersApi, apiFetch, manifestsApi, productsApi, variantsApi, shippingApi } from "@/lib/api";
import { STATUS_LABELS as statusLabels, STATUS_CLASSES as statusClasses } from "@/lib/order-constants";
import { type WhatsAppOrderData } from "@/lib/whatsapp";
import { WhatsAppDialog } from "@/components/whatsapp-dialog";
import { useBrand } from "@/contexts/BrandContext";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

// ── Product Search Combobox ───────────────────────────────────────────────────
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
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">لا يوجد منتج في المخزون</div>
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

// ── Edit Product Dialog ───────────────────────────────────────────────────────
function EditProductDialog({ open, onOpenChange, order: o, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateOrder = useUpdateOrder();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants = [] } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });

  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (o && open) {
      setProduct(o.product || "");
      setQuantity(o.quantity || 1);
      setUnitPrice(o.unitPrice || 0);
      setColor(o.color || "");
      setSize(o.size || "");
      setNotes(o.notes || "");
      setSelectedProduct(null);
    }
  }, [o, open]);

  const productVariants = allVariants.filter((v: any) => v.productId === selectedProduct?.id);
  const availableColors = [...new Set(productVariants.map((v: any) => v.color))] as string[];
  const hasVariants = productVariants.length > 0;

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setProduct(p.name);
    setColor(""); setSize("");
    if (p.unitPrice) setUnitPrice(p.unitPrice);
  };

  const handleSubmit = async () => {
    if (!product.trim() || unitPrice <= 0 || quantity < 1) {
      toast({ title: "خطأ", description: "تأكد من اسم المنتج والسعر والكمية.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise<void>((resolve, reject) => {
        updateOrder.mutate({ id: o.id, data: { product, quantity, unitPrice, color: color || null, size: size || null, notes: notes || null } as any }, {
          onSuccess: (updated: any) => {
            queryClient.setQueryData(getGetOrderQueryKey(o.id), updated);
            resolve();
          },
          onError: () => reject(),
        });
      });
      await queryClient.invalidateQueries({ queryKey: ["invoice-group"] });
      await queryClient.refetchQueries({ queryKey: ["invoice-group"] });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "تم الحفظ", description: "تم تعديل المنتج بنجاح." });
      onSuccess(); onOpenChange(false);
    } catch {
      toast({ title: "خطأ", description: "فشل الحفظ.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />تعديل المنتج
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-medium mb-1.5 block">اختر من المخزون (اختياري)</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold">{selectedProduct.name}</span>
                </div>
                <button type="button" onClick={() => setSelectedProduct(null)}
                  className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <ProductSearchCombobox products={products} allVariants={allVariants} onSelect={handleSelectProduct} />
            )}
          </div>
          {selectedProduct && hasVariants && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">اللون</label>
                <select value={color} onChange={e => { setColor(e.target.value); setSize(""); }}
                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">اختر لون...</option>
                  {availableColors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">المقاس</label>
                <select value={size} disabled={!color} onChange={e => {
                  setSize(e.target.value);
                  const v = productVariants.find((pv: any) => pv.color === color && pv.size === e.target.value);
                  if (v?.unitPrice) setUnitPrice(v.unitPrice);
                }}
                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                  <option value="">اختر مقاس...</option>
                  {productVariants.filter((v: any) => v.color === color).map((v: any) => {
                    const a = v.totalQuantity ?? 0;
                    return <option key={v.id} value={v.size} disabled={a === 0}>{v.size} {a === 0 ? "(نفد)" : `(${a})`}</option>;
                  })}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium mb-1.5 block">اسم المنتج *</label>
            <Input value={product} onChange={e => setProduct(e.target.value)} className="h-9 text-sm" placeholder="اسم المنتج" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">اللون</label>
              <Input value={color} onChange={e => setColor(e.target.value)} className="h-9 text-sm" placeholder="مثال: أسود" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">المقاس</label>
              <Input value={size} onChange={e => setSize(e.target.value)} className="h-9 text-sm" placeholder="مثال: XL" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">الكمية *</label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                <span className="w-10 text-center text-sm font-bold">{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
              <Input type="number" min={0} value={unitPrice || ""} onChange={e => setUnitPrice(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block">ملاحظات</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[50px] text-sm resize-none" placeholder="ملاحظات اختيارية..." />
          </div>
        </div>
        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1">إلغاء</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !product.trim() || unitPrice <= 0}
            className="flex-1 gap-1">
            <Save className="w-3 h-3" />{isSubmitting ? "جاري الحفظ..." : "حفظ التعديل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Product Dialog ────────────────────────────────────────────────────────
function AddProductDialog({ open, onOpenChange, repOrder, invoiceNumber: invNum, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; repOrder: any; invoiceNumber: string; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants = [] } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [variantRows, setVariantRows] = useState<{ color: string; size: string; quantity: number }[]>([{ color: "", size: "", quantity: 1 }]);
  const [unitPrice, setUnitPrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productVariants = allVariants.filter((v: any) => v.productId === selectedProduct?.id);
  const availableColors = [...new Set(productVariants.map((v: any) => v.color))] as string[];
  const hasVariants = productVariants.length > 0;

  const reset = () => {
    setSelectedProduct(null);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    setUnitPrice(0);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    if (p.unitPrice) setUnitPrice(p.unitPrice);
  };

  const updateRow = (i: number, key: string, val: any) => {
    setVariantRows(rows => {
      const next = rows.map((r, idx) => idx === i ? { ...r, [key]: val, ...(key === "color" ? { size: "" } : {}) } : r);
      if (key === "size") {
        const row = next[i];
        const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === val);
        if (v?.unitPrice) setUnitPrice(v.unitPrice);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    if (unitPrice <= 0) {
      toast({ title: "خطأ", description: "أدخل سعر البيع.", variant: "destructive" });
      return;
    }
    const filledRows = hasVariants ? variantRows.filter(r => r.color && r.size) : variantRows;
    if (hasVariants && filledRows.length === 0) {
      toast({ title: "خطأ", description: "اختر لون ومقاس على الأقل.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const items = filledRows.map(r => ({
        product: selectedProduct.name,
        color: r.color || null,
        size: r.size || null,
        quantity: r.quantity,
        unitPrice,
        productId: selectedProduct.id,
        variantId: hasVariants ? (productVariants.find((v: any) => v.color === r.color && v.size === r.size)?.id ?? null) : null,
      }));
      await ordersApi.batchCreate({
        invoiceNumber: invNum,
        customerName: repOrder.customerName,
        phone: repOrder.phone ?? null,
        city: repOrder.city ?? null,
        address: repOrder.address ?? null,
        shippingCompanyId: repOrder.shippingCompanyId ?? null,
        notes: null,
        items,
      });
      toast({ title: "تم إضافة المنتج ✅", description: `${selectedProduct.name} اتضاف للفاتورة بنجاح.` });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      console.error("AddProduct error:", e);
      toast({ title: "خطأ", description: e?.message || "فشل الإضافة، حاول تاني.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />إضافة منتج للفاتورة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-medium mb-1.5 block">اختر من المخزون *</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold">{selectedProduct.name}</span>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setVariantRows([{ color: "", size: "", quantity: 1 }]); }}
                  className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <ProductSearchCombobox products={products} allVariants={allVariants} onSelect={handleSelectProduct} />
            )}
          </div>
          {selectedProduct && hasVariants && (
            <div className="space-y-2">
              {variantRows.map((row, ri) => {
                const sizesForColor = productVariants.filter((v: any) => v.color === row.color).map((v: any) => v.size);
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
                        <span className="w-7 text-center text-sm font-bold">{row.quantity}</span>
                        <button type="button" onClick={() => updateRow(ri, "quantity", row.quantity + 1)}
                          className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                      </div>
                    </div>
                    {variantRows.length > 1 && (
                      <button type="button" onClick={() => setVariantRows(r => r.filter((_, idx) => idx !== ri))}
                        className="mb-0.5 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          {selectedProduct && (
            <div>
              <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
              <Input type="number" min={0} value={unitPrice || ""} onChange={e => setUnitPrice(Number(e.target.value))} className="h-9 text-sm" />
            </div>
          )}
        </div>
        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }} className="flex-1">إلغاء</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !selectedProduct || unitPrice <= 0}
            className="flex-1 gap-1">
            <Plus className="w-3 h-3" />{isSubmitting ? "جاري الإضافة..." : "إضافة للفاتورة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InvoiceGroup() {
  const { brand } = useBrand();
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
  const [waOrder, setWaOrder]                           = useState<WhatsAppOrderData | null>(null);
  const [showAddProduct, setShowAddProduct]             = useState(false);
  const [isEditingInvoice, setIsEditingInvoice]         = useState(false);
  const [editingProduct, setEditingProduct]             = useState<any>(null);
  const [deletingProductId, setDeletingProductId]       = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId]           = useState<number | null>(null);

  // Inline edit form state
  const [editCustomerName, setEditCustomerName]         = useState("");
  const [editPhone, setEditPhone]                       = useState("");
  const [editCity, setEditCity]                         = useState("");
  const [editAddress, setEditAddress]                   = useState("");
  const [editShippingCompanyId, setEditShippingCompanyId] = useState<string>("");
  const [editTrackingNumber, setEditTrackingNumber]     = useState("");
  const [editNotes, setEditNotes]                       = useState("");
  const [isSavingEdit, setIsSavingEdit]                 = useState(false);

  const { data: shippingCompanies = [] } = useQuery({ queryKey: ["shipping-companies"], queryFn: shippingApi.list });

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["invoice-group", invoiceNumber],
    queryFn: () => apiFetch<any[]>(`/orders/by-invoice/${encodeURIComponent(invoiceNumber)}`),
    enabled: !!invoiceNumber,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: invoiceManifestData } = useQuery({
    queryKey: ["invoice-manifest-status", invoiceNumber],
    queryFn: () => manifestsApi.getInvoiceManifestStatus(invoiceNumber),
    enabled: !!invoiceNumber,
    staleTime: 0,
  });

  const openManifestEntry = invoiceManifestData?.find((e: any) => e.manifestStatus === "open");
  const hasOpenManifest = !!openManifestEntry;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["invoice-group", invoiceNumber] });
  };

  const handleOpenEdit = (r: any) => {
    setEditCustomerName(r.customerName || "");
    setEditPhone(r.phone || "");
    setEditCity(r.city || "");
    setEditAddress(r.address || "");
    setEditShippingCompanyId(r.shippingCompanyId ? String(r.shippingCompanyId) : "");
    setEditTrackingNumber(r.trackingNumber || "");
    setEditNotes(r.notes || "");
    setIsEditingInvoice(true);
  };

  const handleSaveEdit = async (ordersToUpdate: any[]) => {
    if (!editCustomerName.trim()) {
      toast({ title: "خطأ", description: "اسم العميل مطلوب.", variant: "destructive" });
      return;
    }
    setIsSavingEdit(true);
    try {
      const payload: any = {
        customerName: editCustomerName.trim(),
        phone: editPhone.trim() || null,
        city: editCity.trim() || null,
        address: editAddress.trim() || null,
        shippingCompanyId: editShippingCompanyId ? Number(editShippingCompanyId) : null,
        trackingNumber: editTrackingNumber.trim() || null,
        notes: editNotes.trim() || null,
      };
      for (const order of ordersToUpdate) {
        await new Promise<void>((resolve, reject) => {
          updateOrder.mutate({ id: order.id, data: payload }, {
            onSuccess: () => resolve(),
            onError: () => reject(),
          });
        });
      }
      invalidateAll();
      toast({ title: "تم الحفظ ✅", description: "تم تعديل بيانات الفاتورة بنجاح." });
      setIsEditingInvoice(false);
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ البيانات.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteProduct = async (orderId: number) => {
    if (orders.length <= 1) {
      toast({ title: "خطأ", description: "لا يمكن حذف المنتج الوحيد في الفاتورة. استخدم حذف الفاتورة كلها.", variant: "destructive" });
      setConfirmDeleteId(null);
      return;
    }
    setDeletingProductId(orderId);
    try {
      const token = localStorage.getItem("caprina_token");
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل الحذف");
      invalidateAll();
      toast({ title: "تم الحذف ✅", description: "تم حذف المنتج من الفاتورة." });
    } catch {
      toast({ title: "خطأ", description: "فشل حذف المنتج.", variant: "destructive" });
    } finally {
      setDeletingProductId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!orders?.length) return;
    if (hasOpenManifest) {
      toast({
        title: "⛔ لا يمكن تعديل حالة الطلب",
        description: `هذه الفاتورة مرتبطة ببيان شحن مفتوح (${openManifestEntry?.manifestNumber}).`,
        variant: "destructive",
      });
      setPendingStatus(null);
      return;
    }
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

  const handleBulkDelete = async () => {
    if (!orders?.length) return;
    if (hasOpenManifest) {
      toast({
        title: "⛔ لا يمكن حذف الطلبات",
        description: `هذه الفاتورة مرتبطة ببيان شحن مفتوح (${openManifestEntry?.manifestNumber}).`,
        variant: "destructive",
      });
      setShowBulkDeleteDialog(false);
      return;
    }
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

  const handlePrint = () => {
    if (!orders?.length) return;
    const rep = orders[0];
    const totalQty = orders.reduce((sum: number, order: any) => sum + order.quantity, 0);
    const totalPrice = orders.reduce((sum: number, order: any) => sum + order.totalPrice, 0);
    const shippingCost = rep.shippingCost ?? 0;
    const brandName = brand.name || "CAPRINA";
    const dateLabel = format(new Date(rep.createdAt), "yyyy/MM/dd HH:mm");
    const rowsHtml = orders.map((order: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td class="name">${order.product}</td>
        <td>${[order.color, order.size].filter(Boolean).join(" / ") || "-"}</td>
        <td>${order.quantity}</td>
        <td>${formatCurrency(order.unitPrice)}</td>
        <td>${formatCurrency(order.totalPrice)}</td>
      </tr>
    `).join("");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>فاتورة ${invoiceNumber}</title>
<style>
  body{font-family:Arial,Tahoma,sans-serif;margin:0;padding:24px;color:#111;background:#fff}
  .sheet{max-width:900px;margin:0 auto;border:1px solid #ddd;padding:24px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;border-bottom:2px solid #111;padding-bottom:16px}
  .brand{font-size:28px;font-weight:800}.muted{color:#666;font-size:13px}
  .title{font-size:24px;font-weight:800;margin:0 0 8px}
  .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 24px;margin-bottom:20px}
  .meta-item{font-size:14px}.meta-item b{display:inline-block;min-width:88px}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  th,td{border:1px solid #ddd;padding:10px 8px;text-align:center;font-size:14px}
  th{background:#111;color:#fff}td.name{text-align:right;font-weight:700}
  .totals{width:320px;margin-right:auto}
  .totals-row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0;font-size:14px}
  .totals-row.total{font-size:18px;font-weight:800;border-bottom:2px solid #111}
  @media print{body{padding:0}.sheet{border:0;max-width:none}}
</style></head><body><div class="sheet">
<div class="header"><div><div class="brand">${brandName}</div><div class="muted">فاتورة رقم: ${invoiceNumber}</div><div class="muted">${dateLabel}</div></div>
<div><h1 class="title">فاتورة العميل</h1><div class="muted">${orders.length} منتجات / ${totalQty} قطعة</div></div></div>
<div class="meta">
  <div class="meta-item"><b>العميل:</b> ${rep.customerName || "-"}</div>
  <div class="meta-item"><b>الهاتف:</b> ${rep.phone || "-"}</div>
  <div class="meta-item"><b>المحافظة:</b> ${rep.city || "-"}</div>
  <div class="meta-item"><b>العنوان:</b> ${rep.address || "-"}</div>
</div>
<table><thead><tr><th>#</th><th>المنتج</th><th>اللون/المقاس</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
<div class="totals">
  <div class="totals-row"><span>إجمالي المنتجات</span><b>${formatCurrency(totalPrice)}</b></div>
  <div class="totals-row"><span>الشحن</span><b>${formatCurrency(shippingCost)}</b></div>
  <div class="totals-row total"><span>الإجمالي الكلي</span><b>${formatCurrency(totalPrice + shippingCost)}</b></div>
</div></div></body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400); };
  };

  const handleWhatsApp = () => {
    if (!orders?.length) return;
    const rep = orders[0];
    setWaOrder({
      id: rep.id,
      customerName: rep.customerName,
      product: orders.map((o: any) => `${o.product}×${o.quantity}`).join("، "),
      quantity: orders.reduce((s: number, o: any) => s + o.quantity, 0),
      totalPrice: orders.reduce((s: number, o: any) => s + o.totalPrice, 0),
      status: rep.status,
      phone: rep.phone,
    });
  };

  const handleWaSent = async (orderId: number, currentStatus: string) => {
    if (!orders?.length) return;
    const hasPending = orders.some((o: any) => o.status === "pending");
    if (hasPending) {
      for (const order of orders) {
        if (order.status === "pending") {
          await new Promise<void>((resolve) => {
            updateOrder.mutate({ id: order.id, data: { status: "warehouse_ready" } }, { onSuccess: () => resolve(), onError: () => resolve() });
          });
        }
      }
      invalidateAll();
      toast({ title: "تم إرسال واتساب ✅", description: "تم تحويل الطلبات لـ «قيد الشحن في المخزن»" });
    } else {
      toast({ title: "تم فتح واتساب ✅", description: "الرسالة جاهزة للإرسال" });
    }
  };

  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">جاري التحميل...</div>;
  if (error) return (
    <div className="p-12 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
      <h2 className="text-lg font-bold mb-2">حدث خطأ في تحميل الفاتورة</h2>
      <p className="text-sm text-muted-foreground mb-3">{(error as any)?.message || "تعذر الاتصال بالسيرفر"}</p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => window.location.reload()}>إعادة المحاولة</Button>
        <Link href="/orders"><Button variant="outline">العودة للطلبات</Button></Link>
      </div>
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
  const getReceivedPrice = (o: any): number => {
    if (o.status === "partial_received" && o.partialQuantity != null && o.unitPrice != null) {
      return Math.round(o.unitPrice * o.partialQuantity);
    }
    return o.totalPrice;
  };
  const totalPrice      = orders.reduce((s: number, o: any) => s + getReceivedPrice(o), 0);
  const totalFullPrice  = orders.reduce((s: number, o: any) => s + o.totalPrice, 0);
  const totalQty        = orders.reduce((s: number, o: any) => s + o.quantity, 0);
  const totalReceivedQty = orders.reduce((s: number, o: any) => s + (o.status === "partial_received" && o.partialQuantity != null ? o.partialQuantity : o.quantity), 0);
  const hasPartial      = orders.some((o: any) => o.status === "partial_received");
  const shippingCost    = rep.shippingCost ?? 0;
  const allSameStatus   = orders.every((o: any) => o.status === rep.status);
  const dominantStatus  = rep.status;
  const isAnyLocked     = orders.some((o: any) => (o.status === "received" || o.status === "partial_received")) && !isAdmin;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/orders">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border shrink-0">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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
        </div>

        {/* Action buttons — all in one row, no wrapping */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <Button
            variant="outline" size="sm"
            onClick={() => !isAnyLocked && !hasOpenManifest && setShowBulkDeleteDialog(true)}
            disabled={isAnyLocked || hasOpenManifest}
            className="h-9 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 disabled:opacity-40 font-bold shrink-0">
            <Trash2 className="w-3.5 h-3.5" />حذف
          </Button>

          {!isAnyLocked && !hasOpenManifest && (
            <Button size="sm" onClick={() => setShowAddProduct(true)}
              className="h-9 text-xs gap-1.5 font-bold shrink-0">
              <Plus className="w-3.5 h-3.5" />إضافة منتج
            </Button>
          )}

          {!isAnyLocked && !hasOpenManifest && (
            <Button variant="outline" size="sm"
              onClick={() => isEditingInvoice ? setIsEditingInvoice(false) : handleOpenEdit(rep)}
              className="h-9 text-xs gap-1.5 font-bold border-border shrink-0">
              <Pencil className="w-3.5 h-3.5" />تعديل
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrint}
            className="h-9 text-xs gap-1.5 border-border font-bold shrink-0">
            <Printer className="w-3.5 h-3.5" />فاتورة
          </Button>

          {orders.some((o: any) => ["pending","warehouse_ready","in_shipping","delayed"].includes(o.status)) && (
            <Button variant="outline" size="sm" onClick={handleWhatsApp}
              className="h-9 text-xs gap-1.5 border-green-700 text-green-400 hover:bg-green-500/10 font-bold shrink-0">
              <MessageCircle className="w-3.5 h-3.5" />واتساب
            </Button>
          )}

          <Select value="" onValueChange={(v) => { if (v) setPendingStatus(v); }} disabled={isUpdatingStatus || isAnyLocked || hasOpenManifest}>
            <SelectTrigger className="h-9 text-xs bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-bold w-auto gap-1.5 px-3 shrink-0"
              title={hasOpenManifest ? `مرتبط ببيان مفتوح (${openManifestEntry?.manifestNumber})` : undefined}>
              <div className="flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingStatus ? "animate-spin" : ""}`} />
                <span>{isUpdatingStatus ? "جاري..." : "تغيير الحالة"}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="warehouse_ready">قيد الشحن في المخزن</SelectItem>
              <SelectItem value="in_shipping">قيد الشحن</SelectItem>
              <SelectItem value="received">استلم ✓</SelectItem>
              <SelectItem value="delayed">مؤجل</SelectItem>
              <SelectItem value="returned">مرتجع</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* بيان مفتوح */}
      {hasOpenManifest && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/40 text-xs text-orange-400">
          <span className="text-base shrink-0">⛔</span>
          <span>
            هذه الفاتورة مرتبطة ببيان شحن مفتوح
            <span className="font-bold mx-1 text-orange-300">({openManifestEntry?.manifestNumber})</span>
            — لا يمكن تعديل حالة الطلبات إلا من داخل البيان في قسم شركات الشحن.
          </span>
        </div>
      )}

      {/* Customer info */}
      <Card className="border-border bg-card">
        <CardContent className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><p className="text-muted-foreground mb-0.5">العميل</p><p className="font-bold">{rep.customerName}</p></div>
          {rep.phone && <div><p className="text-muted-foreground mb-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />الهاتف</p><p className="font-bold">{rep.phone}</p></div>}
          {rep.city && <div><p className="text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />المحافظة</p><p className="font-bold">{rep.city}</p></div>}
          {rep.address && <div><p className="text-muted-foreground mb-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />العنوان</p><p className="font-bold">{rep.address}</p></div>}
        </CardContent>
      </Card>

      {/* Inline edit form — نفس شكل order-detail */}
      {isEditingInvoice && (
        <Card className="border-primary/40 bg-card">
          <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
              <Pencil className="w-4 h-4" />تعديل الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* بيانات العميل */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">اسم العميل</Label>
                <Input value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">الهاتف</Label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="h-8 text-sm mt-1" dir="ltr" />
              </div>
            </div>
            <div>
              <Label className="text-xs">العنوان</Label>
              <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">شركة الشحن</Label>
                <Select value={editShippingCompanyId || "none"} onValueChange={v => setEditShippingCompanyId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm bg-card mt-1"><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {shippingCompanies.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">رقم التتبع</Label>
                <Input value={editTrackingNumber} onChange={e => setEditTrackingNumber(e.target.value)} className="h-8 text-sm mt-1 font-mono" placeholder="TRK-12345" dir="ltr" />
              </div>
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="min-h-[60px] text-sm resize-none mt-1" />
            </div>

            {/* قسم منتجات الفاتورة */}
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />منتجات الفاتورة ({orders.length})
                </h3>
                <button onClick={() => { setIsEditingInvoice(false); setShowAddProduct(true); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 px-3 py-1.5 rounded-md transition-colors">
                  <Plus className="w-3.5 h-3.5" />إضافة منتج للفاتورة
                </button>
              </div>
              {orders.map((o: any) => (
                <Card key={o.id} className="border border-border bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{o.product}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {o.color && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{o.color}</Badge>}
                          {o.size && <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{o.size}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{o.quantity} وحدة × {formatCurrency(o.unitPrice)}</span>
                          <span className="font-bold text-foreground">{formatCurrency(o.totalPrice)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-border"
                          onClick={() => { setEditingProduct(o); setIsEditingInvoice(false); }}>
                          <Pencil className="w-3 h-3" />تعديل
                        </Button>
                        <Button variant="outline" size="sm"
                          className="h-7 text-xs gap-1 border-red-800 text-red-400 hover:bg-red-900/20"
                          disabled={deletingProductId === o.id}
                          onClick={() => setConfirmDeleteId(o.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <Button size="sm" onClick={() => handleSaveEdit(orders)}
                disabled={isSavingEdit || !editCustomerName.trim()} className="gap-1 h-8 text-xs">
                <Save className="w-3 h-3" />{isSavingEdit ? "جاري الحفظ..." : "حفظ"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1"
                onClick={() => setIsEditingInvoice(false)}>
                <X className="w-3 h-3" />إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products list */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              المنتجات ({orders.length})
            </div>
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
                    {order.color || order.size ? " · " : ""}×{order.quantity}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-left">
                  <p className="text-sm font-bold text-primary">{formatCurrency(getReceivedPrice(order))}</p>
                  {order.status === "partial_received" && getReceivedPrice(order) !== order.totalPrice && (
                    <p className="text-[9px] text-muted-foreground line-through">{formatCurrency(order.totalPrice)}</p>
                  )}
                  <Badge variant="outline" className={`text-[8px] font-bold border mt-0.5 ${statusClasses[order.status] || ""}`}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))}

          <Separator className="my-2" />

          <div className="flex items-center justify-between text-sm font-bold">
            <span>الإجمالي ({hasPartial ? `${totalReceivedQty} من ${totalQty}` : `${totalQty}`} قطعة)</span>
            <div className="text-left">
              <span className="text-primary text-base">{formatCurrency(totalPrice)}</span>
              {hasPartial && totalPrice !== totalFullPrice && (
                <p className="text-[10px] text-muted-foreground line-through font-normal">{formatCurrency(totalFullPrice)}</p>
              )}
            </div>
          </div>
          {shippingCost > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>تكلفة الشحن</span>
              <span>{formatCurrency(shippingCost)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <AddProductDialog
        open={showAddProduct}
        onOpenChange={setShowAddProduct}
        repOrder={rep}
        invoiceNumber={invoiceNumber}
        onSuccess={invalidateAll}
      />

      {/* Edit Product Dialog */}
      <EditProductDialog
        open={!!editingProduct}
        onOpenChange={v => { if (!v) setEditingProduct(null); }}
        order={editingProduct}
        onSuccess={invalidateAll}
      />

      {/* Delete single product confirm */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المنتج من الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDeleteId && handleDeleteProduct(confirmDeleteId)}
              disabled={!!deletingProductId}>
              {deletingProductId ? "جاري الحذف..." : "نعم، احذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change confirm */}
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

      {/* Delete confirm */}
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

      {/* WhatsApp dialog */}
      <WhatsAppDialog
        open={!!waOrder}
        onOpenChange={(open) => { if (!open) setWaOrder(null); }}
        order={waOrder}
        onSent={() => waOrder && handleWaSent(waOrder.id, waOrder.status)}
      />
    </div>
  );
}
