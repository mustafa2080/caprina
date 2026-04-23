import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { productsApi, variantsApi, analyticsApi, warehousesApi, type Product, type ProductVariant, type StockIntelligenceItem, type Warehouse } from "@/lib/api";
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
  Layers, Tag, TrendingUp, DollarSign, Boxes, BarChart3, Search, PackagePlus, Archive,
  Filter, X, SortAsc, SortDesc, ChevronDown as ChevronDownIcon, Warehouse as WarehouseIcon, MapPin
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Warehouse distribution entry
type WarehouseDistEntry = { warehouseId: number; quantity: number };

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
  const { can, canViewFinancials } = useAuth();
  const canEdit = can("edit_inventory");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Filter & Sort
  const [filterColor, setFilterColor] = useState<string>("all");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [showFilters, setShowFilters] = useState(false);

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

  // Warehouse distribution for new SKU
  const [warehouseDist, setWarehouseDist] = useState<WarehouseDistEntry[]>([]);
  const [useWarehouseDist, setUseWarehouseDist] = useState(false);
  const [isVariantSubmitting, setIsVariantSubmitting] = useState(false);

  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll });
  const { data: stockIntel } = useQuery({ queryKey: ["stock-intelligence"], queryFn: analyticsApi.stockIntelligence, staleTime: 60000 });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list });

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
    mutationFn: (id: number) => productsApi.update(id, { isArchived: true } as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); queryClient.invalidateQueries({ queryKey: ["variants"] }); toast({ title: "تم أرشفة المنتج" }); },
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
      setAddStockOpen(false); setAddStockVariant(null); setAddStockQty(""); setAddStockNotes("");
      toast({ title: "تمت إضافة المخزون" });
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
    // auto-init with all warehouses if available
    if (warehouses && warehouses.length > 0) {
      setUseWarehouseDist(true);
      setWarehouseDist(warehouses.map(w => ({ warehouseId: w.id, quantity: 0 })));
    } else {
      setWarehouseDist([]);
      setUseWarehouseDist(false);
    }
    setVariantDialogOpen(true);
  };
  const openEditVariant = (v: ProductVariant) => {
    setActiveProductId(v.productId);
    setEditingVariant(v);
    setVariantForm({ color: v.color, size: v.size, sku: v.sku ?? "", totalQuantity: 0, lowStockThreshold: v.lowStockThreshold, unitPrice: v.unitPrice, costPrice: v.costPrice });
    setVariantDialogOpen(true);
  };
  const openAddVariantStock = (v: ProductVariant) => {
    setAddStockVariant(v); setAddStockQty(""); setAddStockNotes(""); setAddStockOpen(true);
  };

  const handleAddStockSubmit = () => {
    if (!addStockVariant) return;
    const qty = parseInt(addStockQty);
    if (isNaN(qty) || qty < 1) { toast({ title: "خطأ", description: "أدخل كمية صحيحة.", variant: "destructive" }); return; }
    addStockMutation.mutate({ productId: addStockVariant.productId, variantId: addStockVariant.id, qty, notes: addStockNotes });
  };

  const handleProductSubmit = () => {
    if (!productForm.name.trim()) { toast({ title: "خطأ", description: "اسم المنتج مطلوب.", variant: "destructive" }); return; }
    if (editingProduct) updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    else createProductMutation.mutate(productForm);
  };

  const handleVariantSubmit = async () => {
    if (!variantForm.color.trim() || !variantForm.size.trim()) {
      toast({ title: "خطأ", description: "اللون والمقاس مطلوبان.", variant: "destructive" }); return;
    }
    if (!activeProductId) return;

    if (!editingVariant && useWarehouseDist && warehouseDist.length > 0) {
      const distTotal = warehouseDist.reduce((s, d) => s + (d.quantity || 0), 0);
      if (variantForm.totalQuantity > 0 && distTotal !== variantForm.totalQuantity) {
        toast({ title: "خطأ في التوزيع", description: `مجموع المخازن (${distTotal}) لا يساوي الكمية الإجمالية (${variantForm.totalQuantity}).`, variant: "destructive" });
        return;
      }
    }

    if (editingVariant) {
      const { totalQuantity: _qty, ...editData } = variantForm;
      updateVariantMutation.mutate({ productId: activeProductId, id: editingVariant.id, data: editData });
      return;
    }

    setIsVariantSubmitting(true);
    try {
      const newVariant = await variantsApi.create(activeProductId, variantForm);
      if (variantForm.totalQuantity > 0) {
        const activeEntries = warehouseDist.filter(d => d.warehouseId && d.quantity > 0);
        if (useWarehouseDist && activeEntries.length > 0) {
          await Promise.all(
            activeEntries.map(d =>
              warehousesApi.addStock(d.warehouseId, { variantId: newVariant.id, productId: activeProductId, quantity: d.quantity })
            )
          );
        } else {
          await variantsApi.addStock(activeProductId, newVariant.id, variantForm.totalQuantity, "مخزون افتتاحي");
          const defaultWh = warehouses?.find(w => w.isDefault);
          if (defaultWh) {
            await warehousesApi.addStock(defaultWh.id, { variantId: newVariant.id, productId: activeProductId, quantity: variantForm.totalQuantity });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-profit"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["stock-intelligence"] });
      setVariantDialogOpen(false);
      setVariantForm(emptyVariantForm);
      setWarehouseDist([]);
      setUseWarehouseDist(false);
      const activeEntries = warehouseDist.filter(d => d.quantity > 0);
      toast({
        title: "تمت إضافة المقاس/اللون",
        description: activeEntries.length > 0
          ? `تم توزيع ${variantForm.totalQuantity} وحدة على ${activeEntries.length} مخزن`
          : variantForm.totalQuantity > 0
            ? `تم تسجيل ${variantForm.totalQuantity} وحدة في المخزون`
            : undefined,
      });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setIsVariantSubmitting(false);
    }
  };

  const getProductVariants = (productId: number) => allVariants?.filter(v => v.productId === productId) ?? [];

  const totalVariants = allVariants?.length ?? 0;
  const lowStockVariants = allVariants?.filter(v => v.totalQuantity <= v.lowStockThreshold).length ?? 0;
  const totalAvailable = allVariants?.reduce((s, v) => s + Math.max(0, v.totalQuantity), 0) ?? 0;
  const inventoryValue = allVariants?.reduce((s, v) => s + Math.max(0, v.totalQuantity) * (v.costPrice ?? v.unitPrice * 0.6), 0) ?? 0;

  const allColors = [...new Set(allVariants?.map(v => v.color) ?? [])].sort();
  const allSizes = [...new Set(allVariants?.map(v => v.size) ?? [])].sort();
  const activeFiltersCount = [filterColor !== "all", filterSize !== "all", filterStatus !== "all", sortBy !== "name"].filter(Boolean).length;

  const filteredProducts = (products?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    const variants = getProductVariants(p.id);
    if (filterColor !== "all" && !variants.some(v => v.color === filterColor)) return false;
    if (filterSize !== "all" && !variants.some(v => v.size === filterSize)) return false;
    if (filterStatus !== "all") {
      const rel = variants.filter(v => (filterColor === "all" || v.color === filterColor) && (filterSize === "all" || v.size === filterSize));
      if (filterStatus === "out" && !rel.some(v => v.totalQuantity === 0)) return false;
      if (filterStatus === "low" && !rel.some(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold)) return false;
      if (filterStatus === "good" && !rel.some(v => v.totalQuantity > v.lowStockThreshold)) return false;
    }
    return true;
  }) ?? []).sort((a, b) => {
    const sA = getProductVariants(a.id).reduce((s, v) => s + v.totalQuantity, 0);
    const sB = getProductVariants(b.id).reduce((s, v) => s + v.totalQuantity, 0);
    if (sortBy === "stock_desc") return sB - sA;
    if (sortBy === "stock_asc") return sA - sB;
    if (sortBy === "price_desc") return b.unitPrice - a.unitPrice;
    if (sortBy === "price_asc") return a.unitPrice - b.unitPrice;
    return a.name.localeCompare(b.name, "ar");
  });

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;
  const isVariantPending = updateVariantMutation.isPending;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المخزون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المنتجات • الألوان • المقاسات • التكاليف</p>
        </div>
        {canEdit && (
          <Button onClick={openAddProduct} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
            <Plus className="w-4 h-4" />منتج جديد
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><Package className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">إجمالي المنتجات</p></div>
          <p className="text-2xl font-black">{products?.length ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{totalVariants} SKU إجمالي</p>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/5 p-4">
          <div className="flex items-center gap-2 mb-2"><Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">متاح للبيع</p></div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalAvailable}</p>
          <p className="text-[10px] text-muted-foreground mt-1">وحدة متاحة</p>
        </Card>
        <Card className={`border p-4 ${lowStockVariants > 0 ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className={`w-4 h-4 ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} /><p className="text-xs text-muted-foreground">مخزون منخفض</p></div>
          <p className={`text-2xl font-black ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{lowStockVariants}</p>
          <p className="text-[10px] text-muted-foreground mt-1">SKU يحتاج تجديد</p>
        </Card>
        {canViewFinancials && (
          <Card className="border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-primary" /><p className="text-xs text-muted-foreground">قيمة المخزون</p></div>
            <p className="text-xl font-black text-primary">{fc(inventoryValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">بسعر التكلفة</p>
          </Card>
        )}
      </div>

      {/* Stock Intelligence */}
      {stockIntel && canViewFinancials && (stockIntel.summary.fastMovers > 0 || stockIntel.summary.slowMovers > 0 || stockIntel.summary.totalFrozenCapital > 0) && (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card/50 px-4 py-2.5 text-xs flex-wrap">
          <span className="text-muted-foreground font-semibold">ذكاء المخزون:</span>
          {stockIntel.summary.fastMovers > 0 && <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{stockIntel.summary.fastMovers} سريع النفاد</span>}
          {stockIntel.summary.slowMovers > 0 && <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />{stockIntel.summary.slowMovers} بطيء الحركة</span>}
          {stockIntel.summary.totalFrozenCapital > 0 && <span className="text-amber-700/80 dark:text-amber-400/80">{fc(stockIntel.summary.totalFrozenCapital)} رأسمال متجمد</span>}
          {stockIntel.summary.outOfStock > 0 && <span className="text-red-600/80 dark:text-red-400/80">{stockIntel.summary.outOfStock} نفد مخزونه</span>}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="بحث باسم المنتج أو SKU..." className="pr-9 h-9 text-sm bg-card border-border" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant={showFilters ? "default" : "outline"} size="sm" className="h-9 gap-1.5 text-xs font-bold shrink-0" onClick={() => setShowFilters(v => !v)}>
          <Filter className="w-3.5 h-3.5" />فلتر
          {activeFiltersCount > 0 && <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 text-[9px] font-black flex items-center justify-center">{activeFiltersCount}</span>}
        </Button>
      </div>
