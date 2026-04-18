import { useListOrders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi } from "@/lib/api";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText, CheckSquare, Square } from "lucide-react";
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
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export default function Invoices() {
  const [location] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preselectedId = params.get("orderId") ? Number(params.get("orderId")) : null;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(preselectedId ? new Set([preselectedId]) : new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    const selected = orders?.filter(o => selectedIds.has(o.id)) ?? [];
    if (!selected.length) { alert("اختر طلبات للطباعة أولاً."); return; }

    const groups: typeof selected[] = [];
    for (let i = 0; i < selected.length; i += 4) groups.push(selected.slice(i, i + 4));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      @page { size: A4; margin: 6mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; background: white; color: #111; }
      .page { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5mm; width: 100%; height: 282mm; page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      .invoice { border: 2px solid #222; border-radius: 3mm; padding: 5mm; background: white; overflow: hidden; display: flex; flex-direction: column; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 3mm; margin-bottom: 3mm; }
      .brand { font-size: 18pt; font-weight: 900; letter-spacing: 2px; color: #111; }
      .brand-sub { font-size: 5.5pt; color: #888; letter-spacing: 3px; text-transform: uppercase; margin-top: 0.5mm; }
      .order-no { font-size: 10pt; font-weight: 900; color: #111; }
      .date { font-size: 7pt; color: #666; margin-top: 0.5mm; }
      .section { margin-bottom: 2.5mm; }
      .section-label { font-size: 6pt; color: #999; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 0.8mm; }
      .section-val { font-size: 9.5pt; font-weight: 700; color: #111; }
      .contact { font-size: 7.5pt; color: #555; margin-top: 0.5mm; }
      .divider { border: none; border-top: 1px dashed #bbb; margin: 2.5mm 0; }
      .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5mm; }
      .row-label { font-size: 7pt; color: #888; }
      .row-val { font-size: 8.5pt; font-weight: 600; color: #111; }
      .total-box { margin-top: auto; border-top: 2.5pt solid #111; padding-top: 2.5mm; display: flex; justify-content: space-between; align-items: center; }
      .total-label { font-size: 10pt; font-weight: 700; }
      .total-val { font-size: 14pt; font-weight: 900; color: #111; }
      .status-badge { border: 2px solid #111; padding: 1mm 4mm; font-size: 7.5pt; font-weight: 700; border-radius: 1mm; display: inline-block; margin-top: 2mm; }
      .footer { border-top: 1px solid #ddd; margin-top: 2mm; padding-top: 1.5mm; font-size: 6pt; color: #aaa; text-align: center; }
      .empty-slot { border: 1.5px dashed #e0e0e0; border-radius: 3mm; background: #fafafa; }
    `;

    const invoiceHTML = (order: (typeof selected)[0]) => {
      const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
      return `
        <div class="invoice">
          <div class="header">
            <div>
              <div class="brand">CAPRINA</div>
              <div class="brand-sub">WIN OR DIE</div>
            </div>
            <div style="text-align:left">
              <div class="order-no">فاتورة #${order.id.toString().padStart(4,"0")}</div>
              <div class="date">${format(new Date(order.createdAt), "yyyy/MM/dd")}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-label">بيانات العميل</div>
            <div class="section-val">${order.customerName}</div>
            ${order.phone ? `<div class="contact">هاتف: ${order.phone}</div>` : ""}
            ${order.address ? `<div class="contact">العنوان: ${order.address}</div>` : ""}
          </div>

          <hr class="divider"/>

          <div class="section">
            <div class="section-label">تفاصيل الطلب</div>
            <div class="row"><span class="row-label">المنتج</span><span class="row-val">${order.product}</span></div>
            ${((order as any).color || (order as any).size) ? `<div class="row"><span class="row-label">اللون / المقاس</span><span class="row-val">${[(order as any).color, (order as any).size].filter(Boolean).join(" · ")}</span></div>` : ""}
            <div class="row"><span class="row-label">الكمية</span><span class="row-val">${order.quantity} وحدة</span></div>
            <div class="row"><span class="row-label">سعر الوحدة</span><span class="row-val">${formatCurrency(order.unitPrice)}</span></div>
            ${company ? `<div class="row"><span class="row-label">شركة الشحن</span><span class="row-val">${company.name}</span></div>` : ""}
          </div>

          <div class="total-box">
            <span class="total-label">الإجمالي</span>
            <span class="total-val">${formatCurrency(order.totalPrice)}</span>
          </div>

          <div>
            <span class="status-badge">${statusLabels[order.status] || order.status}</span>
            ${order.partialQuantity ? `<span style="font-size:7pt;color:#666;margin-right:2mm">مستلم: ${order.partialQuantity} وحدة</span>` : ""}
          </div>

          ${order.notes ? `<div style="margin-top:2mm;font-size:7pt;color:#777;border-right:2px solid #ddd;padding-right:2mm">${order.notes}</div>` : ""}

          <div class="footer">CAPRINA Sales System &bull; جنيه مصري &bull; WIN OR DIE</div>
        </div>
      `;
    };

    const pagesHTML = groups.map(group => {
      const invoices = group.map(o => invoiceHTML(o)).join("");
      const empties = group.length < 4 ? Array(4 - group.length).fill('<div class="empty-slot"></div>').join("") : "";
      return `<div class="page">${invoices}${empties}</div>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فواتير CAPRINA</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${pagesHTML}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">اختر الطلبات واطبع 4 فواتير في صفحة A4 واحدة</p>
        </div>
        <Button onClick={handlePrint} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm" disabled={selectedIds.size === 0}>
          <Printer className="w-4 h-4" />طباعة ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm bg-card border-border">
            <SelectValue placeholder="تصفية" />
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
        {selectedIds.size > 0 && <span className="text-xs text-primary font-bold">{selectedIds.size} محدد</span>}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : orders?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            const company = shippingCompanies?.find(c => c.id === order.shippingCompanyId);
            return (
              <Card
                key={order.id}
                onClick={() => toggleSelect(order.id)}
                className={`border p-4 cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80 hover:bg-muted/10"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isSelected ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="font-bold text-sm">{order.customerName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">#{order.id.toString().padStart(4,"0")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold border ${statusClasses[order.status] || ""}`}>
                    {statusLabels[order.status]}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{order.product} × {order.quantity}</span>
                    <span className="font-bold text-primary">{formatCurrency(order.totalPrice)}</span>
                  </div>
                  {company && <p className="text-muted-foreground">🚚 {company.name}</p>}
                  {order.phone && <p className="text-muted-foreground">📞 {order.phone}</p>}
                  <p className="text-muted-foreground">{format(new Date(order.createdAt), "yyyy/MM/dd")}</p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border p-12 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="font-bold">لا توجد طلبات</p>
        </Card>
      )}
    </div>
  );
}
