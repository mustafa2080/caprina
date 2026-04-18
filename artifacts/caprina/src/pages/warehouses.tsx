import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse, Package, Edit2, Trash2, Star, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { warehousesApi, type Warehouse as WarehouseType, type WarehouseDetail, productsApi, variantsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-EG").format(n);

function WarehouseFormDialog({
  open, onClose, existing,
}: {
  open: boolean; onClose: () => void; existing?: WarehouseType;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "خطأ", description: "اسم المخزن مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await warehousesApi.update(existing.id, { name, address: address || null, notes: notes || null, isDefault });
        toast({ title: "تم تحديث المخزن" });
      } else {
        await warehousesApi.create({ name, address: address || null, notes: notes || null, isDefault });
        toast({ title: "تم إنشاء المخزن" });
      }
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      onClose();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{existing ? "تعديل المخزن" : "إضافة مخزن جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">اسم المخزن *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="المخزن الرئيسي" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">العنوان</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="شارع، مدينة..." className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="..." className="min-h-[60px] text-sm resize-none" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">مخزن افتراضي</Label>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs h-8">إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="text-xs h-8">{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockEditor({ warehouseId, onClose }: { warehouseId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: warehouse, isLoading } = useQuery({
    queryKey: ["warehouses", warehouseId],
    queryFn: () => warehousesApi.get(warehouseId),
  });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });
  const { data: allVariants } = useQuery({ queryKey: ["variants-all"], queryFn: variantsApi.listAll });
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [qty, setQty] = useState(0);
  const [adding, setAdding] = useState(false);

  const productVariants = allVariants?.filter(v => v.productId === Number(selectedProductId)) ?? [];

  const handleAddStock = async () => {
    if (!selectedProductId) { toast({ title: "اختر منتجاً", variant: "destructive" }); return; }
    setAdding(true);
    try {
      await warehousesApi.addStock(warehouseId, {
        productId: selectedVariantId ? null : Number(selectedProductId),
        variantId: selectedVariantId ? Number(selectedVariantId) : null,
        quantity: qty,
      });
      qc.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast({ title: "تم تحديث المخزون" });
      setSelectedProductId(""); setSelectedVariantId(""); setQty(0);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateQty = async (stockId: number, newQty: number) => {
    try {
      await warehousesApi.updateStock(warehouseId, stockId, newQty);
      qc.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="text-base font-bold">مخزون: {warehouse?.name}</h2>
      </div>

      {/* Add stock row */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-bold text-primary">إضافة / تحديث منتج</CardTitle></CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">المنتج</Label>
              <select
                className="w-full h-8 text-xs bg-card border border-input rounded-md px-2"
                value={selectedProductId}
                onChange={e => { setSelectedProductId(e.target.value ? Number(e.target.value) : ""); setSelectedVariantId(""); }}
              >
                <option value="">اختر منتج...</option>
                {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">النوع (اختياري)</Label>
              <select
                className="w-full h-8 text-xs bg-card border border-input rounded-md px-2"
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value ? Number(e.target.value) : "")}
                disabled={!selectedProductId || productVariants.length === 0}
              >
                <option value="">كل الأنواع</option>
                {productVariants.map(v => <option key={v.id} value={v.id}>{v.color} — {v.size}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">الكمية</Label>
              <Input type="number" min="0" value={qty} onChange={e => setQty(Number(e.target.value))} className="h-8 text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={handleAddStock} disabled={adding} className="text-xs h-7 gap-1">
            <Plus className="w-3 h-3" />{adding ? "جاري الحفظ..." : "تحديث الكمية"}
          </Button>
        </CardContent>
      </Card>

      {/* Stock table */}
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs text-right">المنتج</TableHead>
              <TableHead className="text-xs text-right">النوع</TableHead>
              <TableHead className="text-xs text-center">الكمية</TableHead>
              <TableHead className="text-xs text-right">آخر تحديث</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouse?.stock.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-6">لا توجد بيانات مخزون</TableCell></TableRow>
            )}
            {warehouse?.stock.map(item => (
              <TableRow key={item.id}>
                <TableCell className="text-xs font-medium">{item.productName ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.variantColor ? `${item.variantColor} / ${item.variantSize}` : "إجمالي"}
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number" min="0"
                    defaultValue={item.quantity}
                    onBlur={e => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v !== item.quantity) handleUpdateQty(item.id, v);
                    }}
                    className="h-7 w-20 text-xs text-center mx-auto"
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString("ar-EG")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | undefined>();
  const [stockViewId, setStockViewId] = useState<number | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: warehousesApi.list,
  });

  const deleteWarehouse = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المخزن؟")) return;
    try {
      await warehousesApi.delete(id);
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast({ title: "تم حذف المخزن" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  if (stockViewId !== null) {
    return (
      <div className="max-w-4xl mx-auto">
        <StockEditor warehouseId={stockViewId} onClose={() => setStockViewId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المخازن</h1>
          <p className="text-muted-foreground text-xs mt-0.5">إدارة المخازن ومخزون كل فرع</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => { setEditingWarehouse(undefined); setFormOpen(true); }}>
            <Plus className="w-3.5 h-3.5" />إضافة مخزن
          </Button>
        )}
      </div>

      {isLoading && <p className="text-center text-muted-foreground text-sm py-12">جاري التحميل...</p>}

      {!isLoading && warehouses.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد مخازن بعد. أضف مخزنك الأول.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {warehouses.map(w => (
          <Card key={w.id} className="border-border bg-card hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Warehouse className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{w.name}</p>
                    {w.address && <p className="text-[10px] text-muted-foreground truncate">{w.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {w.isDefault && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingWarehouse(w); setFormOpen(true); }}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteWarehouse(w.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/20 rounded-md p-2">
                  <p className="text-base font-bold text-primary">{fmt(w.totalUnits)}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">وحدة</p>
                </div>
                <div className="bg-muted/20 rounded-md p-2">
                  <p className="text-base font-bold">{w.skuCount}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">صنف</p>
                </div>
                <div className="bg-muted/20 rounded-md p-2">
                  <p className="text-base font-bold">{w.orderCount}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">طلب</p>
                </div>
              </div>
              {w.notes && <p className="text-[10px] text-muted-foreground border-t border-border pt-2">{w.notes}</p>}
              <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1"
                onClick={() => setStockViewId(w.id)}>
                <Package className="w-3 h-3" />إدارة المخزون
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <WarehouseFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingWarehouse(undefined); }}
        existing={editingWarehouse}
      />
    </div>
  );
}
