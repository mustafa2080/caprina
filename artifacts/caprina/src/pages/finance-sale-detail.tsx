import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  ArrowRight, Printer, Package, User, Phone, MapPin,
  Calendar, Hash, CreditCard, Truck, FileSpreadsheet,
  ChevronDown, Check, Pencil, Trash2, X, Save,
} from "lucide-react";
// ── أنواع ──────────────────────────────────────────────────────────────────
type SaleItem = {
  id: number; productName: string; color: string; size: string;
  quantity: number; unitPrice: string; subtotal?: string;
};
type SaleOrder = {
  id: number; soNumber: string;
  clientName: string; clientPhone: string | null; clientAddress: string | null;
  warehouseId: number | null; status: string; paymentStatus: string;
  totalAmount: string; paidAmount: string; discountAmount: string;
  shippingCost: string; taxAmount: string;
  notes: string | null; expectedDate: string | null;
  deliveredAt: string | null; createdAt: string;
  items: SaleItem[];
};

// ── ثوابت الحالات ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: "قيد التجهيز",   bg: "#FFF8E1", color: "#E65100" },
  confirmed:  { label: "قيد التجهيز",   bg: "#FFF8E1", color: "#E65100" },
  processing: { label: "قيد التجهيز",   bg: "#FFF8E1", color: "#E65100" },
  delivered:  { label: "قيد التجهيز",   bg: "#FFF8E1", color: "#E65100" },
  closed:     { label: "تم التسليم ✓",  bg: "#E8F5E9", color: "#1B5E20" },
  cancelled:  { label: "ملغي",          bg: "#FFEBEE", color: "#B71C1C" },
};
const PAY_MAP: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",    color: "#B71C1C" },
  partial: { label: "مدفوع جزئياً", color: "#E65100" },
  paid:    { label: "مدفوع بالكامل",color: "#1B5E20" },
};

const fmtNum  = (n: string | number) => Number(n).toLocaleString("ar-EG");
const fmtDate = (d: string | null)   => d
  ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—";

// ── تصدير Excel احترافي بـ ExcelJS: RTL + حدود + ألوان ──────────────────
async function exportToExcel(order: SaleOrder) {
  const fmtDate2 = (d: string | null) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";
  const total    = parseFloat(order.totalAmount    ?? "0");
  const paid     = parseFloat(order.paidAmount     ?? "0");
  const discount = parseFloat(order.discountAmount ?? "0");
  const shipping = parseFloat(order.shippingCost   ?? "0");
  const due      = total - paid;

  // ورقة 1: بيانات الفاتورة
  const info: (string|number)[][] = [
    ["رقم الفاتورة",   order.soNumber],
    ["اسم العميل",    order.clientName],
    ["هاتف العميل",   order.clientPhone ?? "—"],
    ["عنوان العميل",  order.clientAddress ?? "—"],
    ["حالة الأمر",    STATUS_MAP[order.status]?.label ?? order.status],
    ["حالة الدفع",    PAY_MAP[order.paymentStatus]?.label ?? order.paymentStatus],
    ["تاريخ الإنشاء",  fmtDate2(order.createdAt)],
    ["عدد المنتجات",  order.items.length],
    ["إجمالي القطع",  order.items.reduce((s,i)=>s+i.quantity,0)],
    ["الإجمالي الكلي",   total],
    ["المدفوع",       paid],
    ["المتبقي",       due > 0 ? due : "مسدد بالكامل ✓"],
    ...(discount > 0 ? [["الخصم", discount]] : []),
    ...(shipping > 0 ? [["رسوم الشحن", shipping]] : []),
    ...(order.notes  ? [["ملاحظات", order.notes]] : []),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([["البيان", "القيمة"], ...info]);
  ws1["!cols"] = [{ wch: 28 }, { wch: 36 }];

  // ورقة 2: بنود الفاتورة
  const itemRows = order.items.map((it, i) => [
    i + 1,
    it.productName ?? "—",
    it.color ?? "—",
    it.size  ?? "—",
    it.quantity,
    Number(it.unitPrice),
    it.quantity * Number(it.unitPrice),
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ["#", "المنتج", "اللون", "المقاس", "الكمية", "سعر الوحدة", "الإجمالي"],
    ...itemRows,
    ["", "", "", "الإجمالي", order.items.reduce((s,i)=>s+i.quantity,0), "", total],
  ]);
  ws2["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 14 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "بيانات الفاتورة");
  XLSX.utils.book_append_sheet(wb, ws2, "بنود الفاتورة");
  XLSX.writeFile(wb, `فاتورة-${order.soNumber}.xlsx`);
}

// ── طباعة PDF ──────────────────────────────────────────────────────────────
function printManifestPDF(order: SaleOrder) {
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, bg: "#eee", color: "#333" };
  const payInfo    = PAY_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: "#333" };
  const total    = parseFloat(order.totalAmount   ?? "0");
  const paid     = parseFloat(order.paidAmount    ?? "0");
  const discount = parseFloat(order.discountAmount?? "0");
  const shipping = parseFloat(order.shippingCost  ?? "0");
  const due      = total - paid;

  const rows = order.items.map((it, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td><strong>${it.productName ?? "—"}</strong></td>
      <td>${it.color ?? "—"}</td>
      <td>${it.size ?? "—"}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:center">${fmtNum(it.unitPrice)} ج</td>
      <td style="text-align:center;font-weight:600">${fmtNum(it.quantity * Number(it.unitPrice))} ج</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<title>فاتورة ${order.soNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:28px;color:#222;font-size:13px;background:#f5f0e8}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid hsl(43,74%,50%);padding-bottom:16px;margin-bottom:20px}
  .brand{font-size:26px;font-weight:900;color:hsl(43,74%,50%);letter-spacing:3px}
  .brand-sub{font-size:11px;color:#888;margin-top:2px}
  .mnf-info{text-align:left}
  .mnf-num{font-size:15px;font-weight:700}
  .mnf-date{font-size:11px;color:#888;margin-top:4px}
  .status-pill{display:inline-block;padding:3px 14px;border-radius:999px;font-size:11px;font-weight:700;margin-top:6px;background:${statusInfo.bg};color:${statusInfo.color}}
  .stats{display:flex;gap:12px;margin-bottom:20px}
  .stat-box{flex:1;border:1px solid #e0f2f1;border-radius:10px;padding:10px 14px;text-align:center;background:#f9fffe}
  .stat-val{font-size:20px;font-weight:800;color:hsl(43,74%,50%)}
  .stat-lbl{font-size:10px;color:#888;margin-top:2px}
  .client-section{background:#F5FFFE;border:1px solid #B2DFDB;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap}
  .client-field{font-size:12px}
  .client-label{color:#888;margin-left:4px}
  .client-val{font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  thead th{background:hsl(43,74%,50%);color:#0a0a0a;padding:9px 10px;font-size:12px;text-align:right}
  tbody tr{border-bottom:1px solid #f0f0f0}
  tbody tr:nth-child(even){background:#FAFFFE}
  tbody td{padding:8px 10px;font-size:12px}
  .totals-box{border:1px solid #B2DFDB;border-radius:10px;padding:14px 20px;min-width:260px;background:#F5FFFE;margin-bottom:20px}
  .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
  .totals-row.grand{border-top:2px solid hsl(43,74%,50%);margin-top:6px;padding-top:8px;font-weight:800;font-size:16px;color:hsl(43,74%,50%)}
  .footer{display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:16px;margin-top:20px}
  .sig-block{text-align:center}
  .sig-line{width:160px;border-bottom:1px solid #aaa;margin:40px auto 6px}
  .sig-lbl{font-size:11px;color:#888}
  @media print{.no-print{display:none!important}}
</style></head><body>
<div class="header">
  <div><div class="brand">CAPRINA</div><div class="brand-sub">فاتورة بيع — SALE ORDER</div></div>
  <div class="mnf-info">
    <div class="mnf-num">${order.soNumber}</div>
    <div class="mnf-date">تاريخ الإنشاء: ${fmtDate(order.createdAt)}</div>
    <div class="mnf-date">طبع: ${new Date().toLocaleDateString("ar-EG")}</div>
    <div><span class="status-pill">${statusInfo.label}</span></div>
  </div>
</div>
<div class="stats">
  <div class="stat-box"><div class="stat-val">${order.items.length}</div><div class="stat-lbl">عدد المنتجات</div></div>
  <div class="stat-box"><div class="stat-val">${order.items.reduce((s,i)=>s+i.quantity,0)}</div><div class="stat-lbl">إجمالي القطع</div></div>
  <div class="stat-box"><div class="stat-val" style="color:${PAY_MAP[order.paymentStatus]?.color??'#333'}">${payInfo.label}</div><div class="stat-lbl">حالة الدفع</div></div>
  <div class="stat-box"><div class="stat-val">${fmtNum(total)} ج</div><div class="stat-lbl">إجمالي الفاتورة</div></div>
</div>
<div class="client-section">
  <div class="client-field"><span class="client-label">العميل:</span><span class="client-val">${order.clientName}</span></div>
  ${order.clientPhone?`<div class="client-field"><span class="client-label">الهاتف:</span><span class="client-val">${order.clientPhone}</span></div>`:""}
  ${order.clientAddress?`<div class="client-field"><span class="client-label">العنوان:</span><span class="client-val">${order.clientAddress}</span></div>`:""}
</div>
<table>
  <thead><tr><th style="text-align:center;width:40px">#</th><th>المنتج</th><th>اللون</th><th>المقاس</th><th style="text-align:center">الكمية</th><th style="text-align:center">سعر الوحدة</th><th style="text-align:center">الإجمالي</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals-box">
  <div class="totals-row"><span>الإجمالي الفرعي</span><span>${fmtNum(total)} ج</span></div>
  ${discount>0?`<div class="totals-row" style="color:#c62828"><span>الخصم</span><span>- ${fmtNum(discount)} ج</span></div>`:""}
  ${shipping>0?`<div class="totals-row"><span>رسوم الشحن</span><span>${fmtNum(shipping)} ج</span></div>`:""}
  <div class="totals-row grand"><span>الإجمالي الكلي</span><span>${fmtNum(total)} ج</span></div>
  <div class="totals-row" style="color:#1B5E20"><span>المدفوع</span><span>${fmtNum(paid)} ج</span></div>
  ${due>0?`<div class="totals-row" style="color:#B71C1C"><span>المتبقي</span><span>${fmtNum(due)} ج</span></div>`:""}
</div>
${order.notes?`<div style="background:#FFFDE7;border:1px solid #FFF176;border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:20px"><strong>ملاحظات:</strong> ${order.notes}</div>`:""}
<div class="footer">
  <div class="sig-block"><div class="sig-line"></div><div class="sig-lbl">توقيع المندوب — الاسم: ___________</div></div>
  <div class="sig-block"><div class="sig-line"></div><div class="sig-lbl">توقيع المسؤول — الاسم: ___________</div></div>
</div>
<div class="no-print" style="text-align:center;margin-top:28px">
  <button onclick="window.print()" style="padding:10px 32px;background:hsl(43,74%,50%);color:#0a0a0a;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700">🖨️ طباعة / حفظ PDF</button>
</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Dropdown مشترك للتغيير السريع ─────────────────────────────────────────
function QuickChangeDropdown({
  label, options, current, onSelect, disabled, darkMode,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  current: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
  darkMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentOpt = options.find(o => o.value === current);

  const btnBg          = darkMode ? "transparent"   : "hsl(var(--card))";
  const btnBorder      = darkMode ? (currentOpt?.color ?? "#888") : "hsl(var(--border))";
  const btnColor       = currentOpt?.color ?? (darkMode ? "#ccc" : "hsl(var(--foreground))");
  const dropBg         = darkMode ? "#1a1a1a"        : "hsl(var(--card))";
  const dropBorder     = darkMode ? "#333"           : "hsl(var(--border))";
  const itemHoverBg    = darkMode ? "#ffffff14"      : undefined;

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:opacity-80"
        style={{
          background: btnBg,
          borderColor: btnBorder,
          color: btnColor,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}: {currentOpt?.label ?? current}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 mt-1 rounded-xl border shadow-xl overflow-hidden z-50"
            style={{ minWidth: 180, background: dropBg, borderColor: dropBorder }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                className="w-full text-right px-4 py-2.5 text-sm flex items-center justify-between transition-colors"
                style={{
                  color: opt.color ?? (darkMode ? "#ccc" : "hsl(var(--foreground))"),
                  background: opt.value === current ? (darkMode ? "#ffffff0d" : "hsl(var(--muted))") : "transparent",
                }}
                onMouseEnter={e => { if (itemHoverBg) (e.currentTarget as HTMLElement).style.background = itemHoverBg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = opt.value === current ? (darkMode ? "#ffffff0d" : "hsl(var(--muted))") : "transparent"; }}
                onClick={() => { onSelect(opt.value); setOpen(false); }}
              >
                {opt.label}
                {opt.value === current && <Check className="w-3.5 h-3.5 opacity-60" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ══ المكوّن الرئيسي ══════════════════════════════════════════════════════════
export default function FinanceSaleDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [order, setOrder]   = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [saving, setSaving]  = useState(false);

  // تعديل/حذف المنتجات
  const [editingItemId, setEditingItemId]   = useState<number | null>(null);
  const [editQty,       setEditQty]         = useState<number>(1);
  const [editPrice,     setEditPrice]       = useState<number>(0);
  const [editName,      setEditName]        = useState<string>("");
  const [editColor,     setEditColor]       = useState<string>("");
  const [editSize,      setEditSize]        = useState<string>("");
  const [itemSaving,    setItemSaving]      = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // إغلاق الفاتورة
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing]  = useState(false);

  // دفع جزئي
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount]       = useState<string>("");

  const handleClose = async () => {
    if (!order) return;
    setClosing(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setOrder(prev => prev ? { ...prev, status: "closed" } : prev);
      setShowConfirm(false);
    } catch (e: any) {
      alert("حدث خطأ: " + e.message);
    } finally { setClosing(false); }
  };

  // تغيير الحالة أو حالة الدفع
  const handleStatusChange = async (field: "status" | "paymentStatus", value: string) => {
    if (!order) return;
    // لو status = closed → استخدم confirm dialog
    if (field === "status" && value === "closed") { setShowConfirm(true); return; }
    // لو paymentStatus = partial → افتح modal إدخال المبلغ
    if (field === "paymentStatus" && value === "partial") {
      setPartialAmount(order.paidAmount && Number(order.paidAmount) > 0 ? order.paidAmount : "");
      setShowPartialModal(true);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      setOrder(prev => prev ? { ...prev, [field]: value } : prev);
    } catch (e: any) {
      alert("حدث خطأ: " + e.message);
    } finally { setSaving(false); }
  };

  // حفظ الدفع الجزئي
  const handleSavePartial = async () => {
    if (!order) return;
    const amount = parseFloat(partialAmount);
    const total  = parseFloat(order.totalAmount);
    if (isNaN(amount) || amount <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
    if (amount >= total) { alert("المبلغ أكبر من أو يساوي الإجمالي، استخدم «مدفوع بالكامل» بدلاً من ذلك"); return; }
    setSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "partial", paidAmount: String(amount) }),
      });
      setOrder(prev => prev ? { ...prev, paymentStatus: "partial", paidAmount: String(amount) } : prev);
      setShowPartialModal(false);
      setPartialAmount("");
    } catch (e: any) {
      alert("حدث خطأ: " + e.message);
    } finally { setSaving(false); }
  };

  // بدء تعديل منتج
  const startEditItem = (it: SaleItem) => {
    setEditingItemId(it.id);
    setEditQty(it.quantity);
    setEditPrice(Number(it.unitPrice));
    setEditName(it.productName);
    setEditColor(it.color ?? "");
    setEditSize(it.size ?? "");
  };

  // حفظ تعديل المنتج
  const saveEditItem = async () => {
    if (!order || editingItemId === null) return;
    setItemSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}/items/${editingItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          productName: editName,
          color: editColor || null,
          size: editSize || null,
          quantity: editQty,
          unitPrice: editPrice,
        }),
      });
      // تحديث الـ state محلياً
      const newTotal = order.items.reduce((sum, it) => {
        if (it.id === editingItemId) return sum + editQty * editPrice;
        return sum + it.quantity * Number(it.unitPrice);
      }, 0);
      setOrder(prev => prev ? {
        ...prev,
        totalAmount: String(newTotal),
        items: prev.items.map(it => it.id === editingItemId
          ? { ...it, productName: editName, color: editColor, size: editSize, quantity: editQty, unitPrice: String(editPrice) }
          : it
        ),
      } : prev);
      setEditingItemId(null);
    } catch (e: any) {
      alert("خطأ في التعديل: " + e.message);
    } finally { setItemSaving(false); }
  };

  // حذف منتج
  const deleteItem = async (itemId: number) => {
    if (!order) return;
    setItemSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}/items/${itemId}`, {
        method: "DELETE",
      });
      const remaining = order.items.filter(it => it.id !== itemId);
      const newTotal  = remaining.reduce((sum, it) => sum + it.quantity * Number(it.unitPrice), 0);
      setOrder(prev => prev ? {
        ...prev,
        totalAmount: String(newTotal),
        items: remaining,
      } : prev);
      setDeleteConfirmId(null);
    } catch (e: any) {
      alert("خطأ في الحذف: " + e.message);
    } finally { setItemSaving(false); }
  };

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    apiFetch<SaleOrder>(`/finance/sale-orders/${params.id}`)
      .then(data => { setOrder(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">جاري التحميل…</div>
  );
  if (error || !order) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-destructive text-sm">{error ?? "لم يُعثر على الأمر"}</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/finance/sales")}>رجوع</Button>
    </div>
  );

  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, bg: "#eee", color: "#555" };
  const payInfo    = PAY_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: "#555" };
  const total    = parseFloat(order.totalAmount   ?? "0");
  const paid     = parseFloat(order.paidAmount    ?? "0");
  const discount = parseFloat(order.discountAmount?? "0");
  const shipping = parseFloat(order.shippingCost  ?? "0");
  const due      = total - paid;
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  const statusOptions = Object.entries(STATUS_MAP).map(([k, v]) => ({
    value: k, label: v.label, color: v.color,
  }));
  const payOptions = Object.entries(PAY_MAP).map(([k, v]) => ({
    value: k, label: v.label, color: v.color,
  }));

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "hsl(var(--background))" }} dir="rtl">

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button
          onClick={() => navigate("/finance/sales")}
          className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
          style={{ color: "hsl(43,74%,50%)" }}
        >
          <ArrowRight className="w-4 h-4" /> العودة لفواتير البيع
        </button>

        {/* ── شريط الأزرار الداكن ── */}
        <div
          className="flex items-center flex-wrap rounded-xl"
          style={{ background: "#111", border: "1px solid #2a2a2a", padding: "5px 8px", gap: "6px" }}
        >
          {/* 1. طباعة / PDF */}
          <button
            onClick={() => printManifestPDF(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-75"
            style={{ background: "hsl(43,74%,50%)", border: "1px solid hsl(43,74%,50%)", color: "#000" }}
          >
            <Printer className="w-3.5 h-3.5" /> طباعة / PDF
          </button>

          {/* 2. تصدير Excel */}
          <button
            onClick={() => exportToExcel(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: "transparent", border: "1px solid hsl(43,74%,50%)", color: "hsl(43,74%,50%)" }}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> تصدير Excel
          </button>

          {/* 3. إغلاق البيان */}
          {order.status !== "closed" && order.status !== "cancelled" && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{ background: "transparent", border: "1px solid #4CAF50", color: "#4CAF50" }}
            >
              🔒 إغلاق البيان
            </button>
          )}

          {/* 4. الدفع dropdown */}
          {order.status !== "closed" && (
            <QuickChangeDropdown
              label="الدفع"
              options={payOptions}
              current={order.paymentStatus}
              onSelect={v => handleStatusChange("paymentStatus", v)}
              disabled={saving}
              darkMode
            />
          )}

          {/* 5. حالة الأمر — أقصى الشمال */}
          {order.status === "closed" ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border: "1px solid #4CAF50", color: "#4CAF50", background: "transparent" }}>
              ✓ تم التسليم
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border: `1px solid ${statusInfo.color}`, color: statusInfo.color, background: "transparent" }}>
              {statusInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* ── CONFIRM CLOSE DIALOG ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(184,134,11,0.12)" }}>
                <span style={{ fontSize: 28 }}>🔒</span>
              </div>
              <h3 className="text-base font-bold mb-1">إغلاق الفاتورة</h3>
              <p className="text-sm text-muted-foreground">
                سيتم إغلاق <strong>{order.soNumber}</strong> وتحويل{" "}
                <strong style={{ color: "hsl(43,74%,50%)" }}>{fmtNum(total)} ج</strong> للخزينة.
              </p>
              <p className="text-xs text-muted-foreground mt-2">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} disabled={closing}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70"
                style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={handleClose} disabled={closing}
                className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-85"
                style={{ background: "hsl(43,74%,50%)", color: "#0a0a0a" }}>
                {closing ? "جارٍ…" : "تأكيد الإغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PARTIAL PAYMENT MODAL ── */}
      {showPartialModal && order && (() => {
        const tot   = parseFloat(order.totalAmount);
        const paid  = parseFloat(partialAmount) || 0;
        const remaining = tot - paid;
        const isValid   = paid > 0 && paid < tot;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" style={{ background: "hsl(var(--card))" }} dir="rtl">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: "rgba(230,81,0,0.1)" }}>
                  <span style={{ fontSize: 26 }}>💰</span>
                </div>
                <h3 className="text-base font-bold mb-1">دفع جزئي</h3>
                <p className="text-xs text-muted-foreground">
                  إجمالي الفاتورة:{" "}
                  <strong style={{ color: "hsl(43,74%,50%)" }}>{fmtNum(tot)} ج</strong>
                </p>
              </div>

              {/* حقل الإدخال */}
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">المبلغ المدفوع (ج)</label>
                <input
                  type="number"
                  min={1}
                  max={tot - 1}
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold text-center outline-none focus:ring-2"
                  style={{
                    borderColor: isValid ? "hsl(43,74%,50%)" : "hsl(var(--border))",
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    ringColor: "hsl(43,74%,50%)",
                  }}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && isValid) handleSavePartial(); }}
                />
              </div>

              {/* عرض المتبقي */}
              <div className="rounded-xl p-3 mb-5 flex justify-between items-center text-sm"
                style={{ background: remaining > 0 && isValid ? "#FFF8E1" : "hsl(var(--muted))", border: "1px solid", borderColor: remaining > 0 && isValid ? "#FFE082" : "hsl(var(--border))" }}>
                <span className="text-xs text-muted-foreground font-medium">المتبقي:</span>
                <span className="font-extrabold text-base" style={{ color: remaining > 0 && isValid ? "#E65100" : "hsl(var(--muted-foreground))" }}>
                  {isValid ? `${fmtNum(remaining)} ج` : "—"}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowPartialModal(false); setPartialAmount(""); }}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70"
                  style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
                <button
                  onClick={handleSavePartial}
                  disabled={saving || !isValid}
                  className="flex-1 py-2 rounded-lg text-sm font-bold transition-opacity"
                  style={{ background: isValid ? "hsl(43,74%,50%)" : "#ccc", color: "#0a0a0a", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "جارٍ…" : "حفظ"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── HEADER CARD ── */}
      <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-black tracking-widest mb-1" style={{ color: "hsl(43,74%,50%)" }}>CAPRINA</div>
            <div className="text-xs text-muted-foreground mb-3">فاتورة بيع — SALE ORDER</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm font-bold">
                <Hash className="w-4 h-4 text-muted-foreground" /> {order.soNumber}
              </span>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold"
                style={{ background: statusInfo.bg, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
              <span className="text-xs font-bold" style={{ color: payInfo.color }}>{payInfo.label}</span>
            </div>
          </div>
          <div className="text-left text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" /> تاريخ الإنشاء: {fmtDate(order.createdAt)}
            </div>
            {order.expectedDate && (
              <div className="flex items-center gap-1 justify-end">
                <Truck className="w-3 h-3" /> تاريخ التسليم المتوقع: {fmtDate(order.expectedDate)}
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex items-center gap-1 justify-end">
                <Package className="w-3 h-3" /> تسليم فعلي: {fmtDate(order.deliveredAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { val: order.items.length, lbl: "عدد المنتجات" },
          { val: totalQty,           lbl: "إجمالي القطع" },
          { val: `${fmtNum(total)} ج`, lbl: "إجمالي الفاتورة" },
          { val: due > 0 ? `${fmtNum(due)} ج` : "✓ مسدد", lbl: "المتبقي" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border p-3 text-center"
            style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
            <div className="text-xl font-extrabold mb-0.5" style={{ color: "hsl(43,74%,50%)" }}>{s.val}</div>
            <div className="text-xs text-muted-foreground">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* ── CLIENT INFO ── */}
      <div className="rounded-xl border p-4 mb-5 flex flex-wrap gap-4"
        style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground text-xs">العميل:</span>
          <span className="font-bold">{order.clientName}</span>
        </div>
        {order.clientPhone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">الهاتف:</span>
            <span className="font-semibold" dir="ltr">{order.clientPhone}</span>
          </div>
        )}
        {order.clientAddress && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">العنوان:</span>
            <span className="font-semibold">{order.clientAddress}</span>
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE ── */}
      <div className="rounded-xl border overflow-hidden mb-5" style={{ borderColor: "#B2DFDB" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "hsl(43,74%,50%)" }}>
              {["#","المنتج","اللون","المقاس","الكمية","سعر الوحدة","الإجمالي",""].map((h,idx) => (
                <th key={idx} className="text-right py-2.5 px-3 text-xs font-bold" style={{ color: "#0a0a0a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => {
              const isEditing = editingItemId === it.id;
              return (
                <tr key={it.id}
                  style={{
                    background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted)/0.3)",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}>
                  <td className="py-2 px-3 text-muted-foreground text-xs w-8">{i + 1}</td>

                  {/* اسم المنتج */}
                  <td className="py-2 px-3 font-semibold">
                    {isEditing
                      ? <input className="border rounded px-2 py-1 text-xs w-full" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                          value={editName} onChange={e => setEditName(e.target.value)} />
                      : it.productName ?? "—"}
                  </td>

                  {/* اللون */}
                  <td className="py-2 px-3">
                    {isEditing
                      ? <input className="border rounded px-2 py-1 text-xs w-20" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                          value={editColor} onChange={e => setEditColor(e.target.value)} />
                      : it.color ?? "—"}
                  </td>

                  {/* المقاس */}
                  <td className="py-2 px-3">
                    {isEditing
                      ? <input className="border rounded px-2 py-1 text-xs w-16" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                          value={editSize} onChange={e => setEditSize(e.target.value)} />
                      : it.size ?? "—"}
                  </td>

                  {/* الكمية */}
                  <td className="py-2 px-3 text-center font-bold">
                    {isEditing
                      ? <input type="number" min={1} className="border rounded px-2 py-1 text-xs w-16 text-center" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                          value={editQty} onChange={e => setEditQty(Number(e.target.value) || 1)} />
                      : it.quantity}
                  </td>

                  {/* السعر */}
                  <td className="py-2 px-3 text-center">
                    {isEditing
                      ? <input type="number" min={0} className="border rounded px-2 py-1 text-xs w-20 text-center" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                          value={editPrice} onChange={e => setEditPrice(Number(e.target.value) || 0)} />
                      : `${fmtNum(it.unitPrice)} ج`}
                  </td>

                  {/* الإجمالي */}
                  <td className="py-2 px-3 text-center font-bold" style={{ color: "hsl(43,74%,50%)" }}>
                    {isEditing
                      ? `${fmtNum(editQty * editPrice)} ج`
                      : `${fmtNum(it.quantity * Number(it.unitPrice))} ج`}
                  </td>

                  {/* أزرار التعديل/الحذف */}
                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={saveEditItem} disabled={itemSaving}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-opacity hover:opacity-85"
                          style={{ background: "hsl(43,74%,50%)", color: "#0a0a0a" }}>
                          <Save className="w-3 h-3" />
                          {itemSaving ? "…" : "حفظ"}
                        </button>
                        <button onClick={() => setEditingItemId(null)} disabled={itemSaving}
                          className="px-2 py-1 rounded text-xs border hover:bg-muted/40 transition-colors"
                          style={{ borderColor: "hsl(var(--border))" }}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditItem(it)}
                          title="تعديل"
                          className="p-1.5 rounded hover:bg-blue-500/10 transition-colors"
                          style={{ color: "#1565C0" }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(it.id)}
                          title="حذف"
                          className="p-1.5 rounded hover:bg-rose-500/10 transition-colors"
                          style={{ color: "#B71C1C" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── CONFIRM DELETE DIALOG ── */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(183,28,28,0.1)" }}>
                <Trash2 className="w-7 h-7" style={{ color: "#B71C1C" }} />
              </div>
              <h3 className="text-base font-bold mb-1">حذف المنتج</h3>
              <p className="text-sm text-muted-foreground">
                هل أنت متأكد من حذف <strong>{order.items.find(x => x.id === deleteConfirmId)?.productName}</strong>؟
              </p>
              <p className="text-xs text-muted-foreground mt-1">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)} disabled={itemSaving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70 transition-opacity"
                style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={() => deleteItem(deleteConfirmId!)} disabled={itemSaving}
                className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-85 transition-opacity"
                style={{ background: "#B71C1C", color: "#ffd5d5" }}>
                {itemSaving ? "جارٍ…" : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOTALS ── */}
      <div className="flex justify-start mb-5">
        <div className="rounded-xl border p-4 min-w-64"
          style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">الإجمالي الفرعي</span>
            <span className="font-semibold">{fmtNum(total)} ج</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">الخصم</span>
              <span className="font-semibold text-red-500">- {fmtNum(discount)} ج</span>
            </div>
          )}
          {shipping > 0 && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">رسوم الشحن</span>
              <span className="font-semibold">{fmtNum(shipping)} ج</span>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t text-base font-extrabold"
            style={{ color: "hsl(43,74%,50%)", borderColor: "hsl(43,74%,50%)" }}>
            <span>الإجمالي الكلي</span>
            <span>{fmtNum(total)} ج</span>
          </div>
          <div className="flex justify-between text-sm py-1" style={{ color: "#1B5E20" }}>
            <span>المدفوع</span>
            <span className="font-bold">{fmtNum(paid)} ج</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-sm py-1" style={{ color: "#B71C1C" }}>
              <span>المتبقي</span>
              <span className="font-bold">{fmtNum(due)} ج</span>
            </div>
          )}
        </div>
      </div>

      {/* ── NOTES ── */}
      {order.notes && (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground mb-4"
          style={{ borderColor: "#FFF176", background: "#FFFDE7" }}>
          <strong className="text-foreground">ملاحظات: </strong>{order.notes}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="text-center text-xs text-muted-foreground mt-8 pb-4">
        CAPRINA · {order.soNumber} · {new Date().getFullYear()}
      </div>
    </div>
  );
}
