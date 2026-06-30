import { Router, type IRouter } from "express";
import { eq, desc, and, sql, or, like, isNull } from "drizzle-orm";
import {
  db, suppliersTable, purchaseOrdersTable, purchaseOrderItemsTable,
  cashRegistersTable, cashTransactionsTable, expensesTable,
} from "@workspace/db";
import ExcelJS from "exceljs";
import { z } from "zod";
import { getTenantId } from "../middlewares/requireTenant.js";

const router: IRouter = Router();

// ── helper: إعادة حساب رصيد المورد (مديونيته) من أوامر الشراء + مصروفات دفعات إضافية ──
// balance = إجمالي المتبقي على أوامر الشراء (totalAmount - paidAmount) − دفعات إضافية مسجّلة كمصروف "دفعة لمورد"
export async function recalcSupplierBalance(supplierId: number) {
  const orders = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.supplierId, supplierId));
  const ordersUnpaid = orders.reduce((s: number, o: any) =>
    s + (parseFloat(o.totalAmount ?? "0") - parseFloat(o.paidAmount ?? "0")), 0);

  const extraExpenses = await db.select().from(expensesTable)
    .where(and(eq(expensesTable.category, "supplier_payment"), eq(expensesTable.supplierId, supplierId)));
  const extraPaid = extraExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount ?? "0"), 0);

  const balance = ordersUnpaid - extraPaid;
  await db.update(suppliersTable).set({ balance: String(balance), updatedAt: new Date() })
    .where(eq(suppliersTable.id, supplierId));
  return balance;
}

const SupplierSchema = z.object({
  name: z.string().min(1), phone: z.string().nullish(), email: z.string().nullish(),
  address: z.string().nullish(), country: z.string().nullish(), category: z.string().nullish(),
  taxNumber: z.string().nullish(), paymentTerms: z.string().nullish(),
  notes: z.string().nullish(), isActive: z.boolean().default(true),
});
const PurchaseItemSchema = z.object({
  productId: z.number().nullish(), variantId: z.number().nullish(),
  productName: z.string().min(1), color: z.string().nullish(), size: z.string().nullish(),
  sku: z.string().nullish(), quantity: z.number().int().min(1), unitCost: z.number().min(0),
  notes: z.string().nullish(),
});
const PurchaseOrderSchema = z.object({
  supplierId: z.number().nullish(), supplierName: z.string().nullish(),
  warehouseId: z.number().nullish(),
  status: z.enum(["draft","ordered","received","partial_received","cancelled"]).default("draft"),
  shippingCost: z.number().default(0), taxAmount: z.number().default(0),
  discountAmount: z.number().default(0), notes: z.string().nullish(),
  expectedDate: z.string().nullish(), items: z.array(PurchaseItemSchema).min(1),
});

const PAY_LABEL: Record<string,string> = { unpaid:"غير مدفوع", partial:"جزئي", paid:"مدفوع" };
const STA_LABEL: Record<string,string> = {
  draft:"مسودة", ordered:"تم الطلب", received:"تم الاستلام",
  partial_received:"استلام جزئي", cancelled:"ملغي",
};
const CAT_LABEL: Record<string,string> = {
  raw_materials:"خامات", products:"منتجات", packaging:"تغليف", services:"خدمات", other:"أخرى",
};

// ── Suppliers ──────────────────────────────────────────────────────────────
router.get("/finance/suppliers", async (req, res): Promise<void> => {
  const { search, category } = req.query as Record<string, string>;
  const tenantId = getTenantId(req);
  const conds: any[] = tenantId !== null ? [eq(suppliersTable.tenantId, tenantId)] : [];
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    conds.push(or(like(suppliersTable.name, q), like(suppliersTable.phone, q), like(suppliersTable.email, q)));
  }
  if (category?.trim() && category !== "all") conds.push(eq(suppliersTable.category, category.trim()));
  const rows = await db.select().from(suppliersTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(suppliersTable.createdAt));
  res.json(rows);
});

// ── المورد الافتراضي ────────────────────────────────────────────────────────
router.get("/finance/suppliers/default", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const conds: any[] = [eq(suppliersTable.isDefault, true)];
  if (tenantId !== null) conds.push(eq(suppliersTable.tenantId, tenantId));
  const [supplier] = await db.select().from(suppliersTable).where(and(...conds)).limit(1);
  if (!supplier) { res.status(404).json({ message: "لا يوجد مورد افتراضي" }); return; }
  res.json(supplier);
});

// ── تعيين مورد كافتراضي (يلغي السابق) ────────────────────────────────────
router.patch("/finance/suppliers/:id/set-default", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const supplierId = parseInt(req.params.id);
  if (isNaN(supplierId)) { res.status(400).json({ message: "id غير صالح" }); return; }

  // ألغِ الافتراضي القديم
  const clearConds: any[] = [eq(suppliersTable.isDefault, true)];
  if (tenantId !== null) clearConds.push(eq(suppliersTable.tenantId, tenantId));
  await db.update(suppliersTable).set({ isDefault: false, updatedAt: new Date() }).where(and(...clearConds));

  // عيّن الجديد
  const setConds: any[] = [eq(suppliersTable.id, supplierId)];
  if (tenantId !== null) setConds.push(eq(suppliersTable.tenantId, tenantId));
  await db.update(suppliersTable).set({ isDefault: true, updatedAt: new Date() }).where(and(...setConds));

  const [updated] = await db.select().from(suppliersTable).where(and(...setConds)).limit(1);
  res.json(updated);
});

router.get("/finance/suppliers/export-excel", async (req, res): Promise<void> => {
  const { search, category } = req.query as Record<string, string>;
  const tenantId = getTenantId(req);
  const conds: any[] = tenantId !== null ? [eq(suppliersTable.tenantId, tenantId)] : [];
  if (search?.trim()) { const q = `%${search.trim()}%`; conds.push(or(like(suppliersTable.name, q), like(suppliersTable.phone, q))); }
  if (category?.trim() && category !== "all") conds.push(eq(suppliersTable.category, category.trim()));
  const rows = await db.select().from(suppliersTable)
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(suppliersTable.createdAt));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الموردون");
  ws.views = [{ rightToLeft: true }];
  ws.columns = [
    { header:"#", key:"id", width:6 }, { header:"الاسم", key:"name", width:28 },
    { header:"الفئة", key:"cat", width:18 }, { header:"هاتف", key:"phone", width:16 },
    { header:"بريد", key:"email", width:24 }, { header:"شروط الدفع", key:"terms", width:20 },
    { header:"الرصيد", key:"balance", width:14 }, { header:"الحالة", key:"active", width:10 },
  ];
  ws.getRow(1).font = { bold:true, size:11 };
  ws.getRow(1).fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFE2E8F0" } };
  rows.forEach(s => ws.addRow({
    id: s.id, name: s.name, cat: CAT_LABEL[s.category ?? ""] ?? s.category ?? "",
    phone: s.phone ?? "", email: s.email ?? "", terms: s.paymentTerms ?? "",
    balance: parseFloat(s.balance ?? "0"), active: s.isActive ? "نشط" : "غير نشط",
  }));
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",`attachment; filename="suppliers.xlsx"`);
  await wb.xlsx.write(res); res.end();
});

router.post("/finance/suppliers", async (req, res): Promise<void> => {
  const parsed = SupplierSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const tenantId = getTenantId(req);
  const result = await db.insert(suppliersTable).values({
    ...parsed.data, balance:"0", createdAt:now, updatedAt:now,
    ...(tenantId !== null ? { tenantId } : {}),
  });
  const id = (result as any)[0]?.insertId;
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  res.status(201).json(s);
});

router.patch("/finance/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const parsed = SupplierSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.update(suppliersTable).set({ ...parsed.data, updatedAt:new Date() }).where(eq(suppliersTable.id, id));
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!s) { res.status(404).json({ error:"Supplier not found" }); return; }
  res.json(s);
});

router.delete("/finance/suppliers/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    // تحقق من وجود أوامر شراء مرتبطة
    const relatedOrders = await db.select({ id: purchaseOrdersTable.id })
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.supplierId, id))
      .limit(1);
    if (relatedOrders.length > 0) {
      res.status(400).json({ error: "لا يمكن حذف المورد — يوجد أوامر شراء مرتبطة به" });
      return;
    }
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error("[DELETE supplier]", err);
    res.status(500).json({ error: "فشل حذف المورد" });
  }
});

// ── Supplier Statement ──────────────────────────────────────────────────────
router.get("/finance/suppliers/:id/statement", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { from, to } = req.query as Record<string, string>;
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error:"المورد غير موجود" }); return; }
  const conds: any[] = [eq(purchaseOrdersTable.supplierId, id)];
  if (from) conds.push(sql`${purchaseOrdersTable.createdAt} >= ${new Date(from)}`);
  if (to)   conds.push(sql`${purchaseOrdersTable.createdAt} <= ${new Date(to + "T23:59:59")}`);
  const orders = await db.select().from(purchaseOrdersTable).where(and(...conds)).orderBy(desc(purchaseOrdersTable.createdAt));
  const totalAmount = orders.reduce((s,o) => s + parseFloat(o.totalAmount??"0"), 0);
  const totalPaid   = orders.reduce((s,o) => s + parseFloat(o.paidAmount ??"0"), 0);

  // ── دفعات إضافية (مصروفات "دفعة لمورد") — لازم تتحسب هنا عشان تطابق recalcSupplierBalance ──
  const extraConds: any[] = [eq(expensesTable.category, "supplier_payment"), eq(expensesTable.supplierId, id)];
  if (from) extraConds.push(sql`${expensesTable.createdAt} >= ${new Date(from)}`);
  if (to)   extraConds.push(sql`${expensesTable.createdAt} <= ${new Date(to + "T23:59:59")}`);
  const extraPayments = await db.select().from(expensesTable).where(and(...extraConds)).orderBy(desc(expensesTable.createdAt));
  const totalExtraPaid = extraPayments.reduce((s,e) => s + parseFloat(e.amount ?? "0"), 0);

  // المعادلة لازم تطابق recalcSupplierBalance بالظبط: (totalAmount - totalPaid) - extraPaid
  const totalUnpaid = (totalAmount - totalPaid) - totalExtraPaid;

  res.json({
    supplier, orders, extraPayments,
    summary:{
      totalOrders: orders.length, totalAmount, totalPaid,
      totalExtraPaid, totalUnpaid,
    },
  });
});

router.get("/finance/suppliers/:id/statement/export-excel", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { from, to } = req.query as Record<string, string>;
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error:"المورد غير موجود" }); return; }
  const conds: any[] = [eq(purchaseOrdersTable.supplierId, id)];
  if (from) conds.push(sql`${purchaseOrdersTable.createdAt} >= ${new Date(from)}`);
  if (to)   conds.push(sql`${purchaseOrdersTable.createdAt} <= ${new Date(to + "T23:59:59")}`);
  const orders = await db.select().from(purchaseOrdersTable).where(and(...conds)).orderBy(desc(purchaseOrdersTable.createdAt));

  const totalAmount = orders.reduce((s,o) => s + parseFloat(o.totalAmount ?? "0"), 0);
  const totalPaid   = orders.reduce((s,o) => s + parseFloat(o.paidAmount  ?? "0"), 0);
  const totalDue    = totalAmount - totalPaid;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Caprina";
  wb.created = new Date();
  const ws = wb.addWorksheet("كشف حساب", {
    views: [{ rightToLeft: true }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // ── صف العنوان الرئيسي (merged) ──
  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `🧾  كشف حساب — ${supplier.name}`;
  titleCell.font  = { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Arial" };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 38;

  // ── صف الفترة/التاريخ ──
  ws.mergeCells("A2:H2");
  const dateCell = ws.getCell("A2");
  const periodTxt = (from || to) ? `   |   الفترة: ${from || "البداية"} → ${to || "الآن"}` : "";
  dateCell.value = `تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG", { year:"numeric", month:"long", day:"numeric" })}${periodTxt}   |   إجمالي السجلات: ${orders.length}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "FF555555" } };
  dateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
  dateCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  // ── صف بيانات المورد ──
  ws.mergeCells("A3:H3");
  const infoCell = ws.getCell("A3");
  const infoParts = [supplier.phone ? `📞 ${supplier.phone}` : null, supplier.email ? `✉️ ${supplier.email}` : null, supplier.paymentTerms ? `شروط الدفع: ${supplier.paymentTerms}` : null].filter(Boolean);
  infoCell.value = infoParts.join("   |   ") || " ";
  infoCell.font = { size: 10, color: { argb: "FF555555" } };
  infoCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 18;

  // ── ملخص علوي (4 بطاقات) ──
  ws.addRow([]);
  const sumLabels = ["إجمالي الأوامر", "إجمالي المشتريات", "إجمالي المدفوع", "المتبقي (مديونية)"];
  const sumValues = [orders.length, totalAmount, totalPaid, totalDue];
  const sumColors = ["FF533483", "FFC0892C", "FF1A6B3C", "FFC0392B"];
  const sumRow1 = ws.addRow(sumLabels);
  const sumRow2 = ws.addRow(sumValues);
  sumRow1.height = 20; sumRow2.height = 24;
  sumLabels.forEach((_, i) => {
    const lc = sumRow1.getCell(i + 1); const vc = sumRow2.getCell(i + 1);
    lc.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Arial" };
    lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sumColors[i] } };
    lc.alignment = { horizontal: "center", vertical: "middle" };
    vc.font = { bold: true, size: 13, color: { argb: sumColors[i] }, name: "Arial" };
    vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    vc.alignment = { horizontal: "center", vertical: "middle" };
    if (i > 0) vc.numFmt = '#,##0.00 "ج.م"';
    [lc, vc].forEach(c => c.border = { top:{style:"thin",color:{argb:"FFAAAAAA"}}, bottom:{style:"thin",color:{argb:"FFAAAAAA"}}, left:{style:"thin",color:{argb:"FFAAAAAA"}}, right:{style:"thin",color:{argb:"FFAAAAAA"}} });
  });
  ws.addRow([]);

  // ── تعريف الأعمدة ──
  ws.columns = [
    { key: "po",        width: 20 },
    { key: "date",       width: 14 },
    { key: "status",     width: 16 },
    { key: "total",      width: 16 },
    { key: "paid",       width: 16 },
    { key: "due",        width: 16 },
    { key: "payStatus",  width: 14 },
    { key: "notes",      width: 30 },
  ];

  // ── صف الهيدر ──
  const HEADERS = ["رقم الأمر", "التاريخ", "الحالة", "الإجمالي (ج.م)", "المدفوع (ج.م)", "المتبقي (ج.م)", "حالة الدفع", "ملاحظات"];
  const HEADER_COLORS = ["FF16213E","FF0F3460","FF533483","FFC0392B","FF1A6B3C","FFB7950B","FF0E5E6F","FF4A4A6A"];
  const headerRow = ws.addRow(HEADERS);
  headerRow.height = 26;
  headerRow.eachCell((cell, colNum) => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_COLORS[colNum - 1] ?? "FF333333" } };
    cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Arial" };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: "FFAAAAAA" } },
      bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
      left:   { style: "thin", color: { argb: "FFAAAAAA" } },
      right:  { style: "thin", color: { argb: "FFAAAAAA" } },
    };
  });

  // ── بيانات أوامر الشراء ──
  const PAY_COLORS: Record<string,string> = { unpaid:"FFFFD5D5", partial:"FFFFF3D5", paid:"FFD5FFE8" };
  orders.forEach((o, i) => {
    const total = parseFloat(o.totalAmount ?? "0");
    const paid  = parseFloat(o.paidAmount  ?? "0");
    const due   = total - paid;
    const payKey = o.paymentStatus ?? "unpaid";
    const bgColor = i % 2 === 0 ? (PAY_COLORS[payKey] ?? "FFFFFFFF") : "FFFFFFFF";

    const row = ws.addRow({
      po:        o.poNumber,
      date:      o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "",
      status:    STA_LABEL[o.status ?? ""] ?? o.status ?? "",
      total, paid, due,
      payStatus: PAY_LABEL[payKey] ?? payKey,
      notes:     o.notes ?? "—",
    });
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle", horizontal: "right", wrapText: false };
      cell.font = { size: 10, name: "Arial" };
      cell.border = { bottom: { style: "hair", color: { argb: "FFDDDDDD" } }, right: { style: "hair", color: { argb: "FFDDDDDD" } } };
    });
    [row.getCell("total"), row.getCell("paid"), row.getCell("due")].forEach(c => { c.numFmt = '#,##0.00'; });
    row.getCell("po").font   = { size: 10, bold: true, color: { argb: "FF1A1A2E" }, name: "Arial" };
    row.getCell("due").font  = { size: 10, bold: true, color: { argb: due > 0 ? "FFC0392B" : "FF1A6B3C" }, name: "Arial" };
    row.getCell("paid").font = { size: 10, color: { argb: "FF1A6B3C" }, name: "Arial" };
  });

  // ── صف الإجمالي ──
  ws.addRow([]);
  const totalRow = ws.addRow({
    po: "📊  الإجمالي الكلي", date: "", status: "", total: totalAmount, paid: totalPaid, due: totalDue,
    payStatus: `${orders.length} أمر`, notes: "",
  });
  totalRow.height = 28;
  totalRow.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
    cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" }, name: "Arial" };
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.border = { top: { style: "medium", color: { argb: "FFAAAAAA" } }, bottom: { style: "medium", color: { argb: "FFAAAAAA" } } };
  });
  [totalRow.getCell("total"), totalRow.getCell("paid")].forEach(c => { c.numFmt = '#,##0.00 "ج.م"'; c.font = { bold:true, size:12, color:{argb:"FFFFD700"}, name:"Arial" }; });
  const dueCell = totalRow.getCell("due");
  dueCell.numFmt = '#,##0.00 "ج.م"';
  dueCell.font = { bold: true, size: 13, color: { argb: totalDue > 0 ? "FFFF6B6B" : "FF6BFFA0" }, name: "Arial" };

  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''supplier-statement-${id}-${Date.now()}.xlsx`);
  await wb.xlsx.write(res); res.end();
});

// ── Purchase Orders ─────────────────────────────────────────────────────────
router.get("/finance/purchases", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const conds: any[] = tenantId !== null ? [eq(purchaseOrdersTable.tenantId, tenantId)] : [];
  const orders = await db.select().from(purchaseOrdersTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(purchaseOrdersTable.createdAt));
  res.json(orders);
});

router.get("/finance/purchases/export-excel", async (req, res): Promise<void> => {
  const { search, paymentStatus, status, supplierId, from, to } = req.query as Record<string,string>;
  const tenantId = getTenantId(req);
  const conds: any[] = tenantId !== null ? [eq(purchaseOrdersTable.tenantId, tenantId)] : [];
  let orders = await db.select().from(purchaseOrdersTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(purchaseOrdersTable.createdAt));
  const allSupp = await db.select().from(suppliersTable)
    .where(tenantId !== null ? eq(suppliersTable.tenantId, tenantId) : undefined);
  const suppMap: Record<number,string> = {};
  allSupp.forEach(s => { suppMap[s.id] = s.name; });
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    orders = orders.filter(o =>
      o.poNumber?.toLowerCase().includes(q) ||
      (suppMap[o.supplierId??0]??o.supplierName??"").toLowerCase().includes(q) ||
      o.notes?.toLowerCase().includes(q)
    );
  }
  if (paymentStatus && paymentStatus !== "all") orders = orders.filter(o => o.paymentStatus === paymentStatus);
  if (status && status !== "all")               orders = orders.filter(o => o.status === status);
  if (supplierId && supplierId !== "all")        orders = orders.filter(o => String(o.supplierId) === supplierId);
  if (from) orders = orders.filter(o => o.createdAt && new Date(o.createdAt) >= new Date(from));
  if (to)   orders = orders.filter(o => o.createdAt && new Date(o.createdAt) <= new Date(to+"T23:59:59"));
  const totalAmt  = orders.reduce((s,o) => s + parseFloat(o.totalAmount??"0"), 0);
  const totalPaid = orders.reduce((s,o) => s + parseFloat(o.paidAmount ??"0"), 0);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("أوامر الشراء");
  ws.views = [{ rightToLeft:true }];
  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = `أوامر الشراء — ${orders.length} أمر | الإجمالي: ${totalAmt.toLocaleString("ar-EG")} ج.م | المدفوع: ${totalPaid.toLocaleString("ar-EG")} ج.م | المتبقي: ${(totalAmt-totalPaid).toLocaleString("ar-EG")} ج.م`;
  ws.getCell("A1").font  = { bold:true, size:11 };
  ws.getCell("A1").fill  = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFDBEAFE" } };
  ws.addRow([]);
  ws.columns = [
    { header:"رقم الأمر", key:"po", width:20 }, { header:"التاريخ", key:"date", width:13 },
    { header:"المورد", key:"supplier", width:22 }, { header:"حالة الطلب", key:"status", width:16 },
    { header:"الإجمالي", key:"total", width:14 }, { header:"المدفوع", key:"paid", width:14 },
    { header:"المتبقي", key:"due", width:14 }, { header:"حالة الدفع", key:"payStatus", width:14 },
    { header:"ملاحظات", key:"notes", width:30 },
  ];
  const hdr = ws.getRow(3); hdr.font = { bold:true, size:10 }; hdr.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFE2E8F0" } };
  orders.forEach(o => {
    const total = parseFloat(o.totalAmount??"0"); const paid = parseFloat(o.paidAmount??"0");
    const row = ws.addRow({
      po: o.poNumber, date: o.createdAt?new Date(o.createdAt).toLocaleDateString("ar-EG"):"",
      supplier: suppMap[o.supplierId??0]??o.supplierName??"—",
      status: STA_LABEL[o.status??""]??o.status??"",
      total, paid, due: total-paid,
      payStatus: PAY_LABEL[o.paymentStatus??""]??o.paymentStatus??"",
      notes: o.notes??"",
    });
    if (o.paymentStatus === "unpaid")  row.getCell("payStatus").font = { color:{ argb:"FFE53E3E" } };
    if (o.paymentStatus === "partial") row.getCell("payStatus").font = { color:{ argb:"FFD97706" } };
    if (o.paymentStatus === "paid")    row.getCell("payStatus").font = { color:{ argb:"FF059669" } };
  });
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",`attachment; filename="purchases.xlsx"`);
  await wb.xlsx.write(res); res.end();
});

router.get("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!order) { res.status(404).json({ error:"Purchase order not found" }); return; }
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, id));
  res.json({ ...order, items });
});

router.post("/finance/purchases", async (req, res): Promise<void> => {
  const parsed = PurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const tenantId = getTenantId(req);
  const { items, ...orderData } = parsed.data;
  const totalAmount = items.reduce((s,i) => s + i.quantity * i.unitCost, 0)
    + (orderData.shippingCost??0) + (orderData.taxAmount??0) - (orderData.discountAmount??0);
  const poNumber = `PO-${Date.now()}`;
  const result = await db.insert(purchaseOrdersTable).values({
    ...orderData, poNumber, totalAmount:String(totalAmount),
    paidAmount:"0", paymentStatus:"unpaid", createdAt:now, updatedAt:now,
    ...(tenantId !== null ? { tenantId } : {}),
  });
  const poId = (result as any)[0]?.insertId;
  for (const item of items) {
    await db.insert(purchaseOrderItemsTable).values({
      purchaseOrderId:poId, ...item, receivedQuantity:0, totalCost:String(item.quantity*item.unitCost),
    });
  }
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, poId));
  const newItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, poId));
  if (orderData.supplierId) await recalcSupplierBalance(orderData.supplierId);
  res.status(201).json({ ...order, items:newItems });
});

// ── helper: جيب الخزنة الافتراضية أو أول خزنة نشطة ─────────────────────
async function getDefaultRegister() {
  const regs = await db.select().from(cashRegistersTable)
    .where(eq(cashRegistersTable.isActive, true))
    .orderBy(cashRegistersTable.id);
  return (regs.find((r: any) => r.isDefault) ?? regs.find((r: any) => r.type === "main") ?? regs[0]) ?? null;
}

router.patch("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, paymentStatus, paidAmount, notes } = req.body;
  const now = new Date();

  const [ob] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!ob) { res.status(404).json({ error:"أمر الشراء مش موجود" }); return; }

  const prevPay  = ob.paymentStatus ?? "unpaid";
  const newPay   = paymentStatus ?? prevPay;
  const prevPaid = parseFloat(ob.paidAmount ?? "0");
  const total    = parseFloat(ob.totalAmount ?? "0");

  // ── حساب المبلغ الجديد المدفوع ────────────────────────────────────────────
  let newPaidAmt: number;
  if (newPay === "unpaid")  newPaidAmt = 0;
  else if (newPay === "paid") newPaidAmt = total;
  else newPaidAmt = Math.min(Math.max(parseFloat(paidAmount ?? "0"), 0), total); // partial

  const delta = newPaidAmt - prevPaid; // موجب = خصم، سالب = إرجاع

  try {
    if (delta > 0) {
      // ── خصم من الخزنة ──────────────────────────────────────────────────
      const reg = await getDefaultRegister();
      if (!reg) { res.status(400).json({ error:"لا توجد خزنة نشطة" }); return; }
      const bb = parseFloat(reg.balance ?? "0");
      if (bb < delta) {
        res.status(400).json({ error:`رصيد الخزنة "${reg.name}" مش كفاية — المتاح: ${bb.toLocaleString("ar-EG")} ج.م` });
        return;
      }
      const ba = bb - delta;
      await db.update(cashRegistersTable).set({ balance:String(ba), updatedAt:now }).where(eq(cashRegistersTable.id, reg.id));
      await db.insert(cashTransactionsTable).values({
        registerId:reg.id, type:"purchase_paid", amount:String(delta),
        balanceBefore:String(bb), balanceAfter:String(ba),
        purchaseOrderId:id,
        description:`دفع ${newPay==="paid"?"كامل":"جزئي"} — أمر شراء ${ob.poNumber}`,
        referenceNumber:ob.poNumber, transactionDate:now, createdAt:now,
      });

    } else if (delta < 0) {
      // ── إرجاع للخزنة ───────────────────────────────────────────────────
      const refund = Math.abs(delta);
      const reg = await getDefaultRegister();
      if (reg) {
        const bb = parseFloat(reg.balance ?? "0");
        const ba = bb + refund;
        await db.update(cashRegistersTable).set({ balance:String(ba), updatedAt:now }).where(eq(cashRegistersTable.id, reg.id));
        await db.insert(cashTransactionsTable).values({
          registerId:reg.id, type:"deposit", amount:String(refund),
          balanceBefore:String(bb), balanceAfter:String(ba),
          purchaseOrderId:id,
          description:`إرجاع دفع — أمر شراء ${ob.poNumber}`,
          referenceNumber:ob.poNumber, transactionDate:now, createdAt:now,
        });
      }
    }
    // delta === 0 → لا تغيير في الخزنة

    // ── تحديث أمر الشراء ──────────────────────────────────────────────────
    const finalPayStatus = newPaidAmt <= 0 ? "unpaid" : newPaidAmt >= total ? "paid" : "partial";
    await db.update(purchaseOrdersTable).set({
      status:        status ?? ob.status,
      paymentStatus: finalPayStatus,
      paidAmount:    String(newPaidAmt),
      notes:         notes ?? ob.notes,
      updatedAt:     now,
    }).where(eq(purchaseOrdersTable.id, id));

  } catch(e) { console.error(e); res.status(500).json({ error:"خطأ أثناء تحديث أمر الشراء" }); return; }

  if (ob.supplierId) await recalcSupplierBalance(ob.supplierId);

  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  res.json(order);
});

router.delete("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const now = new Date();

  const [ob] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!ob) { res.status(404).json({ error:"أمر الشراء مش موجود" }); return; }

  // ── لو فيه مبلغ مدفوع → ارجعه للخزنة قبل الحذف ──────────────────────────
  const paidSoFar = parseFloat(ob.paidAmount ?? "0");
  if (paidSoFar > 0) {
    const reg = await getDefaultRegister();
    if (reg) {
      const bb = parseFloat(reg.balance ?? "0");
      const ba = bb + paidSoFar;
      await db.update(cashRegistersTable).set({ balance:String(ba), updatedAt:now }).where(eq(cashRegistersTable.id, reg.id));
      await db.insert(cashTransactionsTable).values({
        registerId:reg.id, type:"deposit", amount:String(paidSoFar),
        balanceBefore:String(bb), balanceAfter:String(ba),
        purchaseOrderId:id,
        description:`إلغاء أمر شراء ${ob.poNumber} — إرجاع ${paidSoFar.toLocaleString("ar-EG")} ج.م`,
        referenceNumber:ob.poNumber, transactionDate:now, createdAt:now,
      });
    }
  }

  await db.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, id));
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (ob.supplierId) await recalcSupplierBalance(ob.supplierId);
  res.status(204).send();
});

export default router;
