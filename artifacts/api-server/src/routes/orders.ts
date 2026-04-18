import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, gte, and } from "drizzle-orm";
import { db, ordersTable, productsTable, productVariantsTable } from "@workspace/db";
import {
  ListOrdersQueryParams,
  ListOrdersResponse,
  CreateOrderBody,
  GetOrderParams,
  GetOrderResponse,
  UpdateOrderParams,
  UpdateOrderBody,
  UpdateOrderResponse,
  GetOrdersSummaryResponse,
  GetRecentOrdersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Statuses that keep items "reserved" (not yet delivered / in transit)
const RESERVED_STATUSES = ["pending", "in_shipping", "delayed"];
// Statuses that free inventory back (nothing reserved, nothing sold)
const FREED_STATUSES = ["returned", "deleted"];

/**
 * Compute the correct reservedQty / soldQty deltas for a status transition.
 * Returns {reservedDelta, soldDelta} to apply to the inventory record.
 *
 * We always: REVERSE old effect, then APPLY new effect.
 * This guarantees idempotency — calling twice with the same transition is safe
 * because the second call will see the already-reversed state.
 */
function computeInventoryDeltas(
  oldStatus: string,
  newStatus: string,
  orderQty: number,
  oldPartialQty: number | null,
  newPartialQty: number | null,
): { reservedDelta: number; soldDelta: number } {
  let reservedDelta = 0;
  let soldDelta = 0;

  // --- Reverse the old status effect ---
  if (RESERVED_STATUSES.includes(oldStatus)) {
    reservedDelta -= orderQty;
  } else if (oldStatus === "received") {
    soldDelta -= orderQty;
  } else if (oldStatus === "partial_received") {
    soldDelta -= (oldPartialQty ?? 0);
    // remaining (orderQty - partialQty) was already freed when partial_received was first set,
    // so nothing more to reverse for reserved.
  }
  // returned / deleted / none → no outstanding effect to reverse

  // --- Apply the new status effect ---
  if (RESERVED_STATUSES.includes(newStatus)) {
    reservedDelta += orderQty;
  } else if (newStatus === "received") {
    soldDelta += orderQty;
  } else if (newStatus === "partial_received") {
    const pQty = newPartialQty ?? 0;
    soldDelta += pQty;
    // The remaining (orderQty - pQty) is freed (not reserved, not sold).
    // We already subtracted orderQty from reserved above (reversing the old RESERVED state).
    // Nothing extra to add.
  }
  // returned / deleted / freed → items return to available; no new effect needed.

  return { reservedDelta, soldDelta };
}

async function applyVariantInventory(
  variantId: number,
  reservedDelta: number,
  soldDelta: number,
): Promise<void> {
  const [v] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!v) return;
  await db.update(productVariantsTable).set({
    reservedQuantity: Math.max(0, v.reservedQuantity + reservedDelta),
    soldQuantity: Math.max(0, v.soldQuantity + soldDelta),
    updatedAt: new Date(),
  }).where(eq(productVariantsTable.id, variantId));
}

async function applyProductInventory(
  productId: number,
  reservedDelta: number,
  soldDelta: number,
): Promise<void> {
  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p) return;
  await db.update(productsTable).set({
    reservedQuantity: Math.max(0, p.reservedQuantity + reservedDelta),
    soldQuantity: Math.max(0, p.soldQuantity + soldDelta),
    updatedAt: new Date(),
  }).where(eq(productsTable.id, productId));
}

/**
 * Resolve the inventory target for an order.
 * Priority: variantId → productId → SKU lookup (product name + color + size)
 */
async function resolveInventoryTarget(order: {
  variantId?: number | null;
  productId?: number | null;
  product?: string | null;
  color?: string | null;
  size?: string | null;
}): Promise<{ variantId: number | null; productId: number | null }> {
  if (order.variantId) return { variantId: order.variantId, productId: null };
  if (order.productId) return { variantId: null, productId: order.productId };

  // SKU-based lookup: find variant by parent product name + color + size
  if (order.product && order.color && order.size) {
    const variants = await db
      .select({ id: productVariantsTable.id, productId: productVariantsTable.productId })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .where(
        and(
          ilike(productsTable.name, order.product),
          ilike(productVariantsTable.color, order.color),
          ilike(productVariantsTable.size, order.size),
        ),
      );
    if (variants.length > 0) return { variantId: variants[0].id, productId: null };
  }

  // Fallback: look up product by name only
  if (order.product) {
    const products = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(ilike(productsTable.name, order.product));
    if (products.length > 0) return { variantId: null, productId: products[0].id };
  }

  return { variantId: null, productId: null };
}

/**
 * Core function: adjust inventory when order status changes.
 * Uses the stored oldPartialQty from the existing order record to correctly
 * reverse partial_received effects.
 */
async function adjustOrderInventory(
  order: {
    variantId?: number | null;
    productId?: number | null;
    product?: string | null;
    color?: string | null;
    size?: string | null;
    quantity: number;
    partialQuantity?: number | null;
  },
  oldStatus: string,
  newStatus: string,
  newPartialQty?: number | null,
  oldPartialQty?: number | null,
): Promise<void> {
  if (oldStatus === newStatus && newStatus !== "partial_received") return; // nothing to do

  const { variantId, productId } = await resolveInventoryTarget(order);
  if (!variantId && !productId) return; // no inventory record found

  const { reservedDelta, soldDelta } = computeInventoryDeltas(
    oldStatus,
    newStatus,
    order.quantity,
    oldPartialQty ?? order.partialQuantity ?? null,
    newPartialQty ?? null,
  );

  if (reservedDelta === 0 && soldDelta === 0) return;

  if (variantId) {
    await applyVariantInventory(variantId, reservedDelta, soldDelta);
  } else if (productId) {
    await applyProductInventory(productId, reservedDelta, soldDelta);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/orders/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const all = await db.select().from(ordersTable);
  const filter = (from: Date) => all.filter(o => new Date(o.createdAt) >= from);
  const revenue = (orders: typeof all) =>
    orders.filter(o => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => s + o.totalPrice, 0);

  const productCount: Record<string, number> = {};
  all.forEach(o => { productCount[o.product] = (productCount[o.product] || 0) + o.quantity; });
  const bestProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0];

  res.json({
    today: { orders: filter(startOfToday).length, revenue: revenue(filter(startOfToday)) },
    week: { orders: filter(startOfWeek).length, revenue: revenue(filter(startOfWeek)) },
    month: { orders: filter(startOfMonth).length, revenue: revenue(filter(startOfMonth)) },
    bestProduct: bestProduct ? { name: bestProduct[0], quantity: bestProduct[1] } : null,
  });
});

// ─── List orders ──────────────────────────────────────────────────────────────

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).$dynamic();
  const conditions: any[] = [];

  if (params.data.status) conditions.push(eq(ordersTable.status, params.data.status as any));
  if (params.data.search) {
    const s = `%${params.data.search}%`;
    conditions.push(or(ilike(ordersTable.customerName, s), ilike(ordersTable.product, s), ilike(ordersTable.phone, s)));
  }
  if ((req.query as any).dateFrom) {
    conditions.push(gte(ordersTable.createdAt, new Date((req.query as any).dateFrom as string)));
  }

  if (conditions.length === 1) query = query.where(conditions[0]);
  else if (conditions.length > 1) query = query.where(and(...conditions));

  res.json(ListOrdersResponse.parse(await query));
});

// ─── Create order ─────────────────────────────────────────────────────────────

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const totalPrice = parsed.data.quantity * parsed.data.unitPrice;
  const [order] = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending" }).returning();

  await adjustOrderInventory(
    { ...parsed.data, variantId: (parsed.data as any).variantId ?? null },
    "none",
    "pending",
  );

  res.status(201).json(GetOrderResponse.parse(order));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable);
  const summary = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === "pending").length,
    shippingOrders: orders.filter(o => o.status === "in_shipping").length,
    receivedOrders: orders.filter(o => o.status === "received").length,
    delayedOrders: orders.filter(o => o.status === "delayed").length,
    returnedOrders: orders.filter(o => o.status === "returned").length,
    partialOrders: orders.filter(o => o.status === "partial_received").length,
    totalRevenue: orders
      .filter(o => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => s + o.totalPrice, 0),
  };
  res.json(GetOrdersSummaryResponse.parse(summary));
});

// ─── Recent orders ────────────────────────────────────────────────────────────

router.get("/orders/recent", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(8);
  res.json(GetRecentOrdersResponse.parse(orders));
});

// ─── Get single order ─────────────────────────────────────────────────────────

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(GetOrderResponse.parse(order));
});

// ─── Update order ─────────────────────────────────────────────────────────────

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const quantity = parsed.data.quantity ?? existing.quantity;
  const unitPrice = parsed.data.unitPrice ?? existing.unitPrice;
  const totalPrice = quantity * unitPrice;

  const [order] = await db
    .update(ordersTable)
    .set({ ...parsed.data, totalPrice })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Only adjust inventory when status changes
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await adjustOrderInventory(
      {
        variantId: order.variantId ?? existing.variantId,
        productId: order.productId ?? existing.productId,
        product: order.product ?? existing.product,
        color: order.color ?? existing.color,
        size: order.size ?? existing.size,
        quantity: order.quantity,
        partialQuantity: existing.partialQuantity,
      },
      existing.status,
      parsed.data.status,
      parsed.data.partialQuantity ?? null,     // new partial qty (incoming)
      existing.partialQuantity ?? null,         // old partial qty (for reversal)
    );
  }

  res.json(UpdateOrderResponse.parse(order));
});

// ─── Delete order ─────────────────────────────────────────────────────────────

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  // Reverse inventory effect before deleting
  await adjustOrderInventory(
    {
      variantId: existing.variantId,
      productId: existing.productId,
      product: existing.product,
      color: existing.color,
      size: existing.size,
      quantity: existing.quantity,
      partialQuantity: existing.partialQuantity,
    },
    existing.status,
    "deleted",
    null,
    existing.partialQuantity ?? null,
  );

  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  res.status(204).end();
});

export default router;
