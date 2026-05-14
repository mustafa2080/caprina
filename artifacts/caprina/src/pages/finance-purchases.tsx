import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ShoppingCart, Trash2, ChevronDown, Search, X, Filter, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const api = {
  get: (url: string) => apiFetch<any>(url),
  post: (url: string, body: any) => apiFetch<any>(url, { method: "POST", body: JSON.stringify(body) }),
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: "مسودة",        color: "bg-gray-100 text-gray-600 border-gray-300" },
  ordered:          { label: "تم الطلب",      color: "bg-blue-50 text-blue-700 border-blue-300" },
  received:         { label: "تم الاستلام",   color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  partial_received: { label: "استلام جزئي",   color: "bg-purple-50 text-purple-700 border-purple-300" },
  cancelled:        { label: "ملغي",          color: "bg-red-50 text-red-700 border-red-300" },
};

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",    color: "text-rose-500" },
  partial: { label: "مدفوع جزئياً", color: "text-amber-500" },
  paid:    { label: "مدفوع بالكامل",color: "text-emerald-500" },
};

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

type PurchaseOrder = {
  id: number; poNumber: string; supplierId: number | null; supplierName: string | null;
  status: string; paymentStatus: string; totalAmount: string; paidAmount: string;
  notes: string | null; expectedDate: string | null; createdAt: string;
  shippingCost: string; taxAmount: string; discountAmount: string;
};
type Supplier = { id: number; name: string; category: string | null };
type Product  = { id: number; name: string; costPrice?: string };

// ── مكوّن صف أمر الشراء ────────────────────────────────────────────────────
function PORow({
  order, onEdit, onDelete, suppliers,
}: {
  order: PurchaseOrder;
  onEdit: (o: PurchaseOrder) => void;
  onDelete: (id: number) => void;
  suppliers: Supplier[];
}) {
  const supplierName = suppliers.find(s => s.id === order.supplierId)?.name ?? order.supplierName ?? "—";
  const st = STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
  const pt = PAY_LABELS[order.paymentStatus] ?? { label: order.paymentStatus, color: "text-gray-500" };
  const total = parseFloat(order.totalAmount ?? "0");
  const paid  = parseFloat(order.paidAmount ?? "0");
  const due   = total - paid;
  return (
    <tr className="border-b hover:bg-gray-50/60 transition-colors">
      <td className="px-3 py-3 font-mono text-xs text-blue-700 font-semibold">{order.poNumber}</td>
      <td className="px-3 py-3 text-sm text-gray-700">{supplierName}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span>
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-gray-800">{fmt(total)}</td>
      <td className="px-3 py-3 text-sm text-emerald-600 font-medium">{fmt(paid)}</td>
      <td className={`px-3 py-3 text-sm font-semibold ${due > 0 ? "text-rose-500" : "text-gray-400"}`}>{fmt(due)}</td>
      <td className={`px-3 py-3 text-xs font-semibold ${pt.color}`}>{pt.label}</td>
      <td className="px-3 py-3 text-xs text-gray-500">
        {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy") : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(order)}>تعديل</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete(order.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </td>
    </tr>
  );
}

// ── مكوّن نموذج إضافة/تعديل أمر الشراء ────────────────────────────────────
function POForm({
  open, onClose, editOrder, suppliers, products, onSuccess,
}: {
  open: boolean; onClose: () => void;
  editOrder: PurchaseOrder | null;
  suppliers: Supplier[]; products: Product[];
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editOrder;

  const [supplierId, setSupplierId]   = useState<string>(String(editOrder?.supplierId ?? ""));
  const [supplierName, setSupplierName] = useState(editOrder?.supplierName ?? "");
  const [status, setStatus]           = useState(editOrder?.status ?? "draft");
  const [payStatus, setPayStatus]     = useState(editOrder?.paymentStatus ?? "unpaid");
  const [paidAmount, setPaidAmount]   = useState(editOrder?.paidAmount ?? "0");
  const [shippingCost, setShippingCost] = useState(editOrder?.shippingCost ?? "0");
  const [taxAmount, setTaxAmount]     = useState(editOrder?.taxAmount ?? "0");
  const [discount, setDiscount]       = useState(editOrder?.discountAmount ?? "0");
  const [notes, setNotes]             = useState(editOrder?.notes ?? "");
  const [expectedDate, setExpectedDate] = useState(editOrder?.expectedDate?.split("T")[0] ?? "");

  type ItemRow = { productId: string; productName: string; color: string; size: string; sku: string; quantity: number; unitCost: number };
  const blankItem = (): ItemRow => ({ productId: "", productName: "", color: "", size: "", sku: "", quantity: 1, unitCost: 0 });
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);

  const updateItem = (i: number, field: keyof ItemRow, val: any) => {
    setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const subTotal = items.reduce((s, r) => s + r.quantity * r.unitCost, 0);
  const total = subTotal + Number(shippingCost) + Number(taxAmount) - Number(discount);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        supplierId: supplierId ? parseInt(supplierId) : null,
        supplierName: supplierId ? null : supplierName,
        status, paymentStatus: payStatus,
        paidAmount: parseFloat(paidAmount),
        shippingCost: parseFloat(shippingCost),
        taxAmount: parseFloat(taxAmount),
        discountAmount: parseFloat(discount),
        notes: notes || null,
        expectedDate: expectedDate || null,
        items: items.map(r => ({
          productId: r.productId ? parseInt(r.productId) : null,
          productName: r.productName, color: r.color || null, size: r.size || null,
          sku: r.sku || null, quantity: r.quantity, unitCost: r.unitCost,
        })),
      };
      if (isEdit) {
        return apiFetch<any>(`/finance/purchases/${editOrder!.id}`, { method: "PATCH", body: JSON.stringify({ status, paymentStatus: payStatus, paidAmount: body.paidAmount, notes: body.notes }) });
      }
      return api.post("/finance/purchases", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-purchases"] });
      qc.invalidateQueries({ queryKey: ["cash-registers"] });
      qc.invalidateQueries({ queryKey: ["finance-cash-ledger"] });
      toast({ title: isEdit ? "تم تحديث الأمر" : "تم إنشاء الأمر" });
      onSuccess(); onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{isEdit ? `تعديل — ${editOrder?.poNumber}` : "أمر شراء جديد"}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* المورد */}
          <div className="col-span-2">
            <Label>المورد</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="اختر مورد أو اكتب اسماً" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {!supplierId && (
              <Input className="mt-2" placeholder="أو اكتب اسم المورد يدوياً" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
            )}
          </div>

          {/* الحالة */}
          <div>
            <Label>حالة الطلب</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* حالة الدفع */}
          <div>
            <Label>حالة الدفع</Label>
            <Select value={payStatus} onValueChange={setPayStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* المبلغ المدفوع */}
          {payStatus !== "unpaid" && (
            <div>
              <Label>المبلغ المدفوع (ج.م)</Label>
              <Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            </div>
          )}

          {/* التكاليف الإضافية */}
          {!isEdit && (<>
            <div><Label>تكلفة الشحن</Label><Input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} /></div>
            <div><Label>الضريبة</Label><Input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} /></div>
            <div><Label>الخصم</Label><Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
          </>)}
          <div><Label>تاريخ التسليم المتوقع</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
          <div className="col-span-2"><Label>ملاحظات</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>

        {/* بنود الأمر — فقط في الإنشاء */}
        {!isEdit && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">البنود</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, blankItem()])}>
                <Plus className="w-3 h-3 ml-1" />إضافة بند
              </Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["المنتج","اللون","المقاس","الكمية","التكلفة/وحدة","الإجمالي",""].map(h => (
                      <th key={h} className="px-2 py-2 text-right text-xs text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <Select value={row.productId} onValueChange={v => {
                          const p = products.find(x => String(x.id) === v);
                          updateItem(i, "productId", v);
                          if (p) { updateItem(i, "productName", p.name); updateItem(i, "unitCost", parseFloat(p.costPrice ?? "0")); }
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="اختر أو اكتب" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!row.productId && <Input className="mt-1 h-7 text-xs" placeholder="اسم المنتج" value={row.productName} onChange={e => updateItem(i, "productName", e.target.value)} />}
                      </td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-20" placeholder="لون" value={row.color} onChange={e => updateItem(i, "color", e.target.value)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-16" placeholder="مقاس" value={row.size} onChange={e => updateItem(i, "size", e.target.value)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-16" type="number" min={1} value={row.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value)||1)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-24" type="number" min={0} value={row.unitCost} onChange={e => updateItem(i, "unitCost", parseFloat(e.target.value)||0)} /></td>
                      <td className="px-2 py-1 font-semibold text-xs text-gray-700">{fmt(row.quantity * row.unitCost)}</td>
                      <td className="px-2 py-1">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-left text-sm text-gray-600 space-y-0.5">
              <p>الإجمالي الفرعي: <strong>{fmt(subTotal)}</strong></p>
              <p className="text-lg font-bold text-gray-900">الإجمالي الكلي: {fmt(total)}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء الأمر"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── الصفحة الرئيسية ─────────────────────────────────────────────────────────
export default function FinancePurchases() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── فلاتر ─────────────────────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterPay, setFilterPay]         = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [fromDate, setFromDate]           = useState("");
  const [toDate, setToDate]               = useState("");
  const [showFilters, setShowFilters]     = useState(false);

  // ── dialogs ───────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen]   = useState(false);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);

  // ── بيانات ───────────────────────────────────────────────────────────────
  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["finance-purchases"],
    queryFn: () => api.get("/finance/purchases"),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["finance-suppliers"],
    queryFn: () => api.get("/finance/suppliers"),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products-list"],
    queryFn: () => api.get("/products"),
  });

  // ── فلترة محلية ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      const suppName = (suppliers.find(s => s.id === o.supplierId)?.name ?? o.supplierName ?? "").toLowerCase();
      if (q && !o.poNumber?.toLowerCase().includes(q) && !suppName.includes(q) && !o.notes?.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterPay !== "all" && o.paymentStatus !== filterPay) return false;
      if (filterSupplier !== "all" && String(o.supplierId) !== filterSupplier) return false;
      if (fromDate && new Date(o.createdAt) < new Date(fromDate)) return false;
      if (toDate && new Date(o.createdAt) > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [orders, search, filterStatus, filterPay, filterSupplier, fromDate, toDate, suppliers]);

  // ── إحصائيات ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = filtered.reduce((s, o) => s + parseFloat(o.totalAmount ?? "0"), 0);
    const paid    = filtered.reduce((s, o) => s + parseFloat(o.paidAmount  ?? "0"), 0);
    const unpaid  = total - paid;
    const countUnpaid = filtered.filter(o => o.paymentStatus === "unpaid").length;
    const countPartial = filtered.filter(o => o.paymentStatus === "partial").length;
    return { total, paid, unpaid, countUnpaid, countPartial };
  }, [filtered]);

  // ── حذف ──────────────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/finance/purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-purchases"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ في الحذف", description: e.message, variant: "destructive" }),
  });

  // ── تصدير Excel ───────────────────────────────────────────────────────────
  const exportExcel = () => {
    const params = new URLSearchParams();
    if (search.trim())          params.set("search", search.trim());
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPay !== "all")    params.set("paymentStatus", filterPay);
    if (filterSupplier !== "all") params.set("supplierId", filterSupplier);
    if (fromDate)               params.set("from", fromDate);
    if (toDate)                 params.set("to", toDate);
    const baseUrl = (import.meta as any).env?.VITE_API_URL ?? "";
    window.open(`${baseUrl}/api/finance/purchases/export-excel?${params.toString()}`, "_blank");
  };

  const activeFilters = [filterStatus !== "all", filterPay !== "all", filterSupplier !== "all", !!fromDate, !!toDate].filter(Boolean).length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />أوامر الشراء
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} أمر — إجمالي {fmt(stats.total)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="w-4 h-4" />تصدير Excel
          </Button>
          <Button size="sm" onClick={() => { setEditOrder(null); setFormOpen(true); }} className="gap-1">
            <Plus className="w-4 h-4" />أمر جديد
          </Button>
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأوامر",   value: fmt(stats.total),  gradient: "from-[#1a2a1a] to-[#2d4a2d]", valueColor: "text-[#a8e6a8]" },
          { label: "إجمالي المدفوع",   value: fmt(stats.paid),   gradient: "from-[#0f2a2a] to-[#1a4a3a]", valueColor: "text-[#7eecd4]" },
          { label: "المتبقي",          value: fmt(stats.unpaid), gradient: "from-[#2a1a1a] to-[#4a2020]", valueColor: "text-[#f87171]" },
          { label: "غير مدفوع / جزئي", value: `${stats.countUnpaid} / ${stats.countPartial}`, gradient: "from-[#2a2010] to-[#4a3a10]", valueColor: "text-[#fbbf24]" },
        ].map(c => (
          <div key={c.label} className={`relative rounded-2xl bg-gradient-to-br ${c.gradient} p-4 border border-white/10 shadow-lg overflow-hidden`}>
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
            <p className="text-xs text-white/50 font-medium mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.valueColor} drop-shadow`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── شريط البحث والفلاتر ── */}
      <Card className="p-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pr-9" placeholder="بحث برقم الأمر، المورد، الملاحظات…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(p => !p)} className="gap-1">
            <Filter className="w-4 h-4" />فلاتر{activeFilters > 0 && <span className="bg-white text-blue-700 rounded-full text-xs w-4 h-4 flex items-center justify-center font-bold">{activeFilters}</span>}
          </Button>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterPay("all"); setFilterSupplier("all"); setFromDate(""); setToDate(""); }}>
              <X className="w-3 h-3 ml-1" />مسح
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 pt-3 border-t">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPay} onValueChange={setFilterPay}>
              <SelectTrigger><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الدفعات</SelectItem>
                {Object.entries(PAY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger><SelectValue placeholder="المورد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموردين</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" placeholder="من تاريخ" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <Input type="date" placeholder="إلى تاريخ" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        )}
      </Card>

      {/* ── الجدول ── */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <ShoppingCart className="w-8 h-8 animate-pulse ml-2" />جارٍ التحميل…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">لا توجد أوامر شراء</p>
            <p className="text-sm mt-1">اضغط "أمر جديد" لإنشاء أول أمر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["رقم الأمر","المورد","الحالة","الإجمالي","المدفوع","المتبقي","الدفع","التاريخ","إجراءات"].map(h => (
                    <th key={h} className="px-3 py-3 text-right text-xs text-gray-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <PORow key={o.id} order={o} suppliers={suppliers} onDelete={id => {
                    if (confirm("هل تريد حذف هذا الأمر؟")) deleteMut.mutate(id);
                  }} onEdit={o => { setEditOrder(o); setFormOpen(true); }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── النموذج ── */}
      {formOpen && (
        <POForm
          open={formOpen} onClose={() => { setFormOpen(false); setEditOrder(null); }}
          editOrder={editOrder} suppliers={suppliers} products={products}
          onSuccess={() => { setFormOpen(false); setEditOrder(null); }}
        />
      )}
    </div>
  );
}
