import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsApi, type Product } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, AlertTriangle, Edit2, Trash2, CheckCircle2 } from "lucide-react";

const emptyForm = { name: "", sku: "", totalQuantity: 0, lowStockThreshold: 5, unitPrice: 0 };

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: productsApi.list });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => productsApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setDialogOpen(false); setForm(emptyForm); toast({ title: "تمت الإضافة", description: "تم إضافة المنتج بنجاح." }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) => productsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setDialogOpen(false); setEditingProduct(null); setForm(emptyForm); toast({ title: "تم التحديث" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  const openAdd = () => { setEditingProduct(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditingProduct(p); setForm({ name: p.name, sku: p.sku ?? "", totalQuantity: p.totalQuantity, lowStockThreshold: p.lowStockThreshold, unitPrice: p.unitPrice }); setDialogOpen(true); };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast({ title: "خطأ", description: "اسم المنتج مطلوب.", variant: "destructive" }); return; }
    if (editingProduct) updateMutation.mutate({ id: editingProduct.id, data: form });
    else createMutation.mutate(form);
  };

  const lowStockCount = products?.filter(p => (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold).length ?? 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المخزون</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المنتجات والكميات المتاحة</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm">
          <Plus className="w-4 h-4" />إضافة منتج
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
          <p className="text-2xl font-bold mt-1">{products?.length ?? 0}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">محجوز للطلبات</p>
          <p className="text-2xl font-bold mt-1 text-amber-400">{products?.reduce((s, p) => s + p.reservedQuantity, 0) ?? 0}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">تم البيع</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">{products?.reduce((s, p) => s + p.soldQuantity, 0) ?? 0}</p>
        </Card>
        <Card className={`border p-4 ${lowStockCount > 0 ? "border-red-800 bg-red-900/20" : "border-border bg-card"}`}>
          <p className="text-xs text-muted-foreground">مخزون منخفض</p>
          <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? "text-red-400" : "text-foreground"}`}>{lowStockCount}</p>
        </Card>
      </div>

      <Card className="border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
        ) : products?.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-right text-xs">المنتج</TableHead>
                  <TableHead className="text-right text-xs">SKU</TableHead>
                  <TableHead className="text-center text-xs">إجمالي</TableHead>
                  <TableHead className="text-center text-xs">محجوز</TableHead>
                  <TableHead className="text-center text-xs">مباع</TableHead>
                  <TableHead className="text-center text-xs">متاح</TableHead>
                  <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
                  <TableHead className="text-center text-xs">الحالة</TableHead>
                  <TableHead className="text-center text-xs w-20">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const available = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
                  const isLow = available <= p.lowStockThreshold;
                  return (
                    <TableRow key={p.id} className="border-border hover:bg-muted/20">
                      <TableCell className="font-semibold text-sm">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{p.sku || "—"}</TableCell>
                      <TableCell className="text-center text-sm">{p.totalQuantity}</TableCell>
                      <TableCell className="text-center text-xs text-amber-400 font-bold">{p.reservedQuantity}</TableCell>
                      <TableCell className="text-center text-xs text-emerald-400 font-bold">{p.soldQuantity}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm font-bold ${isLow ? "text-red-400" : "text-foreground"}`}>{available}</span>
                      </TableCell>
                      <TableCell className="text-xs text-primary font-bold">{formatCurrency(p.unitPrice)}</TableCell>
                      <TableCell className="text-center">
                        {isLow ? (
                          <Badge variant="outline" className="text-[9px] font-bold border-red-800 bg-red-900/30 text-red-400">
                            <AlertTriangle className="w-2.5 h-2.5 ml-1" />منخفض
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] font-bold border-emerald-800 bg-emerald-900/30 text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5 ml-1" />جيد
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(p)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { if (confirm(`حذف "${p.name}"؟`)) deleteMutation.mutate(p.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="font-bold">لا توجد منتجات في المخزون</p>
            <p className="text-sm text-muted-foreground mt-1">أضف منتجاتك للبدء في تتبع المخزون.</p>
            <Button onClick={openAdd} className="mt-4 gap-2 text-sm"><Plus className="w-4 h-4" />إضافة أول منتج</Button>
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1.5 block">اسم المنتج *</Label>
              <Input placeholder="اسم المنتج" className="h-9 text-sm bg-background" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">SKU / الرمز</Label>
              <Input placeholder="SKU-001" className="h-9 text-sm bg-background" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">الكمية الإجمالية *</Label>
                <Input type="number" min="0" className="h-9 text-sm bg-background" value={form.totalQuantity} onChange={e => setForm(f => ({ ...f, totalQuantity: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">حد التنبيه (مخزون منخفض)</Label>
                <Input type="number" min="0" className="h-9 text-sm bg-background" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">سعر الوحدة (ر.س) *</Label>
              <Input type="number" min="0" step="0.01" className="h-9 text-sm bg-background" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 h-9 text-sm font-bold bg-primary text-primary-foreground" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "جاري الحفظ..." : editingProduct ? "حفظ التعديلات" : "إضافة المنتج"}
              </Button>
              <Button variant="outline" className="h-9 text-sm border-border" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
