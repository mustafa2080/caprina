import { useListOrders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi, ordersApi } from "@/lib/api";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: allOrders, isLoading } = useListOrders({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const { data: manifestData } = useQuery({
    queryKey: ["in-manifest-ids"],
    queryFn: ordersApi.inManifestIds,
  });

  const orders = useMemo(() => {
    if (!allOrders) return [];
    if (!manifestData) return allOrders;
    const manifestSet = new Set(manifestData.ids);
    return allOrders.filter(o => !manifestSet.has(o.id));
  }, [allOrders, manifestData]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => { if (orders) setSelectedIds(new Set(orders.map(o => o.id))); };
  const clearAll  = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    const selected = orders?.filter(o => selectedIds.has(o.id)) ?? [];
    if (!selected.length) { alert("اختر طلبات للطباعة أولاً."); return; }

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

    const brandName    = brand.name    || "CAPRINA";
    const brandTagline = brand.tagline || "WIN OR DIE";

    const groups: typeof selected[] = [];
    for (let i = 0; i < selected.length; i += 4) groups.push(selected.slice(i, i + 4));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap');
      @page { size: A4 landscape; margin: 4mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl; background: white; color: #111; font-size: 9pt;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .page {
        display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
        gap: 3mm; width: 100%; height: 194mm; page-break-after: always;
      }
      .page:last-child { page-break-after: avoid; }

      .inv {
        border: 1.5px solid #1a1a1a; border-radius: 2mm;
        display: flex; flex-direction: column;
        overflow: hidden; background: white;
      }

      /* HEADER: تاريخ | اسم البراند + رقم الأوردر | لوجو */
      .inv-hdr {
        background: #1a1a1a; color: white;
        display: grid; grid-template-columns: auto 1fr auto;
        align-items: center; padding: 1.5mm 3mm; gap: 2mm; flex-shrink: 0;
      }
      .hdr-date  { font-size: 7pt; opacity: 0.85; white-space: nowrap; direction: ltr; }
      .hdr-mid   { text-align: center; line-height: 1.3; }
      .hdr-brand { font-size: 10pt; font-weight: 900; letter-spacing: 2px; }
      .hdr-order { font-size: 6pt; opacity: 0.6; letter-spacing: 1px; }
      .hdr-logo  { display: flex; align-items: center; gap: 1.5mm; }
      .logo-img  { width: 8mm; height: 8mm; object-fit: contain; border-radius: 1mm; }
      .logo-txt  { font-size: 10pt; font-weight: 900; letter-spacing: 2px; line-height: 1; }
      .logo-sub  { font-size: 4.5pt; opacity: 0.6; letter-spacing: 2px; }

      /* CUSTOMER: تليفون يسار | اسم يمين */
      .cust-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.2mm 3mm; border-bottom: 1px solid #ddd;
        background: #f9f9f9; flex-shrink: 0; gap: 2mm;
      }
      .cust-phone { font-size: 9pt; font-weight: 700; direction: ltr; }
      .cust-name  { font-size: 11pt; font-weight: 900; }

      /* BODY */
      .inv-body { padding: 1.5mm 3mm; flex: 1; display: flex; flex-direction: column; gap: 1mm; }

      /* PRODUCT TABLE — header داكن زي الصورة */
      .prod-table { width: 100%; border-collapse: collapse; font-size: 7pt; flex-shrink: 0; }
      .prod-table th {
        background: #1a1a1a; color: white; border: 0.5px solid #333;
        padding: 1mm 1.5mm; font-weight: 700; font-size: 7pt; text-align: center;
      }
      .prod-table td {
        border: 0.5px solid #ddd; padding: 1mm 1.5mm;
        text-align: center; font-size: 7.5pt; vertical-align: middle;
      }
      .prod-table td.name-col { text-align: right; font-weight: 700; font-size: 8pt; }
      .prod-table .total-row td {
        background: #f0f0f0; font-weight: 900; font-size: 7.5pt; border-color: #bbb; color: #111;
      }
      .prod-table .total-row td.t-label { text-align: right; }

      /* INFO STRIP: رقم التتبع | شركة الشحن | المحافظة */
      .info-strip {
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        border: 0.5px solid #ddd; border-radius: 1mm;
        overflow: hidden; flex-shrink: 0;
      }
      .info-cell { padding: 0.8mm 1.5mm; border-left: 0.5px solid #ddd; display: flex; flex-direction: column; }
      .info-cell:last-child { border-left: none; }
      .info-lbl { font-size: 5.5pt; color: #999; }
      .info-val { font-size: 7pt; font-weight: 700; min-height: 3mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* ADDRESS */
      .addr-box { border: 0.5px solid #ddd; border-radius: 1mm; padding: 0.8mm 1.5mm; flex-shrink: 0; }
      .addr-lbl { font-size: 5.5pt; color: #999; }
      .addr-val { font-size: 7.5pt; font-weight: 700; word-break: break-word; line-height: 1.4; }

      /* NOTES */
      .notes-box {
        background: #fff8e1; border: 0.5px solid #ffe082;
        border-right: 3px solid #f59e0b; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6.5pt; color: #333;
        display: flex; gap: 1.5mm; flex-shrink: 0; line-height: 1.5;
      }
      .notes-box b { color: #b45309; white-space: nowrap; font-size: 7pt; }

      /* CONFIRM */
      .confirm-box {
        border: 0.8px solid #bbb; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6pt; color: #333; flex-shrink: 0;
        display: flex; gap: 1.5mm; align-items: flex-start; line-height: 1.5;
        background: #fafafa;
      }
      .confirm-box .cb-lbl { font-weight: 900; color: #111; font-size: 6.5pt; white-space: nowrap; }

      /* FOOTER */
      .inv-footer {
        border-top: 1.5px solid #1a1a1a; background: #1a1a1a;
        padding: 1.5mm 3mm; flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center; gap: 2mm;
      }
      .policy-txt   { font-size: 5.5pt; color: #aaa; text-align: left; line-height: 1.5; }
      .footer-brand { font-size: 7pt; font-weight: 900; color: #fff; letter-spacing: 2px; }

      .empty-slot { border: 1px dashed #ddd; border-radius: 2mm; background: #fafafa; }
    `;

    const invoiceHTML = (order: (typeof selected)[0]) => {
      const company        = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
      const trackingNumber = (order as any).trackingNumber ?? (order as any).tracking_number ?? "";
      const color          = (order as any).color          ?? "";
      const size           = (order as any).size           ?? "";
      const notes          = (order as any).notes          ?? (order as any).note ?? (order as any).orderNotes ?? "";
      const shippingCost   = (order as any).shippingCost   ?? (order as any).shipping_cost ?? 0;
      const partialQty     = (order as any).partialQuantity;
      const displayQty     = partialQty ? `${partialQty} / ${order.quantity}` : `${order.quantity}`;
      const dateStr        = format(new Date(order.createdAt), "yyyy/MM/dd");
      const logoEl         = logoB64
        ? `<img src="${logoB64}" class="logo-img" alt="${brandName}" />`
        : ``;
      const address        = order.address ?? "";
      const orderNum       = String(order.id).padStart(4, "0");

      return `
        <div class="inv">

          <!-- HEADER: تاريخ | براند + رقم | لوجو -->
          <div class="inv-hdr">
            <div class="hdr-date">${dateStr}</div>
            <div class="hdr-mid">
              <div class="hdr-brand">${brandName}</div>
              <div class="hdr-order">ORDER #${orderNum}</div>
            </div>
            <div class="hdr-logo">
              <div style="text-align:left">
                <div class="logo-txt">${brandName}</div>
                <div class="logo-sub">${brandTagline}</div>
              </div>
              ${logoEl}
            </div>
          </div>

          <!-- CUSTOMER: تليفون يسار | اسم يمين -->
          <div class="cust-row">
            <div class="cust-phone">&#128222; ${order.phone ?? "&#8212;"}</div>
            <div class="cust-name">${order.customerName}</div>
          </div>

          <!-- BODY -->
          <div class="inv-body">

            <!-- جدول المنتجات بهيدر داكن -->
            <table class="prod-table">
              <thead>
                <tr>
                  <th style="width:30%">الصنف</th>
                  <th style="width:14%">المقاس</th>
                  <th style="width:18%">اللون</th>
                  <th style="width:10%">العدد</th>
                  <th style="width:14%">السعر</th>
                  <th style="width:14%">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="name-col">${order.product}</td>
                  <td>${size || "&#8212;"}</td>
                  <td>${color || "&#8212;"}</td>
                  <td style="font-weight:900">${displayQty}</td>
                  <td>${formatCurrency(order.unitPrice)}</td>
                  <td style="font-weight:900">${formatCurrency(order.totalPrice)}</td>
                </tr>
                ${shippingCost > 0 ? `<tr>
                  <td class="name-col" colspan="4" style="color:#777;font-size:6pt">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700">${formatCurrency(shippingCost)}</td>
                </tr>` : ""}
                <tr class="total-row">
                  <td class="t-label" colspan="3">&#9679; الإجمالي الكلي</td>
                  <td style="font-weight:900">${displayQty}</td>
                  <td colspan="2" style="font-weight:900">${formatCurrency(order.totalPrice + shippingCost)}</td>
                </tr>
              </tbody>
            </table>

            <!-- INFO: رقم التتبع | شركة الشحن | المحافظة -->
            <div class="info-strip">
              <div class="info-cell">
                <span class="info-lbl">رقم التتبع</span>
                <span class="info-val" style="direction:ltr;text-align:right">${trackingNumber || "&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">شركة الشحن</span>
                <span class="info-val">${company ? company.name : "&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">المحافظة</span>
                <span class="info-val">${order.city ?? "&#8212;"}</span>
              </div>
            </div>

            <!-- العنوان -->
            <div class="addr-box">
              <div class="addr-lbl">العنوان بالتفصيل</div>
              <div class="addr-val">${address || "&#8212;"}</div>
            </div>

            <!-- الملاحظات — تظهر دايماً -->
            <div class="notes-box">
              <b>&#128203; ملاحظات:</b>
              <span>${notes || "&#8212;"}</span>
            </div>

            <!-- التاكيد على الشحن -->
            <div class="confirm-box">
              <span class="cb-lbl">&#10003; التاكيد علي الشحن:</span>
              <span>تم التاكيد مع العميل &#8212; في حاله عدم الاستلام بيتم دفع مصاريف الشحن كامله المتفق عليها</span>
            </div>

          </div>

          <!-- FOOTER -->
          <div class="inv-footer">
            <div class="policy-txt">الاسترجاع فقط اثناء تواجد المندوب &middot; الاستبدال خلال 7 أيام &middot; ضمان 6 أشهر &middot; احتفظ بالفاتورة</div>
            <div class="footer-brand">${brandName}</div>
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
          <p className="text-muted-foreground text-sm mt-0.5">اختر الطلبات واطبع 4 فواتير في صفحة A4 واحدة</p>
        </div>
        <Button onClick={handlePrint} className="gap-2 font-bold text-sm" disabled={selectedIds.size === 0}>
          <Printer className="w-4 h-4" />
          طباعة ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm bg-card border-border">
            <SelectValue placeholder="تصفية بالحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الطلبات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="in_shipping">قيد الشحن</SelectItem>
            <SelectItem value="received">استلم</SelectItem>
            <SelectItem value="delayed">مؤجل</SelectItem>
            <SelectItem value="returned">مرتجع</SelectItem>
            <SelectItem value="partial_received">استلم جزئي</SelectItem>
          </SelectContent>
        </Select>

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
          <span className="text-xs text-muted-foreground mr-auto">{orders.length} طلب</span>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : orders?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
            const color = (order as any).color as string | null;
            const size  = (order as any).size  as string | null;
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
                  {order.city  && <p>📍 {order.city}</p>}
                  <p className="text-[10px] opacity-60">{format(new Date(order.createdAt), "yyyy/MM/dd")}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد طلبات</p>
          <p className="text-sm text-muted-foreground mt-1">سيظهر هنا الطلبات بعد إنشائها</p>
        </Card>
      )}
    </div>
  );
}
