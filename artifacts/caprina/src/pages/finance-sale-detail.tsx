import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  ArrowRight, Printer, Package, User, Phone, MapPin,
  Calendar, Hash, CreditCard, Truck, FileSpreadsheet,
  ChevronDown, Check, Pencil, Trash2, X, Save, Receipt,
} from "lucide-react";

// ── نوع الـ Variant ────────────────────────────────────────────────────────
type Variant = {
  id: number; productId: number; productName: string;
  color: string; size: string; sku: string | null;
  totalQuantity: number; reservedQuantity: number; soldQuantity: number;
  unitPrice: string; costPrice: string | null;
};
type Product = { id: number; name: string };
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

// ── الألوان الموحدة: ذهبي + رمادي فقط ──────────────────────────────────────
const GOLD       = "hsl(43,74%,50%)";
const GOLD_DIM   = "rgba(201,162,39,0.12)";
const GOLD_BORDER= "rgba(201,162,39,0.35)";
const GOLD_GLOW  = "rgba(201,162,39,0.18)";
const RED        = "#EF5350";
const RED_DIM    = "rgba(239,83,80,0.12)";
const RED_BORDER = "rgba(239,83,80,0.3)";
const GREEN      = "#4CAF50";
const GREEN_DIM  = "rgba(76,175,80,0.12)";
const GREEN_BORDER="rgba(76,175,80,0.3)";

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: "قيد التجهيز",  bg: GOLD_DIM,   color: GOLD  },
  confirmed:  { label: "قيد التجهيز",  bg: GOLD_DIM,   color: GOLD  },
  processing: { label: "قيد التجهيز",  bg: GOLD_DIM,   color: GOLD  },
  delivered:  { label: "قيد التجهيز",  bg: GOLD_DIM,   color: GOLD  },
  closed:     { label: "تم التسليم ✓", bg: GREEN_DIM,  color: GREEN },
  cancelled:  { label: "ملغي",         bg: RED_DIM,    color: RED   },
};
const PAY_MAP: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",     color: RED   },
  partial: { label: "مدفوع جزئياً",  color: GOLD  },
  paid:    { label: "مدفوع بالكامل", color: GREEN },
};

const fmtNum  = (n: string | number) => Number(n).toLocaleString("ar-EG");
const fmtDate = (d: string | null)   => d
  ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—";

// ── تصدير Excel ──────────────────────────────────────────────────────────
async function exportToExcel(order: SaleOrder) {
  const fmtDate2 = (d: string | null) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";
  const total    = parseFloat(order.totalAmount    ?? "0");
  const paid     = parseFloat(order.paidAmount     ?? "0");
  const discount = parseFloat(order.discountAmount ?? "0");
  const shipping = parseFloat(order.shippingCost   ?? "0");
  const due      = total - paid;
  const info: (string|number)[][] = [
    ["رقم الفاتورة",  order.soNumber],
    ["اسم العميل",   order.clientName],
    ["هاتف العميل",  order.clientPhone ?? "—"],
    ["عنوان العميل", order.clientAddress ?? "—"],
    ["حالة الأمر",   STATUS_MAP[order.status]?.label ?? order.status],
    ["حالة الدفع",   PAY_MAP[order.paymentStatus]?.label ?? order.paymentStatus],
    ["تاريخ الإنشاء", fmtDate2(order.createdAt)],
    ["عدد المنتجات", order.items.length],
    ["إجمالي القطع", order.items.reduce((s,i)=>s+i.quantity,0)],
    ["الإجمالي الكلي",  total],
    ["المدفوع",      paid],
    ["المتبقي",      due > 0 ? due : "مسدد بالكامل ✓"],
    ...(discount > 0 ? [["الخصم", discount]] : []),
    ...(shipping > 0 ? [["رسوم الشحن", shipping]] : []),
    ...(order.notes  ? [["ملاحظات", order.notes]] : []),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([["البيان", "القيمة"], ...info]);
  ws1["!cols"] = [{ wch: 28 }, { wch: 36 }];
  const itemRows = order.items.map((it, i) => [
    i + 1, it.productName ?? "—", it.color ?? "—", it.size ?? "—",
    it.quantity, Number(it.unitPrice), it.quantity * Number(it.unitPrice),
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
      <td>${it.color ?? "—"}</td><td>${it.size ?? "—"}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:center">${fmtNum(it.unitPrice)} ج</td>
      <td style="text-align:center;font-weight:600">${fmtNum(it.quantity * Number(it.unitPrice))} ج</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<title>فاتورة ${order.soNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:28px;color:#222;font-size:13px;background:#f8f6f0}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid hsl(43,74%,50%);padding-bottom:16px;margin-bottom:20px}
  .brand{font-size:26px;font-weight:900;color:hsl(43,74%,50%);letter-spacing:3px}
  .brand-sub{font-size:11px;color:#888;margin-top:2px}
  .stats{display:flex;gap:12px;margin-bottom:20px}
  .stat-box{flex:1;border:1px solid rgba(201,162,39,0.3);border-radius:10px;padding:10px 14px;text-align:center;background:#fff}
  .stat-val{font-size:20px;font-weight:800;color:hsl(43,74%,50%)}
  .stat-lbl{font-size:10px;color:#888;margin-top:2px}
  .client-section{background:#fffdf5;border:1px solid rgba(201,162,39,0.25);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  thead th{background:hsl(43,74%,50%);color:#0a0a0a;padding:9px 10px;font-size:12px;text-align:right}
  tbody tr{border-bottom:1px solid #f0f0f0}
  tbody tr:nth-child(even){background:#fffdf5}
  tbody td{padding:8px 10px;font-size:12px}
  .totals-box{border:1px solid rgba(201,162,39,0.3);border-radius:10px;padding:14px 20px;min-width:260px;background:#fffdf5;margin-bottom:20px}
  .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
  .totals-row.grand{border-top:2px solid hsl(43,74%,50%);margin-top:6px;padding-top:8px;font-weight:800;font-size:16px;color:hsl(43,74%,50%)}
  .footer{display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:16px;margin-top:20px}
  .sig-line{width:160px;border-bottom:1px solid #aaa;margin:40px auto 6px}
  .sig-lbl{font-size:11px;color:#888;text-align:center}
  @media print{@page{size:A4;margin:15mm}}
</style></head><body>
<div class="header">
  <div><div class="brand">CAPRINA</div><div class="brand-sub">فاتورة بيع — SALE ORDER</div></div>
  <div style="text-align:left;font-size:12px;color:#666">
    <div style="font-size:15px;font-weight:700">${order.soNumber}</div>
    <div>تاريخ الإنشاء: ${fmtDate(order.createdAt)}</div>
    <div>طبع: ${new Date().toLocaleDateString("ar-EG")}</div>
    <div style="margin-top:4px;display:inline-block;padding:3px 14px;border-radius:999px;font-size:11px;font-weight:700;background:${statusInfo.bg};color:${statusInfo.color}">${statusInfo.label}</div>
  </div>
</div>
<div class="stats">
  <div class="stat-box"><div class="stat-val">${order.items.length}</div><div class="stat-lbl">عدد المنتجات</div></div>
  <div class="stat-box"><div class="stat-val">${order.items.reduce((s,i)=>s+i.quantity,0)}</div><div class="stat-lbl">إجمالي القطع</div></div>
  <div class="stat-box"><div class="stat-val" style="color:${PAY_MAP[order.paymentStatus]?.color??'#333'}">${payInfo.label}</div><div class="stat-lbl">حالة الدفع</div></div>
  <div class="stat-box"><div class="stat-val">${fmtNum(total)} ج</div><div class="stat-lbl">إجمالي الفاتورة</div></div>
</div>
<div class="client-section">
  <div style="font-size:12px"><span style="color:#888;margin-left:4px">العميل:</span><strong>${order.clientName}</strong></div>
  ${order.clientPhone?`<div style="font-size:12px"><span style="color:#888;margin-left:4px">الهاتف:</span><strong>${order.clientPhone}</strong></div>`:""}
  ${order.clientAddress?`<div style="font-size:12px"><span style="color:#888;margin-left:4px">العنوان:</span><strong>${order.clientAddress}</strong></div>`:""}
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
${order.notes?`<div style="background:#fffdf5;border:1px solid rgba(201,162,39,0.3);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:20px"><strong>ملاحظات:</strong> ${order.notes}</div>`:""}
<div class="footer">
  <div><div class="sig-line"></div><div class="sig-lbl">توقيع المندوب — الاسم: ___________</div></div>
  <div><div class="sig-line"></div><div class="sig-lbl">توقيع المسؤول — الاسم: ___________</div></div>
</div>
</body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none";
  document.body.appendChild(iframe);
  const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iDoc) {
    iDoc.open(); iDoc.write(html); iDoc.close();
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1500); }, 500);
  }
}

// ── Dropdown مشترك ──────────────────────────────────────────────────────────
function QuickChangeDropdown({ label, options, current, onSelect, disabled, darkMode }: {
  label: string; options: { value: string; label: string; color?: string }[];
  current: string; onSelect: (v: string) => void; disabled?: boolean; darkMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentOpt = options.find(o => o.value === current);
  return (
    <div className="relative">
      <button disabled={disabled} onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:opacity-80"
        style={{ background: "transparent", borderColor: GOLD, color: GOLD, opacity: disabled ? 0.5 : 1 }}>
        {label}: {currentOpt?.label ?? current}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 rounded-xl border shadow-xl overflow-hidden z-50"
            style={{ minWidth: 180, background: "#1a1a1a", borderColor: "#333" }}>
            {options.map(opt => (
              <button key={opt.value}
                className="w-full text-right px-4 py-2.5 text-sm flex items-center justify-between transition-colors"
                style={{ color: opt.color ?? "#ccc", background: opt.value === current ? "#ffffff0d" : "transparent" }}
                onClick={() => { onSelect(opt.value); setOpen(false); }}>
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
  const [allVariants, setAllVariants] = useState<Variant[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  useEffect(() => {
    apiFetch<Variant[]>("/variants").then(d => setAllVariants(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch<Product[]>("/products").then(d => setAllProducts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const variantsOf   = (pid: string) => allVariants.filter(v => String(v.productId) === pid);
  const colorsOf     = (pid: string) => [...new Set(variantsOf(pid).map(v => v.color).filter(Boolean))];
  const sizesOf      = (pid: string, color: string) => variantsOf(pid).filter(v => v.color === color).map(v => v.size).filter(Boolean);
  const matchVariant = (pid: string, color: string, size: string) => variantsOf(pid).find(v => v.color === color && v.size === size);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editProductId, setEditProductId] = useState<string>("");
  const [editQty,       setEditQty]       = useState<number>(1);
  const [editPrice,     setEditPrice]     = useState<number>(0);
  const [editName,      setEditName]      = useState<string>("");
  const [editColor,     setEditColor]     = useState<string>("");
  const [editSize,      setEditSize]      = useState<string>("");
  const [itemSaving,    setItemSaving]    = useState(false);
  const [deleteConfirmId,   setDeleteConfirmId]   = useState<number | null>(null);
  const [showDeleteInvoice, setShowDeleteInvoice] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  const [showAddItem,  setShowAddItem]  = useState(false);
  const [addProductId, setAddProductId] = useState<string>("");
  const [addColor,     setAddColor]     = useState<string>("");
  const [addSize,      setAddSize]      = useState<string>("");
  const [addQty,       setAddQty]       = useState<number>(1);
  const [addPrice,     setAddPrice]     = useState<number>(0);
  const [addSaving,    setAddSaving]    = useState(false);
  const handleAddProduct = (pid: string) => {
    const colors = colorsOf(pid); const color = colors[0] ?? "";
    const sizes = color ? sizesOf(pid, color) : []; const size = sizes[0] ?? "";
    const v = color && size ? matchVariant(pid, color, size) : undefined;
    setAddProductId(pid); setAddColor(color); setAddSize(size);
    if (v) setAddPrice(parseFloat(v.unitPrice)); else setAddPrice(0);
  };
  const handleAddColor = (color: string) => {
    const sizes = sizesOf(addProductId, color); const size = sizes[0] ?? "";
    const v = size ? matchVariant(addProductId, color, size) : undefined;
    setAddColor(color); setAddSize(size); if (v) setAddPrice(parseFloat(v.unitPrice));
  };
  const handleAddSize = (size: string) => {
    const v = matchVariant(addProductId, addColor, size); setAddSize(size);
    if (v) setAddPrice(parseFloat(v.unitPrice));
  };
  const handleSaveAddItem = async () => {
    if (!order || !addProductId || !addColor || !addSize || addQty < 1) return;
    const v = matchVariant(addProductId, addColor, addSize); if (!v) return;
    setAddSaving(true);
    try {
      const updated = await apiFetch<SaleOrder>(`/finance/sale-orders/${order.id}/items`, {
        method: "POST", body: JSON.stringify({ variantId: v.id, quantity: addQty, unitPrice: addPrice }),
      });
      setOrder(updated); setShowAddItem(false);
      setAddProductId(""); setAddColor(""); setAddSize(""); setAddQty(1); setAddPrice(0);
    } catch (e: any) { alert("خطأ: " + e.message); } finally { setAddSaving(false); }
  };
  const handleEditProduct = (pid: string) => {
    const p = allProducts.find(x => String(x.id) === pid);
    const colors = colorsOf(pid); const color = colors[0] ?? "";
    const sizes = color ? sizesOf(pid, color) : []; const size = sizes[0] ?? "";
    const v = color && size ? matchVariant(pid, color, size) : undefined;
    setEditProductId(pid); setEditName(p?.name ?? ""); setEditColor(color); setEditSize(size);
    if (v) setEditPrice(parseFloat(v.unitPrice));
  };
  const handleEditColor = (color: string) => {
    const sizes = sizesOf(editProductId, color); const size = sizes[0] ?? "";
    const v = size ? matchVariant(editProductId, color, size) : undefined;
    setEditColor(color); setEditSize(size); if (v) setEditPrice(parseFloat(v.unitPrice));
  };
  const handleEditSize = (size: string) => {
    const v = matchVariant(editProductId, editColor, size); setEditSize(size);
    if (v) setEditPrice(parseFloat(v.unitPrice));
  };
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState<string>("");
  const handleClose = async () => {
    if (!order) return; setClosing(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
      setOrder(prev => prev ? { ...prev, status: "closed" } : prev); setShowConfirm(false);
    } catch (e: any) { alert("حدث خطأ: " + e.message); } finally { setClosing(false); }
  };
  const handleStatusChange = async (field: "status" | "paymentStatus", value: string) => {
    if (!order) return;
    if (field === "status" && value === "closed") { setShowConfirm(true); return; }
    if (field === "paymentStatus" && value === "partial") {
      setPartialAmount(order.paidAmount && Number(order.paidAmount) > 0 ? order.paidAmount : "");
      setShowPartialModal(true); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value }) });
      setOrder(prev => prev ? { ...prev, [field]: value } : prev);
    } catch (e: any) { alert("حدث خطأ: " + e.message); } finally { setSaving(false); }
  };
  const handleSavePartial = async () => {
    if (!order) return;
    const amount = parseFloat(partialAmount); const total = parseFloat(order.totalAmount);
    if (isNaN(amount) || amount <= 0) { alert("أدخل مبلغاً صحيحاً"); return; }
    if (amount >= total) { alert("المبلغ أكبر من أو يساوي الإجمالي، استخدم «مدفوع بالكامل»"); return; }
    setSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ paymentStatus: "partial", paidAmount: String(amount) }) });
      setOrder(prev => prev ? { ...prev, paymentStatus: "partial", paidAmount: String(amount) } : prev);
      setShowPartialModal(false); setPartialAmount("");
    } catch (e: any) { alert("حدث خطأ: " + e.message); } finally { setSaving(false); }
  };
  const startEditItem = (it: SaleItem) => {
    const v = allVariants.find(x => x.color === it.color && x.size === it.size && x.productName?.toLowerCase() === it.productName?.toLowerCase());
    const pid = v ? String(v.productId) : "";
    setEditingItemId(it.id); setEditProductId(pid); setEditQty(it.quantity);
    setEditPrice(Number(it.unitPrice)); setEditName(it.productName);
    setEditColor(it.color ?? ""); setEditSize(it.size ?? "");
  };
  const saveEditItem = async () => {
    if (!order || editingItemId === null) return; setItemSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}/items/${editingItemId}`, {
        method: "PATCH", body: JSON.stringify({ productName: editName, color: editColor || null, size: editSize || null, quantity: editQty, unitPrice: editPrice }),
      });
      const newTotal = order.items.reduce((sum, it) => {
        if (it.id === editingItemId) return sum + editQty * editPrice;
        return sum + it.quantity * Number(it.unitPrice);
      }, 0);
      setOrder(prev => prev ? { ...prev, totalAmount: String(newTotal), items: prev.items.map(it => it.id === editingItemId ? { ...it, productName: editName, color: editColor, size: editSize, quantity: editQty, unitPrice: String(editPrice) } : it) } : prev);
      setEditingItemId(null);
    } catch (e: any) { alert("خطأ في التعديل: " + e.message); } finally { setItemSaving(false); }
  };
  const deleteItem = async (itemId: number) => {
    if (!order) return; setItemSaving(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}/items/${itemId}`, { method: "DELETE" });
      const remaining = order.items.filter(it => it.id !== itemId);
      const newTotal  = remaining.reduce((sum, it) => sum + it.quantity * Number(it.unitPrice), 0);
      setOrder(prev => prev ? { ...prev, totalAmount: String(newTotal), items: remaining } : prev);
      setDeleteConfirmId(null);
    } catch (e: any) { alert("خطأ في الحذف: " + e.message); } finally { setItemSaving(false); }
  };
  const handleDeleteInvoice = async () => {
    if (!order) return; setIsDeletingInvoice(true);
    try {
      await apiFetch(`/finance/sale-orders/${order.id}`, { method: "DELETE" });
      navigate("/finance/sales");
    } catch (e: any) { alert("خطأ في حذف الفاتورة: " + e.message); }
    finally { setIsDeletingInvoice(false); setShowDeleteInvoice(false); }
  };
  useEffect(() => {
    if (!params.id) return; setLoading(true);
    apiFetch<SaleOrder>(`/finance/sale-orders/${params.id}`)
      .then(data => { setOrder(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [params.id]);
  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">جاري التحميل…</div>;
  if (error || !order) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-destructive text-sm">{error ?? "لم يُعثر على الأمر"}</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/finance/sales")}>رجوع</Button>
    </div>
  );
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, bg: "#eee", color: "#555" };
  const payInfo    = PAY_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: "#555" };
  const total    = parseFloat(order.totalAmount   ?? "0");
  const paid     = order.paymentStatus === "paid" ? total : parseFloat(order.paidAmount ?? "0");
  const discount = parseFloat(order.discountAmount?? "0");
  const shipping = parseFloat(order.shippingCost  ?? "0");
  const due      = order.paymentStatus === "paid" ? 0 : Math.max(0, total - paid);
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const statusOptions = Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label, color: v.color }));
  const payOptions    = Object.entries(PAY_MAP).map(([k, v]) => ({ value: k, label: v.label, color: v.color }));

  // ── الـ JSX الرئيسي ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8" style={{ background: "hsl(var(--background))" }} dir="rtl">

      {/* TOP BAR */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2 sm:gap-3">
        <button onClick={() => navigate("/finance/sales")}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium hover:opacity-70 transition-opacity"
          style={{ color: GOLD }}>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> العودة لفواتير البيع
        </button>
        <div className="flex items-center flex-wrap rounded-xl"
          style={{ background: "#111", border: "1px solid #2a2a2a", padding: "4px 6px", gap: "4px" }}>
          <button onClick={() => printManifestPDF(order)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-80"
            style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD }}>
            <Printer className="w-3.5 h-3.5" /> طباعة
          </button>
          <button onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-80"
            style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD }}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> تصدير ↓
          </button>
          {order.status !== "closed" && order.status !== "cancelled" && (
            <button onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-80"
              style={{ background: "transparent", border: `1px solid ${GREEN}`, color: GREEN }}>
              🔒 إغلاق الفاتورة
            </button>
          )}
          {order.status !== "closed" && (
            <QuickChangeDropdown label="الدفع" options={payOptions} current={order.paymentStatus}
              onSelect={v => handleStatusChange("paymentStatus", v)} disabled={saving} darkMode />
          )}
          {order.status === "closed" ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border: `1px solid ${GREEN}`, color: GREEN, background: "transparent" }}>✓ تم التسليم</span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "transparent" }}>{statusInfo.label}</span>
          )}
          <div style={{ width: "1px", height: "20px", background: "#333", margin: "0 2px" }} />
          <button onClick={() => setShowDeleteInvoice(true)}
            className="flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all duration-200"
            style={{ background: "transparent", border: `1px solid ${RED_BORDER}`, color: "rgba(239,83,80,0.5)", padding: "6px 10px" }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = RED_DIM; b.style.borderColor = RED; b.style.color = RED; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.borderColor = RED_BORDER; b.style.color = "rgba(239,83,80,0.5)"; }}>
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </button>
        </div>
      </div>

      {/* HEADER CARD */}
      <div className="rounded-2xl border p-4 sm:p-5 mb-4 sm:mb-5" style={{ borderColor: GOLD_BORDER, background: "hsl(var(--card))" }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="text-xl sm:text-2xl font-black tracking-widest mb-1" style={{ color: GOLD }}>CAPRINA</div>
            <div className="text-xs text-muted-foreground mb-2">فاتورة بيع — SALE ORDER</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm font-bold">
                <Hash className="w-4 h-4 text-muted-foreground" /> {order.soNumber}
              </span>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold" style={{ background: statusInfo.bg, color: statusInfo.color }}>{statusInfo.label}</span>
              <span className="text-xs font-bold" style={{ color: payInfo.color }}>{payInfo.label}</span>
            </div>
          </div>
          <div className="text-right sm:text-left text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 sm:justify-end"><Calendar className="w-3 h-3" /> تاريخ الإنشاء: {fmtDate(order.createdAt)}</div>
            {order.expectedDate && <div className="flex items-center gap-1 sm:justify-end"><Truck className="w-3 h-3" /> تاريخ التسليم المتوقع: {fmtDate(order.expectedDate)}</div>}
            {order.deliveredAt  && <div className="flex items-center gap-1 sm:justify-end"><Package className="w-3 h-3" /> تسليم فعلي: {fmtDate(order.deliveredAt)}</div>}
          </div>
        </div>
      </div>

      {/* STATS — لونين فقط: ذهبي + رمادي */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "عدد المنتجات",   val: String(order.items.length), gold: true },
          { label: "إجمالي القطع",   val: String(totalQty),           gold: true },
          { label: "إجمالي الفاتورة", val: `${fmtNum(total)} ج`,      gold: true },
          { label: due > 0 ? "المتبقي" : "الحالة", val: due > 0 ? `${fmtNum(due)} ج` : "✓ مسدد", gold: due === 0, red: due > 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{
            background: s.red ? RED_DIM : GOLD_DIM,
            border: `1px solid ${s.red ? RED_BORDER : GOLD_BORDER}`,
          }}>
            <div className="text-xl font-extrabold mb-0.5" style={{ color: s.red ? RED : GOLD }}>{s.val}</div>
            <div className="text-xs font-semibold" style={{ color: s.red ? "rgba(239,83,80,0.7)" : "rgba(201,162,39,0.7)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* PROFIT ANALYSIS — ذهبي فقط للعناوين */}
      {(() => {
        const revenue = parseFloat(order.totalAmount ?? "0");
        const ship    = parseFloat(order.shippingCost ?? "0");
        const cogs = order.items.reduce((sum, item) => {
          const v = allVariants.find(v => v.productName === item.productName && v.color === item.color && v.size === item.size);
          return sum + (v?.costPrice ? parseFloat(v.costPrice) : 0) * item.quantity;
        }, 0);
        const netProfit = revenue - cogs - ship;
        const profitPct = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0";
        return (
          <div className="mb-4 sm:mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: GOLD, fontSize: 15 }}>📊</span>
              <h2 className="font-bold text-sm">تحليل الأرباح</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-2 sm:mb-3">
              {[
                { label: "إجمالي الإيرادات", val: `${fmtNum(revenue)} ج` },
                { label: "تكلفة الشحن",      val: ship > 0 ? `${fmtNum(ship)} ج` : "-- ج" },
                { label: "تكلفة البضاعة",    val: cogs > 0 ? `${fmtNum(cogs)} ج` : "-- ج" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}>
                  <p className="text-[10px] mb-1 text-right" style={{ color: "rgba(201,162,39,0.6)" }}>{s.label}</p>
                  <p className="text-lg font-black text-right" style={{ color: GOLD }}>{s.val}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-4" style={{
              background: netProfit >= 0 ? GREEN_DIM : RED_DIM,
              border: `1px solid ${netProfit >= 0 ? GREEN_BORDER : RED_BORDER}`,
            }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: netProfit >= 0 ? "rgba(76,175,80,0.7)" : "rgba(239,83,80,0.7)" }}>صافي الربح</p>
                <span style={{ fontSize: 18, color: netProfit >= 0 ? GREEN : RED }}>{netProfit >= 0 ? "↗" : "↘"}</span>
              </div>
              <p className="text-2xl font-black text-right mt-1" style={{ color: netProfit >= 0 ? GREEN : RED }}>
                {cogs > 0 ? `${fmtNum(Math.abs(netProfit))} ج` : "-- ج"}
              </p>
              {cogs > 0 && <p className="text-[10px] text-right mt-0.5" style={{ color: netProfit >= 0 ? "rgba(76,175,80,0.7)" : "rgba(239,83,80,0.7)" }}>
                {netProfit >= 0 ? "▲" : "▼"} {profitPct}% من الإيرادات
              </p>}
            </div>
          </div>
        );
      })()}

      {/* SETTLEMENT CARD — ذهبي فقط */}
      <div className="rounded-xl border p-4 sm:p-5 mb-4 sm:mb-5" style={{ borderColor: GOLD_BORDER, background: GOLD_DIM }}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4" style={{ color: GOLD }} />
          <h2 className="font-bold text-xs sm:text-sm">بيان التسوية — ملخص الفاتورة المالي</h2>
          {order.status === "closed" && (
            <span className="mr-auto text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ borderColor: GREEN, color: GREEN, background: GREEN_DIM }}>مُغلق ✓</span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الفاتورة", val: `${fmtNum(total)} ج`, sub: `${order.items.length} صنف · ${totalQty} قطعة` },
            { label: "المحصَّل",         val: `${fmtNum(paid)} ج`,  sub: payInfo.label, subColor: payInfo.color },
            { label: "باقي التسوية",     val: due > 0 ? `${fmtNum(due)} ج` : "✓ مسدد", sub: "إجمالي − محصَّل", red: due > 0 },
            { label: "موعد التسليم",     val: fmtDate(order.expectedDate), sub: order.deliveredAt ? `سُلِّم ${fmtDate(order.deliveredAt)}` : "لم يُسلَّم بعد" },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: s.red ? RED_DIM : "rgba(0,0,0,0.15)", border: `1px solid ${s.red ? RED_BORDER : GOLD_BORDER}` }}>
              <p className="text-[10px] mb-1" style={{ color: s.red ? "rgba(239,83,80,0.6)" : "rgba(201,162,39,0.6)" }}>{s.label}</p>
              <p className="text-base font-black" style={{ color: s.red ? RED : GOLD }}>{s.val}</p>
              <p className="text-[10px]" style={{ color: s.subColor ?? (s.red ? "rgba(239,83,80,0.5)" : "rgba(201,162,39,0.5)") }}>{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: GOLD_BORDER, background: "rgba(0,0,0,0.15)" }}>
          <div>
            <p className="text-xs text-muted-foreground">صافي الإجمالي الفعلي</p>
            <p className="text-[10px] text-muted-foreground">ج {fmtNum(total)} إجمالي{discount > 0 ? ` − ${fmtNum(discount)} ج خصم` : ""}{shipping > 0 ? ` + ${fmtNum(shipping)} ج شحن` : ""}</p>
          </div>
          <p className="text-lg font-black" style={{ color: GOLD }}>{fmtNum(total)} ج</p>
        </div>
      </div>

      {/* CLIENT INFO */}
      <div className="rounded-xl border p-3 sm:p-4 mb-4 sm:mb-5 flex flex-wrap gap-2 sm:gap-4"
        style={{ borderColor: GOLD_BORDER, background: "hsl(var(--card))" }}>
        <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground text-xs">العميل:</span>
          <span className="font-bold truncate">{order.clientName}</span>
        </div>
        {order.clientPhone && (
          <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">الهاتف:</span>
            <span className="font-semibold" dir="ltr">{order.clientPhone}</span>
          </div>
        )}
        {order.clientAddress && (
          <div className="flex items-center gap-2 text-sm w-full sm:w-auto">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground text-xs">العنوان:</span>
            <span className="font-semibold">{order.clientAddress}</span>
          </div>
        )}
      </div>

      {/* ITEMS TABLE */}
      <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-bold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          الطلبيات في الفاتورة
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
            {order.items.length} صنف · {totalQty} قطعة
          </span>
        </h2>
        <button onClick={() => { setShowAddItem(true); setAddProductId(""); setAddColor(""); setAddSize(""); setAddQty(1); setAddPrice(0); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
          style={{ background: GOLD_DIM, border: `1px solid ${GOLD}`, color: GOLD }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>+</span> إضافة صنف
        </button>
      </div>
      <div className="rounded-xl border overflow-x-auto mb-5" style={{ borderColor: GOLD_BORDER }}>
        <table className="w-full text-sm min-w-[540px]">
          <thead>
            <tr style={{ background: GOLD }}>
              {["#","المنتج","اللون","المقاس","الكمية","سعر الوحدة","الإجمالي",""].map((h,idx) => (
                <th key={idx} className="text-right py-2.5 px-3 text-xs font-bold" style={{ color: "#0a0a0a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => {
              const isEditing = editingItemId === it.id;
              return (
                <tr key={it.id} style={{ background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted)/0.3)", borderBottom: "1px solid hsl(var(--border))" }}>
                  <td className="py-2 px-3 text-muted-foreground text-xs w-8">{i + 1}</td>
                  <td className="py-2 px-3 font-semibold min-w-[160px]">
                    {isEditing ? (
                      <select className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: GOLD, color: "hsl(var(--foreground))" }}
                        value={editProductId} onChange={e => handleEditProduct(e.target.value)}>
                        <option value="">— اختر منتج —</option>
                        {allProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                      </select>
                    ) : it.productName ?? "—"}
                  </td>
                  <td className="py-2 px-3 min-w-[110px]">
                    {isEditing ? (
                      <select className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: GOLD, color: "hsl(var(--foreground))" }}
                        value={editColor} disabled={!editProductId} onChange={e => handleEditColor(e.target.value)}>
                        <option value="">— لون —</option>
                        {colorsOf(editProductId).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : it.color ?? "—"}
                  </td>
                  <td className="py-2 px-3 min-w-[90px]">
                    {isEditing ? (
                      <select className="border rounded px-2 py-1 text-xs w-full"
                        style={{ background: "hsl(var(--background))", borderColor: GOLD, color: "hsl(var(--foreground))" }}
                        value={editSize} disabled={!editColor} onChange={e => handleEditSize(e.target.value)}>
                        <option value="">— مقاس —</option>
                        {sizesOf(editProductId, editColor).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : it.size ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-center font-bold">
                    {isEditing
                      ? <input type="number" min={1} className="border rounded px-2 py-1 text-xs w-16 text-center" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} value={editQty} onChange={e => setEditQty(Number(e.target.value) || 1)} onFocus={e => e.target.select()} />
                      : it.quantity}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {isEditing
                      ? <input type="number" min={0} className="border rounded px-2 py-1 text-xs w-20 text-center" style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }} value={editPrice} onChange={e => setEditPrice(Number(e.target.value) || 0)} onFocus={e => e.target.select()} />
                      : `${fmtNum(it.unitPrice)} ج`}
                  </td>
                  <td className="py-2 px-3 text-center font-bold" style={{ color: GOLD }}>
                    {isEditing ? `${fmtNum(editQty * editPrice)} ج` : `${fmtNum(it.quantity * Number(it.unitPrice))} ج`}
                  </td>
                  <td className="py-2 px-2 text-center whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={saveEditItem} disabled={itemSaving}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold hover:opacity-85"
                          style={{ background: GOLD, color: "#0a0a0a" }}>
                          <Save className="w-3 h-3" />{itemSaving ? "…" : "حفظ"}
                        </button>
                        <button onClick={() => setEditingItemId(null)} disabled={itemSaving}
                          className="px-2 py-1 rounded text-xs border hover:bg-muted/40" style={{ borderColor: "hsl(var(--border))" }}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEditItem(it)} className="p-1.5 rounded hover:bg-muted/40" style={{ color: GOLD }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteConfirmId(it.id)} className="p-1.5 rounded hover:bg-rose-500/10" style={{ color: RED }}>
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

      {/* TOTALS */}
      <div className="flex justify-start mb-5">
        <div className="rounded-xl border p-4 min-w-64" style={{ borderColor: GOLD_BORDER, background: "hsl(var(--card))" }}>
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
          <div className="flex justify-between pt-2 mt-2 border-t text-base font-extrabold" style={{ color: GOLD, borderColor: GOLD }}>
            <span>الإجمالي الكلي</span><span>{fmtNum(total)} ج</span>
          </div>
          <div className="flex justify-between text-sm py-1" style={{ color: GREEN }}>
            <span>المدفوع</span><span className="font-bold">{fmtNum(paid)} ج</span>
          </div>
          {due > 0 && (
            <div className="flex justify-between text-sm py-1" style={{ color: RED }}>
              <span>المتبقي</span><span className="font-bold">{fmtNum(due)} ج</span>
            </div>
          )}
        </div>
      </div>

      {order.notes && (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground mb-4" style={{ borderColor: GOLD_BORDER, background: GOLD_DIM }}>
          <strong className="text-foreground">ملاحظات: </strong>{order.notes}
        </div>
      )}
      <div className="text-center text-xs text-muted-foreground mt-8 pb-4">CAPRINA · {order.soNumber} · {new Date().getFullYear()}</div>

      {/* DIALOGS */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: GOLD_DIM }}>
                <span style={{ fontSize: 28 }}>🔒</span>
              </div>
              <h3 className="text-base font-bold mb-1">إغلاق الفاتورة</h3>
              <p className="text-sm text-muted-foreground">سيتم إغلاق <strong>{order.soNumber}</strong> وتحويل <strong style={{ color: GOLD }}>{fmtNum(total)} ج</strong> للخزينة.</p>
              <p className="text-xs text-muted-foreground mt-2">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} disabled={closing} className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70" style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={handleClose} disabled={closing} className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-85" style={{ background: GOLD, color: "#0a0a0a" }}>{closing ? "جارٍ…" : "تأكيد الإغلاق"}</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: RED_DIM }}>
                <Trash2 className="w-7 h-7" style={{ color: RED }} />
              </div>
              <h3 className="text-base font-bold mb-1">حذف الفاتورة</h3>
              <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف فاتورة <strong>{order.soNumber}</strong>؟</p>
              <p className="text-xs text-muted-foreground mt-1">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteInvoice(false)} disabled={isDeletingInvoice} className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70" style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={handleDeleteInvoice} disabled={isDeletingInvoice} className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-85" style={{ background: "#B71C1C", color: "#ffd5d5" }}>{isDeletingInvoice ? "جارٍ الحذف…" : "نعم، احذف"}</button>
            </div>
          </div>
        </div>
      )}
      {showPartialModal && order && (() => {
        const tot = parseFloat(order.totalAmount); const paidVal = parseFloat(partialAmount) || 0;
        const remaining = tot - paidVal; const isValid = paidVal > 0 && paidVal < tot;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl" style={{ background: "hsl(var(--card))" }} dir="rtl">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: GOLD_DIM }}><span style={{ fontSize: 26 }}>💰</span></div>
                <h3 className="text-base font-bold mb-1">دفع جزئي</h3>
                <p className="text-xs text-muted-foreground">إجمالي الفاتورة: <strong style={{ color: GOLD }}>{fmtNum(tot)} ج</strong></p>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">المبلغ المدفوع (ج)</label>
                <input type="number" min={1} max={tot - 1} value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm font-bold text-center outline-none"
                  style={{ borderColor: isValid ? GOLD : "hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                  autoFocus onKeyDown={e => { if (e.key === "Enter" && isValid) handleSavePartial(); }} />
              </div>
              <div className="rounded-xl p-3 mb-5 flex justify-between items-center text-sm"
                style={{ background: remaining > 0 && isValid ? GOLD_DIM : "hsl(var(--muted))", border: `1px solid ${remaining > 0 && isValid ? GOLD_BORDER : "hsl(var(--border))"}` }}>
                <span className="text-xs text-muted-foreground font-medium">المتبقي:</span>
                <span className="font-extrabold text-base" style={{ color: remaining > 0 && isValid ? GOLD : "hsl(var(--muted-foreground))" }}>{isValid ? `${fmtNum(remaining)} ج` : "—"}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowPartialModal(false); setPartialAmount(""); }} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70" style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
                <button onClick={handleSavePartial} disabled={saving || !isValid} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: isValid ? GOLD : "#555", color: "#0a0a0a", opacity: saving ? 0.6 : 1 }}>{saving ? "جارٍ…" : "حفظ"}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: RED_DIM }}>
                <Trash2 className="w-7 h-7" style={{ color: RED }} />
              </div>
              <h3 className="text-base font-bold mb-1">حذف المنتج</h3>
              <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف <strong>{order.items.find(x => x.id === deleteConfirmId)?.productName}</strong>؟</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)} disabled={itemSaving} className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70" style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={() => deleteItem(deleteConfirmId!)} disabled={itemSaving} className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-85" style={{ background: "#B71C1C", color: "#ffd5d5" }}>{itemSaving ? "جارٍ…" : "تأكيد الحذف"}</button>
            </div>
          </div>
        </div>
      )}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl" style={{ background: "hsl(var(--card))" }} dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: GOLD_DIM }}>
                  <Package className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">إضافة صنف جديد</h3>
                  <p className="text-[10px] text-muted-foreground">إضافة منتج للفاتورة {order.soNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowAddItem(false)} className="p-1.5 rounded-lg hover:bg-muted/40"><X className="w-4 h-4" /></button>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">المنتج</label>
              <select className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{ background: "hsl(var(--background))", borderColor: addProductId ? GOLD : "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                value={addProductId} onChange={e => handleAddProduct(e.target.value)}>
                <option value="">— اختر منتج —</option>
                {allProducts.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: "اللون", val: addColor, disabled: !addProductId, opts: colorsOf(addProductId), onChange: handleAddColor },
                { label: "المقاس", val: addSize, disabled: !addColor, opts: sizesOf(addProductId, addColor), onChange: handleAddSize },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">{f.label}</label>
                  <select className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", opacity: f.disabled ? 0.5 : 1 }}
                    value={f.val} disabled={f.disabled} onChange={e => f.onChange(e.target.value)}>
                    <option value="">— {f.label} —</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "الكمية", val: addQty, min: 1, onChange: (v: number) => setAddQty(Math.max(1, v)) },
                { label: "السعر (ج)", val: addPrice, min: 0, onChange: (v: number) => setAddPrice(v) },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground">{f.label}</label>
                  <input type="number" min={f.min} className="w-full px-3 py-2 rounded-xl border text-sm text-center font-bold outline-none"
                    style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                    value={f.val} onChange={e => f.onChange(Number(e.target.value) || 0)} />
                </div>
              ))}
            </div>
            {addQty > 0 && addPrice > 0 && (
              <div className="rounded-xl p-3 mb-4 flex justify-between items-center" style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}>
                <span className="text-xs text-muted-foreground">الإجمالي:</span>
                <span className="text-base font-black" style={{ color: GOLD }}>{fmtNum(addQty * addPrice)} ج</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowAddItem(false)} disabled={addSaving} className="flex-1 py-2 rounded-lg text-sm font-semibold border hover:opacity-70" style={{ borderColor: "hsl(var(--border))" }}>إلغاء</button>
              <button onClick={handleSaveAddItem} disabled={addSaving || !addProductId || !addColor || !addSize || addQty < 1}
                className="flex-1 py-2 rounded-lg text-sm font-bold"
                style={{ background: (!addProductId || !addColor || !addSize) ? "#555" : GOLD, color: "#0a0a0a", opacity: addSaving ? 0.6 : 1 }}>
                {addSaving ? "جارٍ الإضافة…" : "✓ إضافة الصنف"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EXPORT DIALOG */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setShowExport(false)}>
          <div className="relative rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#2a2a2a" }}>
              <h3 className="font-bold text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" style={{ color: GOLD }} />تصدير البيان — {order.soNumber}</h3>
              <button onClick={() => setShowExport(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <button onClick={() => { printManifestPDF(order); setShowExport(false); }}
                className="rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-105 hover:brightness-110 transition-all"
                style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,83,80,0.2)" }}>
                  <FileSpreadsheet className="w-6 h-6" style={{ color: RED }} />
                </div>
                <p className="font-bold text-sm" style={{ color: RED }}>تصدير PDF</p>
                <p className="text-[10px] text-center text-muted-foreground">بيان رسمي مع الأرقام</p>
              </button>
              <button onClick={() => { exportToExcel(order); setShowExport(false); }}
                className="rounded-xl p-4 flex flex-col items-center gap-2 hover:scale-105 hover:brightness-110 transition-all"
                style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(76,175,80,0.2)" }}>
                  <FileSpreadsheet className="w-6 h-6" style={{ color: GREEN }} />
                </div>
                <p className="font-bold text-sm" style={{ color: GREEN }}>تصدير Excel</p>
                <p className="text-[10px] text-center text-muted-foreground">بنود الفاتورة والملخص</p>
              </button>
            </div>
            <div className="px-5 pb-4 text-center text-[10px] text-muted-foreground">Excel: {order.items.length} بند · PDF: طباعة الفاتورة الرسمية A4</div>
          </div>
        </div>
      )}
    </div>
  );
}
