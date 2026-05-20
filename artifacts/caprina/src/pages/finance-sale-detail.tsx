import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import {
  ArrowRight, Printer, Package, User, Phone, MapPin,
  Calendar, Warehouse, Hash, CreditCard, Truck,
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

// ── ألوان الحالات ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: "مسودة",        bg: "#F5F5F5", color: "#757575" },
  confirmed:  { label: "مؤكد",         bg: "#E3F2FD", color: "#1565C0" },
  processing: { label: "جاري التجهيز", bg: "#FFF8E1", color: "#F57F17" },
  delivered:  { label: "تم التسليم",   bg: "#E8F5E9", color: "#2E7D32" },
  closed:     { label: "مُغلَق",        bg: "#EDE7F6", color: "#4527A0" },
  cancelled:  { label: "ملغي",         bg: "#FFEBEE", color: "#B71C1C" },
};
const PAY_MAP: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع",    color: "#B71C1C" },
  partial: { label: "مدفوع جزئياً", color: "#E65100" },
  paid:    { label: "مدفوع بالكامل",color: "#1B5E20" },
};

const fmtNum  = (n: string | number) => Number(n).toLocaleString("ar-EG");
const fmtDate = (d: string | null)   => d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }) : "—";

// ── طباعة PDF بشكل الـ manifest ────────────────────────────────────────────
function printManifestPDF(order: SaleOrder) {
  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, bg: "#eee", color: "#333" };
  const payInfo    = PAY_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: "#333" };
  const total      = parseFloat(order.totalAmount  ?? "0");
  const paid       = parseFloat(order.paidAmount   ?? "0");
  const discount   = parseFloat(order.discountAmount ?? "0");
  const shipping   = parseFloat(order.shippingCost  ?? "0");
  const due        = total - paid;

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

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة ${order.soNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 28px; color: #222; font-size: 13px; background: #fff; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid hsl(43,74%,50%); padding-bottom: 16px; margin-bottom: 20px; }
  .brand  { font-size: 26px; font-weight: 900; color: hsl(43,74%,50%); letter-spacing: 3px; }
  .brand-sub { font-size: 11px; color: #888; margin-top: 2px; letter-spacing: 1px; }
  .mnf-info   { text-align: left; }
  .mnf-num    { font-size: 15px; font-weight: 700; color: #222; }
  .mnf-date   { font-size: 11px; color: #888; margin-top: 4px; }
  .status-pill { display: inline-block; padding: 3px 14px; border-radius: 999px;
                 font-size: 11px; font-weight: 700; margin-top: 6px;
                 background: ${statusInfo.bg}; color: ${statusInfo.color}; }

  /* ── Stats row ── */
  .stats { display: flex; gap: 12px; margin-bottom: 20px; }
  .stat-box { flex: 1; border: 1px solid #e0f2f1; border-radius: 10px; padding: 10px 14px; text-align: center; background: #f9fffe; }
  .stat-val { font-size: 22px; font-weight: 800; color: hsl(43,74%,50%); }
  .stat-lbl { font-size: 10px; color: #888; margin-top: 2px; }

  /* ── Client info ── */
  .client-section { background: #F5FFFE; border: 1px solid #B2DFDB; border-radius: 10px;
                    padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 28px; flex-wrap: wrap; }
  .client-field   { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .client-label   { color: #888; min-width: 60px; }
  .client-val     { font-weight: 600; color: #222; }

  /* ── Table ── */
  table       { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th    { background: hsl(43,74%,50%); color: #fff; padding: 9px 10px; font-size: 12px; text-align: right; }
  tbody tr    { border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background: #FAFFFE; }
  tbody td    { padding: 8px 10px; font-size: 12px; }

  /* ── Totals ── */
  .totals-section { display: flex; justify-content: flex-start; margin-bottom: 20px; }
  .totals-box     { border: 1px solid #B2DFDB; border-radius: 10px; padding: 14px 20px; min-width: 260px; background: #F5FFFE; }
  .totals-row     { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals-row.grand { border-top: 2px solid hsl(43,74%,50%); margin-top: 6px; padding-top: 8px;
                      font-weight: 800; font-size: 16px; color: hsl(43,74%,50%); }
  .totals-row.due   { color: #B71C1C; font-weight: 700; }
  .totals-row.paid-row { color: #1B5E20; }

  /* ── Notes ── */
  .notes-box { background: #FFFDE7; border: 1px solid #FFF176; border-radius: 8px;
               padding: 10px 14px; font-size: 12px; color: #555; margin-bottom: 20px; }

  /* ── Footer / Signatures ── */
  .footer { display: flex; justify-content: space-between; border-top: 1px solid #ddd;
            padding-top: 16px; margin-top: 10px; }
  .sig-block { text-align: center; }
  .sig-line  { width: 160px; border-bottom: 1px solid #aaa; margin: 40px auto 6px; }
  .sig-lbl   { font-size: 11px; color: #888; }
  .brand-footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; letter-spacing: 1px; }

  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>

<!-- ── HEADER ── -->
<div class="header">
  <div>
    <div class="brand">CAPRINA</div>
    <div class="brand-sub">فاتورة بيع — SALE ORDER</div>
  </div>
  <div class="mnf-info">
    <div class="mnf-num">${order.soNumber}</div>
    <div class="mnf-date">تاريخ الإنشاء: ${fmtDate(order.createdAt)}</div>
    <div class="mnf-date">طبع: ${new Date().toLocaleDateString("ar-EG")}</div>
    <div><span class="status-pill">${statusInfo.label}</span></div>
  </div>
</div>

<!-- ── STATS ── -->
<div class="stats">
  <div class="stat-box">
    <div class="stat-val">${order.items.length}</div>
    <div class="stat-lbl">عدد المنتجات</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${order.items.reduce((s, i) => s + i.quantity, 0)}</div>
    <div class="stat-lbl">إجمالي القطع</div>
  </div>
  <div class="stat-box">
    <div class="stat-val" style="color:${PAY_MAP[order.paymentStatus]?.color ?? '#333'}">${payInfo.label}</div>
    <div class="stat-lbl">حالة الدفع</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${fmtNum(total)} ج</div>
    <div class="stat-lbl">إجمالي الفاتورة</div>
  </div>
</div>

<!-- ── CLIENT ── -->
<div class="client-section">
  <div class="client-field">
    <span class="client-label">العميل:</span>
    <span class="client-val">${order.clientName}</span>
  </div>
  ${order.clientPhone ? `<div class="client-field"><span class="client-label">الهاتف:</span><span class="client-val">${order.clientPhone}</span></div>` : ""}
  ${order.clientAddress ? `<div class="client-field"><span class="client-label">العنوان:</span><span class="client-val">${order.clientAddress}</span></div>` : ""}
  ${order.expectedDate ? `<div class="client-field"><span class="client-label">تاريخ متوقع:</span><span class="client-val">${fmtDate(order.expectedDate)}</span></div>` : ""}
</div>

<!-- ── TABLE ── -->
<table>
  <thead>
    <tr>
      <th style="text-align:center;width:40px">#</th>
      <th>المنتج</th>
      <th>اللون</th>
      <th>المقاس</th>
      <th style="text-align:center">الكمية</th>
      <th style="text-align:center">سعر الوحدة</th>
      <th style="text-align:center">الإجمالي</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<!-- ── TOTALS ── -->
<div class="totals-section">
  <div class="totals-box">
    <div class="totals-row"><span>الإجمالي الفرعي</span><span>${fmtNum(total)} ج</span></div>
    ${discount > 0 ? `<div class="totals-row" style="color:#c62828"><span>الخصم</span><span>- ${fmtNum(discount)} ج</span></div>` : ""}
    ${shipping > 0 ? `<div class="totals-row"><span>رسوم الشحن</span><span>${fmtNum(shipping)} ج</span></div>` : ""}
    <div class="totals-row grand"><span>الإجمالي الكلي</span><span>${fmtNum(total)} ج</span></div>
    <div class="totals-row paid-row"><span>المدفوع</span><span>${fmtNum(paid)} ج</span></div>
    ${due > 0 ? `<div class="totals-row due"><span>المتبقي</span><span>${fmtNum(due)} ج</span></div>` : ""}
  </div>
</div>

${order.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${order.notes}</div>` : ""}

<!-- ── SIGNATURES ── -->
<div class="footer">
  <div class="sig-block">
    <div class="sig-line"></div>
    <div class="sig-lbl">توقيع المندوب — الاسم: ___________</div>
  </div>
  <div class="sig-block">
    <div class="sig-line"></div>
    <div class="sig-lbl">توقيع المسؤول — الاسم: ___________</div>
  </div>
</div>

<div class="brand-footer">CAPRINA · ${order.soNumber} · ${new Date().getFullYear()}</div>

<!-- Print Button -->
<div class="no-print" style="text-align:center;margin-top:28px">
  <button onclick="window.print()" style="padding:10px 32px;background:hsl(43,74%,50%);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700">
    🖨️ طباعة / حفظ PDF
  </button>
</div>

</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ══ المكوّن الرئيسي ══════════════════════════════════════════════════════════
export default function FinanceSaleDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
    } finally {
      setClosing(false);
    }
  };

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    apiFetch<SaleOrder>(`/finance/sale-orders/${params.id}`)
      .then(data => { setOrder(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      جاري التحميل…
    </div>
  );
  if (error || !order) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-destructive text-sm">{error ?? "لم يُعثر على الأمر"}</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/finance/sales")}>رجوع</Button>
    </div>
  );

  const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, bg: "#eee", color: "#555" };
  const payInfo    = PAY_MAP[order.paymentStatus] ?? { label: order.paymentStatus, color: "#555" };
  const total      = parseFloat(order.totalAmount  ?? "0");
  const paid       = parseFloat(order.paidAmount   ?? "0");
  const discount   = parseFloat(order.discountAmount ?? "0");
  const shipping   = parseFloat(order.shippingCost  ?? "0");
  const due        = total - paid;
  const totalQty   = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "hsl(var(--background))" }}>
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/finance/sales")}
          className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
          style={{ color: "hsl(43,74%,50%)" }}
        >
          <ArrowRight className="w-4 h-4" />
          العودة لفواتير البيع
        </button>
        <div className="flex items-center gap-2">
          {/* زرار الإغلاق — يظهر فقط لو الفاتورة مش مغلقة */}
          {order.status !== "closed" && order.status !== "cancelled" && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-85"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 1C3.91 1 1 3.91 1 7.5S3.91 14 7.5 14 14 11.09 14 7.5 11.09 1 7.5 1zm0 12C4.47 13 2 10.53 2 7.5S4.47 2 7.5 2 13 4.47 13 7.5 10.53 13 7.5 13zm-1-4.5l3.5-3.5.7.7-4.2 4.2-2.2-2.2.7-.7 1.5 1.5z" fill="currentColor"/>
              </svg>
              إغلاق وتحويل للخزينة
            </button>
          )}
          {order.status === "closed" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}>
              ✓ مُغلَقة — تم التحويل للخزينة
            </span>
          )}
          <button
            onClick={() => printManifestPDF(order)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-85"
            style={{ background: "hsl(43,74%,50%)" }}
          >
            <Printer className="w-4 h-4" />
            طباعة / PDF
          </button>
        </div>
      </div>

      {/* ── CONFIRM DIALOG ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" style={{ background: "hsl(var(--card))" }}>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: "hsl(43,74%,50%,0.15)" }}>
                <svg width="28" height="28" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1C3.91 1 1 3.91 1 7.5S3.91 14 7.5 14 14 11.09 14 7.5 11.09 1 7.5 1zm-1 5.5l3.5-3.5.7.7-4.2 4.2-2.2-2.2.7-.7 1.5 1.5z" fill="hsl(43,74%,50%)"/>
                </svg>
              </div>
              <h3 className="text-base font-bold mb-1">إغلاق الفاتورة</h3>
              <p className="text-sm text-muted-foreground">
                سيتم إغلاق فاتورة <strong>{order.soNumber}</strong> وتحويل
                مبلغ <strong style={{ color: "hsl(43,74%,50%)" }}>{fmtNum(total)} ج</strong> للخزينة الرئيسية.
              </p>
              <p className="text-xs text-muted-foreground mt-2">لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} disabled={closing}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-70"
                style={{ borderColor: "hsl(var(--border))" }}>
                إلغاء
              </button>
              <button onClick={handleClose} disabled={closing}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-85"
                style={{ background: "hsl(43,74%,50%)" }}>
                {closing ? "جارٍ الإغلاق…" : "تأكيد الإغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span
                className="px-3 py-0.5 rounded-full text-xs font-bold"
                style={{ background: statusInfo.bg, color: statusInfo.color }}
              >
                {statusInfo.label}
              </span>
              <span className="text-xs font-bold" style={{ color: payInfo.color }}>
                {payInfo.label}
              </span>
            </div>
          </div>
          <div className="text-left text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" />
              تاريخ الإنشاء: {fmtDate(order.createdAt)}
            </div>
            {order.expectedDate && (
              <div className="flex items-center gap-1 justify-end">
                <Truck className="w-3 h-3" />
                تاريخ التسليم المتوقع: {fmtDate(order.expectedDate)}
              </div>
            )}
            {order.deliveredAt && (
              <div className="flex items-center gap-1 justify-end">
                <Package className="w-3 h-3" />
                تسليم فعلي: {fmtDate(order.deliveredAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { val: order.items.length, lbl: "عدد المنتجات", icon: <Package className="w-4 h-4" /> },
          { val: totalQty,           lbl: "إجمالي القطع", icon: <Package className="w-4 h-4" /> },
          { val: `${fmtNum(total)} ج`, lbl: "إجمالي الفاتورة", icon: <CreditCard className="w-4 h-4" /> },
          { val: due > 0 ? `${fmtNum(due)} ج` : "✓ مسدد", lbl: "المتبقي", icon: <CreditCard className="w-4 h-4" /> },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border p-3 text-center" style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
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
              {["#","المنتج","اللون","المقاس","الكمية","سعر الوحدة","الإجمالي"].map(h => (
                <th key={h} className="text-right py-2.5 px-3 text-xs font-bold text-white">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={it.id} className={i % 2 === 0 ? "" : ""}
                  style={{ background: i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted)/0.3)", borderBottom: "1px solid hsl(var(--border))" }}>
                <td className="py-2 px-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="py-2 px-3 font-semibold">{it.productName ?? "—"}</td>
                <td className="py-2 px-3">{it.color ?? "—"}</td>
                <td className="py-2 px-3">{it.size ?? "—"}</td>
                <td className="py-2 px-3 text-center font-bold">{it.quantity}</td>
                <td className="py-2 px-3 text-center">{fmtNum(it.unitPrice)} ج</td>
                <td className="py-2 px-3 text-center font-bold" style={{ color: "hsl(43,74%,50%)" }}>
                  {fmtNum(it.quantity * Number(it.unitPrice))} ج
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── TOTALS ── */}
      <div className="flex justify-start mb-5">
        <div className="rounded-xl border p-4 min-w-64" style={{ borderColor: "#B2DFDB", background: "hsl(var(--card))" }}>
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
          <div className="flex justify-between pt-2 mt-2 border-t text-base font-extrabold" style={{ color: "hsl(43,74%,50%)", borderColor: "hsl(43,74%,50%)" }}>
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
