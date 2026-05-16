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
import { Plus, ShoppingCart, Trash2, ChevronDown, ChevronRight, Search, X, Filter, FileSpreadsheet, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";

const api = {
  get: (url: string) => apiFetch<any>(url),
  post: (url: string, body: any) => apiFetch<any>(url, { method: "POST", body: JSON.stringify(body) }),
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:            { label: "مسودة",        color: "bg-muted/50 text-muted-foreground border-border" },
  ordered:          { label: "تم الطلب",      color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  received:         { label: "تم الاستلام",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  partial_received: { label: "استلام جزئي",   color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  cancelled:        { label: "ملغي",          color: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

const PAY_LABELS: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",    color: "text-rose-500" },
  partial: { label: "مدفوع جزئياً", color: "text-amber-400" },
  paid:    { label: "مدفوع بالكامل",color: "text-emerald-400" },
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

// ── Column Filter Dropdown ─────────────────────────────────────────────────
function ColFilter({
  label, active, visible, isOpen, onToggle, children,
}: {
  label: string; active: boolean; visible: boolean;
  isOpen: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <span className="text-xs font-semibold"
        style={{ color: active ? "#FFB74D" : "hsl(var(--muted-foreground))" }}>
        {label}
      </span>

      {visible && (
        <button
          onClick={onToggle}
          className="inline-flex items-center justify-center rounded transition-colors"
          style={{
            width: 18, height: 18,
            background: active ? "rgba(255,183,77,0.18)" : isOpen ? "hsl(var(--muted)/0.6)" : "transparent",
            color: active ? "#FFB74D" : "hsl(var(--muted-foreground))",
          }}
          title={`فلتر ${label}`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 2.5h8M2.5 5h5M4 7.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {active && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />}
        </button>
      )}

      {visible && isOpen && (
        <div className="absolute z-50 mt-1 rounded-xl border shadow-xl"
          style={{
            top: "100%", right: 0, minWidth: 190,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          }}
          onClick={e => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

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
    <tr style={{ borderBottom: "1px solid hsl(var(--border)/0.5)" }}
      className="transition-colors hover:bg-muted/20">
      <td className="px-3 py-3 font-mono text-xs font-semibold" style={{ color: "#FFB74D" }}>{order.poNumber}</td>
      <td className="px-3 py-3 text-sm" style={{ color: "hsl(var(--foreground))" }}>{supplierName}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span>
      </td>
      <td className="px-3 py-3 text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{fmt(total)}</td>
      <td className="px-3 py-3 text-sm font-medium" style={{ color: "#26A69A" }}>{fmt(paid)}</td>
      <td className="px-3 py-3 text-sm font-semibold" style={{ color: due > 0 ? "#ef4444" : "hsl(var(--muted-foreground))" }}>{fmt(due)}</td>
      <td className={`px-3 py-3 text-xs font-semibold ${pt.color}`}>{pt.label}</td>
      <td className="px-3 py-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
        {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy") : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onEdit(order)}>تعديل</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={() => onDelete(order.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </td>
    </tr>
  );
}

// ── مكوّن نموذج إضافة/تعديل أمر الشراء ────────────────────────────────────
type ItemRow = { id?: number; productId: string; productName: string; color: string; size: string; sku: string; quantity: number; receivedQuantity?: number; unitCost: number; totalCost?: string };

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

  const blankItem = (): ItemRow => ({ productId: "", productName: "", color: "", size: "", sku: "", quantity: 1, unitCost: 0 });
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // reset الـ form + جيب البنود لما بيتفتح
  useEffect(() => {
    setSupplierId(String(editOrder?.supplierId ?? ""));
    setSupplierName(editOrder?.supplierName ?? "");
    setStatus(editOrder?.status ?? "draft");
    setPayStatus(editOrder?.paymentStatus ?? "unpaid");
    setPaidAmount(editOrder?.paidAmount ?? "0");
    setShippingCost(editOrder?.shippingCost ?? "0");
    setTaxAmount(editOrder?.taxAmount ?? "0");
    setDiscount(editOrder?.discountAmount ?? "0");
    setNotes(editOrder?.notes ?? "");
    setExpectedDate(editOrder?.expectedDate?.split("T")[0] ?? "");
    setItems([blankItem()]);

    // لو edit mode → جيب البنود من الـ API
    if (open && editOrder?.id) {
      setItemsLoading(true);
      apiFetch<any>(`/finance/purchases/${editOrder.id}`)
        .then(data => {
          if (data?.items?.length) {
            setItems(data.items.map((item: any) => ({
              id:               item.id,
              productId:        item.productId ? String(item.productId) : "",
              productName:      item.productName ?? "",
              color:            item.color ?? "",
              size:             item.size  ?? "",
              sku:              item.sku   ?? "",
              quantity:         item.quantity ?? 1,
              receivedQuantity: item.receivedQuantity ?? 0,
              unitCost:         parseFloat(item.unitCost ?? "0"),
              totalCost:        item.totalCost,
            })));
          }
        })
        .catch(() => { /* الـ items هتفضل فاضية — ما هيبانش للمستخدم */ })
        .finally(() => setItemsLoading(false));
    }
  }, [editOrder, open]);

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
      qc.invalidateQueries({ queryKey: ["/api/cash-registers"] });
      qc.invalidateQueries({ queryKey: ["/api/cash-registers/alerts"] });
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

        {/* بنود الأمر */}
        {isEdit ? (
          /* ── edit mode: البنود read-only ── */
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">بنود الأمر</Label>
              {itemsLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">جارٍ التحميل…</span>
              )}
            </div>
            {itemsLoading ? (
              <div className="rounded-lg border p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <ShoppingCart className="w-4 h-4 animate-pulse" />
                <span>جارٍ جلب البنود…</span>
              </div>
            ) : items.length === 0 || (items.length === 1 && !items[0].productName) ? (
              <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                لا توجد بنود مسجلة لهذا الأمر
              </div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "hsl(var(--muted)/0.4)" }}>
                    <tr>
                      {["المنتج", "لون / مقاس", "الكمية", "المستلم", "التكلفة/وحدة", "الإجمالي"].map(h => (
                        <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => {
                      const receivedPct = row.quantity > 0 ? Math.round(((row.receivedQuantity ?? 0) / row.quantity) * 100) : 0;
                      const isFullyReceived = (row.receivedQuantity ?? 0) >= row.quantity;
                      return (
                        <tr key={i} style={{ borderTop: "1px solid hsl(var(--border)/0.5)" }}
                          className="hover:bg-muted/10 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-sm">{row.productName || "—"}</p>
                            {row.sku && <p className="text-xs text-muted-foreground font-mono">{row.sku}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {[row.color, row.size].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-center">{row.quantity}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold text-sm ${isFullyReceived ? "text-emerald-500" : (row.receivedQuantity ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                                {row.receivedQuantity ?? 0}
                              </span>
                              <div className="flex-1 min-w-[40px] h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${receivedPct}%`,
                                    background: isFullyReceived ? "#10b981" : (row.receivedQuantity ?? 0) > 0 ? "#f59e0b" : "transparent"
                                  }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm">{fmt(row.unitCost)}</td>
                          <td className="px-3 py-2.5 font-semibold text-sm" style={{ color: "#26A69A" }}>
                            {fmt(row.quantity * row.unitCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ borderTop: "2px solid hsl(var(--border))", background: "hsl(var(--muted)/0.2)" }}>
                    <tr>
                      <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-right text-muted-foreground">
                        الإجمالي الكلي
                      </td>
                      <td className="px-3 py-2.5 text-base font-black" style={{ color: "#FFB74D" }}>
                        {fmt(editOrder?.totalAmount ?? "0")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              💡 لا يمكن تعديل البنود بعد الإنشاء — يمكنك تعديل الحالة وبيانات الدفع فقط
            </p>
          </div>
        ) : (
          /* ── create mode: البنود قابلة للتعديل ── */
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
  const [, navigate] = useLocation();

  // ── فلاتر الأعمدة ────────────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("all");
  const [filterPay, setFilterPay]         = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [fromDate, setFromDate]           = useState("");
  const [toDate, setToDate]               = useState("");
  const [colFiltersVisible, setColFiltersVisible] = useState(false);

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

  // ── state للـ dropdown المفتوح ─────────────────────────────────────────
  const [openCol, setOpenCol] = useState<string | null>(null);

  // item لتبسيط dropdown — بيقفل الـ dropdown بعد الاختيار
  const filterItem = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={() => { onClick(); setOpenCol(null); }}
      className="w-full text-right px-3 py-2 text-sm transition-colors hover:bg-muted/40 flex items-center justify-between"
      style={{ color: active ? "#FFB74D" : "hsl(var(--foreground))" }}
    >
      {label}
      {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate("/finance")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ChevronRight className="w-4 h-4" />
            لوحة الماليات
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />أوامر الشراء
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} أمر — إجمالي {fmt(stats.total)}</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* بحث سريع */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pr-9 h-9 w-52 text-sm"
              placeholder="بحث…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* زر تفعيل فلاتر الأعمدة */}
          <Button
            variant={colFiltersVisible ? "default" : "outline"}
            size="sm"
            className="gap-1.5 relative"
            onClick={() => setColFiltersVisible(p => !p)}
            style={colFiltersVisible ? { background: "rgba(255,183,77,0.15)", color: "#FFB74D", border: "1px solid rgba(255,183,77,0.4)" } : {}}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {colFiltersVisible ? "إخفاء الفلتر" : "إنشاء فلتر"}
            {!colFiltersVisible && activeFilters > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: "#FFB74D", color: "#000" }}>
                {activeFilters}
              </span>
            )}
          </Button>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-rose-400 hover:text-rose-500"
              onClick={() => { setFilterStatus("all"); setFilterPay("all"); setFilterSupplier("all"); setFromDate(""); setToDate(""); }}>
              <X className="w-3.5 h-3.5" />مسح
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            <FileSpreadsheet className="w-4 h-4" />Excel
          </Button>
          <Button size="sm" onClick={() => { setEditOrder(null); setFormOpen(true); }} className="gap-1">
            <Plus className="w-4 h-4" />أمر جديد
          </Button>
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأوامر",   value: fmt(stats.total),  color: "#FFB74D", glow: "rgba(255,183,77,0.32)",  bg: "linear-gradient(135deg, rgba(255,183,77,0.42) 0%, rgba(255,183,77,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
          { label: "إجمالي المدفوع",   value: fmt(stats.paid),   color: "#26A69A", glow: "rgba(38,166,154,0.28)",  bg: "linear-gradient(135deg, rgba(38,166,154,0.44) 0%, rgba(38,166,154,0.18) 52%, rgba(255,255,255,0.08) 100%)" },
          { label: "المتبقي",          value: fmt(stats.unpaid), color: "#ef4444", glow: "rgba(239,68,68,0.28)",   bg: "linear-gradient(135deg, rgba(239,68,68,0.42) 0%, rgba(239,68,68,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
          { label: "غير مدفوع / جزئي", value: `${stats.countUnpaid} / ${stats.countPartial}`, color: "#7E57C2", glow: "rgba(126,87,194,0.32)", bg: "linear-gradient(135deg, rgba(126,87,194,0.42) 0%, rgba(126,87,194,0.16) 52%, rgba(255,255,255,0.08) 100%)" },
        ].map(c => (
          <div key={c.label} className="relative overflow-hidden rounded-[18px] px-4 py-3.5 text-center transition-transform duration-300 hover:-translate-y-0.5"
            style={{ background: c.bg, border: `1px solid ${c.glow}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px ${c.glow}`, backdropFilter: "blur(12px)" }}>
            <div className="absolute inset-x-6 top-0 h-px opacity-80"
              style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
            <p className="text-[11px] font-bold tracking-tight text-white/70">{c.label}</p>
            <p className="mt-1 truncate text-xl font-black sm:text-2xl"
              style={{ color: c.color, textShadow: `0 0 14px ${c.color}88` }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── الجدول ── */}
      <div className="relative overflow-hidden rounded-[22px]"
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.18)",
        }}>
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,183,77,0.6), rgba(38,166,154,0.6), transparent)" }} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            {/* ── thead — دايماً ظاهر ── */}
            <thead>
              <tr style={{ background: "hsl(var(--muted)/0.3)", borderBottom: "1px solid hsl(var(--border))" }}>

                {/* رقم الأمر */}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="رقم الأمر" active={!!search.trim()} visible={colFiltersVisible}
                    isOpen={openCol === "poNumber"} onToggle={() => setOpenCol(p => p === "poNumber" ? null : "poNumber")}>
                    <div className="p-2">
                      <Input className="h-7 text-xs" placeholder="بحث برقم الأمر…"
                        value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                    </div>
                  </ColFilter>
                </th>

                {/* المورد */}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="المورد" active={filterSupplier !== "all"} visible={colFiltersVisible}
                    isOpen={openCol === "supplier"} onToggle={() => setOpenCol(p => p === "supplier" ? null : "supplier")}>
                    <div className="py-1 max-h-52 overflow-y-auto">
                      {filterItem("الكل", filterSupplier === "all", () => setFilterSupplier("all"))}
                      {suppliers.map(s => filterItem(s.name, filterSupplier === String(s.id), () => setFilterSupplier(String(s.id))))}
                    </div>
                  </ColFilter>
                </th>

                {/* الحالة */}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="الحالة" active={filterStatus !== "all"} visible={colFiltersVisible}
                    isOpen={openCol === "status"} onToggle={() => setOpenCol(p => p === "status" ? null : "status")}>
                    <div className="py-1">
                      {filterItem("الكل", filterStatus === "all", () => setFilterStatus("all"))}
                      {Object.entries(STATUS_LABELS).map(([k, v]) => filterItem(v.label, filterStatus === k, () => setFilterStatus(k)))}
                    </div>
                  </ColFilter>
                </th>

                {/* الإجمالي / المدفوع / المتبقي — بدون فلتر */}
                {["الإجمالي", "المدفوع", "المتبقي"].map(h => (
                  <th key={h} className="px-3 py-3 text-right text-xs font-semibold"
                    style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                ))}

                {/* الدفع */}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="الدفع" active={filterPay !== "all"} visible={colFiltersVisible}
                    isOpen={openCol === "pay"} onToggle={() => setOpenCol(p => p === "pay" ? null : "pay")}>
                    <div className="py-1">
                      {filterItem("الكل", filterPay === "all", () => setFilterPay("all"))}
                      {Object.entries(PAY_LABELS).map(([k, v]) => filterItem(v.label, filterPay === k, () => setFilterPay(k)))}
                    </div>
                  </ColFilter>
                </th>

                {/* التاريخ */}
                <th className="px-3 py-3 text-right">
                  <ColFilter label="التاريخ" active={!!fromDate || !!toDate} visible={colFiltersVisible}
                    isOpen={openCol === "date"} onToggle={() => setOpenCol(p => p === "date" ? null : "date")}>
                    <div className="p-2 space-y-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">من</p>
                        <Input type="date" className="h-7 text-xs" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">إلى</p>
                        <Input type="date" className="h-7 text-xs" value={toDate} onChange={e => setToDate(e.target.value)} />
                      </div>
                      {(fromDate || toDate) && (
                        <button className="w-full text-xs text-rose-400 hover:text-rose-500 py-1"
                          onClick={() => { setFromDate(""); setToDate(""); setOpenCol(null); }}>
                          مسح التاريخ
                        </button>
                      )}
                    </div>
                  </ColFilter>
                </th>

                <th className="px-3 py-3 text-right text-xs font-semibold"
                  style={{ color: "hsl(var(--muted-foreground))" }}>إجراءات</th>
              </tr>
            </thead>

            {/* ── tbody — loading / empty / data ── */}
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex items-center justify-center gap-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <ShoppingCart className="w-6 h-6 animate-pulse" />
                      <span className="text-sm">جارٍ التحميل…</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-2" style={{ color: "hsl(var(--muted-foreground)/0.5)" }}>
                      <ShoppingCart className="w-10 h-10 opacity-30" />
                      <p className="text-sm font-medium">
                        {activeFilters > 0 || search ? "لا توجد نتائج للفلتر الحالي" : "لا توجد أوامر شراء"}
                      </p>
                      {(activeFilters > 0 || search) && (
                        <button
                          className="text-xs mt-1 underline"
                          style={{ color: "#FFB74D" }}
                          onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPay("all"); setFilterSupplier("all"); setFromDate(""); setToDate(""); }}
                        >
                          مسح كل الفلاتر
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(o => (
                  <PORow key={o.id} order={o} suppliers={suppliers} onDelete={id => {
                    if (confirm("هل تريد حذف هذا الأمر؟")) deleteMut.mutate(id);
                  }} onEdit={o => { setEditOrder(o); setFormOpen(true); }} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
