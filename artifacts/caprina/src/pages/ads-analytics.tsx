import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Megaphone, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Package, X, Download, ExternalLink, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { teamAnalyticsApi, ordersApi, type CampaignStats } from "@/lib/api";

const fmt = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtNum = (n: number) => new Intl.NumberFormat("ar-EG").format(n);
const fmtPct = (n: number) => `${n}%`;

const SOURCE_META: Record<string, { label: string; color: string; bg: string; hex: string; icon: React.ReactNode }> = {
  facebook:  { label: "فيسبوك",   color: "text-blue-500",    bg: "bg-blue-500/10",    hex: "#1877F2", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#1877F2"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
  )},
  tiktok:    { label: "تيك توك",  color: "text-pink-400",    bg: "bg-pink-500/10",    hex: "#FF0050", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.73a8.19 8.19 0 004.84 1.56V6.84a4.85 4.85 0 01-1.07-.15z"/></svg>
  )},
  instagram: { label: "إنستجرام", color: "text-purple-400",  bg: "bg-purple-500/10",  hex: "#d6249f", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="url(#igGrad)"><defs><radialGradient id="igGrad" cx="30%" cy="107%" r="150%"><stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/><stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/><stop offset="90%" stopColor="#285AEB"/></radialGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
  )},
  youtube:   { label: "يوتيوب",   color: "text-red-500",     bg: "bg-red-500/10",     hex: "#FF0000", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#FF0000"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
  )},
  snapchat:  { label: "سناب شات", color: "text-yellow-400",  bg: "bg-yellow-400/10",  hex: "#FFFC00", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#FFFC00"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.318.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.181-.015h-.06c-1.469 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z"/></svg>
  )},
  whatsapp:  { label: "واتساب",   color: "text-green-400",   bg: "bg-green-500/10",   hex: "#25D366", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  )},
  organic:   { label: "عضوي",     color: "text-emerald-400", bg: "bg-emerald-500/10", hex: "#10b981", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
  )},
  other:     { label: "أخرى",     color: "text-zinc-400",    bg: "bg-zinc-500/10",    hex: "#71717a", icon: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
  )},
};

function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.other;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ─── Source Orders Modal + تصدير إكسيل احترافي ───────────────────────────────
const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار", warehouse_ready: "قيد الشحن بالمخزن",
  in_shipping: "قيد الشحن", received: "استلم",
  delayed: "مؤجل", returned: "مرتجع", partial_received: "استلم جزئي",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  warehouse_ready: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  in_shipping: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  delayed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  returned: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  partial_received: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};
const fc2 = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(Number(n) || 0);

async function exportSourceOrdersToExcel(orders: any[], sourceLabel: string, sourceHex: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Caprina Orders";
  wb.created = new Date();

  const sheet = wb.addWorksheet(sourceLabel, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 5 }],
  });

  const accentHex = sourceHex.replace("#", "").toUpperCase();
  const headerFill = "1F2937"; // dark slate
  const accentFill = accentHex;

  // ── عنوان رئيسي ──
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `تقرير طلبات منصة: ${sourceLabel}`;
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${accentFill}` } };
  sheet.getRow(1).height = 30;

  // ── معلومات التقرير ──
  sheet.mergeCells("A2:K2");
  const infoCell = sheet.getCell("A2");
  const now = new Date();
  infoCell.value = `تاريخ التصدير: ${now.toLocaleDateString("ar-EG")} — ${now.toLocaleTimeString("ar-EG")}   |   عدد الطلبات: ${orders.length}`;
  infoCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF6B7280" } };
  infoCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 18;

  // ── صف ملخص KPI ──
  const delivered = orders.filter(o => o.status === "received").length;
  const returned = orders.filter(o => o.status === "returned").length;
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.totalPrice) || 0) + (Number(o.shippingCost) || 0), 0);
  const totalCost = orders.reduce((s, o) => s + (Number(o.costPrice) || 0) * (Number(o.quantity) || 0), 0);
  const deliveryRate = orders.length ? Math.round((delivered / orders.length) * 100) : 0;

  const kpis: [string, string][] = [
    ["إجمالي الطلبات", String(orders.length)],
    ["مُسلَّم", String(delivered)],
    ["مرتجع", String(returned)],
    ["معدل التسليم", `${deliveryRate}%`],
    ["إجمالي الإيرادات", fc2(totalRevenue)],
  ];
  let kpiCol = 1;
  const kpiRow = 4;
  for (const [label, val] of kpis) {
    const c1 = sheet.getCell(kpiRow, kpiCol);
    const c2 = sheet.getCell(kpiRow + 1, kpiCol);
    c1.value = label;
    c1.font = { size: 9, bold: true, color: { argb: "FF6B7280" } };
    c1.alignment = { horizontal: "center" };
    c2.value = val;
    c2.font = { size: 13, bold: true, color: { argb: `FF${accentFill}` } };
    c2.alignment = { horizontal: "center" };
    kpiCol += 2;
  }
  sheet.getRow(4).height = 16;
  sheet.getRow(5).height = 20;

  // ── رأس الجدول ──
  const headerRowIdx = 7;
  const columns = [
    { header: "#", key: "idx", width: 6 },
    { header: "العميل", key: "customerName", width: 20 },
    { header: "الهاتف", key: "phone", width: 16 },
    { header: "المدينة", key: "city", width: 14 },
    { header: "المنتج", key: "product", width: 22 },
    { header: "اللون / المقاس", key: "variant", width: 16 },
    { header: "الكمية", key: "quantity", width: 9 },
    { header: "الإجمالي", key: "total", width: 13 },
    { header: "الحملة", key: "adCampaign", width: 18 },
    { header: "الحالة", key: "status", width: 14 },
    { header: "تاريخ الطلب", key: "createdAt", width: 14 },
  ];

  const headerRow = sheet.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${headerFill}` } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF374151" } },
      bottom: { style: "thin", color: { argb: "FF374151" } },
      left: { style: "thin", color: { argb: "FF374151" } },
      right: { style: "thin", color: { argb: "FF374151" } },
    };
    sheet.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 22;

  // ── صفوف البيانات ──
  orders.forEach((o, i) => {
    const rowIdx = headerRowIdx + 1 + i;
    const row = sheet.getRow(rowIdx);
    const total = (Number(o.totalPrice) || 0) + (Number(o.shippingCost) || 0);
    const variant = [o.color, o.size].filter(Boolean).join(" / ") || "—";

    const values = [
      i + 1,
      o.customerName ?? "—",
      o.phone ?? "—",
      o.city ?? "—",
      o.product ?? "—",
      variant,
      Number(o.quantity) || 0,
      total,
      o.adCampaign ?? "—",
      STATUS_AR[o.status] ?? o.status ?? "—",
      o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "—",
    ];

    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.alignment = { horizontal: ci === 7 || ci === 6 ? "center" : "right", vertical: "middle" };
      cell.font = { name: "Calibri", size: 10 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      // تلوين خفيف متبادل (zebra striping)
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
    });

    // تنسيق عملة لخلية الإجمالي
    row.getCell(8).numFmt = '#,##0 "ج.م."';
    row.getCell(8).font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${accentFill}` } };

    // تلوين خلية الحالة حسب نوعها
    const statusColors: Record<string, string> = {
      received: "D1FAE5", returned: "FEE2E2", pending: "FEF3C7",
      partial_received: "F3E8FF", delayed: "DBEAFE", in_shipping: "E0F2FE", warehouse_ready: "CCFBF1",
    };
    const sc = statusColors[o.status];
    if (sc) {
      row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${sc}` } };
      row.getCell(10).font = { name: "Calibri", size: 10, bold: true };
    }
  });

  // ── صف إجمالي في الآخر ──
  const totalRowIdx = headerRowIdx + 1 + orders.length;
  sheet.mergeCells(totalRowIdx, 1, totalRowIdx, 7);
  const totalLabelCell = sheet.getCell(totalRowIdx, 1);
  totalLabelCell.value = "الإجمالي";
  totalLabelCell.font = { bold: true, size: 11 };
  totalLabelCell.alignment = { horizontal: "left" };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

  const totalValCell = sheet.getCell(totalRowIdx, 8);
  totalValCell.value = totalRevenue;
  totalValCell.numFmt = '#,##0 "ج.م."';
  totalValCell.font = { bold: true, size: 12, color: { argb: `FF${accentFill}` } };
  totalValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  for (let c = 9; c <= 11; c++) {
    sheet.getCell(totalRowIdx, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  }

  // ── تثبيت autofilter على رأس الجدول ──
  sheet.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: columns.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `طلبات-${sourceLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function SourceOrdersModal({ source, sourceLabel, sourceHex, dateFrom, dateTo, onClose }: {
  source: string; sourceLabel: string; sourceHex: string;
  dateFrom?: string; dateTo?: string; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["orders-by-source", source, dateFrom, dateTo],
    queryFn: () => ordersApi.bySource(source, dateFrom, dateTo),
    staleTime: 60_000,
  });

  const orders = data?.orders ?? [];
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o: any) =>
      (o.customerName ?? "").toLowerCase().includes(q) ||
      (o.phone ?? "").includes(q) ||
      (o.product ?? "").toLowerCase().includes(q) ||
      (o.city ?? "").toLowerCase().includes(q)
    );
  }, [orders, search]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleExport = async () => {
    if (!filteredOrders.length || exporting) return;
    setExporting(true);
    try {
      await exportSourceOrdersToExcel(filteredOrders, sourceLabel, sourceHex);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${sourceHex}1a` }}>
              <span style={{ color: sourceHex, fontSize: "1.4rem", display: "flex" }}>{(SOURCE_META[source] ?? SOURCE_META.other).icon}</span>
            </div>
            <div>
              <h2 className="font-black text-lg">{sourceLabel}</h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "جاري التحميل..." : `${filteredOrders.length} طلب`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!filteredOrders.length || exporting}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
            >
              {exporting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {exporting ? "جاري التصدير..." : "تصدير Excel"}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو المنتج أو المدينة..."
              className="w-full h-9 pr-9 px-3 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Package className="w-10 h-10 opacity-20" />
              <p className="text-sm">{search ? "لا توجد نتائج" : "لا توجد طلبات لهذه المنصة"}</p>
            </div>
          ) : (
            <table className="w-full text-xs" dir="rtl">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">#</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">العميل</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">الهاتف</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">المدينة</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">المنتج</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الكمية</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الإجمالي</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground">الحملة</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">الحالة</th>
                  <th className="py-2.5 px-3 text-center font-semibold text-muted-foreground">التاريخ</th>
                  <th className="py-2.5 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="py-2 px-3 font-mono text-muted-foreground">#{String(o.id).padStart(4, "0")}</td>
                    <td className="py-2 px-3 font-semibold">{o.customerName}</td>
                    <td className="py-2 px-3 text-muted-foreground font-mono">{o.phone ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground">{o.city ?? "—"}</td>
                    <td className="py-2 px-3">
                      <span className="font-semibold">{o.product}</span>
                      {(o.color || o.size) && (
                        <span className="text-primary/70 mr-1">{[o.color, o.size].filter(Boolean).join("/")}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{o.quantity}</td>
                    <td className="py-2 px-3 text-center font-bold text-primary">{fc2((o.totalPrice ?? 0) + (o.shippingCost ?? 0))}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate">{o.adCampaign ?? "—"}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLOR[o.status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_AR[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground whitespace-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <a href={`/orders/${o.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer summary */}
        {!isLoading && filteredOrders.length > 0 && (() => {
          const delivered = filteredOrders.filter((o: any) => o.status === "received").length;
          const returnedCount = filteredOrders.filter((o: any) => o.status === "returned").length;
          const totalRev = filteredOrders.reduce((s: number, o: any) => s + (Number(o.totalPrice) || 0) + (Number(o.shippingCost) || 0), 0);
          return (
            <div className="border-t border-border px-5 py-3 flex flex-wrap gap-4 items-center bg-muted/10 text-xs">
              <span className="text-muted-foreground">إجمالي: <span className="font-black text-foreground">{filteredOrders.length}</span> طلب</span>
              <span className="text-muted-foreground">مُسلَّم: <span className="font-black text-emerald-500">{delivered}</span></span>
              <span className="text-muted-foreground">مرتجع: <span className="font-black text-red-400">{returnedCount}</span></span>
              <span className="text-muted-foreground">إجمالي الإيرادات: <span className="font-black text-primary">{fc2(totalRev)}</span></span>
              <span className="text-muted-foreground mr-auto">معدل التسليم: <span className="font-black text-emerald-500">{filteredOrders.length > 0 ? Math.round(delivered / filteredOrders.length * 100) : 0}%</span></span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function CampaignCard({ stat, maxRevenue }: { stat: CampaignStats; maxRevenue: number }) {
  const meta = SOURCE_META[stat.adSource] ?? SOURCE_META.other;
  const roiPositive = stat.roi >= 0;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <SourceBadge source={stat.adSource} />
            {stat.adCampaign && (
              <p className="text-sm font-bold mt-1 truncate">{stat.adCampaign}</p>
            )}
            {!stat.adCampaign && (
              <p className="text-xs text-muted-foreground mt-1">بدون اسم حملة</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold shrink-0 ${stat.profit >= 0 ? "border-emerald-800 text-emerald-400" : "border-red-800 text-red-400"}`}
          >
            {stat.profit >= 0 ? "+" : ""}{fmt(stat.profit)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>إيرادات: {fmt(stat.revenue)}</span>
            <span>{fmtPct(Math.round(maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0))}</span>
          </div>
          <Progress value={maxRevenue > 0 ? (stat.revenue / maxRevenue) * 100 : 0} className="h-1.5" />
        </div>

        <div className="grid grid-cols-4 gap-1 text-center">
          <div className="bg-muted/20 rounded p-1.5">
            <p className="text-xs font-bold">{fmtNum(stat.total)}</p>
            <p className="text-[8px] text-muted-foreground">طلبات</p>
          </div>
          <div className="bg-emerald-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-emerald-400">{fmtNum(stat.delivered)}</p>
            <p className="text-[8px] text-muted-foreground">مُسلَّم</p>
          </div>
          <div className="bg-red-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-red-400">{fmtNum(stat.returned)}</p>
            <p className="text-[8px] text-muted-foreground">مرتجع</p>
          </div>
          <div className="bg-amber-900/20 rounded p-1.5">
            <p className="text-xs font-bold text-amber-400">{fmtPct(stat.deliveryRate)}</p>
            <p className="text-[8px] text-muted-foreground">تسليم</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs border-t border-border pt-2">
          <span className="text-muted-foreground">تكلفة: <span className="text-foreground">{fmt(stat.cost)}</span></span>
          <span className={`font-bold flex items-center gap-1 ${roiPositive ? "text-emerald-400" : "text-red-400"}`}>
            {roiPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            ROI {roiPositive ? "+" : ""}{fmtPct(stat.roi)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceSummary({ campaigns, onSourceClick }: { campaigns: CampaignStats[]; onSourceClick: (src: string) => void }) {
  const bySource: Record<string, { total: number; revenue: number; profit: number; delivered: number }> = {};
  for (const c of campaigns) {
    if (!bySource[c.adSource]) bySource[c.adSource] = { total: 0, revenue: 0, profit: 0, delivered: 0 };
    bySource[c.adSource].total += (Number(c.total) || 0);
    bySource[c.adSource].revenue += (Number(c.revenue) || 0);
    bySource[c.adSource].profit += (Number(c.profit) || 0);
    bySource[c.adSource].delivered += (Number(c.delivered) || 0);
  }
  const maxRev = Math.max(...Object.values(bySource).map(v => v.revenue), 1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {Object.entries(bySource).map(([src, stats]) => {
        const meta = SOURCE_META[src] ?? SOURCE_META.other;
        return (
          <button
            key={src}
            onClick={() => onSourceClick(src)}
            className="text-right w-full cursor-pointer group focus:outline-none"
          >
            <Card className="border-border bg-card text-center transition-all duration-150 group-hover:border-primary/50 group-hover:shadow-md group-hover:scale-[1.02]">
              <CardContent className="px-3 py-3 space-y-1.5">
                <span className="text-2xl flex justify-center">{meta.icon}</span>
                <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
                <p className="text-sm font-bold">{fmtNum(stats.total)}</p>
                <p className="text-[10px] text-muted-foreground">طلب</p>
                <p className={`text-xs font-bold ${stats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmt(stats.profit)}
                </p>
                <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
                  <div className={`h-full rounded-full ${meta.color.replace("text-", "bg-").replace("-400", "-500")}`}
                    style={{ width: `${(stats.revenue / maxRev) * 100}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">اضغط لعرض الطلبات</p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

export default function AdsAnalyticsPage() {
  const { can, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", dateFrom, dateTo],
    queryFn: () => teamAnalyticsApi.campaigns(dateFrom || undefined, dateTo || undefined),
    enabled: isAdmin || can("analytics.ads"),
  });

  if (!isAdmin && !can("analytics.ads")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Megaphone className="w-10 h-10 opacity-20" />
        <p className="text-sm font-bold">هذه الصفحة للمديرين فقط</p>
        <button onClick={() => navigate("/")} className="text-xs text-primary hover:underline">العودة للرئيسية</button>
      </div>
    );
  }

  const filtered = filterSource ? campaigns.filter(c => c.adSource === filterSource) : campaigns;
  const maxRevenue = Math.max(...filtered.map(c => c.revenue), 1);

  const totals = campaigns.reduce(
    (acc, c) => ({
      orders: acc.orders + (Number(c.total) || 0),
      revenue: acc.revenue + (Number(c.revenue) || 0),
      cost: acc.cost + (Number(c.cost) || 0),
      profit: acc.profit + (Number(c.profit) || 0),
      delivered: acc.delivered + (Number(c.delivered) || 0),
    }),
    { orders: 0, revenue: 0, cost: 0, profit: 0, delivered: 0 }
  );
  const totalRoi = totals.cost > 0 ? Math.round((totals.profit / totals.cost) * 100) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            تحليل الإعلانات والحملات
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">قياس أداء كل حملة وحساب العائد على الإنفاق الإعلاني</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">من</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">إلى</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">المصدر</Label>
            <select
              className="h-7 text-xs bg-card border border-input rounded-md px-2"
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
            >
              <option value="">الكل</option>
              {Object.entries(SOURCE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الطلبات", value: fmtNum(totals.orders), icon: Package, color: "text-primary" },
          { label: "إيرادات", value: fmt(totals.revenue), icon: DollarSign, color: "text-blue-400" },
          { label: "تكاليف", value: fmt(totals.cost), icon: TrendingDown, color: "text-amber-400" },
          { label: "صافي الربح", value: fmt(totals.profit), icon: TrendingUp, color: totals.profit >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "ROI الإجمالي", value: `${totalRoi >= 0 ? "+" : ""}${fmtPct(totalRoi)}`, icon: Target, color: totalRoi >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map(card => (
          <Card key={card.label} className="border-border bg-card">
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <card.icon className={`w-4 h-4 shrink-0 ${card.color}`} />
              <div>
                <p className="text-sm font-bold">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Source breakdown */}
      {campaigns.length > 0 && !filterSource && (
        <div>
          <h2 className="text-sm font-bold mb-3 text-muted-foreground">ملخص حسب المصدر — <span className="font-normal text-xs">اضغط على أي منصة لعرض طلباتها</span></h2>
          <SourceSummary campaigns={campaigns} onSourceClick={src => setSelectedSource(src)} />
        </div>
      )}

      {/* Source Orders Modal */}
      {selectedSource && (() => {
        const meta = SOURCE_META[selectedSource] ?? SOURCE_META.other;
        return (
          <SourceOrdersModal
            source={selectedSource}
            sourceLabel={meta.label}
            sourceHex={meta.hex}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
            onClose={() => setSelectedSource(null)}
          />
        );
      })()}

      {isLoading && <p className="text-center text-muted-foreground text-sm py-12">جاري التحميل...</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد بيانات إعلانية بعد.</p>
          <p className="text-xs mt-1">أضف مصدر الإعلان عند إنشاء الطلبيات لتتبع أداء حملاتك.</p>
        </div>
      )}

      {/* Campaign cards */}
      {filtered.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-3 text-muted-foreground">الحملات ({fmtNum(filtered.length)})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c, i) => (
              <CampaignCard key={`${c.adSource}-${c.adCampaign ?? i}`} stat={c} maxRevenue={maxRevenue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
