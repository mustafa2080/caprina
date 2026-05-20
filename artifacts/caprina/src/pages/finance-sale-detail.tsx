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

// ── نوع الـ Variant ────────────────────────────────────────────────────────
type Variant = {
  id: number; productId: number; productName: string;
  color: string; size: string; sku: string | null;
  totalQuantity: number; reservedQuantity: number; soldQuantity: number;
  unitPrice: string; costPrice: string | null;
};
type Product = { id: number; name: string };
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
  draft:      { label: "قيد التجهيز",   bg: "rgba(230,81,0,0.15)",   color: "#FF8A50" },
  confirmed:  { label: "قيد التجهيز",   bg: "rgba(230,81,0,0.15)",   color: "#FF8A50" },
  processing: { label: "قيد التجهيز",   bg: "rgba(230,81,0,0.15)",   color: "#FF8A50" },
  delivered:  { label: "قيد التجهيز",   bg: "rgba(230,81,0,0.15)",   color: "#FF8A50" },
  closed:     { label: "تم التسليم ✓",  bg: "rgba(27,94,32,0.18)",   color: "#4CAF50" },
  cancelled:  { label: "ملغي",          bg: "rgba(183,28,28,0.18)",  color: "#EF5350" },
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
${order.notes?`<div style="background:#fdf6e3;border:1px solid #e6c84b;border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:20px"><strong>ملاحظات:</strong> ${order.notes}</div>`:""}
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
  const [showExport, setShowExport] = useState(false);

  // ── variants & products من الـ API ──────────────────────────────────────
  const [allVariants,  setAllVariants]  = useState<Variant[]>([]);
  const [allProducts,  setAllProducts]  = useState<Product[]>([]);

  useEffect(() => {
    apiFetch<Variant[]>("/variants").then(d => setAllVariants(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch<Product[]>("/products").then(d => setAllProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // helpers للـ variants
  const variantsOf   = (pid: string) => allVariants.filter(v => String(v.productId) === pid);
  const colorsOf     = (pid: string) => [...new Set(variantsOf(pid).map(v => v.color).filter(Boolean))];
  const sizesOf      = (pid: string, color: string) => variantsOf(pid).filter(v => v.color === color).map(v => v.size).filter(Boolean);
  const matchVariant = (pid: string, color: string, size: string) => variantsOf(pid).find(v => v.color === color && v.size === size);

  // تعديل/حذف المنتجات
  const [editingItemId,   setEditingItemId]   = useState<number | null>(null);
  const [editProductId,   setEditProductId]   = useState<string>("");
  const [editQty,         setEditQty]         = useState<number>(1);
  const [editPrice,       setEditPrice]       = useState<number>(0);
  const [editName,        setEditName]        = useState<string>("");
  const [editColor,       setEditColor]       = useState<string>("");
  const [editSize,        setEditSize]        = useState<string>("");
  const [itemSaving,      setItemSaving]      = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // عند اختيار منتج جديد في التعديل
  const handleEditProduct = (pid: string) => {
    const p      = allProducts.find(x => String(x.id) === pid);
    const colors = colorsOf(pid);
    const color  = colors[0] ?? "";
    const sizes  = color ? sizesOf(pid, color) : [];
    const size   = sizes[0] ?? "";
    const v      = color && size ? matchVariant(pid, color, size) : undefined;
    setEditProductId(pid);
    setEditName(p?.name ?? "");
    setEditColor(color);
    setEditSize(size);
    if (v) setEditPrice(parseFloat(v.unitPrice));
  };

  // عند اختيار لون جديد في التعديل
  const handleEditColor = (color: string) => {
    const sizes = sizesOf(editProductId, color);
    const size  = sizes[0] ?? "";
    const v     = size ? matchVariant(editProductId, color, size) : undefined;
    setEditColor(color);
    setEditSize(size);
    if (v) setEditPrice(parseFloat(v.unitPrice));
  };

  // عند اختيار مقاس جديد في التعديل
  const handleEditSize = (size: string) => {
    const v = matchVariant(editProductId, editColor, size);
    setEditSize(size);
    if (v) setEditPrice(parseFloat(v.unitPrice));
  };

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
    // ابحث عن productId من الـ variants
    const v = allVariants.find(x =>
      x.color === it.color && x.size === it.size &&
      x.productName?.toLowerCase() === it.productName?.toLowerCase()
    );
    const pid = v ? String(v.productId) : "";
    setEditingItemId(it.id);
    setEditProductId(pid);
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
          {/* 1. طباعة */}
          <button
            onClick={() => printManifestPDF(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: "transparent", border: "1px solid hsl(43,74%,50%)", color: "hsl(43,74%,50%)" }}
          >
            <Printer className="w-3.5 h-3.5" /> طباعة
          </button>

          {/* 2. تصدير */}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
            style={{ background: "transparent", border: "1px solid hsl(43,74%,50%)", color: "hsl(43,74%,50%)" }}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> تصدير ↓
          </button>

          {/* 2. إغلاق البيان */}
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
                style={{ background: remaining > 0 && isValid ? "rgba(230,81,0,0.12)" : "hsl(var(--muted))", border: "1px solid", borderColor: remaining > 0 && isValid ? "#FF8A50" : "hsl(var(--border))" }}>
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
                  <td className="py-2 px-3 font-semibold min-w-[160px]">
                    {isEditing ? (
                      <select
                        className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: "hsl(43,74%,50%)", color: "hsl(var(--foreground))" }}
                        value={editProductId}
                        onChange={e => handleEditProduct(e.target.value)}
                      >
                        <option value="">— اختر منتج —</option>
                        {allProducts.map(p => (
                          <option key={p.id} value={String(p.id)}>{p.name}</option>
                        ))}
                      </select>
                    ) : it.productName ?? "—"}
                  </td>

                  {/* اللون */}
                  <td className="py-2 px-3 min-w-[110px]">
                    {isEditing ? (
                      <select
                        className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: "hsl(43,74%,50%)", color: "hsl(var(--foreground))" }}
                        value={editColor}
                        disabled={!editProductId}
                        onChange={e => handleEditColor(e.target.value)}
                      >
                        <option value="">— لون —</option>
                        {colorsOf(editProductId).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : it.color ?? "—"}
                  </td>

                  {/* المقاس */}
                  <td className="py-2 px-3 min-w-[90px]">
                    {isEditing ? (
                      <select
                        className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: "hsl(43,74%,50%)", color: "hsl(var(--foreground))" }}
                        value={editSize}
                        disabled={!editColor}
                        onChange={e => handleEditSize(e.target.value)}
                      >
                        <option value="">— مقاس —</option>
                        {sizesOf(editProductId, editColor).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : it.size ?? "—"}
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
          style={{ borderColor: "rgba(184,134,11,0.4)", background: "rgba(184,134,11,0.08)" }}>
          <strong className="text-foreground">ملاحظات: </strong>{order.notes}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="text-center text-xs text-muted-foreground mt-8 pb-4">
        CAPRINA · {order.soNumber} · {new Date().getFullYear()}
      </div>

      {/* ── Export Dialog — زي الصورة بالظبط ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowExport(false)}>
          <div className="relative rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#2a2a2a" }}>
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" style={{ color: "hsl(43,74%,50%)" }} />
                تصدير البيان — {order.soNumber}
              </h3>
              <button onClick={() => setShowExport(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Info Row */}
            <div className="px-5 pt-4 pb-2">
              <div className="rounded-xl p-3 flex items-center justify-between flex-wrap gap-2"
                style={{ background: "#111", border: "1px solid #2a2a2a" }}>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">الإجمالي</p>
                  <p className="font-black text-sm" style={{ color: "hsl(43,74%,50%)" }}>{fmtNum(total)} ج</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">المحصّل</p>
                  <p className="font-black text-sm" style={{ color: "#4CAF50" }}>{fmtNum(paid)} ج</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">المتبقي</p>
                  <p className="font-black text-sm" style={{ color: due > 0 ? "#EF5350" : "#4CAF50" }}>{fmtNum(due)} ج</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">عدد الأصناف</p>
                  <p className="font-black text-sm" style={{ color: "#4DB6AC" }}>{totalQty}</p>
                </div>
              </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {/* PDF */}
              <button
                onClick={() => { printManifestPDF(order); setShowExport(false); }}
                className="rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:scale-105 hover:brightness-110"
                style={{ background: "rgba(183,28,28,0.12)", border: "1px solid rgba(183,28,28,0.35)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(183,28,28,0.2)" }}>
                  <FileSpreadsheet className="w-6 h-6" style={{ color: "#EF5350" }} />
                </div>
                <p className="font-bold text-sm" style={{ color: "#EF5350" }}>تصدير PDF</p>
                <p className="text-[10px] text-center text-muted-foreground">بيان رسمي مع الأرقام</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(183,28,28,0.2)", color: "#EF5350" }}>pdf.</span>
              </button>

              {/* Excel */}
              <button
                onClick={() => { exportToExcel(order); setShowExport(false); }}
                className="rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:scale-105 hover:brightness-110"
                style={{ background: "rgba(27,94,32,0.12)", border: "1px solid rgba(27,94,32,0.35)" }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(27,94,32,0.2)" }}>
                  <FileSpreadsheet className="w-6 h-6" style={{ color: "#4CAF50" }} />
                </div>
                <p className="font-bold text-sm" style={{ color: "#4CAF50" }}>تصدير Excel</p>
                <p className="text-[10px] text-center text-muted-foreground">بنود الفاتورة · الملخص · حسب الحالة</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(27,94,32,0.2)", color: "#4CAF50" }}>xlsx.</span>
              </button>
            </div>

            {/* Footer info */}
            <div className="px-5 pb-4 text-center text-[10px] text-muted-foreground">
              Excel: {order.items.length} بند · PDF: طباعة الفاتورة الرسمية بصيغة A4
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
