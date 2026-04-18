import { useListOrders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi } from "@/lib/api";
import { useState } from "react";
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

  const { data: orders, isLoading } = useListOrders({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (orders) setSelectedIds(new Set(orders.map(o => o.id)));
  };
  const clearAll = () => setSelectedIds(new Set());

  const handlePrint = async () => {
    const selected = orders?.filter(o => selectedIds.has(o.id)) ?? [];
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
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap');
      @page { size: A4 landscape; margin: 4mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl;
        background: white;
        color: #111;
        font-size: 9pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 3mm;
        width: 100%;
        height: 194mm;
        page-break-after: always;
      }
      .page:last-child { page-break-after: avoid; }

      /* ── Invoice Card ─────────────────────────── */
      .inv {
        border: 1.5px solid #1a1a1a;
        border-radius: 2mm;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: white;
        font-size: 7.5pt;
      }

      /* ── Top bar: brand row ──────────────────── */
      .top-bar {
        background: #1a1a1a;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5mm 3mm;
        gap: 2mm;
      }
      .logo-wrap { display: flex; align-items: center; gap: 1.5mm; }
      .logo-img { width: 8mm; height: 8mm; object-fit: contain; border-radius: 1mm; }
      .logo-txt { font-size: 11pt; font-weight: 900; letter-spacing: 2px; line-height: 1; }
      .logo-sub { font-size: 5pt; letter-spacing: 2px; opacity: 0.7; }
      .brand-city { font-size: 9pt; font-weight: 700; letter-spacing: 1px; opacity: 0.9; }
      .inv-date { font-size: 7.5pt; opacity: 0.85; }

      /* ── Body ─────────────────────────────────── */
      .inv-body { padding: 2mm 3mm; flex: 1; display: flex; flex-direction: column; gap: 1.5mm; }

      /* ── Field row ──────────────────────────────── */
      .field-row {
        display: flex;
        align-items: baseline;
        gap: 1mm;
        border-bottom: 0.5px solid #e0e0e0;
        padding-bottom: 1mm;
      }
      .field-label {
        font-size: 6pt;
        color: #888;
        white-space: nowrap;
        min-width: 18mm;
        text-align: left;
        flex-shrink: 0;
      }
      .field-val {
        font-size: 8.5pt;
        font-weight: 700;
        color: #111;
        flex: 1;
      }
      .field-val.large { font-size: 9.5pt; }

      /* ── Product Table ───────────────────────────── */
      .prod-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1mm 0;
        font-size: 7pt;
      }
      .prod-table th {
        background: #f0f0f0;
        border: 0.5px solid #ccc;
        padding: 1mm 1.5mm;
        font-weight: 700;
        font-size: 6.5pt;
        text-align: center;
        color: #333;
      }
      .prod-table td {
        border: 0.5px solid #ddd;
        padding: 1mm 1.5mm;
        text-align: center;
        font-size: 7pt;
        vertical-align: middle;
      }
      .prod-table td.name-col {
        text-align: right;
        font-weight: 600;
        font-size: 7.5pt;
      }
      .prod-table .total-row td {
        background: #1a1a1a;
        color: white;
        font-weight: 900;
        font-size: 8pt;
        border-color: #333;
      }

      /* ── Address Grid ────────────────────────── */
      .addr-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5mm 2mm;
      }
      .addr-field {
        display: flex;
        flex-direction: column;
        border: 0.5px solid #ddd;
        border-radius: 1mm;
        padding: 1mm 1.5mm;
        background: #fafafa;
      }
      .addr-field .al { font-size: 5.5pt; color: #999; }
      .addr-field .av { font-size: 7pt; font-weight: 600; min-height: 3.5mm; }

      /* ── Delivery Row ───────────────────────── */
      .delivery-row {
        display: flex;
        gap: 2mm;
      }
      .delivery-field {
        flex: 1;
        border: 0.5px solid #ddd;
        border-radius: 1mm;
        padding: 1mm 1.5mm;
        background: #fafafa;
      }
      .delivery-field .dl { font-size: 5.5pt; color: #999; }
      .delivery-field .dv { font-size: 6.5pt; font-weight: 600; min-height: 3.5mm; }

      /* ── Notes / instruction box ────────────── */
      .note-box {
        background: #fff8e1;
        border: 0.5px solid #ffe082;
        border-radius: 1mm;
        padding: 1mm 2mm;
        font-size: 6pt;
        color: #555;
        line-height: 1.5;
      }
      .note-box b { color: #c77800; }

      /* ── Confirm shipping row ─────────────── */
      .confirm-box {
        border: 0.5px solid #ddd;
        border-radius: 1mm;
        padding: 1mm 2mm;
        font-size: 6pt;
        color: #444;
        display: flex;
        gap: 1.5mm;
        align-items: flex-start;
      }
      .confirm-box .cb-label {
        font-weight: 900;
        white-space: nowrap;
        color: #111;
        font-size: 6.5pt;
      }

      /* ── Footer: phone + policy ──────────── */
      .inv-footer {
        border-top: 1px solid #1a1a1a;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2mm;
        padding: 1mm 3mm;
        background: #f9f9f9;
      }
      .phone-block { display: flex; flex-direction: column; }
      .phone-label { font-size: 5.5pt; color: #999; }
      .phone-val { font-size: 9pt; font-weight: 900; color: #111; direction: ltr; text-align: right; }
      .policy-txt { font-size: 5.5pt; color: #666; max-width: 60mm; text-align: left; line-height: 1.5; }

      /* ── Empty slot ───────────────────────── */
      .empty-slot {
        border: 1px dashed #ddd;
        border-radius: 2mm;
        background: #fafafa;
      }
    `;

    const invoiceHTML = (order: (typeof selected)[0]) => {
      const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
      const trackingNumber = (order as any).trackingNumber ?? "";
      const color = (order as any).color ?? "";
      const size = (order as any).size ?? "";
      const dateStr = format(new Date(order.createdAt), "yyyy/MM/dd");
      const logoEl = logoB64
        ? `<img src="${logoB64}" class="logo-img" alt="${brandName}" />`
        : ``;

      // Parse city from address (use first word or the whole short address as city)
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
            <div class="brand-city">${brandName} CAIRO</div>
            <div class="inv-date">${dateStr}</div>
          </div>

          <!-- BODY -->
          <div class="inv-body">

            <!-- Customer -->
            <div class="field-row">
              <span class="field-label">اسم العميل</span>
              <span class="field-val large">الاسم: ${order.customerName}</span>
            </div>

            <!-- Product table -->
            <table class="prod-table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>المقاس</th>
                  <th>اللون</th>
                  <th>العدد</th>
                  <th>القيمة بالجنيه</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="name-col">${order.product}</td>
                  <td>${size || "—"}</td>
                  <td>${color || "—"}</td>
                  <td>${order.quantity}</td>
                  <td>${formatCurrency(order.unitPrice)}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3" style="text-align:right">الإجمالي</td>
                  <td>${order.quantity}</td>
                  <td>${formatCurrency(order.totalPrice)}</td>
                </tr>
              </tbody>
            </table>

            <!-- Address -->
            <div class="addr-grid">
              <div class="addr-field">
                <span class="al">المحافظة</span>
                <span class="av">${order.city ?? ""}</span>
              </div>
              <div class="addr-field">
                <span class="al">المركز/المنطقة</span>
                <span class="av">&nbsp;</span>
              </div>
              <div class="addr-field" style="grid-column:span 2">
                <span class="al">اسم الشارع</span>
                <span class="av">${address}</span>
              </div>
              <div class="addr-field">
                <span class="al">منزل رقم</span>
                <span class="av">&nbsp;</span>
              </div>
              <div class="addr-field">
                <span class="al">رقم التتبع</span>
                <span class="av">${trackingNumber || "&nbsp;"}</span>
              </div>
            </div>

            <!-- Delivery -->
            <div class="delivery-row">
              <div class="delivery-field">
                <span class="dl">تاريخ التسليم الملزم</span>
                <span class="dv">&nbsp;</span>
              </div>
              <div class="delivery-field">
                <span class="dl">الوقت المتاح للتسليم</span>
                <span class="dv">${company ? "شركة: " + company.name : "&nbsp;"}</span>
              </div>
            </div>

            <!-- Communication note -->
            <div class="note-box">
              <b>في حاله هناك مشاكل تواصل:</b>
              (الذهاب للعنوان مباشره)
              ( - عدم الذهاب الا بالتاكيد المسبق )
            </div>

            <!-- Shipping confirmation -->
            <div class="confirm-box">
              <span class="cb-label">التاكيد علي الشحن:</span>
              <span>تم التاكيد مع العميل — في حاله عدم الاستلام بيتم دفع مصاريف الشحن كامله المتفق عليها</span>
            </div>

          </div>

          <!-- FOOTER: phone + policy -->
          <div class="inv-footer">
            <div class="phone-block">
              <span class="phone-label">رقم الهاتف</span>
              <span class="phone-val">${order.phone ?? "—"}</span>
            </div>
            <div class="policy-txt">
              <b style="color:#111;font-size:6pt">سياسه التعامل:</b>
              الاسترجاع فقط اثناء تواجد المندوب. الاستبدال خلال 7 أيام من الشحن.
              المنتج بضمان 6 أشهر. يلزم الحفاظ بالفاتوره.
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
          <p className="text-muted-foreground text-sm mt-0.5">اختر الطلبات واطبع 4 فواتير في صفحة A4 واحدة</p>
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
      </div>

      {/* Preview cards */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : orders?.length ? (
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
          <p className="font-bold">لا توجد طلبات</p>
          <p className="text-sm text-muted-foreground mt-1">سيظهر هنا الطلبات بعد إنشائها</p>
        </Card>
      )}
    </div>
  );
}
