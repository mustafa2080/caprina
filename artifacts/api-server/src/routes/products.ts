import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, productsTable, warehousesTable, warehouseStockTable } from "@workspace/db";
import { z } from "zod";
import { addStock } from "../lib/inventory.js";
import { logAudit } from "../lib/audit.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullish(),
  totalQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  unitPrice: z.number().min(0),
  costPrice: z.number().min(0).nullish(),
});

// Update schema: totalQuantity excluded — use /add-stock instead
const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().nullish().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).nullish().optional(),
});

const AddStockSchema = z.object({
  quantity: z.number().int().min(1),
  notes: z.string().nullish(),
});

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(products);
});

router.post("/products", requireRole("admin", "warehouse"), async (req, res): Promise<void> => {
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertResult = await db.insert(productsTable).values(parsed.data);
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, insertId));

  await logAudit({ action: "create", entityType: "product", entityId: product.id, entityName: product.name, after: { name: product.name, unitPrice: product.unitPrice, totalQuantity: product.totalQuantity }, userId: req.user?.id, userName: req.user?.displayName });

  res.status(201).json(product);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(product);
});

router.patch("/products/:id", requireRole("admin", "warehouse"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!before) { res.status(404).json({ error: "Product not found" }); return; }
  await db.update(productsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(productsTable.id, id));
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  if (before) await logAudit({ action: "update", entityType: "product", entityId: id, entityName: product.name, before: { name: before.name, unitPrice: before.unitPrice, lowStockThreshold: before.lowStockThreshold }, after: { name: product.name, unitPrice: product.unitPrice, lowStockThreshold: product.lowStockThreshold }, userId: req.user?.id, userName: req.user?.displayName });

  res.json(product);
});

router.delete("/products/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Product not found" }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));

  await logAudit({ action: "delete", entityType: "product", entityId: id, entityName: existing.name, before: { name: existing.name }, userId: req.user?.id, userName: req.user?.displayName });

  res.status(204).send();
});

// ─── Add Stock ────────────────────────────────────────────────────────────────

router.post("/products/:id/add-stock", requireRole("admin", "warehouse"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = AddStockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  await addStock(
    { productId: id, product: product.name },
    parsed.data.quantity,
    parsed.data.notes ?? null,
  );

  // ── مزامنة تلقائية: وزّع الكمية على المخزن الافتراضي ──────────────────────
  // لو فيه مخزن افتراضي → upsert الكمية فيه بما يطابق products.totalQuantity
  const [defaultWarehouse] = await db
    .select()
    .from(warehousesTable)
    .where(eq(warehousesTable.isDefault, true));
  if (defaultWarehouse) {
    const [existing] = await db
      .select()
      .from(warehouseStockTable)
      .where(
        eq(warehouseStockTable.warehouseId, defaultWarehouse.id),
      ).then(rows => rows.filter(r => r.productId === id && r.variantId === null));

    if (existing) {
      await db
        .update(warehouseStockTable)
        .set({ quantity: existing.quantity + parsed.data.quantity, updatedAt: new Date() })
        .where(eq(warehouseStockTable.id, existing.id));
    } else {
      await db
        .insert(warehouseStockTable)
        .values({
          warehouseId: defaultWarehouse.id,
          productId: id,
          variantId: null,
          quantity: parsed.data.quantity,
          updatedAt: new Date(),
        });
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  await logAudit({ action: "add_stock", entityType: "product", entityId: id, entityName: product.name, before: { totalQuantity: product.totalQuantity }, after: { totalQuantity: product.totalQuantity + parsed.data.quantity, added: parsed.data.quantity, notes: parsed.data.notes }, userId: req.user?.id, userName: req.user?.displayName });

  const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  res.json(updated);
});

export default router;
