import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { productsApi, variantsApi, analyticsApi, type Product, type ProductVariant, type StockIntelligenceItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Package, AlertTriangle, Edit2, Trash2, ChevronDown, ChevronRight,
  Layers, Tag, TrendingUp, DollarSign, Boxes, BarChart3, Search, PackagePlus
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fc = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

const getColorHex = (name: string): string => {
  const map: Record<string, string> = {
    أسود: "#1a1a1a", أبيض: "#f5f5f5", بيج: "#d4b896", رمادي: "#8a8a8a",
    كحلي: "#1a2744", بني: "#6b3f1f", زيتي: "#4a5c2a", بردقاني: "#6b1a2e",
    أزرق: "#1a4e8a", أحمر: "#8a1a1a", وردي: "#c87892", بنفسجي: "#5a2e7a",
    أصفر: "#c8a81a", برتقالي: "#c8601a", أخضر: "#2a7a3a", تركوازي: "#1a7a7a",
  };
  return map[name] || "#6b6b6b";
};

const calcMargin = (unitPrice: number, costPrice: number | null) => {
  if (!costPrice || costPrice === 0 || unitPrice === 0) return null;
  return Math.round(((unitPrice - costPrice) / unitPrice) * 100);
};

// ─── Constants ────────────────────────────────────────────────────────────────
const COMMON_COLORS = ["أسود", "أبيض", "بيج", "رمادي", "كحلي", "بني", "زيتي", "بردقاني", "أزرق", "أحمر", "وردي", "بنفسجي"];
const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "28", "30", "32", "34", "36", "38", "40"];

const emptyProductForm = { name: "", sku: "", lowStockThreshold: 5, unitPrice: 0, costPrice: null as number | null };
const emptyVariantForm = { color: "", size: "", sku: "", totalQuantity: 0, lowStockThreshold: 5, unitPrice: 0, costPrice: null as number | null };

// ─── Margin Badge ─────────────────────────────────────────────────────────────
function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-muted-foreground">—</span>;
  const cls = margin >= 40 ? "border-emerald-400 text-emerald-700 bg-emerald-100 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20"
    : margin >= 20 ? "border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/20"
    : "border-red-400 text-red-700 bg-red-100 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20";
  return <Badge variant="outline" className={`text-[9px] font-bold border ${cls}`}>{margin}%</Badge>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Inventory() {
  const { isAdmin, canViewFinancials } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);

  // Variant dialog
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [variantForm, setVariantForm] = useState(emptyVariantForm);

  // Add Stock dialog
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [addStockVariant, setAddStockVariant] = useState<ProductVariant | null>(null);
  const [addStockQty, setAddStockQty] = useState("");
  const [addStockNotes, setAddStockNotes] = useState("");

  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { data: stockIntel } = useQuery({ queryKey: ["stock-intelligence"], queryFn: analyticsApi.stockIntelligence, staleTime: 60000 });

  const stockMap = new Map<string, StockIntelligenceItem>(
    stockIntel?.items.map(i => [i.name.trim().toLowerCase(), i]) ?? []
  );

  const createProductMutation = useMutation({
    mutationFn: (data: typeof emptyProductForm) => productsApi.create({ ...data, totalQuantity: 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setProductDialogOpen(false); setProductForm(emptyProductForm); toast({ title: "تمت إضافة المنتج" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyProductForm> }) => productsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); queryClient.invalidateQueries({ queryKey: ["analytics-profit"] }); setProductDialogOpen(false); setEditingProduct(null); setProductForm(emptyProductForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); queryClient.invalidateQueries({ queryKey: ["variants"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const createVariantMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: typeof emptyVariantForm }) => variantsApi.create(productId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); queryClient.invalidateQueries({ queryKey: ["analytics-profit"] }); setVariantDialogOpen(false); setVariantForm(emptyVariantForm); toast({ title: "تمت إضافة المقاس/اللون" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ productId, id, data }: { productId: number; id: number; data: Partial<typeof emptyVariantForm> }) => variantsApi.update(productId, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); queryClient.invalidateQueries({ queryKey: ["analytics-profit"] }); setVariantDialogOpen(false); setEditingVariant(null); setVariantForm(emptyVariantForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: ({ productId, id }: { productId: number; id: number }) => variantsApi.delete(productId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["variants"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const addStockMutation = useMutation({
    mutationFn: ({ productId, variantId, qty, notes }: { productId: number; variantId: number; qty: number; notes: string }) =>
      variantsApi.addStock(productId, variantId, qty, notes || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      queryClient.invalidateQueries({ queryKey: ["stock-intelligence"] });
      setAddStockOpen(false);
      setAddStockVariant(null);
      setAddStockQty("");
      setAddStockNotes("");
      toast({ title: "تمت إضافة المخزون", description: "تم تسجيل الكمية وتحديث المخزون." });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const openAddProduct = () => { setEditingProduct(null); setProductForm(emptyProductForm); setProductDialogOpen(true); };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, sku: p.sku ?? "", lowStockThreshold: p.lowStockThreshold, unitPrice: p.unitPrice, costPrice: p.costPrice });
    setProductDialogOpen(true);
  };
  const openAddVariant = (productId: number) => {
    setActiveProductId(productId);
    setEditingVariant(null);
    const p = products?.find(p => p.id === productId);
    setVariantForm({ ...emptyVariantForm, unitPrice: p?.unitPrice ?? 0, costPrice: p?.costPrice ?? null });
    setVariantDialogOpen(true);
  };
  const openEditVariant = (v: ProductVariant) => {
    setActiveProductId(v.productId);
    setEditingVariant(v);
    setVariantForm({ color: v.color, size: v.size, sku: v.sku ?? "", totalQuantity: 0, lowStockThreshold: v.lowStockThreshold, unitPrice: v.unitPrice, costPrice: v.costPrice });
    setVariantDialogOpen(true);
  };

  const openAddVariantStock = (v: ProductVariant) => {
    setAddStockVariant(v);
    setAddStockQty("");
    setAddStockNotes("");
    setAddStockOpen(true);
  };

  const handleAddStockSubmit = () => {
    if (!addStockVariant) return;
    const qty = parseInt(addStockQty);
    if (isNaN(qty) || qty < 1) { toast({ title: "خطأ", description: "أدخل كمية صحيحة (1 على الأقل).", variant: "destructive" }); return; }
    addStockMutation.mutate({ productId: addStockVariant.productId, variantId: addStockVariant.id, qty, notes: addStockNotes });
  };

  const handleProductSubmit = () => {
    if (!productForm.name.trim()) { toast({ title: "خطأ", description: "اسم المنتج مطلوب.", variant: "destructive" }); return; }
    if (editingProduct) updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    else createProductMutation.mutate(productForm);
  };

  const handleVariantSubmit = () => {
    if (!variantForm.color.trim() || !variantForm.size.trim()) { toast({ title: "خطأ", description: "اللون والمقاس مطلوبان.", variant: "destructive" }); return; }
    if (!activeProductId) return;
    if (editingVariant) {
      // Don't send totalQuantity on edit — use Add Stock instead
      const { totalQuantity: _qty, ...editData } = variantForm;
      updateVariantMutation.mutate({ productId: activeProductId, id: editingVariant.id, data: editData });
    } else {
      createVariantMutation.mutate({ productId: activeProductId, data: variantForm });
    }
  };

  const getProductVariants = (productId: number) => allVariants?.filter(v => v.productId === productId) ?? [];

  // Stats — availableQty = totalQuantity (movement-based model, no reservation)
  const totalVariants = allVariants?.length ?? 0;
  const lowStockVariants = allVariants?.filter(v => v.totalQuantity <= v.lowStockThreshold).length ?? 0;
  const totalAvailable = allVariants?.reduce((s, v) => s + Math.max(0, v.totalQuantity), 0) ?? 0;
  const inventoryValue = allVariants?.reduce((s, v) => {
    return s + Math.max(0, v.totalQuantity) * (v.costPrice ?? v.unitPrice * 0.6);
  }, 0) ?? 0;

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;
  const isVariantPending = createVariantMutation.isPending || updateVariantMutation.isPending;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المخزون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المنتجات • الألوان • المقاسات • التكاليف</p>
        </div>
        <Button onClick={openAddProduct} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
          <Plus className="w-4 h-4" />منتج جديد
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
          </div>
          <p className="text-2xl font-black">{products?.length ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{totalVariants} SKU إجمالي</p>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-muted-foreground">متاح للبيع</p>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalAvailable}</p>
          <p className="text-[10px] text-muted-foreground mt-1">وحدة متاحة</p>
        </Card>
        <Card className={`border p-4 ${lowStockVariants > 0 ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
            <p className="text-xs text-muted-foreground">مخزون منخفض</p>
          </div>
          <p className={`text-2xl font-black ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{lowStockVariants}</p>
          <p className="text-[10px] text-muted-foreground mt-1">SKU يحتاج تجديد</p>
        </Card>
        {canViewFinancials && (
          <Card className="border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">قيمة المخزون</p>
            </div>
            <p className="text-xl font-black text-primary">{fc(inventoryValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">بسعر التكلفة</p>
          </Card>
        )}
      </div>

      {/* Stock Intelligence Summary */}
      {stockIntel && (stockIntel.summary.fastMovers > 0 || stockIntel.summary.slowMovers > 0 || stockIntel.summary.totalFrozenCapital > 0) && (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card/50 px-4 py-2.5 text-xs flex-wrap">
          <span className="text-muted-foreground font-semibold">ذكاء المخزون:</span>
          {stockIntel.summary.fastMovers > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {stockIntel.summary.fastMovers} سريع النفاد (أقل من 7 أيام)
            </span>
          )}
          {stockIntel.summary.slowMovers > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              {stockIntel.summary.slowMovers} بطيء الحركة
            </span>
          )}
          {stockIntel.summary.totalFrozenCapital > 0 && (
            <span className="text-amber-700/80 dark:text-amber-400/80">{fc(stockIntel.summary.totalFrozenCapital)} رأسمال متجمد</span>
          )}
          {stockIntel.summary.outOfStock > 0 && (
            <span className="text-red-600/80 dark:text-red-400/80">{stockIntel.summary.outOfStock} نفد مخزونه</span>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="بحث باسم المنتج أو SKU..."
          className="pr-9 h-9 text-sm bg-card border-border"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Products list */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">جاري التحميل...</div>
      ) : filteredProducts.length ? (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const variants = getProductVariants(product.id);
            const isExpanded = expandedProductId === product.id;
            const totalStock = variants.reduce((s, v) => s + v.totalQuantity, 0);
            const availableStock = totalStock; // availableQty = totalQuantity (movement-based)
            const hasLowStock = variants.some(v => v.totalQuantity <= v.lowStockThreshold);
            const productMargin = calcMargin(product.unitPrice, product.costPrice);
            const intel = stockMap.get(product.name.trim().toLowerCase());
            const productValue = variants.reduce((s, v) => {
              return s + Math.max(0, v.totalQuantity) * (v.costPrice ?? product.costPrice ?? product.unitPrice * 0.6);
            }, 0);

            return (
              <Card key={product.id} className={`border overflow-hidden transition-all ${hasLowStock ? "border-amber-900/50" : "border-border"}`}>
                {/* Product header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{product.name}</p>
                        {hasLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                        {product.sku && <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{product.sku}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">{variants.length} SKU</span>
                        <span className="text-[10px] text-primary font-semibold">{fc(product.unitPrice)}</span>
                        {canViewFinancials && product.costPrice ? (
                          <span className="text-[10px] text-amber-700 dark:text-amber-400">تكلفة: {fc(product.costPrice)}</span>
                        ) : null}
                        {canViewFinancials && <MarginBadge margin={productMargin} />}
                        {intel && intel.velocityPerDay > 0 && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            intel.category === "fast" ? "border-red-400 text-red-700 bg-red-100 dark:border-red-800 dark:text-red-400 dark:bg-red-900/10"
                            : intel.category === "medium" ? "border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/10"
                            : "border-border text-muted-foreground"
                          }`}>
                            {intel.daysUntilStockout === 0 ? "نفد" : intel.daysUntilStockout !== null ? `${intel.daysUntilStockout}ي للنفاد` : `${intel.velocityPerDay}/يوم`}
                          </span>
                        )}
                        {intel && intel.frozenCapital > 0 && (intel.category === "slow" || intel.category === "stale") && (
                          <span className="text-[9px] text-muted-foreground/60">{fc(intel.frozenCapital)} متجمد</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Stock */}
                    <div className="text-left hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">المتاح</p>
                      <p className="text-sm font-bold">
                        <span className={availableStock === 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>{availableStock}</span>
                        <span className="text-muted-foreground"> وحدة</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground">{fc(productValue)}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" title="إضافة SKU" onClick={() => openAddVariant(product.id)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" title="تعديل" onClick={() => openEditProduct(product)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" title="حذف" onClick={() => { if (confirm(`حذف "${product.name}" وكل مقاساته؟`)) deleteProductMutation.mutate(product.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Variants Table */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {variants.length === 0 ? (
                      <div className="p-8 text-center">
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
                              <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground w-28">اللون</th>
                              <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">المقاس</th>
                              <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground hidden lg:table-cell">SKU</th>
                              <th className="text-center py-2.5 px-3 font-semibold text-emerald-500/80">متاح</th>
                              <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground/60 hidden sm:table-cell">مباع</th>
                              <th className="text-right py-2.5 px-3 font-semibold text-primary/80">بيع</th>
                              {canViewFinancials && <th className="text-right py-2.5 px-3 font-semibold text-amber-500/80">تكلفة</th>}
                              {canViewFinancials && <th className="text-center py-2.5 px-3 font-semibold text-emerald-500/80">هامش</th>}
                              <th className="text-center py-2.5 px-3 font-semibold text-muted-foreground">حالة</th>
                              <th className="w-24 py-2.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v) => {
                              const available = v.totalQuantity; // movement-based: available = totalQuantity
                              const isLow = available <= v.lowStockThreshold;
                              const margin = calcMargin(v.unitPrice, v.costPrice);
                              return (
                                <tr key={v.id} className="border-b border-border/40 hover:bg-muted/10 last:border-0">
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 rounded-full border border-border/50 shrink-0" style={{ background: getColorHex(v.color) }} />
                                      <span className="font-semibold">{v.color}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className="font-bold text-[10px] border-border text-foreground">{v.size}</Badge>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-muted-foreground text-[10px] hidden lg:table-cell">{v.sku || "—"}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`font-bold text-sm ${isLow ? "text-amber-700 dark:text-amber-400" : available === 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{available}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-muted-foreground/60 hidden sm:table-cell">{v.soldQuantity}</td>
                                  <td className="py-2.5 px-3 text-primary font-bold">{fc(v.unitPrice)}</td>
                                  {canViewFinancials && (
                                    <td className="py-2.5 px-3">
                                      {v.costPrice ? (
                                        <span className="text-amber-700 dark:text-amber-400 font-semibold">{fc(v.costPrice)}</span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  )}
                                  {canViewFinancials && (
                                    <td className="py-2.5 px-3 text-center">
                                      <MarginBadge margin={margin} />
                                    </td>
                                  )}
                                  <td className="py-2.5 px-3 text-center">
                                    {available === 0 ? (
                                      <Badge variant="outline" className="text-[8px] font-bold border-red-400 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">نفد</Badge>
                                    ) : isLow ? (
                                      <Badge variant="outline" className="text-[8px] font-bold border-amber-400 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">منخفض</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[8px] font-bold border-emerald-400 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">جيد</Badge>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost" size="sm"
                                        className="h-6 px-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 gap-1"
                                        title="إضافة مخزون"
                                        onClick={() => openAddVariantStock(v)}
                                      >
                                        <Plus className="w-3 h-3" />مخزون
                                      </Button>
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
                          {variants.length > 0 && (
                            <tfoot>
                              <tr className="bg-muted/5">
                                <td colSpan={12} className="px-4 py-2">
                                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => openAddVariant(product.id)}>
                                    <Plus className="w-3 h-3" />إضافة لون/مقاس
                                  </Button>
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
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
          <p className="font-bold">{search ? "لا توجد نتائج" : "لا توجد منتجات"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "جرب بحثاً مختلفاً" : "أضف منتجاتك ثم أضف لكل منتج الألوان والمقاسات."}
          </p>
          {!search && <Button onClick={openAddProduct} className="mt-4 gap-2 text-sm"><Plus className="w-4 h-4" />إضافة أول منتج</Button>}
        </Card>
      )}

      {/* ─── Product Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {editingProduct ? "تعديل المنتج" : "منتج جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1.5 block">اسم المنتج *</Label>
              <Input
                placeholder="مثال: Cargo Pants"
                className="h-9 text-sm bg-background"
                value={productForm.name}
                onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">SKU الرئيسي</Label>
              <Input
                placeholder="CARGO-001 (اختياري)"
                className="h-9 text-sm bg-background font-mono"
                value={productForm.sku}
                onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))}
              />
            </div>

            <Separator />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -mb-2">الأسعار</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block text-primary">سعر البيع (ج.م) *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  className="h-9 text-sm bg-background border-primary/30"
                  value={productForm.unitPrice}
                  onChange={e => setProductForm(f => ({ ...f, unitPrice: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block text-amber-700 dark:text-amber-400">تكلفة الوحدة (ج.م)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0"
                  className="h-9 text-sm bg-background border-amber-900/30"
                  value={productForm.costPrice ?? ""}
                  onChange={e => setProductForm(f => ({ ...f, costPrice: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>

            {/* Profit preview */}
            {productForm.costPrice && productForm.unitPrice > 0 && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted/10 rounded-md border border-border text-center text-xs">
                <div>
                  <p className="text-[9px] text-muted-foreground">ربح الوحدة</p>
                  <p className={`font-bold ${productForm.unitPrice - productForm.costPrice >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fc(productForm.unitPrice - productForm.costPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">هامش الربح</p>
                  <p className={`font-bold ${calcMargin(productForm.unitPrice, productForm.costPrice)! >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {calcMargin(productForm.unitPrice, productForm.costPrice)}%
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">ROI</p>
                  <p className="font-bold text-primary">
                    {productForm.costPrice > 0
                      ? Math.round(((productForm.unitPrice - productForm.costPrice) / productForm.costPrice) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            )}

            <Separator />
            <div>
              <Label className="text-xs mb-1.5 block">حد التنبيه للمخزون المنخفض</Label>
              <Input
                type="number" min="0"
                className="h-9 text-sm bg-background"
                value={productForm.lowStockThreshold}
                onChange={e => setProductForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground"
                onClick={handleProductSubmit}
                disabled={isPending}
              >
                {isPending ? "جاري الحفظ..." : editingProduct ? "حفظ التغييرات" : "إضافة المنتج"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setProductDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Variant Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              {editingVariant ? "تعديل اللون/المقاس" : "إضافة لون + مقاس (SKU)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Color + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">اللون *</Label>
                <Input
                  placeholder="أسود، بيج..."
                  className="h-9 text-sm bg-background"
                  value={variantForm.color}
                  onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_COLORS.slice(0, 6).map(c => (
                    <button
                      key={c}
                      onClick={() => setVariantForm(f => ({ ...f, color: c }))}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${variantForm.color === c ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">المقاس *</Label>
                <Input
                  placeholder="M, L, XL, 32..."
                  className="h-9 text-sm bg-background"
                  value={variantForm.size}
                  onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_SIZES.slice(0, 6).map(s => (
                    <button
                      key={s}
                      onClick={() => setVariantForm(f => ({ ...f, size: s }))}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${variantForm.size === s ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* SKU */}
            <div>
              <Label className="text-xs mb-1.5 block">SKU مخصص</Label>
              <Input
                placeholder="يُنشأ تلقائياً إن تُرك فارغاً"
                className="h-9 text-sm bg-background font-mono"
                value={variantForm.sku}
                onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))}
              />
            </div>

            <Separator />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground -mb-2">المخزون والأسعار</p>

            {editingVariant ? (
              <div className="flex items-start gap-2 p-2.5 rounded border border-emerald-900/40 bg-emerald-900/10">
                <PackagePlus className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">تعديل الكمية عبر "إضافة مخزون"</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    المتاح حالياً: <span className="font-bold text-foreground">{editingVariant.totalQuantity}</span> وحدة — استخدم زر "+مخزون" في الجدول لتغيير الكمية
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">الكمية الأولية</Label>
                  <Input
                    type="number" min="0"
                    className="h-9 text-sm bg-background"
                    value={variantForm.totalQuantity}
                    onChange={e => setVariantForm(f => ({ ...f, totalQuantity: Number(e.target.value) }))}
                  />
                  <p className="text-[9px] text-muted-foreground mt-1">يمكن إضافة مخزون لاحقاً عبر زر "+مخزون"</p>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">حد التنبيه</Label>
                  <Input
                    type="number" min="0"
                    className="h-9 text-sm bg-background"
                    value={variantForm.lowStockThreshold}
                    onChange={e => setVariantForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
            {!editingVariant ? null : (
              <div>
                <Label className="text-xs mb-1.5 block">حد التنبيه</Label>
                <Input
                  type="number" min="0"
                  className="h-9 text-sm bg-background"
                  value={variantForm.lowStockThreshold}
                  onChange={e => setVariantForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block text-primary">سعر البيع (ج.م) *</Label>
                <Input
                  type="number" min="0" step="0.01"
                  className="h-9 text-sm bg-background border-primary/30"
                  value={variantForm.unitPrice}
                  onChange={e => setVariantForm(f => ({ ...f, unitPrice: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block text-amber-700 dark:text-amber-400">تكلفة الوحدة (ج.م)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0"
                  className="h-9 text-sm bg-background border-amber-900/30"
                  value={variantForm.costPrice ?? ""}
                  onChange={e => setVariantForm(f => ({ ...f, costPrice: e.target.value ? Number(e.target.value) : null }))}
                />
              </div>
            </div>

            {/* Profit preview for variant */}
            {variantForm.costPrice && variantForm.unitPrice > 0 && (
              <div className="p-3 bg-muted/10 rounded border border-border">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-[9px] text-muted-foreground">ربح الوحدة</p>
                    <p className={`font-bold ${variantForm.unitPrice - variantForm.costPrice >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fc(variantForm.unitPrice - variantForm.costPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">هامش الربح</p>
                    <p className="font-bold text-primary">{calcMargin(variantForm.unitPrice, variantForm.costPrice)}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">قيمة المخزون</p>
                    <p className="font-bold text-amber-400">
                      {fc((editingVariant?.totalQuantity ?? variantForm.totalQuantity) * variantForm.costPrice)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground"
                onClick={handleVariantSubmit}
                disabled={isVariantPending}
              >
                {isVariantPending ? "جاري الحفظ..." : editingVariant ? "حفظ التغييرات" : "إضافة SKU"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setVariantDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Stock Dialog ────────────────────────────────────────────────── */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-emerald-400" />
              إضافة مخزون
            </DialogTitle>
          </DialogHeader>
          {addStockVariant && (
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-md bg-muted/10 border border-border text-sm">
                <p className="font-bold">{addStockVariant.productName ?? "المنتج"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-3 rounded-full border border-border/50" style={{ background: getColorHex(addStockVariant.color) }} />
                  <span className="text-muted-foreground text-xs">{addStockVariant.color} — {addStockVariant.size}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  المخزون الحالي: <span className="font-bold text-emerald-400">{addStockVariant.totalQuantity}</span> وحدة
                </p>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block text-emerald-400">الكمية المضافة *</Label>
                <Input
                  type="number" min="1"
                  placeholder="مثال: 50"
                  className="h-9 text-sm bg-background border-emerald-900/40 focus-visible:ring-emerald-700"
                  value={addStockQty}
                  onChange={e => setAddStockQty(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddStockSubmit()}
                  autoFocus
                />
                {addStockQty && !isNaN(parseInt(addStockQty)) && (
                  <p className="text-[10px] text-emerald-400/80 mt-1">
                    بعد الإضافة: {addStockVariant.totalQuantity + parseInt(addStockQty)} وحدة
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs mb-1.5 block">ملاحظات (اختياري)</Label>
                <Textarea
                  placeholder="مثال: وارد من المورد X — فاتورة #123"
                  className="min-h-[60px] text-sm resize-none bg-background"
                  value={addStockNotes}
                  onChange={e => setAddStockNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 h-9 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
                  onClick={handleAddStockSubmit}
                  disabled={addStockMutation.isPending}
                >
                  <PackagePlus className="w-4 h-4" />
                  {addStockMutation.isPending ? "جاري الإضافة..." : "إضافة للمخزون"}
                </Button>
                <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setAddStockOpen(false)}>إلغاء</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
