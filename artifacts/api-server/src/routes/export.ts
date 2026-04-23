import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import { db, ordersTable, productsTable, productVariantsTable, shippingCompaniesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { isNull, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

// ─── Helper: send workbook as Excel file ──────────────────────────────────────
async function sendWorkbook(res: any, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

// ─── Helper: style header row ─────────────────────────────────────────────────
function styleHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 22;
  sheet.columns = headers.map(h => ({ header: h, width: Math.max(h.length + 4, 16) }));
}


// ─── GET /api/export/orders ───────────────────────────────────────────────────
router.get("/export/orders", requireAuth, async (req, res): Promise<void> => {
  try {
    const orders = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("الطلبات");

    const headers = ["رقم الطلب","اسم العميل","الهاتف","العنوان","المنتج","اللون","المقاس","الكمية","سعر الوحدة","الإجمالي","الحالة","شركة الشحن","تتبع الشحنة","مصدر الإعلان","الحملة","ملاحظات","تاريخ الإنشاء"];
    styleHeader(ws, headers);

    const STATUS: Record<string, string> = {
      pending: "قيد الانتظار", in_shipping: "قيد الشحن", received: "مستلم",
      delayed: "متأخر", returned: "مرتجع", partial_received: "استلام جزئي",
    };

    for (const o of orders) {
      ws.addRow([
        o.id, o.customerName, o.phone ?? "", o.address ?? "",
        o.product, o.color ?? "", o.size ?? "",
        o.quantity, o.unitPrice, o.totalPrice,
        STATUS[o.status] ?? o.status,
        o.shippingCompanyId ?? "", o.trackingNumber ?? "",
        o.adSource ?? "", o.adCampaign ?? "",
        o.notes ?? "",
        o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "",
      ]);
    }

    ws.getColumn(9).numFmt = '#,##0.00 "ج.م"';
    ws.getColumn(10).numFmt = '#,##0.00 "ج.م"';

    await sendWorkbook(res, wb, `طلبات-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير الطلبات", detail: err.message });
  }
});

// ─── GET /api/export/products ─────────────────────────────────────────────────
router.get("/export/products", requireAuth, async (req, res): Promise<void> => {
  try {
    const products = await db.select().from(productsTable);
    const variants = await db.select().from(productVariantsTable);

    const wb = new ExcelJS.Workbook();

    // Sheet 1: Products
    const ws1 = wb.addWorksheet("المنتجات");
    styleHeader(ws1, ["رقم المنتج","الاسم","SKU","سعر البيع","سعر التكلفة","الكمية الكلية","الكمية المحجوزة","الكمية المباعة","حد التنبيه","تاريخ الإنشاء"]);
    for (const p of products) {
      ws1.addRow([p.id, p.name, p.sku ?? "", p.unitPrice, p.costPrice ?? "", p.totalQuantity, p.reservedQuantity, p.soldQuantity, p.lowStockThreshold, p.createdAt ? new Date(p.createdAt).toLocaleDateString("ar-EG") : ""]);
    }

    // Sheet 2: Variants
    const ws2 = wb.addWorksheet("المقاسات والألوان (SKUs)");
    styleHeader(ws2, ["رقم SKU","المنتج","اللون","المقاس","SKU","سعر البيع","سعر التكلفة","الكمية الكلية","الكمية المحجوزة","الكمية المباعة","حد التنبيه"]);
    const productMap = new Map(products.map(p => [p.id, p.name]));
    for (const v of variants) {
      ws2.addRow([v.id, productMap.get(v.productId) ?? v.productId, v.color, v.size, v.sku ?? "", v.unitPrice, v.costPrice ?? "", v.totalQuantity, v.reservedQuantity, v.soldQuantity, v.lowStockThreshold]);
    }

    await sendWorkbook(res, wb, `منتجات-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير المنتجات", detail: err.message });
  }
});

// ─── GET /api/export/shipping ─────────────────────────────────────────────────
router.get("/export/shipping", requireAuth, async (req, res): Promise<void> => {
  try {
    const companies = await db.select().from(shippingCompaniesTable);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("شركات الشحن");
    styleHeader(ws, ["رقم","الاسم","الهاتف","الموقع","ملاحظات","نشط","تاريخ الإنشاء"]);
    for (const c of companies) {
      ws.addRow([c.id, c.name, c.phone ?? "", c.website ?? "", c.notes ?? "", c.isActive ? "نعم" : "لا", c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-EG") : ""]);
    }

    await sendWorkbook(res, wb, `شركات-الشحن-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير شركات الشحن", detail: err.message });
  }
});

// ─── GET /api/export/users ────────────────────────────────────────────────────
router.get("/export/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const users = await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt }).from(usersTable);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("المستخدمين");
    const ROLES: Record<string,string> = { admin: "مدير", employee: "موظف مبيعات", warehouse: "مسؤول مخزون" };
    styleHeader(ws, ["رقم","اسم المستخدم","الاسم الكامل","الدور","نشط","تاريخ الإنشاء"]);
    for (const u of users) {
      ws.addRow([u.id, u.username, u.displayName, ROLES[u.role] ?? u.role, u.isActive ? "نشط" : "معطل", u.createdAt ? new Date(u.createdAt).toLocaleDateString("ar-EG") : ""]);
    }

    await sendWorkbook(res, wb, `مستخدمين-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل تصدير المستخدمين", detail: err.message });
  }
});


// ─── GET /api/export/backup ───────────────────────────────────────────────────
// Full backup: all tables in one Excel file (admin only)
router.get("/export/backup", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  try {
    const [orders, products, variants, companies, users] = await Promise.all([
      db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
      db.select().from(productsTable),
      db.select().from(productVariantsTable),
      db.select().from(shippingCompaniesTable),
      db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, role: usersTable.role, isActive: usersTable.isActive, createdAt: usersTable.createdAt }).from(usersTable),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = "Caprina OS";
    wb.created = new Date();

    // ── Sheet: الطلبات
    const wsO = wb.addWorksheet("الطلبات");
    const STATUS: Record<string, string> = { pending: "قيد الانتظار", in_shipping: "قيد الشحن", received: "مستلم", delayed: "متأخر", returned: "مرتجع", partial_received: "استلام جزئي" };
    styleHeader(wsO, ["id","اسم العميل","الهاتف","العنوان","المنتج","اللون","المقاس","الكمية","سعر الوحدة","الإجمالي","الحالة","شركة_شحن_id","تتبع","مصدر_إعلان","حملة","تكلفة_وحدة","تكلفة_شحن","ملاحظات","سبب_الإرجاع","تاريخ_الإنشاء"]);
    for (const o of orders) {
      wsO.addRow([o.id,o.customerName,o.phone??"",o.address??"",o.product,o.color??"",o.size??"",o.quantity,o.unitPrice,o.totalPrice,STATUS[o.status]??o.status,o.shippingCompanyId??"",o.trackingNumber??"",o.adSource??"",o.adCampaign??"",o.costPrice??"",o.shippingCost??0,o.notes??"",o.returnReason??"",o.createdAt?new Date(o.createdAt).toISOString():""]);
    }

    // ── Sheet: المنتجات
    const wsP = wb.addWorksheet("المنتجات");
    styleHeader(wsP, ["id","الاسم","SKU","سعر_البيع","سعر_التكلفة","كمية_كلية","كمية_محجوزة","كمية_مباعة","حد_التنبيه","تاريخ_الإنشاء"]);
    for (const p of products) {
      wsP.addRow([p.id,p.name,p.sku??"",p.unitPrice,p.costPrice??"",p.totalQuantity,p.reservedQuantity,p.soldQuantity,p.lowStockThreshold,p.createdAt?new Date(p.createdAt).toISOString():""]);
    }

    // ── Sheet: SKUs
    const wsV = wb.addWorksheet("SKUs");
    styleHeader(wsV, ["id","product_id","اللون","المقاس","SKU","سعر_البيع","سعر_التكلفة","كمية_كلية","كمية_محجوزة","كمية_مباعة","حد_التنبيه"]);
    for (const v of variants) {
      wsV.addRow([v.id,v.productId,v.color,v.size,v.sku??"",v.unitPrice,v.costPrice??"",v.totalQuantity,v.reservedQuantity,v.soldQuantity,v.lowStockThreshold]);
    }

    // ── Sheet: شركات الشحن
    const wsS = wb.addWorksheet("شركات_الشحن");
    styleHeader(wsS, ["id","الاسم","الهاتف","الموقع","ملاحظات","نشط","تاريخ_الإنشاء"]);
    for (const c of companies) {
      wsS.addRow([c.id,c.name,c.phone??"",c.website??"",c.notes??"",c.isActive?1:0,c.createdAt?new Date(c.createdAt).toISOString():""]);
    }

    // ── Sheet: المستخدمين
    const wsU = wb.addWorksheet("المستخدمين");
    styleHeader(wsU, ["id","username","الاسم_الكامل","الدور","نشط","تاريخ_الإنشاء"]);
    for (const u of users) {
      wsU.addRow([u.id,u.username,u.displayName,u.role,u.isActive?1:0,u.createdAt?new Date(u.createdAt).toISOString():""]);
    }

    // ── Sheet: إحصائيات
    const wsStat = wb.addWorksheet("إحصائيات");
    styleHeader(wsStat, ["القسم","العدد","تاريخ_النسخة"]);
    const now = new Date().toLocaleString("ar-EG");
    wsStat.addRow(["الطلبات", orders.length, now]);
    wsStat.addRow(["المنتجات", products.length, now]);
    wsStat.addRow(["SKUs", variants.length, now]);
    wsStat.addRow(["شركات الشحن", companies.length, now]);
    wsStat.addRow(["المستخدمين", users.length, now]);

    await sendWorkbook(res, wb, `backup-caprina-${new Date().toISOString().slice(0,10)}`);
  } catch (err: any) {
    res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية", detail: err.message });
  }
});

export default router;
