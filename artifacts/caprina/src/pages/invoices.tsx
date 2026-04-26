import { useListOrders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi, ordersApi } from "@/lib/api";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, FileText, CheckSquare, Square } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { useLocation } from "wouter";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  in_shipping: "قيد الشحن",
  received: "استلم",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(n);

export default function Invoices() {
  const [location] = useLocation();
  const { brand } = useBrand();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preselectedId = params.get("orderId") ? Number(params.get("orderId")) : null;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(preselectedId ? new Set([preselectedId]) : new Set());

  // نجيب بس الطلبات اللي حالتها in_shipping
  const { data: allInShipping, isLoading } = useListOrders({ status: "in_shipping" });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  // نجيب الـ IDs اللي في بيانات فعلياً
  const { data: manifestData } = useQuery({
    queryKey: ["in-manifest-ids"],
    queryFn: ordersApi.inManifestIds,
  });

  // فلتر — بس اللي لسه في المخزن (مش في بيان)
  const orders = useMemo(() => {
    if (!allInShipping || !manifestData) return [];
    const manifestSet = new Set(manifestData.ids);
    return allInShipping.filter(o => !manifestSet.has(o.id));
  }, [allInShipping, manifestData]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(orders.map(o => o.id)));
  };
  const clearAll = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    const selected = orders.filter(o => selectedIds.has(o.id));
    if (!selected.length) { alert("اختر طلبات للطباعة أولاً."); return; }

    // Fetch logo as base64 for embedding in print window
    let logoB64 = "";
    if (brand.logoUrl) {
      try {
        const r = await fetch(brand.logoUrl);
        const blob = await r.blob();
        logoB64 = await new Promise<string>(res => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {}
    }

    const brandName = brand.name || "CAPRINA";
    const brandTagline = brand.tagline || "WIN OR DIE";

    const groups: typeof selected[] = [];
    for (let i = 0; i < selected.length; i += 4) groups.push(selected.slice(i, i + 4));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');

      @page {
        size: A4 landscape;
        margin: 5mm;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl;
        background: white;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ─── صفحة A4 landscape = 297mm × 210mm ────────────── */
      /* بعد margin 5mm من كل ناحية = 287mm × 200mm */
      /* كل فاتورة = نص العرض و نص الارتفاع مع gap 3mm */
      /* = (287-3)/2 = 142mm عرض ، (200-3)/2 = 98.5mm ارتفاع */

      .page {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 3mm;
        width: 287mm;
        height: 200mm;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child { page-break-after: avoid; }

      /* ── Invoice Card ─────────────────────────── */
      .inv {
        border: 1.2px solid #1a1a1a;
        border-radius: 2mm;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: white;
        height: 98.5mm;
        max-height: 98.5mm;
      }

      /* ── Top bar ────────────────────────────── */
      .top-bar {
        background: #1a1a1a;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.2mm 2.5mm;
        gap: 1.5mm;
        flex-shrink: 0;
        height: 10mm;
      }
      .logo-wrap { display: flex; align-items: center; gap: 1.2mm; }
      .logo-img { width: 7mm; height: 7mm; object-fit: contain; border-radius: 1mm; }
      .logo-txt { font-size: 10pt; font-weight: 900; letter-spacing: 2px; line-height: 1; }
      .logo-sub { font-size: 5pt; letter-spacing: 2px; opacity: 0.7; }
      .brand-center { font-size: 8pt; font-weight: 700; letter-spacing: 1px; opacity: 0.9; text-align: center; }
      .inv-date { font-size: 7.5pt; opacity: 0.85; white-space: nowrap; }

      /* ── Body ─────────────────────────────────── */
      .inv-body {
        padding: 1.5mm 2.5mm;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1mm;
        overflow: hidden;
        min-height: 0;
      }

      /* ── Customer row ──────────────────────── */
      .customer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 1mm;
        gap: 1.5mm;
        flex-shrink: 0;
      }
      .customer-name { font-size: 11pt; font-weight: 900; color: #111; line-height: 1.1; }
      .phone-badge {
        font-size: 9.5pt;
        font-weight: 900;
        color: #111;
        direction: ltr;
        background: #f0f0f0;
        border-radius: 1mm;
        padding: 0.5mm 1.5mm;
        white-space: nowrap;
      }

      /* ── Product Table ───────────────────────── */
      .prod-table {
        width: 100%;
        border-collapse: collapse;
        flex-shrink: 0;
      }
      .prod-table th {
        background: #1a1a1a;
        color: white;
        border: 0.4px solid #333;
        padding: 1mm 1.2mm;
        font-weight: 700;
        font-size: 7.5pt;
        text-align: center;
      }
      .prod-table td {
        border: 0.4px solid #ddd;
        padding: 1mm 1.2mm;
        text-align: center;
        font-size: 8pt;
        vertical-align: middle;
        line-height: 1.2;
      }
      .prod-table td.name-col {
        text-align: right;
        font-weight: 700;
        font-size: 8.5pt;
        max-width: 30mm;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .prod-table .total-row td {
        background: #f0f0f0;
        font-weight: 900;
        font-size: 8.5pt;
        border-color: #bbb;
      }

      /* ── Info grid ────────────────────────── */
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.8mm;
        flex-shrink: 0;
      }
      .info-cell {
        border: 0.4px solid #ddd;
        border-radius: 0.8mm;
        padding: 0.7mm 1.2mm;
        background: #fafafa;
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
      }
      .info-cell.span2 { grid-column: span 2; }
      .info-cell.span3 { grid-column: span 3; }
      .ic-label { font-size: 6.5pt; color: #999; white-space: nowrap; line-height: 1.3; }
      .ic-val {
        font-size: 8pt;
        font-weight: 700;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ic-val.wrap {
        white-space: normal;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* ── Notes box ──────────────────────────── */
      .notes-box {
        background: #fffbea;
        border: 1px solid #f59e0b;
        border-right: 3px solid #f59e0b;
        border-radius: 1mm;
        padding: 1mm 2mm;
        display: flex;
        gap: 1.5mm;
        align-items: flex-start;
        flex-shrink: 0;
        overflow: hidden;
      }
      .notes-box .nl { font-size: 7.5pt; font-weight: 900; color: #b45309; white-space: nowrap; }
      .notes-box .nv {
        font-size: 7.5pt;
        font-weight: 700;
        color: #1a1a1a;
        line-height: 1.4;
        white-space: normal;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* ── Confirm box ─────────────────────── */
      .confirm-box {
        border: 0.5px solid #ccc;
        border-radius: 1mm;
        padding: 1mm 1.5mm;
        font-size: 7pt;
        color: #555;
        display: flex;
        gap: 1mm;
        align-items: flex-start;
        flex-shrink: 0;
        line-height: 1.3;
      }
      .confirm-box .cb-label {
        font-weight: 900;
        white-space: nowrap;
        color: #111;
        font-size: 7.5pt;
      }

      /* ── Footer ─────────────────────────── */
      .inv-footer {
        border-top: 1px solid #ddd;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0.8mm 2mm;
        background: #f9f9f9;
        flex-shrink: 0;
        min-height: 5mm;
      }
      .policy-txt { font-size: 6.5pt; color: #777; text-align: center; line-height: 1.4; }

      /* ── Empty slot ─────────────────────── */
      .empty-slot {
        border: 1px dashed #e0e0e0;
        border-radius: 2mm;
        background: #fafafa;
        height: 98.5mm;
      }
    `;

    const invoiceHTML = (order: (typeof selected)[0]) => {
      const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
      const trackingNumber = (order as any).trackingNumber ?? "";
      const color = (order as any).color ?? "";
      const size = (order as any).size ?? "";
      const notes = (order as any).notes ?? "";
      const shippingCost = (order as any).shippingCost ?? 0;
      const partialQty = (order as any).partialQuantity;
      const dateStr = format(new Date(order.createdAt), "yyyy/MM/dd");
      const logoEl = logoB64
        ? `<img src="${logoB64}" class="logo-img" alt="${brandName}" />`
        : ``;

      // الكمية المستلمة فعلياً (لو partial)
      const displayQty = partialQty ? `${partialQty} / ${order.quantity}` : `${order.quantity}`;

      // Parse city from address
      const address = order.address ?? "";

      return `
        <div class="inv">
          <!-- TOP BAR -->
          <div class="top-bar">
            <div class="logo-wrap">
              ${logoEl}
              <div>
                <div class="logo-txt">${brandName}</div>
                <div class="logo-sub">${brandTagline}</div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center">
              <div class="brand-center">${brandName}</div>
              <div style="font-size:5pt;opacity:0.7;letter-spacing:1px">ORDER #${String(order.id).padStart(4,"0")}</div>
            </div>
            <div class="inv-date">${dateStr}</div>
          </div>

          <!-- BODY -->
          <div class="inv-body">

            <!-- Customer + Phone -->
            <div class="customer-row">
              <div>
                <div class="customer-name">${order.customerName}</div>
              </div>
              <div class="phone-badge">📞 ${order.phone ?? "—"}</div>
            </div>

            <!-- Product table -->
            <table class="prod-table">
              <thead>
                <tr>
                  <th style="width:35%">الصنف</th>
                  <th>المقاس</th>
                  <th>اللون</th>
                  <th>العدد</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="name-col" title="${order.product}">${order.product}</td>
                  <td>${size || "—"}</td>
                  <td>${color || "—"}</td>
                  <td style="font-weight:900">${displayQty}</td>
                  <td>${formatCurrency(order.unitPrice)}</td>
                  <td style="font-weight:900;color:#111">${formatCurrency(order.totalPrice)}</td>
                </tr>
                ${shippingCost > 0 ? `
                <tr>
                  <td class="name-col" colspan="4" style="color:#666;font-size:6.5pt">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700">${formatCurrency(shippingCost)}</td>
                </tr>` : ""}
                <tr class="total-row">
                  <td colspan="3" style="text-align:right;font-size:7.5pt">💰 الإجمالي الكلي</td>
                  <td>${displayQty}</td>
                  <td colspan="2" style="font-size:9pt">${formatCurrency(order.totalPrice + shippingCost)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Address info -->
            <div class="info-grid">
              <div class="info-cell">
                <span class="ic-label">المحافظة</span>
                <span class="ic-val">${order.city ?? "—"}</span>
              </div>
              <div class="info-cell">
                <span class="ic-label">شركة الشحن</span>
                <span class="ic-val">${company ? company.name : "—"}</span>
              </div>
              <div class="info-cell">
                <span class="ic-label">رقم التتبع</span>
                <span class="ic-val" style="direction:ltr;text-align:right">${trackingNumber || "—"}</span>
              </div>
              <div class="info-cell span3">
                <span class="ic-label">العنوان بالتفصيل</span>
                <span class="ic-val wrap">${address || "—"}</span>
              </div>
            </div>

            <!-- Customer notes — always shown -->
            <div class="notes-box">
              <span class="nl">📝 ملاحظات:</span>
              <span class="nv">${notes || "—"}</span>
            </div>

            <!-- Shipping confirmation -->
            <div class="confirm-box">
              <span class="cb-label">✓ التأكيد على الشحن:</span>
              <span>تم التأكيد مع العميل — في حالة عدم الاستلام يتم دفع مصاريف الشحن كاملة المتفق عليها</span>
            </div>

          </div>

          <!-- FOOTER: policy only, no repeated phone -->
          <div class="inv-footer">
            <div class="policy-txt">
              الاسترجاع فقط أثناء تواجد المندوب &nbsp;·&nbsp; الاستبدال خلال 7 أيام من الشحن &nbsp;·&nbsp; المنتج بضمان 6 أشهر &nbsp;·&nbsp; يلزم الاحتفاظ بالفاتورة
            </div>
          </div>
        </div>
      `;
    };

    const pagesHTML = groups.map(group => {
      const invoices = group.map(o => invoiceHTML(o)).join("");
      const empties = group.length < 4
        ? Array(4 - group.length).fill('<div class="empty-slot"></div>').join("")
        : "";
      return `<div class="page">${invoices}${empties}</div>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فواتير ${brandName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>${styles}</style>
</head>
<body>${pagesHTML}</body>
</html>`);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 600);
    };
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">طلبات قيد الشحن اللي لسه في المخزن (لم تُدرج في بيان) — اختر واطبع 4 فواتير في صفحة A4</p>
        </div>
        <Button
          onClick={handlePrint}
          className="gap-2 font-bold text-sm"
          disabled={selectedIds.size === 0}
        >
          <Printer className="w-4 h-4" />
          طباعة ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1 border-border" onClick={selectAll}>
          <CheckSquare className="w-3.5 h-3.5" />تحديد الكل
        </Button>

        {selectedIds.size > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={clearAll}>
            <Square className="w-3.5 h-3.5" />إلغاء التحديد
          </Button>
        )}

        {selectedIds.size > 0 && (
          <span className="text-xs text-primary font-bold">{selectedIds.size} محدد للطباعة</span>
        )}

        {!isLoading && (
          <span className="text-xs text-muted-foreground mr-auto">{orders.length} طلب في المخزن جاهز للشحن</span>
        )}
      </div>

      {/* Preview cards */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : orders.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
            const color = (order as any).color as string | null;
            const size = (order as any).size as string | null;
            return (
              <Card
                key={order.id}
                onClick={() => toggleSelect(order.id)}
                className={`border p-4 cursor-pointer transition-all select-none ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="font-bold text-sm leading-tight">{order.customerName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{order.id.toString().padStart(4,"0")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold border shrink-0 ${statusClasses[order.status] || ""}`}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">{order.product}</span>
                    <span className="font-bold text-primary">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  {(color || size) && (
                    <p>{[color, size].filter(Boolean).join(" · ")}</p>
                  )}
                  <div className="flex gap-3">
                    <span>× {order.quantity} وحدة</span>
                    {company && <span>🚚 {company.name}</span>}
                  </div>
                  {order.phone && <p className="font-mono text-[11px]">📞 {order.phone}</p>}
                  {order.city && <p>📍 {order.city}</p>}
                  <p className="text-[10px] opacity-60">{format(new Date(order.createdAt), "yyyy/MM/dd")}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد طلبات في المخزن جاهزة للشحن</p>
          <p className="text-sm text-muted-foreground mt-1">الفواتير تظهر للطلبات قيد الشحن اللي لم تُدرج في بيان بعد</p>
        </Card>
      )}
    </div>
  );
}
