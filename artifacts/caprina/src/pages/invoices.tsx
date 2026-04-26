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

  const { data: allInShipping, isLoading } = useListOrders({ status: "in_shipping" });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const { data: manifestData } = useQuery({
    queryKey: ["in-manifest-ids"],
    queryFn: ordersApi.inManifestIds,
  });

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

  const selectAll = () => setSelectedIds(new Set(orders.map(o => o.id)));
  const clearAll  = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    const selected = orders.filter(o => selectedIds.has(o.id));
    if (!selected.length) { alert("اختر طلبات للطباعة اولا."); return; }

    let logoB64 = "";
    const brandName    = brand.name    || "CAPRINA";
    const brandTagline = brand.tagline || "WIN OR DIE";

    const groups: typeof selected[] = [];
    for (let i = 0; i < selected.length; i += 4) groups.push(selected.slice(i, i + 4));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', sans-serif;
        direction: rtl;
        background: #fff;
        color: #111;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 2mm;
        padding: 3mm;
        width: 297mm;
        height: 210mm;
        page-break-after: always;
        overflow: hidden;
      }
      .page:last-child { page-break-after: avoid; }
      .inv {
        border: 1.5px solid #222;
        border-radius: 1.5mm;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #fff;
        min-height: 0;
      }
      .inv-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
      .hdr {
        background: #1a1a1a; color: #fff;
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.5mm 3mm; flex-shrink: 0;
      }
      .hdr-left { display: flex; align-items: center; gap: 1.5mm; }
      .hdr-img  { width: 7mm; height: 7mm; object-fit: contain; border-radius: 0.8mm; }
      .hdr-name { font-size: 10.5pt; font-weight: 900; letter-spacing: 1.5px; line-height: 1.1; }
      .hdr-sub  { font-size: 5pt; opacity: 0.55; letter-spacing: 1.5px; }
      .hdr-center { text-align: center; line-height: 1.4; }
      .hdr-brand  { font-size: 8.5pt; font-weight: 700; letter-spacing: 1px; }
      .hdr-order  { font-size: 6pt; opacity: 0.65; font-weight: 400; }
      .hdr-date   { font-size: 7.5pt; opacity: 0.85; font-weight: 600; }
      .cust {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.3mm 3mm; border-bottom: 1px solid #ccc;
        flex-shrink: 0; gap: 2mm; background: #f7f7f7;
      }
      .cust-name  { font-size: 11.5pt; font-weight: 900; }
      .cust-phone { font-size: 10pt; font-weight: 700; direction: ltr; }
      .tbl { width: 100%; border-collapse: collapse; flex-shrink: 0; table-layout: fixed; }
      .tbl th {
        background: #1a1a1a; color: #fff; border: 0.5px solid #333;
        padding: 1.2mm 1.5mm; font-size: 8pt; font-weight: 700; text-align: center;
      }
      .tbl td {
        border: 0.5px solid #bbb; padding: 1.2mm 1.5mm; font-size: 8.5pt;
        text-align: center; vertical-align: middle;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tbl td.pname { text-align: right; font-weight: 700; font-size: 9pt; }
      .tbl .tot td  { background: #e8e8e8; font-weight: 900; font-size: 9pt; border-color: #999; }
      .meta { display: flex; border-bottom: 0.5px solid #ddd; flex-shrink: 0; background: #fafafa; }
      .meta-cell { flex: 1; padding: 0.8mm 2.5mm; border-left: 0.5px solid #ddd; display: flex; flex-direction: column; }
      .meta-cell:last-child { border-left: none; }
      .meta-l { font-size: 5.5pt; color: #888; }
      .meta-v { font-size: 7.5pt; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .addr {
        margin: 1.5mm 3mm 0; border: 1.2px solid #333; border-radius: 1mm;
        padding: 1.2mm 2mm; flex-shrink: 0;
        display: flex; gap: 2mm; align-items: flex-start;
        background: #fff;
      }
      .addr-l { font-size: 7pt; color: #444; font-weight: 700; white-space: nowrap; padding-top: 0.3mm; flex-shrink: 0; }
      .addr-v { font-size: 8.5pt; font-weight: 700; line-height: 1.5; word-break: break-word; }
      .notes {
        margin: 1.2mm 3mm 0; background: #fffbea;
        border: 0.8px solid #f59e0b; border-right: 3px solid #f59e0b;
        border-radius: 0.8mm; padding: 0.8mm 1.5mm;
        display: flex; gap: 1.5mm; flex-shrink: 0; overflow: hidden;
      }
      .notes-l { font-size: 6.5pt; font-weight: 900; color: #b45309; white-space: nowrap; flex-shrink: 0; }
      .notes-v {
        font-size: 7pt; font-weight: 700; color: #111;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden; word-break: break-word; line-height: 1.4;
      }
      .confirm {
        margin: auto 3mm 1.5mm;
        border: 0.5px solid #bbb; border-radius: 0.8mm;
        padding: 0.8mm 1.5mm; font-size: 6.5pt; color: #444; line-height: 1.4;
        flex-shrink: 0; overflow: hidden;
      }
      .confirm strong { color: #111; font-weight: 900; }
      .ftr {
        border-top: 0.8px solid #ddd; background: #f0f0f0;
        padding: 0.8mm 3mm; flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center;
      }
      .ftr-txt   { font-size: 5.5pt; color: #888; line-height: 1.4; }
      .ftr-brand { font-size: 6.5pt; font-weight: 900; color: #555; letter-spacing: 1px; }
      .empty { border: 1.5px dashed #ddd; border-radius: 1.5mm; background: #fafafa; min-height: 0; }
    `;

    const invoiceHTML = (order: (typeof selected)[0]) => {
      const company        = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
      const trackingNumber = (order as any).trackingNumber ?? "";
      const color          = (order as any).color          ?? "";
      const size           = (order as any).size           ?? "";
      const notes          = (order as any).notes          ?? "";
      const shippingCost   = (order as any).shippingCost   ?? 0;
      const partialQty     = (order as any).partialQuantity;
      const dateStr        = format(new Date(order.createdAt), "yyyy/MM/dd");
      const logoEl         = logoB64 ? `<img src="${logoB64}" class="hdr-img" alt="${brandName}" />` : "";
      const displayQty     = partialQty ? `${partialQty} / ${order.quantity}` : `${order.quantity}`;
      const address        = order.address ?? "";

      return `
        <div class="inv">
          <div class="hdr">
            <div class="hdr-left">
              ${logoEl}
              <div>
                <div class="hdr-name">${brandName}</div>
                <div class="hdr-sub">${brandTagline}</div>
              </div>
            </div>
            <div class="hdr-center">
              <div class="hdr-brand">${brandName}</div>
              <div class="hdr-order">ORDER #${String(order.id).padStart(4,"0")}</div>
            </div>
            <div class="hdr-date">${dateStr}</div>
          </div>
          <div class="cust">
            <div class="cust-name">${order.customerName}</div>
            <div class="cust-phone">&#128222; ${order.phone ?? "&#8212;"}</div>
          </div>
          <div class="inv-body">
            <table class="tbl">
              <colgroup>
                <col style="width:30%"><col style="width:13%"><col style="width:19%">
                <col style="width:9%"><col style="width:14%"><col style="width:15%">
              </colgroup>
              <thead>
                <tr><th>الصنف</th><th>المقاس</th><th>اللون</th><th>العدد</th><th>السعر</th><th>الاجمالي</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td class="pname" title="${order.product}">${order.product}</td>
                  <td>${size || "&#8212;"}</td>
                  <td>${color || "&#8212;"}</td>
                  <td style="font-weight:900">${displayQty}</td>
                  <td>${formatCurrency(order.unitPrice)}</td>
                  <td style="font-weight:900">${formatCurrency(order.totalPrice)}</td>
                </tr>
                ${shippingCost > 0 ? `<tr>
                  <td class="pname" colspan="4" style="color:#777;font-size:6pt">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700">${formatCurrency(shippingCost)}</td>
                </tr>` : ""}
                <tr class="tot">
                  <td colspan="3" style="text-align:right">الاجمالي الكلي</td>
                  <td>${displayQty}</td>
                  <td colspan="2">${formatCurrency(order.totalPrice + shippingCost)}</td>
                </tr>
              </tbody>
            </table>
            <div class="meta">
              <div class="meta-cell">
                <span class="meta-l">رقم التتبع</span>
                <span class="meta-v" style="direction:ltr;text-align:right">${trackingNumber || "&#8212;"}</span>
              </div>
              <div class="meta-cell">
                <span class="meta-l">شركة الشحن</span>
                <span class="meta-v">${company ? company.name : "&#8212;"}</span>
              </div>
              <div class="meta-cell">
                <span class="meta-l">المحافظة</span>
                <span class="meta-v">${order.city ?? "&#8212;"}</span>
              </div>
            </div>
            <div class="addr">
              <span class="addr-l">العنوان:</span>
              <span class="addr-v">${address || "&#8212;"}</span>
            </div>
            ${notes ? `<div class="notes">
              <span class="notes-l">ملاحظات:</span>
              <span class="notes-v">${notes}</span>
            </div>` : ""}
            <div class="confirm">
              <strong>التاكيد على الشحن:</strong> تم التاكيد مع العميل &#8212; في حالة عدم الاستلام يتم دفع مصاريف الشحن كاملة
            </div>
          </div>
          <div class="ftr">
            <span class="ftr-txt">الاسترجاع اثناء تواجد المندوب &middot; الاستبدال خلال 7 ايام &middot; احتفظ بالفاتورة</span>
            <span class="ftr-brand">${brandName}</span>
          </div>
        </div>
      `;
    };

    const pagesHTML = groups.map(group => {
      const invoices = group.map(o => invoiceHTML(o)).join("");
      const empties  = group.length < 4
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
    printWindow.onload = () => { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 600); };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            طلبات قيد الشحن في المخزن (لم تدرج في بيان) — اختر واطبع 4 فواتير في صفحة A4
          </p>
        </div>
        <Button onClick={handlePrint} className="gap-2 font-bold text-sm" disabled={selectedIds.size === 0}>
          <Printer className="w-4 h-4" />
          طباعة ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-border" onClick={selectAll}>
          <CheckSquare className="w-3.5 h-3.5" />تحديد الكل
        </Button>
        {selectedIds.size > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearAll}>
            <Square className="w-3.5 h-3.5" />الغاء التحديد
          </Button>
        )}
        {selectedIds.size > 0 && (
          <span className="text-xs text-primary font-bold">{selectedIds.size} محدد للطباعة</span>
        )}
        {!isLoading && (
          <span className="text-xs text-muted-foreground mr-auto">{orders.length} طلب جاهز</span>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : orders.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {orders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            const company    = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
            const color      = (order as any).color as string | null;
            const size       = (order as any).size  as string | null;
            return (
              <Card
                key={order.id}
                onClick={() => toggleSelect(order.id)}
                className={`border p-3 cursor-pointer transition-all select-none ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      : <Square      className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="font-bold text-sm leading-tight">{order.customerName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        #{order.id.toString().padStart(4, "0")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold border shrink-0 ${statusClasses[order.status] || ""}`}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>

                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-1">
                    <span className="font-medium text-foreground truncate">{order.product}</span>
                    <span className="font-bold text-primary shrink-0">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  {(color || size) && <p className="truncate">{[color, size].filter(Boolean).join(" · ")}</p>}
                  <div className="flex gap-3">
                    <span>x {order.quantity} وحدة</span>
                    {company && <span className="truncate">🚚 {company.name}</span>}
                  </div>
                  {order.phone && <p className="font-mono text-[11px]">📞 {order.phone}</p>}
                  {order.city  && <p>📍 {order.city}</p>}
                  <p className="text-[10px] opacity-60">{format(new Date(order.createdAt), "yyyy/MM/dd")}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد طلبات في المخزن جاهزة للشحن</p>
          <p className="text-sm text-muted-foreground mt-1">
            الفواتير تظهر للطلبات قيد الشحن اللي لم تدرج في بيان بعد
          </p>
        </Card>
      )}
    </div>
  );
}
