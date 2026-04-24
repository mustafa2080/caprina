import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, or, like } from "drizzle-orm";
import { db, inventoryMovementsTable, productsTable, warehousesTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Build filter conditions ──────────────────────────────────────────────────
async function buildConditions(query: Record<string, string>) {
  const { type, reason, productId, warehouseId, dateFrom, dateTo } = query;
  const conditions: any[] = [];

  if (type === "IN" || type === "OUT")
    conditions.push(eq(inventoryMovementsTable.type, type));

  if (reason)
    conditions.push(eq(inventoryMovementsTable.reason, reason as any));

  if (warehouseId)
    conditions.push(eq(inventoryMovementsTable.warehouseId, parseInt(warehouseId)));

  if (productId) {
    const pid = parseInt(productId);
    const [product] = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, pid))
      .limit(1);

    if (product?.name) {
      conditions.push(
        or(
          eq(inventoryMovementsTable.productId, pid),
          like(inventoryMovementsTable.product, `%${product.name}%`)
        )
      );
    } else {
      conditions.push(eq(inventoryMovementsTable.productId, pid));
    }
  }

  if (dateFrom)
    conditions.push(gte(inventoryMovementsTable.createdAt, new Date(dateFrom)));

  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(inventoryMovementsTable.createdAt, end));
  }

  return conditions;
}

// ─── List movements (with warehouse name) ────────────────────────────────────
router.get("/inventory/movements", async (req, res): Promise<void> => {
  const conditions = await buildConditions(req.query as Record<string, string>);

  let query = db
    .select({
      id:          inventoryMovementsTable.id,
      productId:   inventoryMovementsTable.productId,
      variantId:   inventoryMovementsTable.variantId,
      warehouseId: inventoryMovementsTable.warehouseId,
      warehouseName: warehousesTable.name,
      product:     inventoryMovementsTable.product,
      color:       inventoryMovementsTable.color,
      size:        inventoryMovementsTable.size,
      quantity:    inventoryMovementsTable.quantity,
      type:        inventoryMovementsTable.type,
      reason:      inventoryMovementsTable.reason,
      orderId:     inventoryMovementsTable.orderId,
      notes:       inventoryMovementsTable.notes,
      createdAt:   inventoryMovementsTable.createdAt,
    })
    .from(inventoryMovementsTable)
    .leftJoin(warehousesTable, eq(inventoryMovementsTable.warehouseId, warehousesTable.id))
    .orderBy(desc(inventoryMovementsTable.createdAt))
    .$dynamic();

  if (conditions.length === 1) query = query.where(conditions[0]);
  else if (conditions.length > 1) query = query.where(and(...conditions));

  res.json(await query);
});

// ─── Totals ───────────────────────────────────────────────────────────────────
router.get("/inventory/movements/totals", async (req, res): Promise<void> => {
  const conditions = await buildConditions(req.query as Record<string, string>);

  let query = db.select().from(inventoryMovementsTable).$dynamic();
  if (conditions.length === 1) query = query.where(conditions[0]);
  else if (conditions.length > 1) query = query.where(and(...conditions));

  const rows = await query;
  const totalIn  = rows.filter(r => r.type === "IN").reduce((s, r) => s + r.quantity, 0);
  const totalOut = rows.filter(r => r.type === "OUT").reduce((s, r) => s + r.quantity, 0);

  res.json({ totalIn, totalOut, balance: totalIn - totalOut });
});

// ─── Create manual movement ───────────────────────────────────────────────────
router.post("/inventory/movements", async (req, res): Promise<void> => {
  const { product, color, size, quantity, type, reason, productId, variantId, warehouseId, notes } = req.body;

  if (!product || !quantity || !type || !reason) {
    res.status(400).json({ error: "product, quantity, type, reason مطلوبة" });
    return;
  }
  if (type !== "IN" && type !== "OUT") {
    res.status(400).json({ error: "type يجب أن يكون IN أو OUT" });
    return;
  }

  const insertResult = await db.insert(inventoryMovementsTable).values({
    product,
    color:       color ?? null,
    size:        size ?? null,
    quantity:    parseInt(quantity),
    type,
    reason,
    productId:   productId   ? parseInt(productId)   : null,
    variantId:   variantId   ? parseInt(variantId)   : null,
    warehouseId: warehouseId ? parseInt(warehouseId) : null,
    notes:       notes ?? null,
    orderId:     null,
  });

  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;

  // جيب الحركة مع اسم المخزن
  const [movement] = await db
    .select({
      id:            inventoryMovementsTable.id,
      productId:     inventoryMovementsTable.productId,
      variantId:     inventoryMovementsTable.variantId,
      warehouseId:   inventoryMovementsTable.warehouseId,
      warehouseName: warehousesTable.name,
      product:       inventoryMovementsTable.product,
      color:         inventoryMovementsTable.color,
      size:          inventoryMovementsTable.size,
      quantity:      inventoryMovementsTable.quantity,
      type:          inventoryMovementsTable.type,
      reason:        inventoryMovementsTable.reason,
      orderId:       inventoryMovementsTable.orderId,
      notes:         inventoryMovementsTable.notes,
      createdAt:     inventoryMovementsTable.createdAt,
    })
    .from(inventoryMovementsTable)
    .leftJoin(warehousesTable, eq(inventoryMovementsTable.warehouseId, warehousesTable.id))
    .where(eq(inventoryMovementsTable.id, insertId));

  res.status(201).json(movement);
});

// ─── Update movement ─────────────────────────────────────────────────────────
router.put("/inventory/movements/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  const { product, color, size, quantity, type, reason, warehouseId, notes } = req.body;

  if (!product || !quantity || !type || !reason) {
    res.status(400).json({ error: "product, quantity, type, reason مطلوبة" }); return;
  }
  if (type !== "IN" && type !== "OUT") {
    res.status(400).json({ error: "type يجب أن يكون IN أو OUT" }); return;
  }

  await db.update(inventoryMovementsTable)
    .set({
      product,
      color:       color ?? null,
      size:        size ?? null,
      quantity:    parseInt(quantity),
      type,
      reason,
      warehouseId: warehouseId ? parseInt(warehouseId) : null,
      notes:       notes ?? null,
    })
    .where(eq(inventoryMovementsTable.id, id));

  const [movement] = await db
    .select({
      id:            inventoryMovementsTable.id,
      productId:     inventoryMovementsTable.productId,
      variantId:     inventoryMovementsTable.variantId,
      warehouseId:   inventoryMovementsTable.warehouseId,
      warehouseName: warehousesTable.name,
      product:       inventoryMovementsTable.product,
      color:         inventoryMovementsTable.color,
      size:          inventoryMovementsTable.size,
      quantity:      inventoryMovementsTable.quantity,
      type:          inventoryMovementsTable.type,
      reason:        inventoryMovementsTable.reason,
      orderId:       inventoryMovementsTable.orderId,
      notes:         inventoryMovementsTable.notes,
      createdAt:     inventoryMovementsTable.createdAt,
    })
    .from(inventoryMovementsTable)
    .leftJoin(warehousesTable, eq(inventoryMovementsTable.warehouseId, warehousesTable.id))
    .where(eq(inventoryMovementsTable.id, id));

  if (!movement) { res.status(404).json({ error: "الحركة غير موجودة" }); return; }
  res.json(movement);
});

// ─── Delete movement ──────────────────────────────────────────────────────────
router.delete("/inventory/movements/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "id غير صحيح" }); return; }

  await db.delete(inventoryMovementsTable).where(eq(inventoryMovementsTable.id, id));
  res.json({ success: true });
});

export default router;
