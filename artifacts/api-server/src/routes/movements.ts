import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, or, like } from "drizzle-orm";
import { db, inventoryMovementsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Build filter conditions ──────────────────────────────────────────────────
async function buildConditions(query: Record<string, string>) {
  const { type, reason, productId, dateFrom, dateTo } = query;
  const conditions: any[] = [];

  if (type === "IN" || type === "OUT")
    conditions.push(eq(inventoryMovementsTable.type, type));

  if (reason)
    conditions.push(eq(inventoryMovementsTable.reason, reason as any));

  // ── Product filter: match by productId OR by product name (text) ──────────
  if (productId) {
    const pid = parseInt(productId);
    // جيب اسم المنتج من الـ DB
    const [product] = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, pid))
      .limit(1);

    if (product?.name) {
      // فلتر بـ productId أو باسم المنتج (عشان الحركات القديمة اللي productId = null)
      conditions.push(
        or(
          eq(inventoryMovementsTable.productId, pid),
          like(inventoryMovementsTable.product, `%${product.name}%`)
        )
      );
    } else {
      // المنتج مش موجود — فلتر بالـ id بس
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

// ─── List movements ───────────────────────────────────────────────────────────

router.get("/inventory/movements", async (req, res): Promise<void> => {
  const conditions = await buildConditions(req.query as Record<string, string>);

  let query = db.select().from(inventoryMovementsTable).orderBy(desc(inventoryMovementsTable.createdAt)).$dynamic();
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
  const { product, color, size, quantity, type, reason, productId, variantId, notes } = req.body;

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
    color: color ?? null,
    size: size ?? null,
    quantity: parseInt(quantity),
    type,
    reason,
    productId: productId ? parseInt(productId) : null,
    variantId: variantId ? parseInt(variantId) : null,
    notes: notes ?? null,
    orderId: null,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [movement] = await db.select().from(inventoryMovementsTable).where(eq(inventoryMovementsTable.id, insertId));

  res.status(201).json(movement);
});

export default router;
