import { Router, type IRouter } from "express";
import { eq, and, or, desc, count } from "drizzle-orm";
import {
  db,
  warehousesTable,
  warehouseStockTable,
  productsTable,
  productVariantsTable,
  ordersTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

const WarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullish(),
  notes: z.string().nullish(),
  isDefault: z.boolean().optional(),
});

// ─── List ──────────────────────────────────────────────────────────────────────
router.get("/warehouses", async (req, res): Promise<void> => {
  const warehouses = await db
    .select()
    .from(warehousesTable)
    .orderBy(desc(warehousesTable.isDefault), warehousesTable.name);

  // For each warehouse, get total stock items and order count
  const enriched = await Promise.all(
    warehouses.map(async (w) => {
      const stockItems = await db
        .select()
        .from(warehouseStockTable)
        .where(eq(warehouseStockTable.warehouseId, w.id));

      const totalUnits = stockItems.reduce((s, si) => s + si.quantity, 0);
      const skuCount = stockItems.length;

      const [orderCountRow] = await db
        .select({ cnt: count() })
        .from(ordersTable)
        .where(eq(ordersTable.warehouseId, w.id));

      return { ...w, totalUnits, skuCount, orderCount: Number(orderCountRow?.cnt ?? 0) };
    })
  );

  res.json(enriched);
});

// ─── Create ────────────────────────────────────────────────────────────────────
router.post("/warehouses", async (req, res): Promise<void> => {
  const parsed = WarehouseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.isDefault) {
    await db
      .update(warehousesTable)
      .set({ isDefault: false })
      .where(eq(warehousesTable.isDefault, true));
  }

  const insertResult = await db
    .insert(warehousesTable)
    .values({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
      isDefault: parsed.data.isDefault ?? false,
    });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [w] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, insertId));
  res.status(201).json(w);
});

// ─── Get single + stock ────────────────────────────────────────────────────────
router.get("/warehouses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
  if (!warehouse) { res.status(404).json({ error: "المخزن غير موجود" }); return; }

  // Stock items with product/variant details
  const stockRows = await db
    .select({
      stock: warehouseStockTable,
      product: productsTable,
      variant: productVariantsTable,
    })
    .from(warehouseStockTable)
    .leftJoin(productsTable, eq(warehouseStockTable.productId, productsTable.id))
    .leftJoin(productVariantsTable, eq(warehouseStockTable.variantId, productVariantsTable.id))
    .where(eq(warehouseStockTable.warehouseId, id))
    .orderBy(productsTable.name);

  const stock = stockRows.map((r) => ({
    id: r.stock.id,
    warehouseId: r.stock.warehouseId,
    quantity: r.stock.quantity,
    productId: r.stock.productId,
    variantId: r.stock.variantId,
    productName: r.product?.name ?? null,
    productSku: r.product?.sku ?? null,
    variantColor: r.variant?.color ?? null,
    variantSize: r.variant?.size ?? null,
    updatedAt: r.stock.updatedAt,
  }));

  res.json({ ...warehouse, stock });
});

// ─── Update ────────────────────────────────────────────────────────────────────
router.patch("/warehouses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const Schema = WarehouseSchema.partial();
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.isDefault) {
    await db.update(warehousesTable).set({ isDefault: false }).where(eq(warehousesTable.isDefault, true));
  }

  await db
    .update(warehousesTable)
    .set(parsed.data)
    .where(eq(warehousesTable.id, id));
  const [updated] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
  if (!updated) { res.status(404).json({ error: "المخزن غير موجود" }); return; }
  res.json(updated);
});

// ─── Delete ────────────────────────────────────────────────────────────────────
router.delete("/warehouses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [toDelete] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, id));
  if (!toDelete) { res.status(404).json({ error: "المخزن غير موجود" }); return; }
  await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
  res.status(204).send();
});

// ─── Update stock item ─────────────────────────────────────────────────────────
router.patch("/warehouses/:id/stock/:stockId", async (req, res): Promise<void> => {
  const warehouseId = parseInt(req.params.id);
  const stockId = parseInt(req.params.stockId);
  if (isNaN(warehouseId) || isNaN(stockId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const Schema = z.object({ quantity: z.number().int().min(0) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db
      .update(warehouseStockTable)
      .set({ quantity: parsed.data.quantity })
      .where(and(
        eq(warehouseStockTable.id, stockId),
        eq(warehouseStockTable.warehouseId, warehouseId)
      ));
  const [updated] = await db.select().from(warehouseStockTable).where(eq(warehouseStockTable.id, stockId));
  if (!updated) { res.status(404).json({ error: "عنصر المخزون غير موجود" }); return; }
  res.json(updated);
});

// ─── Add stock item ────────────────────────────────────────────────────────────
router.post("/warehouses/:id/stock", async (req, res): Promise<void> => {
  const warehouseId = parseInt(req.params.id);
  if (isNaN(warehouseId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const Schema = z.object({
    productId: z.number().int().positive().nullish(),
    variantId: z.number().int().positive().nullish(),
    quantity: z.number().int().min(0),
  }).refine(d => d.productId || d.variantId, { message: "يجب تحديد منتج أو نوع" });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Upsert
  const [existing] = await db
    .select()
    .from(warehouseStockTable)
    .where(
      and(
        eq(warehouseStockTable.warehouseId, warehouseId),
        parsed.data.variantId
          ? eq(warehouseStockTable.variantId, parsed.data.variantId)
          : eq(warehouseStockTable.productId, parsed.data.productId!)
      )
    );

  if (existing) {
    await db
      .update(warehouseStockTable)
      .set({ quantity: parsed.data.quantity })
      .where(eq(warehouseStockTable.id, existing.id));
    const [updated] = await db.select().from(warehouseStockTable).where(eq(warehouseStockTable.id, existing.id));
    res.json(updated);
  } else {
    const insertResult = await db
      .insert(warehouseStockTable)
      .values({
        warehouseId,
        productId: parsed.data.productId ?? null,
        variantId: parsed.data.variantId ?? null,
        quantity: parsed.data.quantity,
      });
    const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
    const [created] = await db.select().from(warehouseStockTable).where(eq(warehouseStockTable.id, insertId));
    res.status(201).json(created);
  }
});

export default router;
