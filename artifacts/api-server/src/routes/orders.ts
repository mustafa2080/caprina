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

async function adjustVariantInventory(
  variantId: number,
  oldStatus: string,
  newStatus: string,
  orderQty: number,
  partialQty?: number | null
) {
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  if (!variant) return;

  let { reservedQuantity, soldQuantity } = variant;

  // Reverse old status effect
  if (oldStatus === "pending" || oldStatus === "delayed") {
    reservedQuantity = Math.max(0, reservedQuantity - orderQty);
  } else if (oldStatus === "received") {
    soldQuantity = Math.max(0, soldQuantity - orderQty);
  } else if (oldStatus === "partial_received") {
    soldQuantity = Math.max(0, soldQuantity - (partialQty ?? 0));
  }

  // Apply new status effect
  if (newStatus === "pending" || newStatus === "delayed") {
    reservedQuantity += orderQty;
  } else if (newStatus === "received") {
    soldQuantity += orderQty;
  } else if (newStatus === "partial_received" && partialQty != null) {
    soldQuantity += partialQty;
  }

  await db
    .update(productVariantsTable)
    .set({ reservedQuantity: Math.max(0, reservedQuantity), soldQuantity: Math.max(0, soldQuantity), updatedAt: new Date() })
    .where(eq(productVariantsTable.id, variantId));
}

async function adjustInventory(
  productId: number,
  oldStatus: string,
  newStatus: string,
  orderQty: number,
  partialQty?: number | null
) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return;

  let { reservedQuantity, soldQuantity } = product;

  if (oldStatus === "pending" || oldStatus === "delayed") {
    reservedQuantity = Math.max(0, reservedQuantity - orderQty);
  } else if (oldStatus === "received") {
    soldQuantity = Math.max(0, soldQuantity - orderQty);
  } else if (oldStatus === "partial_received") {
    soldQuantity = Math.max(0, soldQuantity - (partialQty ?? 0));
  }

  if (newStatus === "pending" || newStatus === "delayed") {
    reservedQuantity += orderQty;
  } else if (newStatus === "received") {
    soldQuantity += orderQty;
  } else if (newStatus === "partial_received" && partialQty != null) {
    soldQuantity += partialQty;
  }

  await db
    .update(productsTable)
    .set({ reservedQuantity: Math.max(0, reservedQuantity), soldQuantity: Math.max(0, soldQuantity), updatedAt: new Date() })
    .where(eq(productsTable.id, productId));
}

router.get("/orders/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const all = await db.select().from(ordersTable);

  const filter = (from: Date) => all.filter(o => new Date(o.createdAt) >= from);
  const revenue = (orders: typeof all) => orders.filter(o => o.status === "received" || o.status === "partial_received").reduce((s, o) => s + o.totalPrice, 0);

  const todayOrders = filter(startOfToday);
  const weekOrders = filter(startOfWeek);
  const monthOrders = filter(startOfMonth);

  const productCount: Record<string, number> = {};
  all.forEach(o => { productCount[o.product] = (productCount[o.product] || 0) + o.quantity; });
  const bestProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0];

  res.json({
    today: { orders: todayOrders.length, revenue: revenue(todayOrders) },
    week: { orders: weekOrders.length, revenue: revenue(weekOrders) },
    month: { orders: monthOrders.length, revenue: revenue(monthOrders) },
    bestProduct: bestProduct ? { name: bestProduct[0], quantity: bestProduct[1] } : null,
  });
});

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

  const orders = await query;
  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const totalPrice = parsed.data.quantity * parsed.data.unitPrice;
  const [order] = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending" }).returning();

  if ((parsed.data as any).variantId) {
    await adjustVariantInventory((parsed.data as any).variantId, "none", "pending", parsed.data.quantity);
  } else if (parsed.data.productId) {
    await adjustInventory(parsed.data.productId, "none", "pending", parsed.data.quantity);
  }

  res.status(201).json(GetOrderResponse.parse(order));
});

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable);
  const summary = {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    receivedOrders: orders.filter((o) => o.status === "received").length,
    delayedOrders: orders.filter((o) => o.status === "delayed").length,
    returnedOrders: orders.filter((o) => o.status === "returned").length,
    partialOrders: orders.filter((o) => o.status === "partial_received").length,
    totalRevenue: orders.filter((o) => o.status === "received" || o.status === "partial_received").reduce((s, o) => s + o.totalPrice, 0),
  };
  res.json(GetOrdersSummaryResponse.parse(summary));
});

router.get("/orders/recent", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(8);
  res.json(GetRecentOrdersResponse.parse(orders));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(GetOrderResponse.parse(order));
});

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
  const updateData = { ...parsed.data, totalPrice };

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, params.data.id)).returning();
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  if (parsed.data.status && parsed.data.status !== existing.status) {
    const variantId = (order as any).variantId ?? (existing as any).variantId;
    const productId = order.productId ?? existing.productId;
    if (variantId) {
      await adjustVariantInventory(variantId, existing.status, parsed.data.status, order.quantity, parsed.data.partialQuantity);
    } else if (productId) {
      await adjustInventory(productId, existing.status, parsed.data.status, order.quantity, parsed.data.partialQuantity);
    }
  }

  res.json(UpdateOrderResponse.parse(order));
});

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  if (existing.variantId) {
    await adjustVariantInventory(existing.variantId, existing.status, "deleted", existing.quantity, existing.partialQuantity);
  } else if (existing.productId) {
    await adjustInventory(existing.productId, existing.status, "deleted", existing.quantity, existing.partialQuantity);
  }

  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  res.status(204).end();
});

export default router;
