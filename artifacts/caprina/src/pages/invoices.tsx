import { useListOrders } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { shippingApi, ordersApi } from "@/lib/api";
import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileText, CheckSquare, Square } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";

const statusLabels: Record<string, string> = {
  pending:          "قيد الانتظار",
  warehouse_ready:  "قيد الشحن في المخزن",
  in_shipping:      "قيد الشحن",
  received:         "استلم",
  delayed:          "مؤجل",
  returned:         "مرتجع",
  partial_received: "استلم جزئي",
};

const statusClasses: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  warehouse_ready:  "bg-teal-50    dark:bg-teal-900/30    text-teal-700    dark:text-teal-400    border-teal-300    dark:border-teal-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(n);

type InvoiceListStatus = "all" | "in_shipping" | "received" | "delayed" | "returned" | "partial_received";

export default function Invoices() {
  const { brand } = useBrand();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const preselectedInvoiceNumber = params.get("invoiceNumber");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    preselectedInvoiceNumber
      ? new Set([preselectedInvoiceNumber])
      : new Set()
  );
  const [statusFilter, setStatusFilter] = useState<InvoiceListStatus>("all");
  const [perPage, setPerPage] = useState<number>(4);

  const { data: allOrders, isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: shippingCompanies } = useQuery({ queryKey: ["shipping"], queryFn: shippingApi.list });
  const { data: directInvoiceOrders, isLoading: isDirectInvoiceLoading } = useQuery({
    queryKey: ["invoice-direct-print", preselectedInvoiceNumber],
    queryFn: () => ordersApi.byInvoice(preselectedInvoiceNumber!),
    enabled: !!preselectedInvoiceNumber,
  });
  const { data: manifestData } = useQuery({
    queryKey: ["in-manifest-ids"],
    queryFn: ordersApi.inManifestIds,
  });

  const rawOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(o => {
      // لو فيه فلتر محدد (مش "all") → نطبقه بدقة
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      // لو "all" → نعرض بس warehouse_ready (قيد الشحن في المخزن)
      if (statusFilter === "all" && o.status !== "warehouse_ready") return false;
      return true;
    });
  }, [allOrders, statusFilter]);

  // ─── Group orders by invoiceNumber ───────────────────────────────────────
  type InvoiceGroup = {
    invoiceNumber: string;
    representativeId: number;
    orders: typeof rawOrders;
    customerName: string;
    totalPrice: number;
    status: string;
    createdAt: string;
    phone: string | null;
    city: string | null;
  };

  const invoiceGroups = useMemo<InvoiceGroup[]>(() => {
    const map = new Map<string, { rep: (typeof rawOrders)[0]; orders: typeof rawOrders }>();
    for (const o of rawOrders) {
      const key = (o as any).invoiceNumber ?? `solo-${o.id}`;
      if (!map.has(key)) {
        // ─── نبني orders من _invoiceOrders لو موجودة (كل منتجات الفاتورة)
        const invoiceOrders: any[] | undefined = (o as any)._invoiceOrders;
        const realOrders = (invoiceOrders && invoiceOrders.length > 0)
          ? (invoiceOrders as typeof rawOrders)
          : [o];
        map.set(key, { rep: o, orders: realOrders });
      } else {
        // ─── لو الـ key موجود بالفعل، دمج الـ orders بدل ما نتجاهلها
        // ده بيحصل لو _invoiceOrders مجاش كاملة من الأول
        const existing = map.get(key)!;
        const alreadyHasId = existing.orders.some((x: any) => x.id === o.id);
        if (!alreadyHasId) {
          existing.orders = [...existing.orders, o];
        }
      }
    }

    if (
      preselectedInvoiceNumber &&
      directInvoiceOrders?.length &&
      !map.has(preselectedInvoiceNumber)
    ) {
      map.set(preselectedInvoiceNumber, {
        rep: directInvoiceOrders[0] as (typeof rawOrders)[0],
        orders: directInvoiceOrders as typeof rawOrders,
      });
    }

    return Array.from(map.entries()).map(([invoiceNumber, { rep, orders }]) => ({
      invoiceNumber,
      representativeId: rep.id,
      orders,
      customerName: rep.customerName,
      totalPrice: orders.reduce((s, o) => s + o.totalPrice, 0),
      status: rep.status,
      createdAt: rep.createdAt,
      phone: rep.phone ?? null,
      city: (rep as any).city ?? null,
    }));
  }, [rawOrders, directInvoiceOrders, preselectedInvoiceNumber]);

  // ─── Pre-fetch real orders for ALL invoices on load ───────────────────────
  // هنجيب كل المنتجات الحقيقية لكل فاتورة مرة واحدة عند تحميل الصفحة
  // ده بيضمن إن كل الفواتير عندها كل منتجاتها حتى لو _invoiceOrders مجتش
  const [realOrdersCache, setRealOrdersCache] = useState<Map<string, any[]>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!invoiceGroups.length) return;

    const toFetch = invoiceGroups.filter(grp =>
      grp.invoiceNumber &&
      !grp.invoiceNumber.startsWith("solo-") &&
      !fetchedRef.current.has(grp.invoiceNumber)
    );

    if (!toFetch.length) return;

    toFetch.forEach(grp => fetchedRef.current.add(grp.invoiceNumber));

    Promise.all(
      toFetch.map(async grp => {
        try {
          const orders = await ordersApi.byInvoice(grp.invoiceNumber);
          // فلتر: نحتفظ بس بالـ orders اللي حالتها زي الفلتر الحالي
          const filtered = (statusFilter !== "all")
            ? orders.filter((o: any) => o.status === statusFilter)
            : orders.filter((o: any) => o.status !== "pending" && o.status !== "in_shipping");
          if (filtered && filtered.length > 0) {
            return { key: grp.invoiceNumber, orders: filtered };
          }
        } catch {}
        return { key: grp.invoiceNumber, orders: grp.orders };
      })
    ).then(results => {
      setRealOrdersCache(prev => {
        const next = new Map(prev);
        results.forEach(r => next.set(r.key, r.orders));
        return next;
      });
    });
  }, [invoiceGroups, statusFilter]);

  // ─── Reset cache when filter changes ─────────────────────────────────────
  useEffect(() => {
    setRealOrdersCache(new Map());
    fetchedRef.current = new Set();
  }, [statusFilter]);

  const toggleSelect = (invoiceNumber: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(invoiceNumber)) next.delete(invoiceNumber);
      else next.add(invoiceNumber);
      return next;
    });
  };

  const isSelected = (invoiceNumber: string) => selectedIds.has(invoiceNumber);

  const selectAll = () => { setSelectedIds(new Set(invoiceGroups.map(g => g.invoiceNumber))); };
  const clearAll  = () => setSelectedIds(new Set());

  const handlePrint = async (invoiceNumbers = selectedIds) => {
    const selected = invoiceGroups.filter(g => invoiceNumbers.has(g.invoiceNumber));
    if (!selected.length) { alert("اختر فواتير للطباعة أولاً."); return; }

    // ── جيب الأوردرات الحقيقية دايماً من السيرفر مباشرة عشان نضمن كل المنتجات
    const realOrdersMap = new Map<string, any[]>();

    await Promise.all(
      selected.map(async (grp) => {
        // solo orders — استخدم grp.orders مباشرة
        if (grp.invoiceNumber.startsWith("solo-")) {
          realOrdersMap.set(grp.invoiceNumber, grp.orders);
          return;
        }

        // ─── دايماً نطلب من byInvoice API عشان نضمن كل المنتجات (مش الـ merged row)
        try {
          const orders = await ordersApi.byInvoice(grp.invoiceNumber);
          if (orders && orders.length > 0) {
            realOrdersMap.set(grp.invoiceNumber, orders);
            return;
          }
        } catch {}

        // fallback: الـ cache لو الـ API فشل
        if (realOrdersCache.has(grp.invoiceNumber)) {
          const cached = realOrdersCache.get(grp.invoiceNumber)!;
          if (cached.length > 0) {
            realOrdersMap.set(grp.invoiceNumber, cached);
            return;
          }
        }

        // fallback نهائي: directInvoiceOrders لو مطابقة
        if (directInvoiceOrders && directInvoiceOrders.length > 0 &&
            (directInvoiceOrders[0] as any).invoiceNumber === grp.invoiceNumber) {
          realOrdersMap.set(grp.invoiceNumber, directInvoiceOrders as any[]);
          return;
        }

        realOrdersMap.set(grp.invoiceNumber, grp.orders);
      })
    );

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

    const pageGroups: typeof selected[] = [];
    for (let i = 0; i < selected.length; i += perPage) pageGroups.push(selected.slice(i, i + perPage));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap');
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
        direction: rtl; background: white; color: #111; font-size: 9pt;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .page {
        display: grid;
        ${perPage === 1 ? "grid-template-columns: 1fr; grid-template-rows: 1fr;" :
          perPage === 2 ? "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;" :
          "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;"}
        gap: 2mm; width: 297mm; height: 210mm; padding: 3mm;
        page-break-after: always;
      }
      .page:last-child { page-break-after: avoid; }

      .inv {
        border: 1.5px solid #1a1a1a; border-radius: 2mm;
        display: flex; flex-direction: column;
        overflow: hidden; background: white;
        min-height: 0; min-width: 0;
      }

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

      .cust-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.2mm 3mm; border-bottom: 1px solid #ddd;
        background: #f9f9f9; flex-shrink: 0; gap: 2mm;
      }
      .cust-phone { font-size: 9pt; font-weight: 700; direction: ltr; }
      .cust-name  { font-size: 11pt; font-weight: 900; }

      .inv-body { padding: 1.5mm 3mm; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 1mm; justify-content: space-between; overflow: hidden; }

      .prod-table { width: 100%; border-collapse: collapse; flex-shrink: 1; }
      .prod-table th {
        background: #1a1a1a; color: white; border: 0.5px solid #333;
        padding: 0.8mm 1mm; font-weight: 700; font-size: 7pt; text-align: center;
      }
      .prod-table td {
        border: 0.5px solid #ddd; padding: 0.8mm 1mm;
        text-align: center; font-size: 7pt; vertical-align: middle;
        line-height: 1.2;
      }
      .prod-table td.name-col { text-align: right; font-weight: 700; }
      .prod-table .total-row td {
        background: #f0f0f0; font-weight: 900; font-size: 7pt; border-color: #bbb; color: #111;
      }
      .prod-table .total-row td.t-label { text-align: right; }

      .info-strip {
        display: grid; grid-template-columns: 1fr 1fr 1fr;
        border: 0.5px solid #ddd; border-radius: 1mm;
        overflow: hidden; flex-shrink: 0;
      }
      .info-cell { padding: 0.8mm 1.5mm; border-left: 0.5px solid #ddd; display: flex; flex-direction: column; }
      .info-cell:last-child { border-left: none; }
      .info-lbl { font-size: 5.5pt; color: #999; }
      .info-val { font-size: 7pt; font-weight: 700; min-height: 3mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .addr-box { border: 0.5px solid #ddd; border-radius: 1mm; padding: 0.8mm 1.5mm; flex-shrink: 0; }
      .addr-lbl { font-size: 5.5pt; color: #999; }
      .addr-val { font-size: 7.5pt; font-weight: 700; word-break: break-word; line-height: 1.4; }

      .notes-box {
        background: #fff8e1; border: 0.5px solid #ffe082;
        border-right: 3px solid #f59e0b; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6.5pt; color: #333;
        display: flex; gap: 1.5mm; flex-shrink: 0; line-height: 1.5;
      }
      .notes-box b { color: #b45309; white-space: nowrap; font-size: 7pt; }

      .confirm-box {
        border: 0.8px solid #bbb; border-radius: 1mm;
        padding: 1.2mm 2mm; font-size: 6pt; color: #333; flex-shrink: 0;
        display: flex; gap: 1.5mm; align-items: flex-start; line-height: 1.5;
        background: #fafafa;
      }
      .confirm-box .cb-lbl { font-weight: 900; color: #111; font-size: 6.5pt; white-space: nowrap; }

      .inv-footer {
        border-top: 1.5px solid #1a1a1a; background: #1a1a1a;
        padding: 1.5mm 3mm; flex-shrink: 0;
        display: flex; justify-content: space-between; align-items: center; gap: 2mm;
      }
      .policy-txt   { font-size: 5.5pt; color: #aaa; text-align: left; line-height: 1.5; }
      .footer-brand { font-size: 7pt; font-weight: 900; color: #fff; letter-spacing: 2px; }

      .empty-slot { border: 1px dashed #ddd; border-radius: 2mm; background: #fafafa; }
    `;

    const invoiceHTML = (grp: InvoiceGroup) => {
      // ─── استخدم الأوردرات من realOrdersMap (تم تحميلها مسبقاً أو الآن)
      const realOrders = realOrdersMap.get(grp.invoiceNumber) ?? grp.orders;
      const rep            = realOrders[0];
      const company        = shippingCompanies?.find(c => c.id === rep.shippingCompanyId);
      const trackingNumber = (rep as any).trackingNumber ?? (rep as any).tracking_number ?? "";
      const notes          = (rep as any).notes ?? (rep as any).note ?? (rep as any).orderNotes ?? "";
      const shippingCost   = (rep as any).shippingCost ?? (rep as any).shipping_cost ?? 0;
      const dateStr        = format(new Date(grp.createdAt), "yyyy/MM/dd");
      const logoEl         = logoB64
        ? `<img src="${logoB64}" class="logo-img" alt="${brandName}" />`
        : ``;
      const address        = rep.address ?? "";
      const orderNum       = String(rep.id).padStart(4, "0");
      const city           = (rep as any).city ?? "";

      // ── Build product rows: كل أوردر = صف، نـ merge اللي نفس المنتج+لون+مقاس+سعر
      type FlatRow = { product: string; color: string; size: string; quantity: number; partialQuantity: number | null; unitPrice: number; totalPrice: number; };

      const mergedMap = new Map<string, FlatRow>();
      for (const o of realOrders) {
        const color = (o as any).color ?? "";
        const size  = (o as any).size  ?? "";
        const key   = `${o.product}|||${color}|||${size}|||${o.unitPrice}`;
        if (mergedMap.has(key)) {
          const ex = mergedMap.get(key)!;
          ex.quantity   += o.quantity;
          ex.totalPrice  = parseFloat((ex.totalPrice + o.totalPrice).toFixed(2));
          if ((o as any).partialQuantity != null) ex.partialQuantity = (ex.partialQuantity ?? 0) + (o as any).partialQuantity;
        } else {
          mergedMap.set(key, {
            product: o.product,
            color, size,
            quantity: o.quantity,
            partialQuantity: (o as any).partialQuantity ?? null,
            unitPrice: o.unitPrice,
            totalPrice: o.totalPrice,
          });
        }
      }

      const rowCount = mergedMap.size;
      const maxRowsNoScale = perPage === 4 ? 4 : perPage === 2 ? 8 : 15;
      const scaleFactor = rowCount <= maxRowsNoScale
        ? 1
        : Math.max(0.6, maxRowsNoScale / rowCount);
      const tblFontSize = (7 * scaleFactor).toFixed(1);
      const cellPad = scaleFactor < 0.85 ? "0.4mm 0.8mm" : "0.8mm 1mm";

      const productRows = Array.from(mergedMap.values()).map(r => {
        const displayQty = r.partialQuantity != null ? `${r.partialQuantity} / ${r.quantity}` : `${r.quantity}`;
        return `
          <tr>
            <td class="name-col" style="padding:${cellPad}">${r.product}</td>
            <td style="padding:${cellPad}">${r.size || "&#8212;"}</td>
            <td style="padding:${cellPad}">${r.color || "&#8212;"}</td>
            <td style="font-weight:900;padding:${cellPad}">${displayQty}</td>
            <td style="padding:${cellPad}">${formatCurrency(r.unitPrice)}</td>
            <td style="font-weight:900;padding:${cellPad}">${formatCurrency(r.totalPrice)}</td>
          </tr>`;
      }).join("");

      const totalQty   = realOrders.reduce((s: number, o: any) => s + o.quantity, 0);
      const totalPrice = realOrders.reduce((s: number, o: any) => s + o.totalPrice, 0);

      return `
        <div class="inv">
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

          <div class="cust-row">
            <div class="cust-phone">&#128222; ${grp.phone ?? "&#8212;"}</div>
            <div class="cust-name">${grp.customerName}</div>
          </div>

          <div class="inv-body">
            <table class="prod-table" style="font-size:${tblFontSize}pt">
              <thead>
                <tr>
                  <th style="width:30%;padding:${cellPad}">الصنف</th>
                  <th style="width:14%;padding:${cellPad}">المقاس</th>
                  <th style="width:18%;padding:${cellPad}">اللون</th>
                  <th style="width:10%;padding:${cellPad}">العدد</th>
                  <th style="width:14%;padding:${cellPad}">السعر</th>
                  <th style="width:14%;padding:${cellPad}">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
                ${shippingCost > 0 ? `<tr>
                  <td class="name-col" colspan="4" style="color:#777;font-size:${(parseFloat(tblFontSize)*0.85).toFixed(1)}pt;padding:${cellPad}">مصاريف الشحن</td>
                  <td colspan="2" style="font-weight:700;padding:${cellPad}">${formatCurrency(shippingCost)}</td>
                </tr>` : ""}
                <tr class="total-row">
                  <td class="t-label" colspan="3" style="padding:${cellPad}">&#9679; الإجمالي الكلي</td>
                  <td style="font-weight:900;padding:${cellPad}">${totalQty}</td>
                  <td colspan="2" style="font-weight:900;padding:${cellPad}">${formatCurrency(totalPrice + shippingCost)}</td>
                </tr>
              </tbody>
            </table>

            <div class="info-strip">
              <div class="info-cell">
                <span class="info-lbl">المحافظة</span>
                <span class="info-val">${city || "&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">شركة الشحن</span>
                <span class="info-val">${company ? company.name : "&#8212;"}</span>
              </div>
              <div class="info-cell">
                <span class="info-lbl">رقم التتبع</span>
                <span class="info-val" style="direction:ltr;text-align:right">${trackingNumber || "&#8212;"}</span>
              </div>
            </div>

            <div class="addr-box">
              <div class="addr-lbl">العنوان بالتفصيل</div>
              <div class="addr-val">${address || "&#8212;"}</div>
            </div>

            <div class="notes-box">
              <b>&#128203; ملاحظات:</b>
              <span>${notes || "&#8212;"}</span>
            </div>

            <div class="confirm-box">
              <span class="cb-lbl">&#10003; التاكيد علي الشحن:</span>
              <span>تم التاكيد مع العميل &#8212; في حاله عدم الاستلام بيتم دفع مصاريف الشحن كامله المتفق عليها</span>
            </div>
          </div>

          <div class="inv-footer">
            <div class="policy-txt">الاسترجاع فقط اثناء تواجد المندوب &middot; الاستبدال خلال 7 أيام &middot; ضمان 6 أشهر &middot; احتفظ بالفاتورة</div>
            <div class="footer-brand">${brandName}</div>
          </div>
        </div>
      `;
    };

    const pagesHTML = pageGroups.map(group => {
      const invoices = group.map(g => invoiceHTML(g)).join("");
      const empties = group.length < perPage
        ? Array(perPage - group.length).fill('<div class="empty-slot"></div>').join("")
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

  const autoPrintTriggeredRef = useRef(false);
  useEffect(() => {
    if (!preselectedInvoiceNumber || autoPrintTriggeredRef.current) return;
    if (isLoading || isDirectInvoiceLoading || !invoiceGroups.length) return;
    if (!invoiceGroups.some(g => g.invoiceNumber === preselectedInvoiceNumber)) return;

    // ─── تأكد إن الـ cache للـ invoice المطلوبة موجود أو إن directInvoiceOrders جاهزة
    const grp = invoiceGroups.find(g => g.invoiceNumber === preselectedInvoiceNumber);
    const hasCache = realOrdersCache.has(preselectedInvoiceNumber);
    const hasDirectOrders = directInvoiceOrders && directInvoiceOrders.length > 0;
    const ordersReady = hasCache || hasDirectOrders || (grp && grp.orders.length > 1);
    if (!ordersReady) return;

    const nextSelectedIds = new Set([preselectedInvoiceNumber]);
    setSelectedIds(nextSelectedIds);
    autoPrintTriggeredRef.current = true;
    void handlePrint(nextSelectedIds);
  }, [preselectedInvoiceNumber, isLoading, isDirectInvoiceLoading, invoiceGroups, realOrdersCache, directInvoiceOrders]);

  return (
    <div className="space-y-5 animate-in fade-in duration-500" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تظهر الطلبات من مرحلة «قيد الشحن في المخزن» فما بعد — الطلبات قيد الانتظار لا تظهر هنا</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">فواتير في الصفحة:</span>
          <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
            <SelectTrigger className="w-24 h-9 text-sm bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 فاتورة</SelectItem>
              <SelectItem value="2">2 فواتير</SelectItem>
              <SelectItem value="4">4 فواتير</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void handlePrint()} className="gap-2 font-bold text-sm" disabled={selectedIds.size === 0}>
          <Printer className="w-4 h-4" />
          طباعة ({selectedIds.size})
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InvoiceListStatus)}>
          <SelectTrigger className="w-44 h-9 text-sm bg-card border-border">
            <SelectValue placeholder="تصفية بالحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="warehouse_ready">قيد الشحن في المخزن</SelectItem>
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
          <span className="text-xs text-muted-foreground mr-auto">{invoiceGroups.length} فاتورة</span>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">جاري التحميل...</div>
      ) : invoiceGroups.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {invoiceGroups.map((grp) => {
            const sel = isSelected(grp.invoiceNumber);
            const company = shippingCompanies?.find(c => c.id === grp.orders[0].shippingCompanyId);
            // ─── استخدم الأوردرات من الـ cache لو موجودة، وإلا grp.orders
            const displayOrders = realOrdersCache.get(grp.invoiceNumber) ?? grp.orders;
            const isGroup = displayOrders.length > 1;
            return (
              <Card
                key={grp.invoiceNumber}
                onClick={() => toggleSelect(grp.invoiceNumber)}
                className={`border p-4 cursor-pointer transition-all select-none ${
                  sel
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {sel
                      ? <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="font-bold text-sm leading-tight">{grp.customerName}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-muted-foreground font-mono">#{grp.representativeId.toString().padStart(4,"0")}</p>
                        {isGroup && (
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{displayOrders.length} منتجات</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold border shrink-0 ${statusClasses[grp.status] || ""}`}>
                    {statusLabels[grp.status]}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {isGroup ? (
                    <div className="space-y-0.5">
                      {displayOrders.map((o: any) => (
                        <div key={o.id} className="flex justify-between">
                          <span className="font-medium text-foreground truncate">{o.product} ×{o.quantity}</span>
                          <span className="font-bold text-primary shrink-0 mr-1">{formatCurrency(o.totalPrice)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t border-border pt-1 mt-1">
                        <span className="font-bold text-foreground">الإجمالي</span>
                        <span className="font-bold text-primary">{formatCurrency(displayOrders.reduce((s: number, o: any) => s + o.totalPrice, 0))}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">{displayOrders[0].product} ×{displayOrders[0].quantity}</span>
                      <span className="font-bold text-primary">{formatCurrency(displayOrders[0].totalPrice)}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    {company && <span>🚚 {company.name}</span>}
                  </div>
                  {grp.phone && <p className="font-mono text-[11px]">📞 {grp.phone}</p>}
                  {grp.city  && <p>📍 {grp.city}</p>}
                  <p className="text-[10px] opacity-60">{format(new Date(grp.createdAt), "yyyy/MM/dd")}</p>
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
