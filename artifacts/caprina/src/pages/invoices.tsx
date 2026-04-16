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
  received: "استلم",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending: "text-amber-600 border-amber-600",
  received: "text-emerald-600 border-emerald-600",
  delayed: "text-blue-600 border-blue-600",
  returned: "text-red-600 border-red-600",
  partial_received: "text-purple-600 border-purple-600",
};

export default function Invoices() {
  const [location] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preselectedId = params.get("orderId") ? Number(params.get("orderId")) : null;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(preselectedId ? new Set([preselectedId]) : new Set());
  const [statusFilter, setStatusFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: orders, isLoading } = useListOrders({ status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });

  const formatCurrency = (n: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

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
      @page { size: A4; margin: 8mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Cairo', 'Segoe UI', sans-serif; direction: rtl; background: white; color: black; }
      .page { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 4mm; width: 100%; height: 277mm; page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      .invoice { border: 2px solid #111; padding: 5mm; background: white; overflow: hidden; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 3mm; margin-bottom: 3mm; }
      .brand { font-size: 16pt; font-weight: 900; letter-spacing: 1px; }
      .brand-sub { font-size: 6pt; color: #666; letter-spacing: 2px; }
      .order-no { font-size: 9pt; font-weight: bold; color: #111; }
      .date { font-size: 7pt; color: #444; }
      .section { margin-bottom: 2.5mm; }
      .section-label { font-size: 6.5pt; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1mm; }
      .section-val { font-size: 9pt; font-weight: bold; }
      .divider { border: none; border-top: 1px dashed #ccc; margin: 2mm 0; }
      .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1mm; }
      .total-row { border-top: 2pt solid #111; margin-top: 2mm; padding-top: 2mm; display: flex; justify-content: space-between; }
      .total-label { font-size: 9pt; font-weight: bold; }
      .total-val { font-size: 12pt; font-weight: 900; }
      .status-badge { border: 1.5px solid; padding: 1mm 3mm; font-size: 7pt; font-weight: bold; display: inline-block; }
      .footer { margin-top: auto; padding-top: 2mm; border-top: 1px solid #ccc; font-size: 6pt; color: #888; text-align: center; }
    `;

    const invoiceHTML = (order: (typeof selected)[0], i: number) => {
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
            <div class="section-label">اسم العميل</div>
            <div class="section-val">${order.customerName}</div>
            ${order.phone ? `<div style="font-size:7.5pt;color:#444;margin-top:0.5mm">📞 ${order.phone}</div>` : ""}
            ${order.address ? `<div style="font-size:7.5pt;color:#444;margin-top:0.5mm">📍 ${order.address}</div>` : ""}
          </div>
          <hr class="divider"/>
          <div class="section">
            <div class="row"><span style="font-size:7pt;color:#888">المنتج</span><span style="font-size:8pt;font-weight:bold">${order.product}</span></div>
            ${((order as any).color || (order as any).size) ? `<div class="row"><span style="font-size:7pt;color:#888">اللون / المقاس</span><span style="font-size:8pt">${[(order as any).color, (order as any).size].filter(Boolean).join(" — ")}</span></div>` : ""}
            <div class="row"><span style="font-size:7pt;color:#888">الكمية</span><span style="font-size:8pt">${order.quantity}</span></div>
            <div class="row"><span style="font-size:7pt;color:#888">سعر الوحدة</span><span style="font-size:8pt">${formatCurrency(order.unitPrice)}</span></div>
            ${company ? `<div class="row"><span style="font-size:7pt;color:#888">شركة الشحن</span><span style="font-size:8pt">${company.name}</span></div>` : ""}
          </div>
          <div class="total-row">
            <span class="total-label">الإجمالي</span>
            <span class="total-val">${formatCurrency(order.totalPrice)}</span>
          </div>
          <div style="margin-top:2mm">
            <span class="status-badge">${statusLabels[order.status] || order.status}</span>
            ${order.partialQuantity ? `<span style="font-size:7pt;color:#666;margin-right:2mm">مستلم: ${order.partialQuantity} وحدة</span>` : ""}
          </div>
          ${order.notes ? `<div style="margin-top:2mm;font-size:7pt;color:#666;font-style:italic">${order.notes}</div>` : ""}
          <div class="footer">CAPRINA Sales System • WIN OR DIE</div>
        </div>
      `;
    };

    const pagesHTML = groups.map(group => {
      const invoices = group.map((o, i) => invoiceHTML(o, i)).join("");
      const empties = group.length < 4 ? Array(4 - group.length).fill('<div class="invoice" style="border:1px dashed #eee;background:#fafafa;"></div>').join("") : "";
      return `<div class="page">${invoices}${empties}</div>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html lang="ar"><head><meta charset="UTF-8"><title>فواتير CAPRINA</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"><style>${styles}</style></head><body>${pagesHTML}</body></html>`);
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

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm bg-card border-border">
            <SelectValue placeholder="تصفية" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الطلبات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
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
                    <span className="font-bold text-primary">{new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(order.totalPrice)}</span>
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
