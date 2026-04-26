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

      @page { size: A4 landscape; margin: 4mm; }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'Cairo', sans-serif;
        direction: rtl;
        background: #fff;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /*
        A4 landscape = 297 × 210 mm
        margin 4mm جميع الجهات → print area = 289 × 202 mm
        2 cols × 2 rows  gap 3mm
        card W = (289 - 3) / 2 = 143mm
        card H = (202 - 3) / 2 = 99.5mm
      */

      .page {
        display: grid;
        grid-template-columns: 143mm 143mm;
        grid-template-rows: 99.5mm 99.5mm;
        gap: 3mm;
        width: 289mm;
        height: 202mm;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child { page-break-after: avoid; }

      /* ══ CARD ══════════════════════════════════════════ */
      .inv {
        width: 143mm;
        height: 99.5mm;
        border: 1px solid #222;
        border-radius: 1.5mm;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #fff;
      }

      /* ── Header bar ──────────────────────────────────── */
      .hdr {
        background: #1a1a1a;
        color: #fff;
        height: 9mm;
        min-height: 9mm;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 2.5mm;
        flex-shrink: 0;
      }
      .hdr-brand { display: flex; align-items: center; gap: 1.5mm; }
      .hdr-logo { width: 6.5mm; height: 6.5mm; object-fit: contain; border-radius: 0.8mm; }
      .hdr-name { font-size: 9.5pt; font-weight: 900; letter-spacing: 1.5px; line-height: 1; }
      .hdr-sub  { font-size: 4.5pt; letter-spacing: 1.5px; opacity: 0.65; margin-top: 0.5mm; }
      .hdr-mid  { font-size: 7pt; font-weight: 700; letter-spacing: 0.5px; opacity: 0.85; text-align: center; line-height: 1.4; }
      .hdr-date { font-size: 7pt; opacity: 0.8; white-space: nowrap; }

      /* ── Body ────────────────────────────────────────── */
      .body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        padding: 1.2mm 2mm;
        gap: 0.8mm;
        overflow: hidden;
      }

      /* ── Customer row ────────────────────────────────── */
      .cust {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5mm;
        padding-bottom: 1mm;
        border-bottom: 0.8px solid #ddd;
        flex-shrink: 0;
      }
      .cust-name {
        font-size: 10.5pt;
        font-weight: 900;
        line-height: 1.1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .cust-phone {
        font-size: 8.5pt;
        font-weight: 900;
        direction: ltr;
        background: #f2f2f2;
        border-radius: 0.8mm;
        padding: 0.4mm 1.5mm;
        white-space: nowrap;
        flex-shrink: 0;
        border: 0.5px solid #ddd;
      }

      /* ── Table ───────────────────────────────────────── */
      .tbl {
        width: 100%;
        border-collapse: collapse;
        flex-shrink: 0;
        table-layout: fixed;
      }
      .tbl th {
        background: #222;
        color: #fff;
        border: 0.4px solid #444;
        padding: 0.8mm 1mm;
        font-size: 7pt;
        font-weight: 700;
        text-align: center;
        overflow: hidden;
      }
      .tbl td {
        border: 0.4px solid #ddd;
        padding: 0.8mm 1mm;
        font-size: 7.5pt;
        text-align: center;
        vertical-align: middle;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tbl td.prod-name {
        text-align: right;
        font-weight: 700;
        font-size: 8pt;
      }
      .tbl .tot td {
        background: #f0f0f0;
        font-weight: 900;
        font-size: 8pt;
        border-color: #bbb;
      }

      /* ── Info row (3 cells) ──────────────────────────── */
      .info-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.7mm;
        flex-shrink: 0;
      }
      .ic {
        border: 0.4px solid #ddd;
        border-radius: 0.7mm;
        padding: 0.5mm 1mm;
        background: #fafafa;
        min-width: 0;
        overflow: hidden;
      }
      .ic-l { font-size: 5.5pt; color: #aaa; line-height: 1.3; white-space: nowrap; }
      .ic-v {
        font-size: 7.5pt;
        font-weight: 700;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Address full-width ──────────────────────────── */
      .addr-row {
        display: flex;
        align-items: flex-start;
        gap: 1mm;
        border: 0.4px solid #ddd;
        border-radius: 0.7mm;
        padding: 0.5mm 1mm;
        background: #fafafa;
        flex-shrink: 0;
        overflow: hidden;
        min-height: 6mm;
      }
      .addr-lbl { font-size: 5.5pt; color: #aaa; white-space: nowrap; padding-top: 0.3mm; flex-shrink: 0; }
      .addr-val {
        font-size: 7.5pt;
        font-weight: 700;
        line-height: 1.35;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* ── Notes ───────────────────────────────────────── */
      .notes {
        display: flex;
        align-items: flex-start;
        gap: 1mm;
        background: #fffbea;
        border: 0.8px solid #f59e0b;
        border-right: 3px solid #f59e0b;
        border-radius: 0.8mm;
        padding: 0.7mm 1.2mm;
        flex-shrink: 0;
        overflow: hidden;
        min-height: 6mm;
      }
      .notes-lbl { font-size: 6pt; font-weight: 900; color: #b45309; white-space: nowrap; flex-shrink: 0; padding-top: 0.2mm; }
      .notes-val {
        font-size: 7pt;
        font-weight: 700;
        color: #1a1a1a;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
      }

      /* ── Confirm strip ───────────────────────────────── */
      .confirm {
        border: 0.4px solid #ccc;
        border-radius: 0.7mm;
        padding: 0.6mm 1mm;
        font-size: 6.5pt;
        color: #555;
        line-height: 1.35;
        flex-shrink: 0;
        overflow: hidden;
      }
      .confirm strong { color: #111; font-weight: 900; }

      /* ── Footer ──────────────────────────────────────── */
      .ftr {
        border-top: 0.8px solid #ddd;
        background: #f7f7f7;
        padding: 0.6mm 2mm;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 4.5mm;
        overflow: hidden;
      }
      .ftr-txt { font-size: 5.5pt; color: #888; text-align: center; line-height: 1.4; }

      /* ── Empty slot ──────────────────────────────────── */
      .empty {
        width: 143mm;
        height: 99.5mm;
        border: 1px dashed #ddd;
        border-radius: 1.5mm;
        background: #fafafa;
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

          <div class="hdr">
            <div class="hdr-brand">
              ${logoEl}
              <div>
                <div class="hdr-name">${brandName}</div>
                <div class="hdr-sub">${brandTagline}</div>
              </div>
            </div>
            <div class="hdr-mid">${brandName}<br><span style="font-size:5.5pt;opacity:0.7;font-weight:400">ORDER #${String(order.id).padStart(4,"0")}</span></div>
            <div class="hdr-date">${dateStr}</div>
          </div>

          <div class="body">

            <div class="cust">
              <div class="cust-name">${order.customerName}</div>
              <div class="cust-phone">📞 ${order.phone ?? "—"}</div>
            </div>

            <table class="tbl">
              <colgroup>
                <col style="width:32%">
                <col style="width:12%">
                <col style="width:18%">
                <col style="width:9%">
                <col style="width:14%">
                <col style="width:15%">
              </colgroup>
              <thead>
                <tr>
                  <th>الصنف</th><th>المقاس</th><th>اللون</th><th>العدد</th><th>السعر</th><th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="prod-name" title="${order.product}">${order.product}</td>
                  <td>${size || "—"}</td>
                  <td>${color || "—"}</td>
                  <td style="font-weight:900">${displayQty}</td>
                  <td>${formatCurrency(order.unitPrice)}</td>
                  <td style="font-weight:900">${formatCurrency(order.totalPrice)}</td>
                </tr>
                ${shippingCost > 0 ? `<tr>
                  <td class="prod-name" colspan="4" style="color:#777;font-size:6.5pt">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700">${formatCurrency(shippingCost)}</td>
                </tr>` : ""}
                <tr class="tot">
                  <td colspan="3" style="text-align:right">💰 الإجمالي الكلي</td>
                  <td>${displayQty}</td>
                  <td colspan="2">${formatCurrency(order.totalPrice + shippingCost)}</td>
                </tr>
              </tbody>
            </table>

            <div class="info-row">
              <div class="ic">
                <div class="ic-l">المحافظة</div>
                <div class="ic-v">${order.city ?? "—"}</div>
              </div>
              <div class="ic">
                <div class="ic-l">شركة الشحن</div>
                <div class="ic-v">${company ? company.name : "—"}</div>
              </div>
              <div class="ic">
                <div class="ic-l">رقم التتبع</div>
                <div class="ic-v" style="direction:ltr;text-align:right">${trackingNumber || "—"}</div>
              </div>
            </div>

            <div class="addr-row">
              <span class="addr-lbl">📍 العنوان:</span>
              <span class="addr-val">${address || "—"}</span>
            </div>

            <div class="notes">
              <span class="notes-lbl">📝 ملاحظات:</span>
              <span class="notes-val">${notes || "—"}</span>
            </div>

            <div class="confirm">
              <strong>✓ التأكيد على الشحن:</strong> تم التأكيد مع العميل — في حالة عدم الاستلام يتم دفع مصاريف الشحن كاملة
            </div>

          </div>

          <div class="ftr">
            <div class="ftr-txt">الاسترجاع أثناء تواجد المندوب &nbsp;·&nbsp; الاستبدال خلال 7 أيام &nbsp;·&nbsp; ضمان 6 أشهر &nbsp;·&nbsp; احتفظ بالفاتورة</div>
          </div>

        </div>
      `;
    };

    const pagesHTML = groups.map(group => {
      const invoices = group.map(o => invoiceHTML(o)).join("");
      const empties = group.length < 4
        ? Array(4 - group.length).fill('<div class="empty"></div>').join("")
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
