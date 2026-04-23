import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import {
  db, ordersTable, productsTable, productVariantsTable,
  shippingCompaniesTable, usersTable, inventoryMovementsTable,
  warehousesTable, warehouseStockTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { isNull, eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const BRAND = {
  primary:   "FF1a1a2e",   // header bg
  accent:    "FFe94560",   // accent
  white:     "FFFFFFFF",
  lightGray: "FFF3F4F6",
  midGray:   "FFE5E7EB",
  darkText:  "FF111827",
  green:     "FF16a34a",
  red:       "FFdc2626",
  blue:      "FF2563eb",
  yellow:    "FFca8a04",
};

const STATUS_AR: Record<string, string> = {
  pending:          "قيد الانتظار",
  in_shipping:      "قيد الشحن",
  received:         "مستلم",
  delayed:          "متأخر",
  returned:         "مرتجع",
  partial_received: "استلام جزئي",
};
const STATUS_COLORS: Record<string, string> = {
  pending:          "FFca8a04",
  in_shipping:      "FF2563eb",
  received:         "FF16a34a",
  delayed:          "FFdc2626",
  returned:         "FFdc2626",
  partial_received: "FF7c3aed",
};
const ROLES_AR: Record<string, string> = {
  admin: "مدير النظام", employee: "موظف مبيعات", warehouse: "مسؤول مخزون",
};
const REASON_AR: Record<string, string> = {
  sale: "بيع", partial_sale: "بيع جزئي", return: "مرتجع",
  damaged: "تالف", manual_in: "إدخال يدوي", manual_out: "إخراج يدوي", adjustment: "تسوية",
};

// ─── Send workbook ─────────────────────────────────────────────────────────────
async function sendWorkbook(res: any, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
function applyHeader(sheet: ExcelJS.Worksheet, cols: { header: string; key: string; width: number }[]) {
  sheet.columns = cols;
  const row = sheet.getRow(1);
  row.height = 26;
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: BRAND.white }, size: 11, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
    cell.border = {
      bottom: { style: "medium", color: { argb: BRAND.accent } },
    };
  });
}

function styleDataRow(row: ExcelJS.Row, isEven: boolean) {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, cell => {
    cell.font = { size: 10, name: "Calibri", color: { argb: BRAND.darkText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? BRAND.lightGray : BRAND.white } };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = { bottom: { style: "hair", color: { argb: BRAND.midGray } } };
  });
}

function addSummarySheet(wb: ExcelJS.Workbook, rows: { label: string; value: string | number; color?: string }[]) {
  const ws = wb.addWorksheet("ملخص", { tabColor: { argb: BRAND.accent } });
  ws.columns = [
    { key: "label", width: 30 },
    { key: "value", width: 25 },
  ];
  // Title
  ws.mergeCells("A1:B1");
  const title = ws.getCell("A1");
  title.value = "📊 ملخص التصدير";
  title.font = { bold: true, size: 16, color: { argb: BRAND.white } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.primary } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  ws.mergeCells("A2:B2");
  const sub = ws.getCell("A2");
  sub.value = `تاريخ التصدير: ${new Date().toLocaleString("ar-EG")}`;
  sub.font = { size: 10, color: { argb: "FF6B7280" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lightGray } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 22;

  let rowIdx = 3;
  for (const r of rows) {
    const row = ws.getRow(rowIdx++);
    row.height = 24;
    const lCell = row.getCell(1);
    const vCell = row.getCell(2);
    lCell.value = r.label;
    vCell.value = r.value;
    lCell.font = { size: 11, bold: false, color: { argb: BRAND.darkText } };
    vCell.font = { size: 13, bold: true, color: { argb: r.color ?? BRAND.primary } };
    lCell.fill = vCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.lightGray } };
    lCell.alignment = { horizontal: "right", vertical: "middle" };
    vCell.alignment = { horizontal: "center", vertical: "middle" };
    lCell.border = vCell.border = { bottom: { style: "hair", color: { argb: BRAND.midGray } } };
  }
}

function autoFilter(sheet: ExcelJS.Worksheet) {
  const lastCol = sheet.columnCount;
  if (lastCol > 0) sheet.autoFilter = { from: "A1", to: { row: 1, column: lastCol } };
}

function freezeHeader(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

// ─── Number & Currency formats ────────────────────────────────────────────────
const FMT_CURRENCY = '#,##0.00 "ج.م"';
const FMT_NUMBER   = '#,##0';


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/orders — تصدير الطلبات
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/orders", requireAuth, async (req, res): Promise<void> => {
  try {
    const orders = await db
      .select({
        o: ordersTable,
        companyName: shippingCompaniesTable.name,
        assignedUser: usersTable.displayName,
      })
      .from(ordersTable)
      .leftJoin(shippingCompaniesTable, eq(ordersTable.shippingCompanyId, shippingCompaniesTable.id))
      .leftJoin(usersTable, eq(ordersTable.assignedUserId, usersTable.id))
      .where(isNull(ordersTable.deletedAt))
      .orderBy(desc(ordersTable.createdAt));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Caprina OS";
    wb.created = new Date();

    const ws = wb.addWorksheet("الطلبات", { tabColor: { argb: BRAND.accent } });

    const cols = [
      { header: "#",               key: "id",          width: 8  },
      { header: "اسم العميل",      key: "name",        width: 22 },
      { header: "الهاتف",          key: "phone",       width: 16 },
      { header: "المحافظة / العنوان", key: "address",  width: 28 },
      { header: "المنتج",          key: "product",     width: 24 },
      { header: "اللون",           key: "color",       width: 12 },
      { header: "المقاس",          key: "size",        width: 12 },
      { header: "الكمية",          key: "qty",         width: 10 },
      { header: "سعر الوحدة",      key: "unitPrice",   width: 14 },
      { header: "سعر التكلفة",     key: "costPrice",   width: 14 },
      { header: "تكلفة الشحن",     key: "shipCost",    width: 14 },
      { header: "الإجمالي",        key: "total",       width: 14 },
      { header: "صافي الربح",      key: "profit",      width: 14 },
      { header: "الحالة",          key: "status",      width: 16 },
      { header: "شركة الشحن",      key: "company",     width: 20 },
      { header: "رقم التتبع",      key: "tracking",    width: 20 },
      { header: "الموظف المسؤول",  key: "user",        width: 20 },
      { header: "مصدر الإعلان",    key: "adSource",    width: 16 },
      { header: "الحملة",          key: "campaign",    width: 20 },
      { header: "ملاحظات",         key: "notes",       width: 28 },
      { header: "سبب الإرجاع",     key: "returnReason",width: 22 },
      { header: "تاريخ الإنشاء",   key: "createdAt",   width: 18 },
    ];
    applyHeader(ws, cols);

    let rowIdx = 2;
    let totalRevenue = 0, totalCost = 0, totalShip = 0, totalProfit = 0;
    let countByStatus: Record<string, number> = {};

    for (const { o, companyName, assignedUser } of orders) {
      const cost   = (o.costPrice ?? 0) * o.quantity;
      const ship   = o.shippingCost ?? 0;
      const profit = o.totalPrice - cost - ship;
      totalRevenue += o.totalPrice;
      totalCost    += cost;
      totalShip    += ship;
      totalProfit  += profit;
      countByStatus[o.status] = (countByStatus[o.status] ?? 0) + 1;

      const row = ws.getRow(rowIdx);
      row.values = [
        o.id, o.customerName, o.phone ?? "", o.address ?? "",
        o.product, o.color ?? "", o.size ?? "",
        o.quantity, o.unitPrice, o.costPrice ?? 0, ship, o.totalPrice, profit,
        STATUS_AR[o.status] ?? o.status,
        companyName ?? "", o.trackingNumber ?? "",
        assignedUser ?? "", o.adSource ?? "", o.adCampaign ?? "",
        o.notes ?? "", o.returnReason ?? "",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, rowIdx % 2 === 0);

      // لون حالة الطلب
      const statusCell = row.getCell("status");
      const sColor = STATUS_COLORS[o.status];
      if (sColor) {
        statusCell.font = { bold: true, color: { argb: sColor }, size: 10 };
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sColor + "22" } };
      }

      // لون الربح
      const profitCell = row.getCell("profit");
      profitCell.font = { bold: true, color: { argb: profit >= 0 ? BRAND.green : BRAND.red }, size: 10 };
      profitCell.numFmt = FMT_CURRENCY;

      // تنسيق الأرقام
      (["unitPrice","costPrice","shipCost","total"] as const).forEach(k => {
        row.getCell(k).numFmt = FMT_CURRENCY;
      });
      row.getCell("qty").numFmt = FMT_NUMBER;

      rowIdx++;
    }

    // صف الإجماليات
    const totalRow = ws.getRow(rowIdx);
    totalRow.height = 24;
    totalRow.getCell("product").value = "الإجمالي";
    totalRow.getCell("total").value = totalRevenue;
    totalRow.getCell("profit").value = totalProfit;
    totalRow.getCell("shipCost").value = totalShip;
    totalRow.eachCell({ includeEmpty: false }, cell => {
      cell.font = { bold: true, size: 11, color: { argb: BRAND.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.primary } };
      cell.numFmt = FMT_CURRENCY;
    });

    autoFilter(ws); freezeHeader(ws);

    // ملخص
    addSummarySheet(wb, [
      { label: "إجمالي الطلبات",      value: orders.length,               color: BRAND.blue   },
      { label: "إجمالي الإيرادات",    value: totalRevenue.toFixed(2) + " ج.م", color: BRAND.green },
      { label: "إجمالي التكاليف",     value: totalCost.toFixed(2) + " ج.م",    color: BRAND.red   },
      { label: "تكاليف الشحن",        value: totalShip.toFixed(2) + " ج.م",    color: BRAND.yellow},
      { label: "صافي الربح",          value: totalProfit.toFixed(2) + " ج.م",  color: BRAND.green },
      ...Object.entries(countByStatus).map(([s, c]) => ({ label: `  • ${STATUS_AR[s] ?? s}`, value: c })),
    ]);

    await sendWorkbook(res, wb, `طلبات-كابرينا-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير الطلبات", detail: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/products — تصدير المنتجات والمخزون
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/products", requireAuth, async (req, res): Promise<void> => {
  try {
    const products = await db.select().from(productsTable);
    const variants = await db.select().from(productVariantsTable);
    const warehouseStock = await db
      .select({ stock: warehouseStockTable, wh: warehousesTable })
      .from(warehouseStockTable)
      .leftJoin(warehousesTable, eq(warehouseStockTable.warehouseId, warehousesTable.id));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Caprina OS";

    // ── Sheet 1: المنتجات ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("المنتجات", { tabColor: { argb: BRAND.primary } });
    applyHeader(ws1, [
      { header: "#",            key: "id",        width: 8  },
      { header: "اسم المنتج",  key: "name",      width: 28 },
      { header: "SKU",         key: "sku",       width: 16 },
      { header: "سعر البيع",   key: "unitPrice", width: 14 },
      { header: "سعر التكلفة", key: "costPrice", width: 14 },
      { header: "هامش الربح %",key: "margin",    width: 14 },
      { header: "إجمالي الوحدات", key: "total",  width: 16 },
      { header: "محجوز",       key: "reserved",  width: 12 },
      { header: "مباع",        key: "sold",      width: 12 },
      { header: "متاح",        key: "available", width: 12 },
      { header: "حد التنبيه",  key: "threshold", width: 14 },
      { header: "قيمة المخزون (تكلفة)", key: "stockVal", width: 22 },
      { header: "تاريخ الإضافة", key: "createdAt", width: 18 },
    ]);

    let totalStockValue = 0;
    let lowStockCount = 0;
    let idx = 2;
    for (const p of products) {
      const available = p.totalQuantity - p.reservedQuantity;
      const margin = p.costPrice && p.unitPrice > 0
        ? ((p.unitPrice - p.costPrice) / p.unitPrice * 100)
        : null;
      const sVal = (p.costPrice ?? p.unitPrice) * p.totalQuantity;
      totalStockValue += sVal;
      if (available <= p.lowStockThreshold) lowStockCount++;

      const row = ws1.getRow(idx);
      row.values = [
        p.id, p.name, p.sku ?? "", p.unitPrice, p.costPrice ?? "",
        margin != null ? `${margin.toFixed(1)}%` : "—",
        p.totalQuantity, p.reservedQuantity, p.soldQuantity, available,
        p.lowStockThreshold, sVal,
        p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx % 2 === 0);
      row.getCell("unitPrice").numFmt = FMT_CURRENCY;
      row.getCell("costPrice").numFmt = FMT_CURRENCY;
      row.getCell("stockVal").numFmt  = FMT_CURRENCY;

      // تلوين المخزون المنخفض
      if (available <= p.lowStockThreshold) {
        row.getCell("available").font = { bold: true, color: { argb: BRAND.red }, size: 10 };
        row.getCell("available").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
      }
      idx++;
    }
    autoFilter(ws1); freezeHeader(ws1);

    // ── Sheet 2: SKUs ────────────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("SKUs (ألوان ومقاسات)", { tabColor: { argb: BRAND.accent } });
    const productMap = new Map(products.map(p => [p.id, p]));
    applyHeader(ws2, [
      { header: "#",            key: "id",        width: 8  },
      { header: "المنتج",      key: "product",   width: 26 },
      { header: "اللون",       key: "color",     width: 14 },
      { header: "المقاس",      key: "size",      width: 12 },
      { header: "SKU",         key: "sku",       width: 16 },
      { header: "سعر البيع",   key: "unitPrice", width: 14 },
      { header: "سعر التكلفة", key: "costPrice", width: 14 },
      { header: "هامش الربح %",key: "margin",    width: 14 },
      { header: "إجمالي الوحدات", key: "total",  width: 16 },
      { header: "محجوز",       key: "reserved",  width: 12 },
      { header: "مباع",        key: "sold",      width: 12 },
      { header: "متاح",        key: "available", width: 12 },
      { header: "حد التنبيه",  key: "threshold", width: 14 },
      { header: "حالة المخزون",key: "stockStatus", width: 16 },
    ]);
    idx = 2;
    for (const v of variants) {
      const available = v.totalQuantity - v.reservedQuantity;
      const margin = v.costPrice && v.unitPrice > 0
        ? ((v.unitPrice - v.costPrice) / v.unitPrice * 100)
        : null;
      const stockStatus = available <= 0 ? "نفد المخزون" : available <= v.lowStockThreshold ? "منخفض" : "متاح";
      const row = ws2.getRow(idx);
      row.values = [
        v.id, productMap.get(v.productId)?.name ?? "", v.color, v.size,
        v.sku ?? "", v.unitPrice, v.costPrice ?? "",
        margin != null ? `${margin.toFixed(1)}%` : "—",
        v.totalQuantity, v.reservedQuantity, v.soldQuantity, available,
        v.lowStockThreshold, stockStatus,
      ];
      styleDataRow(row, idx % 2 === 0);
      row.getCell("unitPrice").numFmt = FMT_CURRENCY;
      row.getCell("costPrice").numFmt = FMT_CURRENCY;
      const ssCell = row.getCell("stockStatus");
      if (stockStatus === "نفد المخزون") {
        ssCell.font = { bold: true, color: { argb: BRAND.red }, size: 10 };
      } else if (stockStatus === "منخفض") {
        ssCell.font = { bold: true, color: { argb: BRAND.yellow }, size: 10 };
      } else {
        ssCell.font = { bold: true, color: { argb: BRAND.green }, size: 10 };
      }
      idx++;
    }
    autoFilter(ws2); freezeHeader(ws2);

    // ── Sheet 3: توزيع المخازن ───────────────────────────────────────────────
    const ws3 = wb.addWorksheet("توزيع المخازن", { tabColor: { argb: "FF2563eb" } });
    applyHeader(ws3, [
      { header: "المخزن",      key: "wh",       width: 24 },
      { header: "المنتج",      key: "product",  width: 26 },
      { header: "اللون / المقاس", key: "variant", width: 20 },
      { header: "الكمية",      key: "qty",      width: 14 },
      { header: "آخر تحديث",   key: "updatedAt",width: 18 },
    ]);
    idx = 2;
    for (const { stock, wh } of warehouseStock) {
      const row = ws3.getRow(idx);
      const variantInfo = stock.variantId
        ? variants.find(v => v.id === stock.variantId)
        : null;
      const productInfo = products.find(p => p.id === stock.productId);
      row.values = [
        wh?.name ?? stock.warehouseId,
        productInfo?.name ?? "—",
        variantInfo ? `${variantInfo.color} / ${variantInfo.size}` : "إجمالي",
        stock.quantity,
        stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx % 2 === 0);
      row.getCell("qty").numFmt = FMT_NUMBER;
      idx++;
    }
    autoFilter(ws3); freezeHeader(ws3);

    addSummarySheet(wb, [
      { label: "إجمالي المنتجات",     value: products.length,    color: BRAND.blue  },
      { label: "إجمالي SKUs",         value: variants.length,    color: BRAND.blue  },
      { label: "أصناف مخزون منخفض",   value: lowStockCount,      color: BRAND.red   },
      { label: "قيمة المخزون الكلية", value: totalStockValue.toFixed(2) + " ج.م", color: BRAND.green },
    ]);

    await sendWorkbook(res, wb, `مخزون-كابرينا-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير المنتجات", detail: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/movements — تصدير حركات المخزون
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/movements", requireAuth, async (req, res): Promise<void> => {
  try {
    const movements = await db
      .select()
      .from(inventoryMovementsTable)
      .orderBy(desc(inventoryMovementsTable.createdAt));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("حركات المخزون", { tabColor: { argb: "FF7c3aed" } });

    applyHeader(ws, [
      { header: "#",            key: "id",       width: 8  },
      { header: "المنتج",      key: "product",  width: 26 },
      { header: "اللون",       key: "color",    width: 14 },
      { header: "المقاس",      key: "size",     width: 12 },
      { header: "الكمية",      key: "qty",      width: 12 },
      { header: "النوع",       key: "type",     width: 10 },
      { header: "السبب",       key: "reason",   width: 18 },
      { header: "رقم الطلب",   key: "orderId",  width: 14 },
      { header: "ملاحظات",     key: "notes",    width: 28 },
      { header: "التاريخ والوقت", key: "createdAt", width: 22 },
    ]);

    let totalIn = 0, totalOut = 0;
    let idx = 2;
    for (const m of movements) {
      const isIn = m.type === "IN";
      if (isIn) totalIn += m.quantity; else totalOut += m.quantity;

      const row = ws.getRow(idx);
      row.values = [
        m.id, m.product, m.color ?? "", m.size ?? "",
        m.quantity, isIn ? "⬆ وارد" : "⬇ صادر",
        REASON_AR[m.reason] ?? m.reason,
        m.orderId ?? "—", m.notes ?? "",
        m.createdAt ? new Date(m.createdAt).toLocaleString("ar-EG") : "",
      ];
      styleDataRow(row, idx % 2 === 0);
      row.getCell("qty").numFmt = FMT_NUMBER;

      const typeCell = row.getCell("type");
      typeCell.font = { bold: true, color: { argb: isIn ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }

    autoFilter(ws); freezeHeader(ws);

    addSummarySheet(wb, [
      { label: "إجمالي الحركات",  value: movements.length, color: BRAND.blue  },
      { label: "إجمالي الوارد",   value: totalIn,          color: BRAND.green },
      { label: "إجمالي الصادر",   value: totalOut,         color: BRAND.red   },
      { label: "الفرق الصافي",    value: totalIn - totalOut, color: totalIn >= totalOut ? BRAND.green : BRAND.red },
    ]);

    await sendWorkbook(res, wb, `حركات-المخزون-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير الحركات", detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/shipping — تصدير شركات الشحن
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/shipping", requireAuth, async (req, res): Promise<void> => {
  try {
    const companies = await db.select().from(shippingCompaniesTable);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("شركات الشحن", { tabColor: { argb: BRAND.primary } });

    applyHeader(ws, [
      { header: "#",         key: "id",        width: 8  },
      { header: "الاسم",    key: "name",      width: 26 },
      { header: "الهاتف",   key: "phone",     width: 18 },
      { header: "الموقع",   key: "website",   width: 28 },
      { header: "ملاحظات",  key: "notes",     width: 30 },
      { header: "الحالة",   key: "active",    width: 12 },
      { header: "تاريخ الإضافة", key: "createdAt", width: 18 },
    ]);

    let idx = 2;
    for (const c of companies) {
      const row = ws.getRow(idx);
      row.values = [
        c.id, c.name, c.phone ?? "", c.website ?? "", c.notes ?? "",
        c.isActive ? "✅ نشط" : "⛔ موقوف",
        c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx % 2 === 0);
      const activeCell = row.getCell("active");
      activeCell.font = { bold: true, color: { argb: c.isActive ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(ws); freezeHeader(ws);

    await sendWorkbook(res, wb, `شركات-الشحن-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير شركات الشحن", detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/users — تصدير المستخدمين (admin only)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const users = await db.select({
      id: usersTable.id, username: usersTable.username,
      displayName: usersTable.displayName, role: usersTable.role,
      isActive: usersTable.isActive, createdAt: usersTable.createdAt,
    }).from(usersTable);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المستخدمين", { tabColor: { argb: BRAND.primary } });

    applyHeader(ws, [
      { header: "#",             key: "id",          width: 8  },
      { header: "اسم المستخدم", key: "username",    width: 22 },
      { header: "الاسم الكامل", key: "displayName", width: 24 },
      { header: "الدور",        key: "role",        width: 20 },
      { header: "الحالة",       key: "active",      width: 14 },
      { header: "تاريخ الإنشاء",key: "createdAt",  width: 18 },
    ]);

    let idx = 2;
    for (const u of users) {
      const row = ws.getRow(idx);
      row.values = [
        u.id, u.username, u.displayName,
        ROLES_AR[u.role] ?? u.role,
        u.isActive ? "✅ نشط" : "⛔ معطل",
        u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx % 2 === 0);
      row.getCell("active").font = {
        bold: true, color: { argb: u.isActive ? BRAND.green : BRAND.red }, size: 10,
      };
      idx++;
    }
    autoFilter(ws); freezeHeader(ws);

    await sendWorkbook(res, wb, `مستخدمين-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير المستخدمين", detail: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/export/backup — نسخة احتياطية كاملة (admin only)
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/export/backup", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const [orders, products, variants, companies, users, movements, warehouses, whStock] = await Promise.all([
      db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.createdAt)),
      db.select().from(productsTable),
      db.select().from(productVariantsTable),
      db.select().from(shippingCompaniesTable),
      db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt }).from(usersTable),
      db.select().from(inventoryMovementsTable).orderBy(desc(inventoryMovementsTable.createdAt)),
      db.select().from(warehousesTable),
      db.select({ s: warehouseStockTable, w: warehousesTable }).from(warehouseStockTable).leftJoin(warehousesTable, eq(warehouseStockTable.warehouseId, warehousesTable.id)),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Caprina OS";
    wb.created = new Date();

    const productMap = new Map(products.map(p => [p.id, p]));
    const variantMap = new Map(variants.map(v => [v.id, v]));

    // ── الطلبات ───────────────────────────────────────────────────────────────
    const wsO = wb.addWorksheet("الطلبات", { tabColor: { argb: BRAND.accent } });
    applyHeader(wsO, [
      {header:"#",key:"id",width:8},{header:"العميل",key:"name",width:22},{header:"الهاتف",key:"phone",width:16},
      {header:"العنوان",key:"addr",width:28},{header:"المنتج",key:"product",width:24},
      {header:"اللون",key:"color",width:12},{header:"المقاس",key:"size",width:12},
      {header:"الكمية",key:"qty",width:10},{header:"سعر الوحدة",key:"unitPrice",width:14},
      {header:"سعر التكلفة",key:"costPrice",width:14},{header:"تكلفة الشحن",key:"shipCost",width:14},
      {header:"الإجمالي",key:"total",width:14},{header:"صافي الربح",key:"profit",width:14},
      {header:"الحالة",key:"status",width:16},{header:"شركة الشحن_id",key:"compId",width:14},
      {header:"رقم التتبع",key:"tracking",width:20},{header:"مصدر الإعلان",key:"adSource",width:16},
      {header:"الحملة",key:"campaign",width:20},{header:"ملاحظات",key:"notes",width:28},
      {header:"سبب الإرجاع",key:"returnReason",width:22},{header:"تاريخ الإنشاء",key:"createdAt",width:18},
    ]);
    let idx = 2;
    for (const o of orders) {
      const profit = o.totalPrice - ((o.costPrice ?? 0) * o.quantity) - (o.shippingCost ?? 0);
      const row = wsO.getRow(idx);
      row.values = [
        o.id, o.customerName, o.phone??"", o.address??"", o.product, o.color??"", o.size??"",
        o.quantity, o.unitPrice, o.costPrice??0, o.shippingCost??0, o.totalPrice, profit,
        STATUS_AR[o.status]??o.status, o.shippingCompanyId??"", o.trackingNumber??"",
        o.adSource??"", o.adCampaign??"", o.notes??"", o.returnReason??"",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx%2===0);
      (["unitPrice","costPrice","shipCost","total","profit"] as const).forEach(k => {
        row.getCell(k).numFmt = FMT_CURRENCY;
      });
      const sc = STATUS_COLORS[o.status];
      if (sc) row.getCell("status").font = { bold: true, color: { argb: sc }, size: 10 };
      const pc = row.getCell("profit");
      pc.font = { bold: true, color: { argb: profit>=0 ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(wsO); freezeHeader(wsO);

    // ── المنتجات ──────────────────────────────────────────────────────────────
    const wsP = wb.addWorksheet("المنتجات", { tabColor: { argb: BRAND.primary } });
    applyHeader(wsP, [
      {header:"#",key:"id",width:8},{header:"الاسم",key:"name",width:28},{header:"SKU",key:"sku",width:16},
      {header:"سعر البيع",key:"unitPrice",width:14},{header:"سعر التكلفة",key:"costPrice",width:14},
      {header:"هامش %",key:"margin",width:12},{header:"إجمالي",key:"total",width:12},
      {header:"محجوز",key:"reserved",width:12},{header:"مباع",key:"sold",width:12},
      {header:"متاح",key:"available",width:12},{header:"حد التنبيه",key:"threshold",width:14},
      {header:"قيمة المخزون",key:"stockVal",width:18},{header:"تاريخ الإضافة",key:"createdAt",width:18},
    ]);
    idx = 2;
    for (const p of products) {
      const available = p.totalQuantity - p.reservedQuantity;
      const margin = p.costPrice && p.unitPrice > 0 ? ((p.unitPrice - p.costPrice)/p.unitPrice*100) : null;
      const sVal = (p.costPrice ?? p.unitPrice) * p.totalQuantity;
      const row = wsP.getRow(idx);
      row.values = [p.id, p.name, p.sku??"", p.unitPrice, p.costPrice??"", margin!=null?`${margin.toFixed(1)}%`:"—",
        p.totalQuantity, p.reservedQuantity, p.soldQuantity, available, p.lowStockThreshold, sVal,
        p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : ""];
      styleDataRow(row, idx%2===0);
      row.getCell("unitPrice").numFmt = row.getCell("costPrice").numFmt = row.getCell("stockVal").numFmt = FMT_CURRENCY;
      if (available <= p.lowStockThreshold)
        row.getCell("available").font = { bold: true, color: { argb: BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(wsP); freezeHeader(wsP);

    // ── SKUs ──────────────────────────────────────────────────────────────────
    const wsV = wb.addWorksheet("SKUs", { tabColor: { argb: "FF7c3aed" } });
    applyHeader(wsV, [
      {header:"#",key:"id",width:8},{header:"المنتج",key:"product",width:26},{header:"اللون",key:"color",width:14},
      {header:"المقاس",key:"size",width:12},{header:"SKU",key:"sku",width:16},
      {header:"سعر البيع",key:"unitPrice",width:14},{header:"سعر التكلفة",key:"costPrice",width:14},
      {header:"إجمالي",key:"total",width:12},{header:"محجوز",key:"reserved",width:12},
      {header:"مباع",key:"sold",width:12},{header:"متاح",key:"available",width:12},
      {header:"حد التنبيه",key:"threshold",width:14},{header:"حالة المخزون",key:"stockStatus",width:16},
    ]);
    idx = 2;
    for (const v of variants) {
      const avail = v.totalQuantity - v.reservedQuantity;
      const ss = avail <= 0 ? "نفد" : avail <= v.lowStockThreshold ? "منخفض" : "متاح";
      const row = wsV.getRow(idx);
      row.values = [v.id, productMap.get(v.productId)?.name??"", v.color, v.size, v.sku??"",
        v.unitPrice, v.costPrice??"", v.totalQuantity, v.reservedQuantity, v.soldQuantity, avail, v.lowStockThreshold, ss];
      styleDataRow(row, idx%2===0);
      row.getCell("unitPrice").numFmt = row.getCell("costPrice").numFmt = FMT_CURRENCY;
      const ssC = row.getCell("stockStatus");
      ssC.font = { bold: true, size: 10, color: { argb: ss==="نفد" ? BRAND.red : ss==="منخفض" ? BRAND.yellow : BRAND.green } };
      idx++;
    }
    autoFilter(wsV); freezeHeader(wsV);

    // ── حركات المخزون ─────────────────────────────────────────────────────────
    const wsM = wb.addWorksheet("حركات المخزون", { tabColor: { argb: "FF0891b2" } });
    applyHeader(wsM, [
      {header:"#",key:"id",width:8},{header:"المنتج",key:"product",width:26},
      {header:"اللون",key:"color",width:14},{header:"المقاس",key:"size",width:12},
      {header:"الكمية",key:"qty",width:12},{header:"النوع",key:"type",width:10},
      {header:"السبب",key:"reason",width:18},{header:"رقم الطلب",key:"orderId",width:14},
      {header:"ملاحظات",key:"notes",width:28},{header:"التاريخ",key:"createdAt",width:22},
    ]);
    idx = 2;
    for (const m of movements) {
      const isIn = m.type === "IN";
      const row = wsM.getRow(idx);
      row.values = [m.id, m.product, m.color??"", m.size??"", m.quantity,
        isIn ? "⬆ وارد" : "⬇ صادر", REASON_AR[m.reason]??m.reason,
        m.orderId??"—", m.notes??"",
        m.createdAt ? new Date(m.createdAt).toLocaleString("ar-EG") : ""];
      styleDataRow(row, idx%2===0);
      row.getCell("type").font = { bold: true, color: { argb: isIn ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(wsM); freezeHeader(wsM);

    // ── المخازن ───────────────────────────────────────────────────────────────
    const wsW = wb.addWorksheet("المخازن", { tabColor: { argb: "FF0d9488" } });
    applyHeader(wsW, [
      {header:"#",key:"id",width:8},{header:"المخزن",key:"name",width:26},
      {header:"العنوان",key:"addr",width:28},{header:"افتراضي",key:"isDefault",width:12},
      {header:"المنتج",key:"product",width:26},{header:"اللون/المقاس",key:"variant",width:20},
      {header:"الكمية",key:"qty",width:14},{header:"آخر تحديث",key:"updatedAt",width:18},
    ]);
    idx = 2;
    for (const { s, w } of whStock) {
      const vInfo = s.variantId ? variantMap.get(s.variantId) : null;
      const pInfo = products.find(p => p.id === s.productId);
      const row = wsW.getRow(idx);
      row.values = [
        w?.id??"", w?.name??"", w?.address??"", w?.isDefault ? "✅" : "",
        pInfo?.name??"—",
        vInfo ? `${vInfo.color} / ${vInfo.size}` : "إجمالي",
        s.quantity, s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("ar-EG") : "",
      ];
      styleDataRow(row, idx%2===0);
      row.getCell("qty").numFmt = FMT_NUMBER;
      idx++;
    }
    autoFilter(wsW); freezeHeader(wsW);

    // ── شركات الشحن ───────────────────────────────────────────────────────────
    const wsS = wb.addWorksheet("شركات الشحن", { tabColor: { argb: "FFf59e0b" } });
    applyHeader(wsS, [
      {header:"#",key:"id",width:8},{header:"الاسم",key:"name",width:26},
      {header:"الهاتف",key:"phone",width:18},{header:"الموقع",key:"website",width:28},
      {header:"ملاحظات",key:"notes",width:30},{header:"الحالة",key:"active",width:12},
      {header:"تاريخ الإضافة",key:"createdAt",width:18},
    ]);
    idx = 2;
    for (const c of companies) {
      const row = wsS.getRow(idx);
      row.values = [c.id, c.name, c.phone??"", c.website??"", c.notes??"",
        c.isActive ? "✅ نشط" : "⛔ موقوف",
        c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-EG") : ""];
      styleDataRow(row, idx%2===0);
      row.getCell("active").font = { bold: true, color: { argb: c.isActive ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(wsS); freezeHeader(wsS);

    // ── المستخدمين ────────────────────────────────────────────────────────────
    const wsU = wb.addWorksheet("المستخدمين", { tabColor: { argb: BRAND.primary } });
    applyHeader(wsU, [
      {header:"#",key:"id",width:8},{header:"اسم المستخدم",key:"username",width:22},
      {header:"الاسم الكامل",key:"displayName",width:24},
      {header:"الدور",key:"role",width:20},{header:"الحالة",key:"active",width:14},
      {header:"تاريخ الإنشاء",key:"createdAt",width:18},
    ]);
    idx = 2;
    for (const u of users) {
      const row = wsU.getRow(idx);
      row.values = [u.id, u.username, u.displayName, ROLES_AR[u.role]??u.role,
        u.isActive ? "✅ نشط" : "⛔ معطل",
        u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : ""];
      styleDataRow(row, idx%2===0);
      row.getCell("active").font = { bold: true, color: { argb: u.isActive ? BRAND.green : BRAND.red }, size: 10 };
      idx++;
    }
    autoFilter(wsU); freezeHeader(wsU);

    // ── ملخص الكل ─────────────────────────────────────────────────────────────
    const totalRevenue = orders.reduce((s, o) => s + o.totalPrice, 0);
    const totalCost    = orders.reduce((s, o) => s + (o.costPrice??0)*o.quantity, 0);
    const totalShip    = orders.reduce((s, o) => s + (o.shippingCost??0), 0);
    const totalProfit  = totalRevenue - totalCost - totalShip;
    const stockValue   = products.reduce((s, p) => s + (p.costPrice??p.unitPrice)*p.totalQuantity, 0);

    addSummarySheet(wb, [
      { label: "إجمالي الطلبات",      value: orders.length,    color: BRAND.blue  },
      { label: "إجمالي الإيرادات",    value: totalRevenue.toFixed(2) + " ج.م", color: BRAND.green },
      { label: "إجمالي التكاليف",     value: totalCost.toFixed(2) + " ج.م",    color: BRAND.red   },
      { label: "تكاليف الشحن",        value: totalShip.toFixed(2) + " ج.م",    color: BRAND.yellow},
      { label: "صافي الربح الكلي",    value: totalProfit.toFixed(2) + " ج.م",  color: BRAND.green },
      { label: "──────────────────",  value: "" },
      { label: "إجمالي المنتجات",     value: products.length,  color: BRAND.blue  },
      { label: "إجمالي SKUs",         value: variants.length,  color: BRAND.blue  },
      { label: "قيمة المخزون",        value: stockValue.toFixed(2) + " ج.م",   color: BRAND.green },
      { label: "حركات المخزون",       value: movements.length, color: BRAND.blue  },
      { label: "──────────────────",  value: "" },
      { label: "عدد المخازن",         value: warehouses.length, color: BRAND.blue },
      { label: "شركات الشحن",         value: companies.length, color: BRAND.blue  },
      { label: "المستخدمين",          value: users.length,     color: BRAND.blue  },
    ]);

    await sendWorkbook(res, wb, `backup-كابرينا-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية", detail: err.message });
  }
});

export default router;
