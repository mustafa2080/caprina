import { Router, type IRouter } from "express";
import { eq, desc, and, sql, or, like } from "drizzle-orm";
import {
  db, suppliersTable, purchaseOrdersTable, purchaseOrderItemsTable,
  cashRegistersTable, cashTransactionsTable,
} from "@workspace/db";
import ExcelJS from "exceljs";
import { z } from "zod";

const router: IRouter = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────
const SupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  country: z.string().nullish(),
  category: z.string().nullish(),
  taxNumber: z.string().nullish(),
  paymentTerms: z.string().nullish(),
  notes: z.string().nullish(),
  isActive: z.boolean().default(true),
});

const PurchaseItemSchema = z.object({
  productId: z.number().nullish(),
  variantId: z.number().nullish(),
  productName: z.string().min(1),
  color: z.string().nullish(),
  size: z.string().nullish(),
  sku: z.string().nullish(),
  quantity: z.number().int().min(1),
  unitCost: z.number().min(0),
  notes: z.string().nullish(),
});

const PurchaseOrderSchema = z.object({
  supplierId: z.number().nullish(),
  supplierName: z.string().nullish(),
  warehouseId: z.number().nullish(),
  status: z.enum(["draft", "ordered", "received", "partial_received", "cancelled"]).default("draft"),
  shippingCost: z.number().default(0),
  taxAmount: z.number().default(0),
  discountAmount: z.number().default(0),
  notes: z.string().nullish(),
  expectedDate: z.string().nullish(),
  items: z.array(PurchaseItemSchema).min(1),
});

// ── Suppliers CRUD ──────────────────────────────────────────────────────────
router.get("/finance/suppliers", async (req, res): Promise<void> => {
  const { search, category } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        like(suppliersTable.name, q),
        like(suppliersTable.phone, q),
        like(suppliersTable.email, q),
      )
    );
  }
  if (category?.trim() && category !== "all") {
    conditions.push(eq(suppliersTable.category, category.trim()));
  }
  const suppliers = await db.select().from(suppliersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(suppliersTable.createdAt));
  res.json(suppliers);
});

// ── Export Suppliers Excel ──────────────────────────────────────────────────
router.get("/finance/suppliers/export-excel", async (req, res): Promise<void> => {
  const { search, category } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(or(like(suppliersTable.name, q), like(suppliersTable.phone, q)));
  }
  if (category?.trim() && category !== "all") {
    conditions.push(eq(suppliersTable.category, category.trim()));
  }
  const suppliers = await db.select().from(suppliersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(suppliersTable.createdAt));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("الموردون");
  ws.views = [{ rightToLeft: true }];
  ws.columns = [
    { header: "#",          key: "id",       width: 6  },
    { header: "الاسم",      key: "name",     width: 28 },
    { header: "الفئة",      key: "category", width: 18 },
    { header: "هاتف",       key: "phone",    width: 16 },
    { header: "بريد",       key: "email",    width: 24 },
    { header: "شروط الدفع", key: "terms",    width: 20 },
    { header: "الرصيد",     key: "balance",  width: 14 },
    { header: "الحالة",     key: "active",   width: 10 },
  ];
  ws.getRow(1).font = { bold: true, size: 11 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  const CATS: Record<string, string> = {
    raw_materials: "خامات", products: "منتجات", packaging: "تغليف",
    services: "خدمات", other: "أخرى",
  };
  suppliers.forEach(s => {
    ws.addRow({
      id: s.id, name: s.name,
      category: CATS[s.category ?? ""] ?? s.category ?? "",
      phone: s.phone ?? "", email: s.email ?? "",
      terms: s.paymentTerms ?? "",
      balance: parseFloat(s.balance ?? "0"),
      active: s.isActive ? "نشط" : "غير نشط",
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="suppliers.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});


// ── Supplier Statement (كشف حساب مورد) ─────────────────────────────────────
router.get("/finance/suppliers/:id/statement", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { from, to } = req.query as Record<string, string>;

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "المورد غير موجود" }); return; }

  // أوامر الشراء المرتبطة بالمورد
  const conditions: any[] = [eq(purchaseOrdersTable.supplierId, id)];
  if (from) conditions.push(sql`${purchaseOrdersTable.createdAt} >= ${new Date(from)}`);
  if (to)   conditions.push(sql`${purchaseOrdersTable.createdAt} <= ${new Date(to + "T23:59:59")}`);

  const orders = await db.select().from(purchaseOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(purchaseOrdersTable.createdAt));

  const totalOrders   = orders.length;
  const totalAmount   = orders.reduce((s, o) => s + parseFloat(o.totalAmount ?? "0"), 0);
  const totalPaid     = orders.reduce((s, o) => s + parseFloat(o.paidAmount  ?? "0"), 0);
  const totalUnpaid   = totalAmount - totalPaid;

  res.json({
    supplier,
    orders,
    summary: { totalOrders, totalAmount, totalPaid, totalUnpaid },
  });
});

// ── Supplier Statement Export Excel ────────────────────────────────────────
router.get("/finance/suppliers/:id/statement/export-excel", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { from, to } = req.query as Record<string, string>;

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "المورد غير موجود" }); return; }

  const conditions: any[] = [eq(purchaseOrdersTable.supplierId, id)];
  if (from) conditions.push(sql`${purchaseOrdersTable.createdAt} >= ${new Date(from)}`);
  if (to)   conditions.push(sql`${purchaseOrdersTable.createdAt} <= ${new Date(to + "T23:59:59")}`);

  const orders = await db.select().from(purchaseOrdersTable)
    .where(and(...conditions)).orderBy(desc(purchaseOrdersTable.createdAt));

  const PAY_STATUS: Record<string, string> = { unpaid: "غير مدفوع", partial: "جزئي", paid: "مدفوع" };
  const PO_STATUS: Record<string, string>  = {
    draft: "مسودة", ordered: "مُرسَل", received: "مُستلَم",
    partial_received: "مستلم جزئياً", cancelled: "ملغي",
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("كشف حساب");
  ws.views = [{ rightToLeft: true }];
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `كشف حساب — ${supplier.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.addRow([]);
  ws.columns = [
    { header: "رقم الأمر",   key: "po",      width: 18 },
    { header: "التاريخ",     key: "date",    width: 14 },
    { header: "الحالة",      key: "status",  width: 16 },
    { header: "الإجمالي",    key: "total",   width: 14 },
    { header: "المدفوع",     key: "paid",    width: 14 },
    { header: "المتبقي",     key: "due",     width: 14 },
    { header: "حالة الدفع",  key: "payStatus", width: 14 },
    { header: "ملاحظات",     key: "notes",   width: 28 },
  ];
  const hdrRow = ws.getRow(3);
  hdrRow.font = { bold: true };
  hdrRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  orders.forEach(o => {
    const total = parseFloat(o.totalAmount ?? "0");
    const paid  = parseFloat(o.paidAmount  ?? "0");
    ws.addRow({
      po:        o.poNumber,
      date:      o.createdAt ? new Date(o.createdAt).toLocaleDateString("ar-EG") : "",
      status:    PO_STATUS[o.status ?? ""] ?? o.status ?? "",
      total,
      paid,
      due:       total - paid,
      payStatus: PAY_STATUS[o.paymentStatus ?? ""] ?? o.paymentStatus ?? "",
      notes:     o.notes ?? "",
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="supplier-statement-${id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});


// ── Suppliers CRUD (post / patch / delete) ─────────────────────────────────
router.post("/finance/suppliers", async (req, res): Promise<void> => {
  const parsed = SupplierSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const result = await db.insert(suppliersTable).values({ ...parsed.data, balance: "0", createdAt: now, updatedAt: now });
  const id = (result as any)[0]?.insertId;
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  res.status(201).json(supplier);
});

router.patch("/finance/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const parsed = SupplierSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.update(suppliersTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(suppliersTable.id, id));
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!s) { res.status(404).json({ error: "Supplier not found" }); return; }
  res.json(s);
});

router.delete("/finance/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
  res.status(204).send();
});


// ── Purchase Orders ─────────────────────────────────────────────────────────
router.get("/finance/purchases", async (_req, res): Promise<void> => {
  const orders = await db.select().from(purchaseOrdersTable).orderBy(desc(purchaseOrdersTable.createdAt));
  res.json(orders);
});

router.get("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!order) { res.status(404).json({ error: "Purchase order not found" }); return; }
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, id));
  res.json({ ...order, items });
});

router.post("/finance/purchases", async (req, res): Promise<void> => {
  const parsed = PurchaseOrderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const { items, ...orderData } = parsed.data;
  const totalAmount = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
    + (orderData.shippingCost ?? 0) + (orderData.taxAmount ?? 0) - (orderData.discountAmount ?? 0);
  const poNumber = `PO-${Date.now()}`;
  const result = await db.insert(purchaseOrdersTable).values({
    ...orderData, poNumber, totalAmount: String(totalAmount),
    paidAmount: "0", paymentStatus: "unpaid", createdAt: now, updatedAt: now,
  });
  const poId = (result as any)[0]?.insertId;
  for (const item of items) {
    await db.insert(purchaseOrderItemsTable).values({
      purchaseOrderId: poId, ...item,
      receivedQuantity: 0, totalCost: String(item.quantity * item.unitCost),
    });
  }
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, poId));
  const newItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, poId));
  res.status(201).json({ ...order, items: newItems });
});


router.patch("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, paymentStatus, paidAmount, notes } = req.body;
  const now = new Date();

  const [orderBefore] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!orderBefore) { res.status(404).json({ error: "أمر الشراء مش موجود" }); return; }

  await db.update(purchaseOrdersTable)
    .set({ status, paymentStatus, paidAmount, notes, updatedAt: now })
    .where(eq(purchaseOrdersTable.id, id));

  const prevPay = orderBefore.paymentStatus;
  const newPay  = paymentStatus ?? prevPay;
  const prevPaidAmount = parseFloat(orderBefore.paidAmount ?? "0");
  const shouldRefund = newPay === "unpaid" && prevPay !== "unpaid" && prevPaidAmount > 0;
  const shouldDebit  = newPay !== "unpaid" && (prevPay !== "paid" || prevPaidAmount === 0);

  if (shouldRefund) {
    try {
      const registers = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.isActive, true)).limit(10);
      const mainReg = registers.find(r => r.type === "main") ?? registers[0] ?? null;
      if (mainReg) {
        const balBefore = parseFloat(mainReg.balance ?? "0");
        const balAfter  = balBefore + prevPaidAmount;
        await db.update(cashRegistersTable).set({ balance: String(balAfter), updatedAt: now }).where(eq(cashRegistersTable.id, mainReg.id));
        await db.insert(cashTransactionsTable).values({
          registerId: mainReg.id, type: "deposit",
          amount: String(prevPaidAmount), balanceBefore: String(balBefore), balanceAfter: String(balAfter),
          purchaseOrderId: id,
          description: `إرجاع دفع — أمر شراء ${orderBefore.poNumber} (تم إلغاء الدفع)`,
          referenceNumber: orderBefore.poNumber, transactionDate: now, createdAt: now,
        });
        await db.update(purchaseOrdersTable).set({ paidAmount: "0", updatedAt: now }).where(eq(purchaseOrdersTable.id, id));
      }
    } catch (e) {
      console.error("[purchase PATCH] cash refund error:", e);
      res.status(500).json({ error: "حدث خطأ أثناء إرجاع المبلغ للخزنة" }); return;
    }
  }

  if (shouldDebit) {
    try {
      const total = parseFloat(orderBefore.totalAmount ?? "0");
      const alreadyPaid = parseFloat(orderBefore.paidAmount ?? "0");
      const newPaidAmount = newPay === "paid" ? total : Math.min(parseFloat(paidAmount ?? "0"), total);
      const toDebit = newPaidAmount - alreadyPaid;
      if (toDebit > 0) {
        const registers = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.isActive, true)).limit(10);
        const mainReg = registers.find(r => r.type === "main") ?? registers[0] ?? null;
        if (!mainReg) { res.status(400).json({ error: "لا توجد خزنة — أنشئ خزنة أولاً لتسجيل الدفع" }); return; }
        const balBefore = parseFloat(mainReg.balance ?? "0");
        if (balBefore < toDebit) {
          res.status(400).json({ error: `رصيد الخزنة مش كفاية — المتاح: ${balBefore.toLocaleString("ar-EG")} ج.م، المطلوب: ${toDebit.toLocaleString("ar-EG")} ج.م` }); return;
        }
        const balAfter = balBefore - toDebit;
        await db.update(cashRegistersTable).set({ balance: String(balAfter), updatedAt: now }).where(eq(cashRegistersTable.id, mainReg.id));
        await db.insert(cashTransactionsTable).values({
          registerId: mainReg.id, type: "purchase_paid",
          amount: String(toDebit), balanceBefore: String(balBefore), balanceAfter: String(balAfter),
          purchaseOrderId: id,
          description: `دفع ${newPay === "paid" ? "كامل" : "جزئي"} — أمر شراء ${orderBefore.poNumber}`,
          referenceNumber: orderBefore.poNumber, transactionDate: now, createdAt: now,
        });
        await db.update(purchaseOrdersTable).set({ paidAmount: String(newPaidAmount), updatedAt: now }).where(eq(purchaseOrdersTable.id, id));
      }
    } catch (e) {
      console.error("[purchase PATCH] cash debit error:", e);
      res.status(500).json({ error: "حدث خطأ أثناء خصم المبلغ من الخزنة" }); return;
    }
  }

  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  res.json(order);
});

export default router;
