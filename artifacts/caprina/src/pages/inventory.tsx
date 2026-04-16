import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, variantsApi, type Product, type ProductVariant } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Package, AlertTriangle, Edit2, Trash2, CheckCircle2, ChevronDown, ChevronRight, Layers, Tag } from "lucide-react";

const emptyProductForm = { name: "", sku: "", lowStockThreshold: 5, unitPrice: 0 };
const emptyVariantForm = { color: "", size: "", sku: "", totalQuantity: 0, lowStockThreshold: 5, unitPrice: 0 };

const COMMON_COLORS = ["أسود", "أبيض", "بيج", "رمادي", "كحلي", "بني", "زيتي", "بردقاني", "أزرق", "أحمر"];
const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "28", "30", "32", "34", "36", "38", "40"];

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);

  // Variant dialog
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState(emptyVariantForm);

  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });

  const createProductMutation = useMutation({
    mutationFn: (data: typeof emptyProductForm) => productsApi.create({ ...data, totalQuantity: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setProductDialogOpen(false); setProductForm(emptyProductForm); toast({ title: "تمت إضافة المنتج" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyProductForm> }) => productsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setProductDialogOpen(false); setEditingProduct(null); setProductForm(emptyProductForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); queryClient.invalidateQueries({ queryKey: ["variants"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const createVariantMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: typeof emptyVariantForm }) => variantsApi.create(productId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); setVariantDialogOpen(false); setVariantForm(emptyVariantForm); toast({ title: "تمت إضافة المقاس/اللون" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ productId, id, data }: { productId: number; id: number; data: Partial<typeof emptyVariantForm> }) => variantsApi.update(productId, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); setVariantDialogOpen(false); setEditingVariant(null); setVariantForm(emptyVariantForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: ({ productId, id }: { productId: number; id: number }) => variantsApi.delete(productId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  const openAddProduct = () => { setEditingProduct(null); setProductForm(emptyProductForm); setProductDialogOpen(true); };
  const openEditProduct = (p: Product) => { setEditingProduct(p); setProductForm({ name: p.name, sku: p.sku ?? "", lowStockThreshold: p.lowStockThreshold, unitPrice: p.unitPrice }); setProductDialogOpen(true); };
  const openAddVariant = (productId: number) => { setActiveProductId(productId); setEditingVariant(null); setVariantForm(emptyVariantForm); setVariantDialogOpen(true); };
  const openEditVariant = (v: ProductVariant) => { setActiveProductId(v.productId); setEditingVariant(v); setVariantForm({ color: v.color, size: v.size, sku: v.sku ?? "", totalQuantity: v.totalQuantity, lowStockThreshold: v.lowStockThreshold, unitPrice: v.unitPrice }); setVariantDialogOpen(true); };

  const handleProductSubmit = () => {
    if (!productForm.name.trim()) { toast({ title: "خطأ", description: "اسم المنتج مطلوب.", variant: "destructive" }); return; }
    if (editingProduct) updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    else createProductMutation.mutate(productForm);
  };

  const handleVariantSubmit = () => {
    if (!variantForm.color.trim() || !variantForm.size.trim()) { toast({ title: "خطأ", description: "اللون والمقاس مطلوبان.", variant: "destructive" }); return; }
    if (!activeProductId) return;
    if (editingVariant) updateVariantMutation.mutate({ productId: activeProductId, id: editingVariant.id, data: variantForm });
    else createVariantMutation.mutate({ productId: activeProductId, data: variantForm });
  };

  const getProductVariants = (productId: number) => allVariants?.filter(v => v.productId === productId) ?? [];

  const totalVariants = allVariants?.length ?? 0;
  const lowStockVariants = allVariants?.filter(v => (v.totalQuantity - v.reservedQuantity - v.soldQuantity) <= v.lowStockThreshold).length ?? 0;
  const totalAvailable = allVariants?.reduce((s, v) => s + Math.max(0, v.totalQuantity - v.reservedQuantity - v.soldQuantity), 0) ?? 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المخزون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المنتجات • الألوان • المقاسات (SKU System)</p>
        </div>
        <Button onClick={openAddProduct} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
          <Plus className="w-4 h-4" />منتج جديد
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
          <p className="text-2xl font-bold mt-1">{products?.length ?? 0}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي SKUs</p>
          <p className="text-2xl font-bold mt-1 text-primary">{totalVariants}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">متاح للبيع</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">{totalAvailable}</p>
        </Card>
        <Card className={`border p-4 ${lowStockVariants > 0 ? "border-red-800 bg-red-900/20" : "border-border bg-card"}`}>
          <p className="text-xs text-muted-foreground">SKU منخفض</p>
          <p className={`text-2xl font-bold mt-1 ${lowStockVariants > 0 ? "text-red-400" : "text-foreground"}`}>{lowStockVariants}</p>
        </Card>
      </div>

      {/* Products list */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : products?.length ? (
        <div className="space-y-3">
          {products.map((product) => {
            const variants = getProductVariants(product.id);
            const isExpanded = expandedProductId === product.id;
            const totalStock = variants.reduce((s, v) => s + v.totalQuantity, 0);
            const availableStock = variants.reduce((s, v) => s + Math.max(0, v.totalQuantity - v.reservedQuantity - v.soldQuantity), 0);
            const hasLowStock = variants.some(v => (v.totalQuantity - v.reservedQuantity - v.soldQuantity) <= v.lowStockThreshold);

            return (
              <Card key={product.id} className="border-border overflow-hidden">
                {/* Product header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{product.name}</p>
                        {hasLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{variants.length} SKU</span>
                        {product.sku && <span className="text-[10px] font-mono text-muted-foreground">{product.sku}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left hidden sm:block">
                      <p className="text-xs text-muted-foreground">متاح / إجمالي</p>
                      <p className="text-sm font-bold">
                        <span className={availableStock === 0 ? "text-red-400" : "text-emerald-400"}>{availableStock}</span>
                        <span className="text-muted-foreground"> / {totalStock}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openAddVariant(product.id)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEditProduct(product)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { if (confirm(`حذف "${product.name}" وكل مقاساته؟`)) deleteProductMutation.mutate(product.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Variants */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {variants.length === 0 ? (
                      <div className="p-6 text-center">
                        <Layers className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
                        <p className="text-sm text-muted-foreground">لا توجد مقاسات/ألوان بعد</p>
                        <Button size="sm" className="mt-3 h-7 text-xs gap-1" onClick={() => openAddVariant(product.id)}>
                          <Plus className="w-3 h-3" />إضافة أول SKU
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/10">
                              <th className="text-right py-2 px-4 font-semibold text-muted-foreground">اللون</th>
                              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">المقاس</th>
                              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">SKU</th>
                              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">إجمالي</th>
                              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">محجوز</th>
                              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">مباع</th>
                              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">متاح</th>
                              <th className="text-right py-2 px-3 font-semibold text-muted-foreground">السعر</th>
                              <th className="text-center py-2 px-3 font-semibold text-muted-foreground">حالة</th>
                              <th className="text-center py-2 px-3 w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v) => {
                              const available = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
                              const isLow = available <= v.lowStockThreshold;
                              return (
                                <tr key={v.id} className="border-b border-border/40 hover:bg-muted/10 last:border-0">
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full border border-border/50 shrink-0" style={{ background: getColorHex(v.color) }} />
                                      <span className="font-semibold">{v.color}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className="font-bold text-[10px] border-border text-foreground">{v.size}</Badge>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-muted-foreground">{v.sku || "—"}</td>
                                  <td className="py-2.5 px-3 text-center">{v.totalQuantity}</td>
                                  <td className="py-2.5 px-3 text-center text-amber-400 font-bold">{v.reservedQuantity}</td>
                                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{v.soldQuantity}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`font-bold ${isLow ? "text-red-400" : "text-foreground"}`}>{available}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-primary font-bold">{formatCurrency(v.unitPrice)}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    {isLow ? (
                                      <Badge variant="outline" className="text-[8px] font-bold border-red-800 bg-red-900/20 text-red-400">منخفض</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[8px] font-bold border-emerald-800 bg-emerald-900/20 text-emerald-400">جيد</Badge>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-primary" onClick={() => openEditVariant(v)}>
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => { if (confirm(`حذف ${v.color} - ${v.size}؟`)) deleteVariantMutation.mutate({ productId: v.productId, id: v.id }); }}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="p-3 border-t border-border/40">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => openAddVariant(product.id)}>
                            <Plus className="w-3 h-3" />إضافة لون/مقاس
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد منتجات</p>
          <p className="text-sm text-muted-foreground mt-1">أضف منتجاتك ثم أضف لكل منتج الألوان والمقاسات.</p>
          <Button onClick={openAddProduct} className="mt-4 gap-2 text-sm"><Plus className="w-4 h-4" />إضافة أول منتج</Button>
        </Card>
      )}

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editingProduct ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-xs mb-1.5 block">اسم المنتج *</Label>
              <Input placeholder="مثال: Cargo Pants" className="h-9 text-sm bg-background" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">SKU الرئيسي</Label>
              <Input placeholder="CARGO-001" className="h-9 text-sm bg-background font-mono" value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">سعر الوحدة الافتراضي</Label>
                <Input type="number" min="0" step="0.01" className="h-9 text-sm bg-background" value={productForm.unitPrice} onChange={e => setProductForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">حد التنبيه</Label>
                <Input type="number" min="0" className="h-9 text-sm bg-background" value={productForm.lowStockThreshold} onChange={e => setProductForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={handleProductSubmit} disabled={createProductMutation.isPending || updateProductMutation.isPending}>
                {editingProduct ? "حفظ" : "إضافة المنتج"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setProductDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variant Dialog */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              {editingVariant ? "تعديل اللون/المقاس" : "إضافة لون + مقاس (SKU)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">اللون *</Label>
                <Input placeholder="أسود، بيج..." className="h-9 text-sm bg-background" value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_COLORS.slice(0, 5).map(c => (
                    <button key={c} onClick={() => setVariantForm(f => ({ ...f, color: c }))} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${variantForm.color === c ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">المقاس *</Label>
                <Input placeholder="M, L, XL, 32..." className="h-9 text-sm bg-background" value={variantForm.size} onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))} />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_SIZES.slice(0, 6).map(s => (
                    <button key={s} onClick={() => setVariantForm(f => ({ ...f, size: s }))} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${variantForm.size === s ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">SKU مخصص (اختياري)</Label>
              <Input placeholder="يُنشأ تلقائياً إن تُرك فارغاً" className="h-9 text-sm bg-background font-mono" value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">الكمية *</Label>
                <Input type="number" min="0" className="h-9 text-sm bg-background" value={variantForm.totalQuantity} onChange={e => setVariantForm(f => ({ ...f, totalQuantity: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">سعر الوحدة (ر.س)</Label>
                <Input type="number" min="0" step="0.01" className="h-9 text-sm bg-background" value={variantForm.unitPrice} onChange={e => setVariantForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">حد تنبيه المخزون المنخفض</Label>
              <Input type="number" min="0" className="h-9 text-sm bg-background" value={variantForm.lowStockThreshold} onChange={e => setVariantForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={handleVariantSubmit} disabled={createVariantMutation.isPending || updateVariantMutation.isPending}>
                {editingVariant ? "حفظ" : "إضافة SKU"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setVariantDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getColorHex(colorName: string): string {
  const map: Record<string, string> = {
    "أسود": "#111", "أبيض": "#f5f5f5", "بيج": "#c8ad7f", "رمادي": "#888",
    "كحلي": "#1a237e", "بني": "#5d4037", "زيتي": "#33691e", "بردقاني": "#880e4f",
    "أزرق": "#1565c0", "أحمر": "#c62828", "أخضر": "#2e7d32", "برتقالي": "#e65100",
  };
  return map[colorName] || "#666";
}
