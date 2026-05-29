/**
 * AddProductDialog — مشترك بين order-detail.tsx و invoice-group.tsx
 *
 * Props:
 *  - open / onOpenChange
 *  - order: أي object فيه invoiceNumber, customerName, phone, city, address, shippingCompanyId
 *  - onSuccess: callback بعد الإضافة الناجحة
 */
import { useState } from "react";
import { Plus, Package, X, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { productsApi, variantsApi, ordersApi } from "@/lib/api";
import { ProductSearchCombobox } from "@/components/product-search-combobox";

export interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** أي order من الفاتورة — نحتاج invoiceNumber وبيانات العميل */
  order: any;
  onSuccess: () => void;
}

export function AddProductDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: AddProductDialogProps) {
  const { toast } = useToast();
  const { canViewFinancials } = useAuth();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants = [] } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [variantRows, setVariantRows] = useState<{ color: string; size: string; quantity: number }[]>([
    { color: "", size: "", quantity: 1 },
  ]);
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productVariants = allVariants.filter((v: any) => v.productId === selectedProduct?.id);
  const availableColors = [...new Set(productVariants.map((v: any) => v.color))] as string[];
  const hasVariants = productVariants.length > 0;

  const reset = () => {
    setSelectedProduct(null);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    setUnitPrice(0);
    setCostPrice(null);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setVariantRows([{ color: "", size: "", quantity: 1 }]);
    if (p.unitPrice) setUnitPrice(p.unitPrice);
    if (p.costPrice) setCostPrice(p.costPrice);
  };

  const updateRow = (i: number, key: string, val: any) => {
    setVariantRows(rows => {
      const next = rows.map((r, idx) =>
        idx === i ? { ...r, [key]: val, ...(key === "color" ? { size: "" } : {}) } : r
      );
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
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4 text-primary" />إضافة منتج لنفس الفاتورة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* اختيار المنتج */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">اختر من المخزون *</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2">
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name}
                      className="w-8 h-8 rounded object-cover border border-emerald-300 shrink-0" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-sm font-bold">{selectedProduct.name}</span>
                </div>
                <button type="button"
                  onClick={() => { setSelectedProduct(null); setVariantRows([{ color: "", size: "", quantity: 1 }]); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <ProductSearchCombobox
                products={products}
                allVariants={allVariants}
                onSelect={handleSelectProduct}
                inputStyle
              />
            )}
          </div>

          {/* Variants */}
          {selectedProduct && hasVariants && (
            <div className="space-y-2">
              {variantRows.map((row, ri) => {
                const sizesForColor = productVariants
                  .filter((v: any) => v.color === row.color)
                  .map((v: any) => v.size);
                const rowVariant = productVariants.find(
                  (v: any) => v.color === row.color && v.size === row.size
                );
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
                      <select value={row.size} disabled={!row.color}
                        onChange={e => updateRow(ri, "size", e.target.value)}
                        className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                        <option value="">اختر مقاس...</option>
                        {sizesForColor.map((s: string) => {
                          const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === s);
                          const a = v ? (v.totalQuantity ?? 0) : 0;
                          return (
                            <option key={s} value={s} disabled={a === 0}>
                              {s} {a === 0 ? "(نفد)" : `(${a})`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
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
                    {variantRows.length > 1 && (
                      <button type="button"
                        onClick={() => setVariantRows(r => r.filter((_, idx) => idx !== ri))}
                        className="mb-0.5 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {avail !== null && (
                      <span className={`text-[9px] font-bold mb-1 shrink-0 ${avail <= 5 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                        متاح:{avail}
                      </span>
                    )}
                  </div>
                );
              })}
              <button type="button"
                onClick={() => setVariantRows(r => [...r, { color: "", size: "", quantity: 1 }])}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary border border-dashed border-primary/40 hover:bg-primary/5 py-2 rounded-md transition-colors">
                <Plus className="w-3.5 h-3.5" />أضف لون / مقاس آخر
              </button>
            </div>
          )}

          {/* Qty بدون variants */}
          {selectedProduct && !hasVariants && (
            <div>
              <label className="text-xs font-medium mb-1.5 block">الكمية *</label>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setVariantRows(r => [{ ...r[0], quantity: Math.max(1, r[0].quantity - 1) }])}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                <span className="w-10 text-center text-sm font-bold">{variantRows[0]?.quantity ?? 1}</span>
                <button type="button"
                  onClick={() => setVariantRows(r => [{ ...r[0], quantity: r[0].quantity + 1 }])}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
              </div>
            </div>
          )}

          {/* السعر */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
                <Input type="number" min={0} value={unitPrice || ""}
                  onChange={e => setUnitPrice(Number(e.target.value))} className="h-9 text-sm" />
              </div>
              {canViewFinancials && (
                <div>
                  <label className="text-xs font-medium mb-1.5 block">تكلفة الوحدة (ج.م)</label>
                  <Input type="number" min={0} value={costPrice ?? ""}
                    onChange={e => setCostPrice(e.target.value ? Number(e.target.value) : null)}
                    className="h-9 text-sm" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }} className="flex-1">
            إلغاء
          </Button>
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
