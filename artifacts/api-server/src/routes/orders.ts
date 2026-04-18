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
import { adjustOrderInventory } from "../lib/inventory.js";

const router: IRouter = Router();

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

  // New order always starts as pending → reserve inventory
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

  // Adjust inventory only when status changes
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
      parsed.data.partialQuantity ?? null,
      existing.partialQuantity ?? null,
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
