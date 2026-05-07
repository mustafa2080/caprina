import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, suppliersTable, purchaseOrdersTable, purchaseOrderItemsTable } from "@workspace/db";
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
router.get("/finance/suppliers", async (_req, res): Promise<void> => {
  const suppliers = await db.select().from(suppliersTable).orderBy(desc(suppliersTable.createdAt));
  res.json(suppliers);
});

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
    ...orderData,
    poNumber,
    totalAmount: String(totalAmount),
    paidAmount: "0",
    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
  });
  const poId = (result as any)[0]?.insertId;
  for (const item of items) {
    await db.insert(purchaseOrderItemsTable).values({
      purchaseOrderId: poId,
      ...item,
      receivedQuantity: 0,
      totalCost: String(item.quantity * item.unitCost),
    });
  }
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, poId));
  const newItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, poId));
  res.status(201).json({ ...order, items: newItems });
});

router.patch("/finance/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, paymentStatus, paidAmount, notes } = req.body;
  await db.update(purchaseOrdersTable).set({ status, paymentStatus, paidAmount, notes, updatedAt: new Date() }).where(eq(purchaseOrdersTable.id, id));
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  res.json(order);
});

export default router;
