import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { productsApi, variantsApi, analyticsApi, warehousesApi, type Product, type ProductVariant, type StockIntelligenceItem, type Warehouse, type VariantWarehouseStock } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Package, AlertTriangle, Edit2, Trash2, ChevronDown, ChevronRight,
  Layers, Tag, TrendingUp, DollarSign, Boxes, BarChart3, Search, PackagePlus, Archive,
  Filter, X, SortAsc, SortDesc, ChevronDown as ChevronDownIcon, Warehouse as WarehouseIcon, MapPin, Printer, ImagePlus, Trash
} from "lucide-react";

// ─── Product Image Upload ──────────────────────────────────────────────────────
function ProductImageUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("الحجم الأقصى 3MB"); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex flex-col items-center gap-2">
      {value ? (
        <div className="relative group">
          <img src={value} alt="صورة المنتج" className="w-24 h-24 object-cover rounded-xl border-2 border-primary/30 shadow" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -left-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
          >
            <Trash className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <label className="w-24 h-24 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors">
          <ImagePlus className="w-7 h-7 text-muted-foreground mb-1" />
          <span className="text-[10px] text-muted-foreground text-center">رفع صورة</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
      {value && (
        <label className="text-[11px] text-primary cursor-pointer hover:underline flex items-center gap-1">
          <ImagePlus className="w-3 h-3" />تغيير الصورة
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

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

const emptyProductForm = { name: "", sku: "", lowStockThreshold: 5, unitPrice: 0, costPrice: null as number | null, image: null as string | null };
const emptyVariantForm = { color: "", size: "", sku: "", totalQuantity: 0, lowStockThreshold: 5, unitPrice: 0, costPrice: null as number | null };

// Warehouse distribution entry
type WarehouseDistEntry = { warehouseId: number; quantity: number };

// ─── Warehouse Breakdown per SKU ──────────────────────────────────────────────
function VariantWarehouseBreakdown({ variantId }: { variantId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["variant-wh-stock", variantId],
    queryFn: () => warehousesApi.stockByVariant(variantId),
    staleTime: 30000,
  });

  if (isLoading) return <span className="text-[10px] text-muted-foreground">...</span>;
  if (!data || data.length === 0) return null;

  const active = data.filter(d => d.quantity > 0);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      {active.map(d => (
        <span
          key={d.warehouseId}
          className="inline-flex items-center gap-1 text-[9px] font-semibold bg-primary/8 border border-primary/20 text-primary/80 px-1.5 py-0.5 rounded-full"
          title={d.warehouseName}
        >
          <WarehouseIcon className="w-2.5 h-2.5" />
          {d.warehouseName.length > 8 ? d.warehouseName.slice(0, 8) + "…" : d.warehouseName}
          <span className="font-black">{d.quantity}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Margin Badge ─────────────────────────────────────────────────────────────
function MarginBadge({ margin }: { margin: number | null }) {
  if (margin === null) return <span className="text-muted-foreground">—</span>;
  const cls = margin >= 40 ? "border-emerald-400 text-emerald-700 bg-emerald-100 dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/20"
    : margin >= 20 ? "border-amber-400 text-amber-700 bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/20"
    : "border-red-400 text-red-700 bg-red-100 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20";
  return <Badge variant="outline" className={`text-[9px] font-bold border ${cls}`}>{margin}%</Badge>;
}

// ─── Print Inventory for a single product ─────────────────────────────────────
function printProductInventory(product: Product, variants: ProductVariant[], warehouses: Warehouse[] | undefined, canSeeCost: boolean) {
  const fc = (n: number) =>
    new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

  const totalStock = variants.reduce((s, v) => s + v.totalQuantity, 0);
  const now = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

  const rows = variants.map(v => {
    const isOut = v.totalQuantity === 0;
    const isLow = v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold;
    const status = isOut ? "نفد" : isLow ? "منخفض" : "متاح";
    const statusColor = isOut ? "#dc2626" : isLow ? "#d97706" : "#16a34a";
    const margin = canSeeCost && v.costPrice ? Math.round(((v.unitPrice - v.costPrice) / v.unitPrice) * 100) : null;
    return `
      <tr>
        <td>${v.color}</td>
        <td>${v.size}</td>
        <td>${v.sku ?? "—"}</td>
        <td style="text-align:center;font-weight:bold;color:${statusColor}">${v.totalQuantity}</td>
        <td style="text-align:center;color:${statusColor};font-weight:bold">${status}</td>
        ${canSeeCost ? `<td style="text-align:center">${fc(v.unitPrice)}</td>` : ""}
        ${canSeeCost ? `<td style="text-align:center">${margin !== null ? margin + "%" : "—"}</td>` : ""}
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>جرد مخزون - ${product.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 24px; color: #111; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 12px; }
    .brand { font-size: 22px; font-weight: 900; }
    .meta { text-align: left; font-size: 11px; color: #555; }
    .product-title { font-size: 18px; font-weight: 900; margin-bottom: 4px; }
    .product-sub { font-size: 11px; color: #666; margin-bottom: 16px; }
    .kpi { display: flex; gap: 20px; margin-bottom: 20px; }
    .kpi-box { border: 1px solid #ddd; border-radius: 8px; padding: 10px 16px; text-align: center; }
    .kpi-box .val { font-size: 20px; font-weight: 900; }
    .kpi-box .lbl { font-size: 10px; color: #777; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #111; color: #fff; padding: 8px 10px; font-size: 11px; font-weight: 700; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">🧺 كابرينا</div>
    <div class="meta"><div>تقرير جرد المخزون</div><div>${now}</div></div>
  </div>
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
    ${product.image ? `<img src="${product.image}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #ddd;" />` : ""}
    <div>
      <div class="product-title">${product.name}${product.sku ? ` <span style="font-size:12px;color:#999;font-weight:400">(${product.sku})</span>` : ""}</div>
      <div class="product-sub">إدارة المنتجات • الألوان • المقاسات • التكاليف</div>
    </div>
  </div>
  <div class="kpi">
    <div class="kpi-box"><div class="val">${variants.length}</div><div class="lbl">إجمالي SKU</div></div>
    <div class="kpi-box"><div class="val" style="color:#16a34a">${totalStock}</div><div class="lbl">وحدة متاحة</div></div>
    <div class="kpi-box"><div class="val" style="color:#dc2626">${variants.filter(v => v.totalQuantity === 0).length}</div><div class="lbl">نفد مخزونه</div></div>
    <div class="kpi-box"><div class="val" style="color:#d97706">${variants.filter(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold).length}</div><div class="lbl">مخزون منخفض</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>اللون</th><th>المقاس</th><th>SKU</th>
        <th style="text-align:center">الكمية</th>
        <th style="text-align:center">الحالة</th>
        ${canSeeCost ? "<th style='text-align:center'>سعر البيع</th>" : ""}
        ${canSeeCost ? "<th style='text-align:center'>هامش الربح</th>" : ""}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">تم إنشاء هذا التقرير بواسطة نظام كابرينا • ${now}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Inventory() {
  const { can, isAdmin } = useAuth();
  // ── Inventory permission shortcuts ────────────────────────────────────────
  const canEdit        = can("inventory.edit");
  const canDelete      = can("inventory.delete");
  const canSeeCost     = isAdmin || can("inventory.cost");
  const canMovements   = can("inventory.movements");
  const canWarehouses  = can("inventory.warehouses");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Filter & Sort — فلتر الموديل بدل الحالة
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterColor, setFilterColor] = useState<string>("all");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [filterStockStatus, setFilterStockStatus] = useState<string>("all"); // all / out / low / ok
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
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
  const [editWarehouseDist, setEditWarehouseDist] = useState<WarehouseDistEntry[]>([]);

  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list, staleTime: 0, refetchOnWindowFocus: true });
  const { data: allVariants } = useQuery({ queryKey: ["variants"], queryFn: variantsApi.listAll, staleTime: 0, refetchOnWindowFocus: true });
  const { data: stockIntel } = useQuery({ queryKey: ["stock-intelligence"], queryFn: analyticsApi.stockIntelligence, staleTime: 30000 });
  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: warehousesApi.list, staleTime: 0, refetchOnWindowFocus: true });

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
    setProductForm({ name: p.name, sku: p.sku ?? "", lowStockThreshold: p.lowStockThreshold, unitPrice: p.unitPrice, costPrice: p.costPrice, image: p.image ?? null });
    setProductDialogOpen(true);
  };
  const openAddVariant = (productId: number) => {
    setActiveProductId(productId);
    setEditingVariant(null);
    const p = products?.find(p => p.id === productId);
    setVariantForm({ ...emptyVariantForm, unitPrice: p?.unitPrice ?? 0, costPrice: p?.costPrice ?? null });
    if (warehouses && warehouses.length > 0) {
      setUseWarehouseDist(true);
      setWarehouseDist(warehouses.map(w => ({ warehouseId: w.id, quantity: 0 })));
    } else {
      setWarehouseDist([]);
      setUseWarehouseDist(false);
    }
    setVariantDialogOpen(true);
  };
  const openEditVariant = async (v: ProductVariant) => {
    setActiveProductId(v.productId);
    setEditingVariant(v);
    setVariantForm({ color: v.color, size: v.size, sku: v.sku ?? "", totalQuantity: 0, lowStockThreshold: v.lowStockThreshold, unitPrice: v.unitPrice, costPrice: v.costPrice });
    try {
      const whStock = await warehousesApi.stockByVariant(v.id);
      const dist: WarehouseDistEntry[] = (warehouses ?? []).map(wh => {
        const found = whStock.find(s => s.warehouseId === wh.id);
        return { warehouseId: wh.id, quantity: found?.quantity ?? 0 };
      });
      setEditWarehouseDist(dist);
    } catch {
      setEditWarehouseDist((warehouses ?? []).map(wh => ({ warehouseId: wh.id, quantity: 0 })));
    }
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

    if (editingVariant) {
      const { totalQuantity: _qty, ...editData } = variantForm;
      setIsVariantSubmitting(true);
      try {
        await new Promise<void>((resolve, reject) => {
          updateVariantMutation.mutate(
            { productId: activeProductId, id: editingVariant.id, data: editData },
            { onSuccess: () => resolve(), onError: (e) => reject(e) }
          );
        });
        const activeEditEntries = editWarehouseDist.filter(d => d.quantity >= 0);
        if (activeEditEntries.length > 0) {
          await Promise.all(
            activeEditEntries.map(d =>
              warehousesApi.addStock(d.warehouseId, {
                variantId: editingVariant.id,
                productId: activeProductId,
                quantity: d.quantity,
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: ["variant-wh-stock", editingVariant.id] });
          queryClient.invalidateQueries({ queryKey: ["warehouses"] });
          queryClient.invalidateQueries({ queryKey: ["variants"] });
          queryClient.invalidateQueries({ queryKey: ["stock-intelligence"] });
        }
        setVariantDialogOpen(false);
        setEditingVariant(null);
        setVariantForm(emptyVariantForm);
        toast({ title: "✅ تم حفظ التعديلات", description: "تم تحديث بيانات SKU والمخازن" });
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message, variant: "destructive" });
      } finally {
        setIsVariantSubmitting(false);
      }
      return;
    }

    const activeEntries = warehouseDist.filter(d => d.quantity > 0);
    const distTotal = activeEntries.reduce((s, d) => s + d.quantity, 0);

    setIsVariantSubmitting(true);
    try {
      const newVariant = await variantsApi.create(activeProductId, {
        ...variantForm,
        totalQuantity: distTotal,
      });

      if (distTotal > 0) {
        if (activeEntries.length > 0) {
          await Promise.all(
            activeEntries.map(d =>
              warehousesApi.addStock(d.warehouseId, {
                variantId: newVariant.id,
                productId: activeProductId,
                quantity: d.quantity,
              })
            )
          );
        } else {
          await variantsApi.addStock(activeProductId, newVariant.id, distTotal, "مخزون افتتاحي");
          const defaultWh = warehouses?.find(w => w.isDefault);
          if (defaultWh) {
            await warehousesApi.addStock(defaultWh.id, {
              variantId: newVariant.id,
              productId: activeProductId,
              quantity: distTotal,
            });
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

      toast({
        title: "✅ تمت إضافة المقاس/اللون",
        description: activeEntries.length > 0
          ? `تم توزيع ${distTotal} وحدة على ${activeEntries.length} مخزن`
          : distTotal > 0
            ? `تم تسجيل ${distTotal} وحدة في المخزون`
            : "تمت الإضافة بدون مخزون",
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
  // قائمة الموديلات (أسماء المنتجات) للفلتر
  const allModels = [...new Set(products?.map(p => p.name) ?? [])].sort((a, b) => a.localeCompare(b, "ar"));

  const activeFiltersCount = [filterModel !== "all", filterColor !== "all", filterSize !== "all", filterStockStatus !== "all", filterWarehouse !== "all", sortBy !== "name"].filter(Boolean).length;

  // ─── فلترة المنتجات بشكل صحيح ───
  const filteredProducts = (products?.filter(p => {
    // فلتر الموديل (اسم المنتج)
    if (filterModel !== "all" && p.name !== filterModel) return false;

    // فلتر البحث
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    const variants = getProductVariants(p.id);

    // فلتر اللون — لازم يكون في على الأقل variant بهذا اللون
    if (filterColor !== "all" && !variants.some(v => v.color === filterColor)) return false;

    // فلتر المقاس — لازم يكون في على الأقل variant بهذا المقاس
    if (filterSize !== "all" && !variants.some(v => v.size === filterSize)) return false;

    // فلتر حالة المخزون
    if (filterStockStatus !== "all") {
      const hasOut = variants.some(v => v.totalQuantity === 0);
      const hasLow = variants.some(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold);
      const hasOk  = variants.some(v => v.totalQuantity > v.lowStockThreshold);
      if (filterStockStatus === "out" && !hasOut) return false;
      if (filterStockStatus === "low" && !hasLow) return false;
      if (filterStockStatus === "ok"  && !hasOk)  return false;
    }

    return true;
  }) ?? []).sort((a, b) => {
    const sA = getProductVariants(a.id).reduce((s, v) => s + v.totalQuantity, 0);
    const sB = getProductVariants(b.id).reduce((s, v) => s + v.totalQuantity, 0);
    if (sortBy === "stock_desc") return sB - sA;
    if (sortBy === "stock_asc") return sA - sB;
    if (sortBy === "low_first") {
      const scoreA = getProductVariants(a.id).some(v => v.totalQuantity === 0) ? 0 : getProductVariants(a.id).some(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold) ? 1 : 2;
      const scoreB = getProductVariants(b.id).some(v => v.totalQuantity === 0) ? 0 : getProductVariants(b.id).some(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold) ? 1 : 2;
      return scoreA - scoreB;
    }
    if (sortBy === "price_desc") return b.unitPrice - a.unitPrice;
    if (sortBy === "price_asc") return a.unitPrice - b.unitPrice;
    return a.name.localeCompare(b.name, "ar");
  });

  // ─── فلترة الـ variants داخل كل منتج بشكل صحيح ───
  const getFilteredVariants = (productId: number) => {
    const variants = getProductVariants(productId);
    return variants.filter(v => {
      if (filterColor !== "all" && v.color !== filterColor) return false;
      if (filterSize !== "all" && v.size !== filterSize) return false;
      if (filterStockStatus === "out" && v.totalQuantity !== 0) return false;
      if (filterStockStatus === "low" && !(v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold)) return false;
      if (filterStockStatus === "ok"  && !(v.totalQuantity > v.lowStockThreshold)) return false;
      return true;
    });
  };

  const isPending = createProductMutation.isPending || updateProductMutation.isPending;
  const isVariantPending = updateVariantMutation.isPending;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">المخزون</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">إدارة المنتجات • الألوان • المقاسات • التكاليف</p>
        </div>
        {canEdit && (
          <Button onClick={openAddProduct} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs sm:text-sm h-8 sm:h-9 px-3">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">منتج جديد</span>
            <span className="xs:hidden">جديد</span>
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card className="border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">إجمالي المنتجات</p>
          </div>
          <p className="text-xl sm:text-2xl font-black">{products?.length ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{totalVariants} SKU إجمالي</p>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/5 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">متاح للبيع</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalAvailable}</p>
          <p className="text-[10px] text-muted-foreground mt-1">وحدة متاحة</p>
        </Card>
        <Card className={`border p-3 sm:p-4 ${lowStockVariants > 0 ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
            <p className="text-[10px] sm:text-xs text-muted-foreground">مخزون منخفض</p>
          </div>
          <p className={`text-xl sm:text-2xl font-black ${lowStockVariants > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{lowStockVariants}</p>
          <p className="text-[10px] text-muted-foreground mt-1">SKU يحتاج تجديد</p>
        </Card>
        {canSeeCost && (
          <Card className="border-primary/30 bg-primary/5 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">قيمة المخزون</p>
            </div>
            <p className="text-base sm:text-xl font-black text-primary">{fc(inventoryValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">بسعر التكلفة</p>
          </Card>
        )}
      </div>

      {/* Stock Intelligence */}
      {stockIntel && canSeeCost && (stockIntel.summary.fastMovers > 0 || stockIntel.summary.slowMovers > 0 || stockIntel.summary.totalFrozenCapital > 0) && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 sm:px-4 py-2.5 text-xs flex-wrap">
          <span className="text-muted-foreground font-semibold">ذكاء المخزون:</span>
          {stockIntel.summary.fastMovers > 0 && <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{stockIntel.summary.fastMovers} سريع النفاد</span>}
          {stockIntel.summary.slowMovers > 0 && <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />{stockIntel.summary.slowMovers} بطيء الحركة</span>}
          {stockIntel.summary.totalFrozenCapital > 0 && <span className="text-amber-700/80 dark:text-amber-400/80">{fc(stockIntel.summary.totalFrozenCapital)} رأسمال متجمد</span>}
          {stockIntel.summary.outOfStock > 0 && <span className="text-red-600/80 dark:text-red-400/80">{stockIntel.summary.outOfStock} نفد مخزونه</span>}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="بحث باسم المنتج أو SKU..." className="pr-9 h-9 text-sm bg-card border-border w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant={showFilters ? "default" : "outline"} size="sm" className="h-9 gap-1.5 text-xs font-bold shrink-0 px-3" onClick={() => setShowFilters(v => !v)}>
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">فلتر</span>
          {activeFiltersCount > 0 && <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 text-[9px] font-black flex items-center justify-center">{activeFiltersCount}</span>}
        </Button>
      </div>

      {/* Filter Panel — فلتر الموديل بدل الحالة */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* فلتر الموديل */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold">الموديل</p>
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="كل الموديلات" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموديلات</SelectItem>
                  {allModels.map(m => (
                    <SelectItem key={m} value={m}>
                      <span className="truncate max-w-[150px] block">{m}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* فلتر اللون */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold">اللون</p>
              <Select value={filterColor} onValueChange={setFilterColor}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="كل الألوان" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الألوان</SelectItem>
                  {allColors.map(c => (
                    <SelectItem key={c} value={c}>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-border/50 shrink-0" style={{ background: getColorHex(c) }} />
                        {c}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* فلتر المقاس */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold">المقاس</p>
              <Select value={filterSize} onValueChange={setFilterSize}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="كل المقاسات" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المقاسات</SelectItem>
                  {allSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* ترتيب */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold">ترتيب</p>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">الاسم</SelectItem>
                  <SelectItem value="stock_desc">مخزون ↓ (الأعلى أولاً)</SelectItem>
                  <SelectItem value="stock_asc">مخزون ↑ (الأقل أولاً)</SelectItem>
                  <SelectItem value="low_first">🔴 منخفض أولاً</SelectItem>
                  <SelectItem value="price_desc">سعر ↓</SelectItem>
                  <SelectItem value="price_asc">سعر ↑</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* صف ثاني — حالة المخزون + المستودع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-border/50 pt-2.5">
            {/* فلتر حالة المخزون */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold">🔍 حالة المخزون (للجرد)</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { value: "all", label: "الكل",       cls: "border-border text-muted-foreground" },
                  { value: "out", label: "🔴 نافد",     cls: "border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
                  { value: "low", label: "🟡 منخفض",   cls: "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
                  { value: "ok",  label: "🟢 متاح",    cls: "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStockStatus(opt.value)}
                    className={`h-7 px-2.5 text-[11px] font-bold rounded-md border transition-all ${filterStockStatus === opt.value ? opt.cls + " shadow-sm" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* فلتر المستودع */}
            {warehouses && warehouses.length > 1 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 font-semibold">🏭 المستودع</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilterWarehouse("all")}
                    className={`h-7 px-2.5 text-[11px] font-bold rounded-md border transition-all ${filterWarehouse === "all" ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    كل المستودعات
                  </button>
                  {warehouses.map(wh => (
                    <button
                      key={wh.id}
                      onClick={() => setFilterWarehouse(String(wh.id))}
                      className={`h-7 px-2.5 text-[11px] font-bold rounded-md border transition-all flex items-center gap-1 ${filterWarehouse === String(wh.id) ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/40"}`}
                    >
                      <WarehouseIcon className="w-2.5 h-2.5" />{wh.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setFilterModel("all"); setFilterColor("all"); setFilterSize("all"); setFilterStockStatus("all"); setFilterWarehouse("all"); setSortBy("name"); }}>
              <X className="w-3 h-3" />مسح الفلاتر ({activeFiltersCount})
            </Button>
          )}
        </div>
      )}

      {/* Products List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">جاري التحميل...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {activeFiltersCount > 0 || search ? "لا توجد نتائج مطابقة للفلتر" : "لا توجد منتجات"}
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredProducts.map(product => {
            const variants = getProductVariants(product.id);
            const filteredVariants = getFilteredVariants(product.id);
            const isExpanded = expandedProductId === product.id;
            const totalStock = variants.reduce((s, v) => s + v.totalQuantity, 0);
            const hasLow = variants.some(v => v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold);
            const hasOut = variants.some(v => v.totalQuantity === 0);
            const margin = calcMargin(product.unitPrice, product.costPrice);
            const intel = stockMap.get(product.name.trim().toLowerCase());

            return (
              <Card key={product.id} className="border-border bg-card overflow-hidden">
                {/* Product Row */}
                <div
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                >
                  {/* صورة المنتج */}
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm">{product.name}</span>
                      {product.sku && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{product.sku}</span>}
                      {hasOut && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">نفد</Badge>}
                      {hasLow && !hasOut && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-400 text-amber-700">منخفض</Badge>}
                      {intel?.badge === "fast" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-red-400 text-red-600 hidden sm:flex">سريع النفاد</Badge>}
                      {intel?.badge === "slow" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-muted-foreground text-muted-foreground hidden sm:flex">بطيء</Badge>}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      <span>{variants.length} SKU</span>
                      <span className="font-semibold text-foreground">{totalStock} وحدة</span>
                      {canSeeCost && <span className="hidden sm:inline">{fc(product.unitPrice)}</span>}
                      {canSeeCost && <span className="hidden sm:inline"><MarginBadge margin={margin} /></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hidden sm:flex" title="طباعة الجرد" onClick={e => { e.stopPropagation(); printProductInventory(product, variants, warehouses, canSeeCost); }}>
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); openEditProduct(product); }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hidden sm:flex" onClick={e => { e.stopPropagation(); if (confirm("أرشفة هذا المنتج؟")) deleteProductMutation.mutate(product.id); }}>
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Variants */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Variants Table Header — responsive */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-1.5 bg-muted/20 text-[10px] text-muted-foreground font-semibold">
                      <span>اللون / المقاس</span>
                      <span className="text-center w-16">المخزون</span>
                      {canSeeCost && <span className="text-center w-20">السعر</span>}
                      {canSeeCost && <span className="text-center w-12">هامش</span>}
                      {canEdit && <span className="w-20" />}
                    </div>
                    {filteredVariants.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        {variants.length > 0 ? "لا يوجد SKU مطابق للفلتر" : "لا يوجد SKU بعد"}
                      </div>
                    ) : (
                      filteredVariants.map(v => {
                        const vMargin = calcMargin(v.unitPrice, v.costPrice);
                        const isLow = v.totalQuantity > 0 && v.totalQuantity <= v.lowStockThreshold;
                        const isOut = v.totalQuantity === 0;
                        return (
                          <div key={v.id} className="border-t border-border/50">
                            {/* Desktop row */}
                            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2.5 items-start hover:bg-muted/10">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full shrink-0 border border-border/50" style={{ background: getColorHex(v.color) }} />
                                  <span className="text-xs font-medium truncate">{v.color} / {v.size}</span>
                                  {v.sku && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded font-mono">{v.sku}</span>}
                                </div>
                                <VariantWarehouseBreakdown variantId={v.id} />
                              </div>
                              <div className={`text-center w-16 text-xs font-bold ${isOut ? "text-red-600 dark:text-red-400" : isLow ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {v.totalQuantity}
                              </div>
                              {canSeeCost && <div className="text-center w-20 text-xs text-muted-foreground">{fc(v.unitPrice)}</div>}
                              {canSeeCost && <div className="text-center w-12"><MarginBadge margin={vMargin} /></div>}
                              {(canEdit || canDelete) && (
                                <div className="flex items-center gap-1 w-20 justify-end">
                                  {canEdit && (
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="إضافة مخزون" onClick={() => openAddVariantStock(v)}>
                                    <PackagePlus className="w-3.5 h-3.5" />
                                  </Button>
                                  )}
                                  {canEdit && (
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditVariant(v)}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  )}
                                  {canDelete && (
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm("حذف هذا SKU؟")) deleteVariantMutation.mutate({ productId: v.productId, id: v.id }); }}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Mobile row */}
                            <div className="sm:hidden flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/10">
                              <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-border/50 mt-0.5" style={{ background: getColorHex(v.color) }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold">{v.color} / {v.size}</span>
                                  <span className={`text-xs font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
                                    {v.totalQuantity} وحدة
                                  </span>
                                </div>
                                {v.sku && <span className="text-[9px] text-muted-foreground font-mono">{v.sku}</span>}
                                <VariantWarehouseBreakdown variantId={v.id} />
                              </div>
                              {(canEdit || canDelete) && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {canEdit && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => openAddVariantStock(v)}>
                                    <PackagePlus className="w-3.5 h-3.5" />
                                  </Button>
                                  )}
                                  {canEdit && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditVariant(v)}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  )}
                                  {canDelete && (
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("حذف هذا SKU؟")) deleteVariantMutation.mutate({ productId: v.productId, id: v.id }); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {/* Add SKU Button */}
                    {canEdit && (
                      <div className="px-3 sm:px-4 py-2 border-t border-border/50">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/5" onClick={() => openAddVariant(product.id)}>
                          <Plus className="w-3.5 h-3.5" />إضافة SKU جديد
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Product Dialog ─── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل المنتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* صورة المنتج */}
            <div className="flex items-center gap-4">
              <ProductImageUpload value={productForm.image} onChange={v => setProductForm(f => ({ ...f, image: v }))} />
              <div className="flex-1 space-y-3">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">اسم المنتج *</Label>
                  <Input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: تيشيرت قطن" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">SKU (اختياري)</Label>
                  <Input value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} placeholder="مثال: TS-001" className="h-9 text-sm font-mono" />
                </div>
              </div>
            </div>
            <div className={`grid gap-3 ${canSeeCost ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">سعر البيع (ج.م)</Label>
                <Input type="number" value={productForm.unitPrice || ""} onChange={e => setProductForm(f => ({ ...f, unitPrice: parseFloat(e.target.value) || 0 }))} placeholder="0" className="h-9 text-sm" />
              </div>
              {canSeeCost && (
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">سعر التكلفة (ج.م)</Label>
                <Input type="number" value={productForm.costPrice ?? ""} onChange={e => setProductForm(f => ({ ...f, costPrice: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="اختياري" className="h-9 text-sm" />
              </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">حد المخزون المنخفض</Label>
              <Input type="number" value={productForm.lowStockThreshold} onChange={e => setProductForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 5 }))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleProductSubmit} disabled={isPending} className="flex-1 h-9 text-sm font-bold">
              {isPending ? "جاري الحفظ..." : editingProduct ? "حفظ التعديلات" : "إضافة المنتج"}
            </Button>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="h-9 text-sm">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Variant Dialog ─── */}
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {editingVariant ? <><Edit2 className="w-4 h-4" />تعديل SKU</> : <><Plus className="w-4 h-4" />إضافة SKU جديد</>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-[11px] font-bold mb-2 block text-muted-foreground">اللون *</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_COLORS.map(c => (
                  <button key={c} onClick={() => setVariantForm(f => ({ ...f, color: c }))}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors ${variantForm.color === c ? "border-primary bg-primary/10 text-primary font-bold" : "border-border bg-muted/30 hover:border-primary/50"}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: getColorHex(c) }} />{c}
                  </button>
                ))}
              </div>
              <Input value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} placeholder="أو اكتب لوناً آخر..." className="h-8 text-sm" />
            </div>

            <div>
              <Label className="text-[11px] font-bold mb-2 block text-muted-foreground">المقاس *</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_SIZES.map(s => (
                  <button key={s} onClick={() => setVariantForm(f => ({ ...f, size: s }))}
                    className={`px-2.5 py-0.5 rounded text-[11px] border transition-colors ${variantForm.size === s ? "border-primary bg-primary/10 text-primary font-bold" : "border-border bg-muted/30 hover:border-primary/50"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <Input value={variantForm.size} onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))} placeholder="أو اكتب مقاساً آخر..." className="h-8 text-sm" />
            </div>

            <div className={`grid gap-2 ${canSeeCost ? "grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <Label className="text-[11px] font-bold mb-1.5 block text-muted-foreground">كود SKU</Label>
                <Input value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))} placeholder="اختياري" className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-[11px] font-bold mb-1.5 block text-muted-foreground">سعر البيع</Label>
                <Input type="number" value={variantForm.unitPrice || ""} onChange={e => setVariantForm(f => ({ ...f, unitPrice: parseFloat(e.target.value) || 0 }))} className="h-8 text-xs" />
              </div>
              {canSeeCost && (
              <div>
                <Label className="text-[11px] font-bold mb-1.5 block text-muted-foreground">سعر التكلفة</Label>
                <Input type="number" value={variantForm.costPrice ?? ""} onChange={e => setVariantForm(f => ({ ...f, costPrice: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="اختياري" className="h-8 text-xs" />
              </div>
              )}
            </div>

            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <WarehouseIcon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold">
                    {editingVariant ? "كميات المخازن الحالية" : "توزيع الكميات على المخازن"}
                  </span>
                  {warehouses && warehouses.length > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {warehouses.length} مخزن
                    </span>
                  )}
                </div>

                {!warehouses || warehouses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    <WarehouseIcon className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                    لا توجد مخازن مضافة. أضف مخازن أولاً من قسم المخازن.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="grid grid-cols-[1fr_100px] gap-3 px-4 py-2 bg-muted/50 text-[10px] font-bold text-muted-foreground border-b border-border">
                      <span>المخزن</span>
                      <span className="text-center">الكمية</span>
                    </div>
                    {warehouses.map((wh, idx) => {
                      const distList = editingVariant ? editWarehouseDist : warehouseDist;
                      const entry = distList.find(d => d.warehouseId === wh.id);
                      const qty = entry?.quantity ?? 0;
                      return (
                        <div
                          key={wh.id}
                          className={`grid grid-cols-[1fr_100px] gap-3 px-4 py-3 items-center transition-colors
                            ${idx !== 0 ? "border-t border-border/50" : ""}
                            ${qty > 0 ? "bg-primary/5" : "hover:bg-muted/30"}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${qty > 0 ? "bg-primary" : "bg-muted-foreground/25"}`} />
                            <span className="text-xs font-semibold truncate">{wh.name}</span>
                            {wh.isDefault && (
                              <span className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min="0"
                            value={qty || ""}
                            placeholder="0"
                            className={`h-9 text-sm text-center font-bold transition-all
                              ${qty > 0 ? "border-primary/60 bg-primary/5 text-primary" : ""}`}
                            onChange={e => {
                              const newQty = parseInt(e.target.value) || 0;
                              const updater = (prev: WarehouseDistEntry[]) => {
                                const existing = prev.find(d => d.warehouseId === wh.id);
                                if (existing) return prev.map(d => d.warehouseId === wh.id ? { ...d, quantity: newQty } : d);
                                return [...prev, { warehouseId: wh.id, quantity: newQty }];
                              };
                              if (editingVariant) setEditWarehouseDist(updater);
                              else setWarehouseDist(updater);
                            }}
                          />
                        </div>
                      );
                    })}
                    {(() => {
                      const distList = editingVariant ? editWarehouseDist : warehouseDist;
                      const distTotal = distList.reduce((s, d) => s + (d.quantity || 0), 0);
                      return (
                        <div className={`grid grid-cols-[1fr_100px] gap-3 px-4 py-2.5 border-t-2 items-center
                          ${distTotal > 0 ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30"}`}>
                          <span className="text-xs font-bold text-foreground">إجمالي الكميات</span>
                          <span className={`text-center text-base font-black ${distTotal > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {distTotal}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>

            <div>
              <Label className="text-[11px] font-bold mb-1.5 block text-muted-foreground">حد التنبيه (مخزون منخفض)</Label>
              <Input type="number" value={variantForm.lowStockThreshold} onChange={e => setVariantForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 5 }))} className="h-8 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-border mt-2">
            <Button onClick={handleVariantSubmit} disabled={isVariantPending || isVariantSubmitting} className="flex-1 h-9 text-sm font-bold gap-2">
              {(isVariantPending || isVariantSubmitting) ? "جاري الحفظ..." : editingVariant ? "حفظ التعديلات" : "إضافة SKU"}
            </Button>
            <Button variant="outline" onClick={() => setVariantDialogOpen(false)} className="h-9 text-sm px-6">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Stock Dialog ─── */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مخزون</DialogTitle>
          </DialogHeader>
          {addStockVariant && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                <span className="w-4 h-4 rounded-full border" style={{ background: getColorHex(addStockVariant.color) }} />
                <span className="text-sm font-semibold">{addStockVariant.color} / {addStockVariant.size}</span>
                <span className="text-xs text-muted-foreground mr-auto">المخزون الحالي: {addStockVariant.totalQuantity}</span>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">الكمية المضافة *</Label>
                <Input type="number" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} placeholder="أدخل الكمية" className="h-9 text-sm" autoFocus />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">ملاحظات (اختياري)</Label>
                <Textarea value={addStockNotes} onChange={e => setAddStockNotes(e.target.value)} placeholder="مثال: شحنة جديدة، مرتجع..." className="text-sm h-16 resize-none" />
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleAddStockSubmit} disabled={addStockMutation.isPending} className="flex-1 h-9 text-sm font-bold">
              {addStockMutation.isPending ? "جاري الحفظ..." : "إضافة للمخزون"}
            </Button>
            <Button variant="outline" onClick={() => setAddStockOpen(false)} className="h-9 text-sm">إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
