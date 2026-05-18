import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, ShoppingBag, Trash2, ChevronRight, Search, X,
  SlidersHorizontal, FileSpreadsheet, Package, Wallet, TrendingUp, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

const api = {
  get:  (url: string)            => apiFetch<any>(url),
  post: (url: string, body: any) => apiFetch<any>(url, { method: "POST", body: JSON.stringify(body) }),
};

// ── ألوان الحالات ──────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:      { label: "مسودة",         color: "bg-muted/50 text-muted-foreground border-border" },
  confirmed:  { label: "مؤكد",          color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  processing: { label: "جاري التجهيز",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  delivered:  { label: "تم التسليم",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  closed:     { label: "مُغلَق",         color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  cancelled:  { label: "ملغي",          color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",     color: "text-rose-500" },
  partial: { label: "مدفوع جزئياً",  color: "text-amber-400" },
  paid:    { label: "مدفوع بالكامل", color: "text-emerald-400" },
};

const fmt = (n: string | number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n));

type SaleOrder = {
  id: number; soNumber: string;
  clientName: string; clientPhone: string | null; clientAddress: string | null;
  warehouseId: number | null; status: string; paymentStatus: string;
  totalAmount: string; paidAmount: string; discountAmount: string;
  shippingCost: string; taxAmount: string; invoiceRef: string | null;
  notes: string | null; expectedDate: string | null;
  deliveredAt: string | null; createdAt: string;
};
type Warehouse = { id: number; name: string };
type Product   = { id: number; name: string; costPrice?: string };

// ── ColFilter ─────────────────────────────────────────────────────────────
function ColFilter({ label, active, visible, isOpen, onToggle, children }: {
  label: string; active: boolean; visible: boolean;
  isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); };
    if (isOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isOpen]);
  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <span className="text-xs font-semibold" style={{ color: active ? "#4DB6AC" : "hsl(var(--muted-foreground))" }}>{label}</span>
      {visible && (
        <button onClick={onToggle}
          className="inline-flex items-center justify-center rounded transition-colors"
          style={{ width: 18, height: 18, background: active ? "rgba(77,182,172,0.18)" : isOpen ? "hsl(var(--muted)/0.6)" : "transparent", color: active ? "#4DB6AC" : "hsl(var(--muted-foreground))" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 2.5h8M2.5 5h5M4 7.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {active && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-teal-400" />}
        </button>
      )}
      {visible && isOpen && (
        <div className="absolute z-50 mt-1 rounded-xl border shadow-xl"
          style={{ top: "100%", right: 0, minWidth: 190, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "0 8px 32px rgba(0,0,0,0.28)" }}
          onClick={e => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── SORow ──────────────────────────────────────────────────────────────────
function SORow({ order, onEdit, onDelete, warehouses }: {
  order: SaleOrder; onEdit: (o: SaleOrder) => void;
  onDelete: (id: number) => void; warehouses: Warehouse[];
}) {
  const wName = warehouses.find(w => w.id === order.warehouseId)?.name ?? "—";
  const st  = STATUS_LABELS[order.status] ?? { label: order.status, color: "" };
  const pt  = PAY_LABELS[order.paymentStatus] ?? { label: order.paymentStatus, color: "" };
  const total = parseFloat(order.totalAmount ?? "0");
  const paid  = parseFloat(order.paidAmount  ?? "0");
  const due   = total - paid;
  return (
    <tr style={{ borderBottom: "1px solid hsl(var(--border)/0.5)" }} className="transition-colors hover:bg-muted/20">
      <td className="px-3 py-3 font-mono text-xs font-semibold" style={{ color: "#4DB6AC" }}>{order.soNumber}</td>
      <td className="px-3 py-3">
        <p className="text-sm font-medium">{order.clientName}</p>
        {order.clientPhone && <p className="text-xs text-muted-foreground">{order.clientPhone}</p>}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{wName}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span>
      </td>
      <td className="px-3 py-3 text-sm font-semibold">{fmt(total)}</td>
      <td className="px-3 py-3 text-sm font-medium" style={{ color: "#26A69A" }}>{fmt(paid)}</td>
      <td className="px-3 py-3 text-sm font-semibold" style={{ color: due > 0 ? "#ef4444" : "hsl(var(--muted-foreground))" }}>{fmt(due)}</td>
      <td className={`px-3 py-3 text-xs font-semibold ${pt.color}`}>{pt.label}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy") : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(order)}>تعديل</Button>
          {!["delivered","closed"].includes(order.status) && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10"
              onClick={() => onDelete(order.id)}><Trash2 className="w-3 h-3" /></Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── SOForm ────────────────────────────────────────────────────────────────
type ItemRow = { productId: string; productName: string; color: string; size: string; sku: string; quantity: number; unitPrice: number; deliveredQty?: number };

function SOForm({ open, onClose, editOrder, warehouses, products, onSuccess }: {
  open: boolean; onClose: () => void; editOrder: SaleOrder | null;
  warehouses: Warehouse[]; products: Product[]; onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editOrder;

  const [clientName,    setClientName]    = useState(editOrder?.clientName    ?? "");
  const [clientPhone,   setClientPhone]   = useState(editOrder?.clientPhone   ?? "");
  const [clientAddress, setClientAddress] = useState(editOrder?.clientAddress ?? "");
  const [warehouseId,   setWarehouseId]   = useState(String(editOrder?.warehouseId ?? ""));
  const [status,        setStatus]        = useState(editOrder?.status        ?? "draft");
  const [payStatus,     setPayStatus]     = useState(editOrder?.paymentStatus ?? "unpaid");
  const [paidAmount,    setPaidAmount]    = useState(editOrder?.paidAmount    ?? "0");
  const [discount,      setDiscount]      = useState(editOrder?.discountAmount ?? "0");
  const [shippingCost,  setShippingCost]  = useState(editOrder?.shippingCost  ?? "0");
  const [taxAmount,     setTaxAmount]     = useState(editOrder?.taxAmount     ?? "0");
  const [notes,         setNotes]         = useState(editOrder?.notes         ?? "");
  const [expectedDate,  setExpectedDate]  = useState(editOrder?.expectedDate?.split("T")[0] ?? "");
  const [invoiceRef,    setInvoiceRef]    = useState(editOrder?.invoiceRef    ?? "");
  const [itemsLoading,  setItemsLoading]  = useState(false);

  const blank = (): ItemRow => ({ productId: "", productName: "", color: "", size: "", sku: "", quantity: 1, unitPrice: 0 });
  const [items, setItems] = useState<ItemRow[]>([blank()]);

  useEffect(() => {
    setClientName(editOrder?.clientName ?? "");
    setClientPhone(editOrder?.clientPhone ?? "");
    setClientAddress(editOrder?.clientAddress ?? "");
    setWarehouseId(String(editOrder?.warehouseId ?? ""));
    setStatus(editOrder?.status ?? "draft");
    setPayStatus(editOrder?.paymentStatus ?? "unpaid");
    setPaidAmount(editOrder?.paidAmount ?? "0");
    setDiscount(editOrder?.discountAmount ?? "0");
    setShippingCost(editOrder?.shippingCost ?? "0");
    setTaxAmount(editOrder?.taxAmount ?? "0");
    setNotes(editOrder?.notes ?? "");
    setExpectedDate(editOrder?.expectedDate?.split("T")[0] ?? "");
    setInvoiceRef(editOrder?.invoiceRef ?? "");
    setItems([blank()]);
    if (open && editOrder?.id) {
      setItemsLoading(true);
      apiFetch<any>(`/finance/sale-orders/${editOrder.id}`)
        .then(data => {
          if (data?.items?.length) {
            setItems(data.items.map((i: any) => ({
              productId: i.productId ? String(i.productId) : "",
              productName: i.productName ?? "",
              color: i.color ?? "", size: i.size ?? "", sku: i.sku ?? "",
              quantity: i.quantity ?? 1, unitPrice: parseFloat(i.unitPrice ?? "0"),
              deliveredQty: i.deliveredQty ?? 0,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setItemsLoading(false));
    }
  }, [editOrder, open]);

  const upd = (i: number, f: keyof ItemRow, v: any) =>
    setItems(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const subTotal = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const total = subTotal + Number(shippingCost) + Number(taxAmount) - Number(discount);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        clientName, clientPhone: clientPhone || null, clientAddress: clientAddress || null,
        warehouseId: warehouseId || null, status, paymentStatus: payStatus,
        paidAmount: parseFloat(paidAmount), discountAmount: parseFloat(discount),
        shippingCost: parseFloat(shippingCost), taxAmount: parseFloat(taxAmount),
        notes: notes || null, expectedDate: expectedDate || null,
        invoiceRef: invoiceRef || null,
      };
      if (isEdit) {
        return apiFetch<any>(`/finance/sale-orders/${editOrder!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      body.items = items.map(r => ({
        productId: r.productId ? parseInt(r.productId) : null,
        productName: r.productName, color: r.color || null, size: r.size || null,
        sku: r.sku || null, quantity: r.quantity, unitPrice: r.unitPrice,
      }));
      return api.post("/finance/sale-orders", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance-sale-orders"] });
      toast({ title: isEdit ? "تم تحديث الأمر" : "تم إنشاء أمر البيع" });
      onSuccess(); onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{isEdit ? `تعديل — ${editOrder?.soNumber}` : "أمر بيع جديد"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* اسم العميل */}
          <div className="col-span-2">
            <Label>اسم العميل / الشركة *</Label>
            <Input placeholder="مثال: شركة النور للتجارة" value={clientName} onChange={e => setClientName(e.target.value)} />
          </div>
          <div><Label>رقم الهاتف</Label><Input placeholder="01xxxxxxxxx" value={clientPhone} onChange={e => setClientPhone(e.target.value)} /></div>
          <div>
            <Label>المخزن</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>العنوان</Label><Input placeholder="عنوان التسليم" value={clientAddress} onChange={e => setClientAddress(e.target.value)} /></div>
          {/* الحالة والدفع */}
          <div>
            <Label>حالة الأمر</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>حالة الدفع</Label>
            <Select value={payStatus} onValueChange={setPayStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PAY_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {payStatus !== "unpaid" && (
            <div><Label>المبلغ المدفوع (ج.م)</Label><Input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} /></div>
          )}
          <div><Label>تاريخ التسليم المتوقع</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
          {/* التكاليف الإضافية */}
          <div><Label>تكلفة الشحن</Label><Input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} /></div>
          <div><Label>الضريبة</Label><Input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} /></div>
          <div><Label>الخصم</Label><Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
          <div><Label>رقم الفاتورة المرتبطة</Label><Input placeholder="INV-2026-001" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} /></div>
          <div className="col-span-2"><Label>ملاحظات</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>

        {/* ── البنود ── */}
        {isEdit ? (
          <div className="mt-4">
            <Label className="text-base font-semibold">بنود الأمر</Label>
            {itemsLoading ? (
              <div className="rounded-lg border p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <ShoppingBag className="w-4 h-4 animate-pulse" /><span>جارٍ جلب البنود…</span>
              </div>
            ) : (
              <div className="mt-2 rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "hsl(var(--muted)/0.4)" }}>
                    <tr>{["المنتج","لون/مقاس","الكمية","المُسلَّم","السعر/وحدة","الإجمالي"].map(h => (
                      <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid hsl(var(--border)/0.5)" }}>
                        <td className="px-3 py-2.5"><p className="font-medium">{r.productName || "—"}</p></td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{[r.color,r.size].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="px-3 py-2.5 text-center font-semibold">{r.quantity}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: (r.deliveredQty??0)>=r.quantity ? "#10b981" : "#f59e0b" }}>{r.deliveredQty ?? 0}</td>
                        <td className="px-3 py-2.5">{fmt(r.unitPrice)}</td>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: "#4DB6AC" }}>{fmt(r.quantity * r.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">💡 لتعديل البنود أنشئ أمراً جديداً</p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">البنود (منتجات الجملة)</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems(p => [...p, blank()])}><Plus className="w-3 h-3 ml-1" />إضافة بند</Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>{["المنتج","اللون","المقاس","الكمية","السعر/وحدة","الإجمالي",""].map(h => (
                    <th key={h} className="px-2 py-2 text-right text-xs text-muted-foreground font-medium">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">
                        <Select value={r.productId} onValueChange={v => {
                          const p = products.find(x => String(x.id) === v);
                          upd(i, "productId", v);
                          if (p) upd(i, "productName", p.name);
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!r.productId && <Input className="mt-1 h-7 text-xs" placeholder="اسم المنتج" value={r.productName} onChange={e => upd(i,"productName",e.target.value)} />}
                      </td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-20" placeholder="لون" value={r.color} onChange={e => upd(i,"color",e.target.value)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-16" placeholder="مقاس" value={r.size} onChange={e => upd(i,"size",e.target.value)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-16" type="number" min={1} value={r.quantity} onChange={e => upd(i,"quantity",parseInt(e.target.value)||1)} /></td>
                      <td className="px-2 py-1"><Input className="h-7 text-xs w-24" type="number" min={0} value={r.unitPrice} onChange={e => upd(i,"unitPrice",parseFloat(e.target.value)||0)} /></td>
                      <td className="px-2 py-1 font-semibold text-xs" style={{ color: "#4DB6AC" }}>{fmt(r.quantity * r.unitPrice)}</td>
                      <td className="px-2 py-1"><Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-rose-400" onClick={() => setItems(p => p.filter((_,idx) => idx !== i))}><X className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-left space-y-0.5 text-sm">
              <p className="text-muted-foreground">الإجمالي الفرعي: <strong>{fmt(subTotal)}</strong></p>
              <p className="text-lg font-black" style={{ color: "#4DB6AC" }}>الإجمالي الكلي: {fmt(total)}</p>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !clientName.trim()}>
            {mutation.isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء الأمر"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────
export default function FinanceSales() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterPay,     setFilterPay]     = useState("all");
  const [fromDate,      setFromDate]      = useState("");
  const [toDate,        setToDate]        = useState("");
  const [colFilters,    setColFilters]    = useState(false);
  const [openCol,       setOpenCol]       = useState<string|null>(null);
  const [formOpen,      setFormOpen]      = useState(false);
  const [editOrder,     setEditOrder]     = useState<SaleOrder|null>(null);

  const { data: orders = [], isLoading } = useQuery<SaleOrder[]>({
    queryKey: ["finance-sale-orders"],
    queryFn: () => api.get("/finance/sale-orders"),
    staleTime: 0, refetchOnWindowFocus: true,
  });
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["warehouses-list"],
    queryFn: () => api.get("/warehouses"),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products-list"],
    queryFn: () => api.get("/products"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (q && !o.soNumber?.toLowerCase().includes(q) && !o.clientName?.toLowerCase().includes(q) && !o.clientPhone?.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      if (filterPay    !== "all" && o.paymentStatus !== filterPay) return false;
      if (fromDate && new Date(o.createdAt) < new Date(fromDate)) return false;
      if (toDate && new Date(o.createdAt) > new Date(toDate + "T23:59:59")) return false;
      return true;
    });
  }, [orders, search, filterStatus, filterPay, fromDate, toDate]);

  const stats = useMemo(() => {
    const total      = filtered.reduce((s,o) => s + parseFloat(o.totalAmount??"0"), 0);
    const paid       = filtered.reduce((s,o) => s + parseFloat(o.paidAmount??"0"),  0);
    const unpaid     = total - paid;
    const pending    = filtered.filter(o => ["draft","confirmed","processing"].includes(o.status)).length;
    const delivered  = filtered.filter(o => o.status === "delivered").length;
    return { total, paid, unpaid, pending, delivered };
  }, [filtered]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/finance/sale-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finance-sale-orders"] }); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const activeFilters = [filterStatus !== "all", filterPay !== "all", !!fromDate, !!toDate].filter(Boolean).length;

  const fi = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={() => { onClick(); setOpenCol(null); }}
      className="w-full text-right px-3 py-2 text-sm transition-colors hover:bg-muted/40 flex items-center justify-between"
      style={{ color: active ? "#4DB6AC" : "hsl(var(--foreground))" }}>
      {label}
      {active && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate("/finance")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ChevronRight className="w-4 h-4" />لوحة الماليات
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" style={{ color: "#4DB6AC" }} />أوامر البيع
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} أمر — إجمالي {fmt(stats.total)}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pr-9 h-9 w-52 text-sm" placeholder="بحث بالاسم أو الرقم…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant={colFilters ? "default" : "outline"} size="sm" className="gap-1.5 relative"
            onClick={() => setColFilters(p => !p)}
            style={colFilters ? { background: "rgba(77,182,172,0.15)", color: "#4DB6AC", border: "1px solid rgba(77,182,172,0.4)" } : {}}>
            <SlidersHorizontal className="w-4 h-4" />{colFilters ? "إخفاء الفلتر" : "فلتر"}
            {!colFilters && activeFilters > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#4DB6AC", color: "#000" }}>{activeFilters}</span>
            )}
          </Button>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-rose-400"
              onClick={() => { setFilterStatus("all"); setFilterPay("all"); setFromDate(""); setToDate(""); }}>
              <X className="w-3.5 h-3.5" />مسح
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditOrder(null); setFormOpen(true); }} className="gap-1"
            style={{ background: "linear-gradient(135deg,#4DB6AC,#26A69A)", color: "#fff" }}>
            <Plus className="w-4 h-4" />أمر بيع جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأوامر",   value: fmt(stats.total),  color: "#4DB6AC", glow: "rgba(77,182,172,0.32)",   bg: "linear-gradient(135deg,rgba(77,182,172,0.42) 0%,rgba(77,182,172,0.16) 52%,rgba(255,255,255,0.08) 100%)" },
          { label: "إجمالي المحصّل",   value: fmt(stats.paid),   color: "#26A69A", glow: "rgba(38,166,154,0.28)",   bg: "linear-gradient(135deg,rgba(38,166,154,0.44) 0%,rgba(38,166,154,0.18) 52%,rgba(255,255,255,0.08) 100%)" },
          { label: "المتبقي للتحصيل",  value: fmt(stats.unpaid), color: "#ef4444", glow: "rgba(239,68,68,0.28)",    bg: "linear-gradient(135deg,rgba(239,68,68,0.42) 0%,rgba(239,68,68,0.16) 52%,rgba(255,255,255,0.08) 100%)" },
          { label: "قيد التنفيذ / مُسلَّم", value: `${stats.pending} / ${stats.delivered}`, color: "#7E57C2", glow: "rgba(126,87,194,0.32)", bg: "linear-gradient(135deg,rgba(126,87,194,0.42) 0%,rgba(126,87,194,0.16) 52%,rgba(255,255,255,0.08) 100%)" },
        ].map(c => (
          <div key={c.label} className="relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center hover:-translate-y-0.5 transition-transform duration-300"
            style={{ background: c.bg, border: `1px solid ${c.glow}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18),0 10px 24px ${c.glow}`, backdropFilter: "blur(12px)" }}>
            <div className="absolute inset-x-6 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg,transparent,${c.color},transparent)` }} />
            <p className="text-[11px] font-bold text-white/70">{c.label}</p>
            <p className="mt-1 truncate text-xl font-black sm:text-2xl" style={{ color: c.color, textShadow: `0 0 14px ${c.color}88` }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-[22px]"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06),0 8px 32px rgba(0,0,0,0.18)" }}>
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(77,182,172,0.6),rgba(38,166,154,0.6),transparent)" }} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(var(--muted)/0.3)", borderBottom: "1px solid hsl(var(--border))" }}>
                <th className="px-3 py-3 text-right">
                  <ColFilter label="رقم الأمر" active={!!search.trim()} visible={colFilters}
                    isOpen={openCol==="so"} onToggle={() => setOpenCol(p => p==="so" ? null : "so")}>
                    <div className="p-2"><Input className="h-7 text-xs" placeholder="بحث…" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
                  </ColFilter>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">العميل</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">المخزن</th>
                <th className="px-3 py-3 text-right">
                  <ColFilter label="الحالة" active={filterStatus!=="all"} visible={colFilters}
                    isOpen={openCol==="status"} onToggle={() => setOpenCol(p => p==="status" ? null : "status")}>
                    <div className="py-1">
                      {fi("الكل", filterStatus==="all", () => setFilterStatus("all"))}
                      {Object.entries(STATUS_LABELS).map(([k,v]) => fi(v.label, filterStatus===k, () => setFilterStatus(k)))}
                    </div>
                  </ColFilter>
                </th>
                {["الإجمالي","المحصّل","المتبقي"].map(h => (
                  <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="الدفع" active={filterPay!=="all"} visible={colFilters}
                    isOpen={openCol==="pay"} onToggle={() => setOpenCol(p => p==="pay" ? null : "pay")}>
                    <div className="py-1">
                      {fi("الكل", filterPay==="all", () => setFilterPay("all"))}
                      {Object.entries(PAY_LABELS).map(([k,v]) => fi(v.label, filterPay===k, () => setFilterPay(k)))}
                    </div>
                  </ColFilter>
                </th>
                <th className="px-3 py-3 text-right">
                  <ColFilter label="التاريخ" active={!!fromDate||!!toDate} visible={colFilters}
                    isOpen={openCol==="date"} onToggle={() => setOpenCol(p => p==="date" ? null : "date")}>
                    <div className="p-2 space-y-2">
                      <div><p className="text-[10px] text-muted-foreground mb-1">من</p><Input type="date" className="h-7 text-xs" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
                      <div><p className="text-[10px] text-muted-foreground mb-1">إلى</p><Input type="date" className="h-7 text-xs" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
                      {(fromDate||toDate) && <button className="w-full text-xs text-rose-400 py-1" onClick={() => { setFromDate(""); setToDate(""); setOpenCol(null); }}>مسح</button>}
                    </div>
                  </ColFilter>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <ShoppingBag className="w-6 h-6 animate-pulse" /><span className="text-sm">جارٍ التحميل…</span>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2" style={{ color: "hsl(var(--muted-foreground)/0.5)" }}>
                    <ShoppingBag className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-medium">{activeFilters > 0 || search ? "لا توجد نتائج للفلتر" : "لا توجد أوامر بيع حتى الآن"}</p>
                    {(activeFilters > 0 || search) && (
                      <button className="text-xs mt-1 underline" style={{ color: "#4DB6AC" }}
                        onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPay("all"); setFromDate(""); setToDate(""); }}>
                        مسح الفلاتر
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : filtered.map(o => (
                <SORow key={o.id} order={o} warehouses={warehouses}
                  onEdit={o => { setEditOrder(o); setFormOpen(true); }}
                  onDelete={id => { if (confirm("هل تريد حذف هذا الأمر؟")) deleteMut.mutate(id); }} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <SOForm open={formOpen} onClose={() => { setFormOpen(false); setEditOrder(null); }}
          editOrder={editOrder} warehouses={warehouses} products={products}
          onSuccess={() => { setFormOpen(false); setEditOrder(null); }} />
      )}
    </div>
  );
}
