import { Router, type IRouter } from "express";
import { eq, desc, ilike, or } from "drizzle-orm";
import { db, ordersTable, productsTable } from "@workspace/db";
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

async function adjustInventory(
  productId: number,
  oldStatus: string,
  newStatus: string,
  orderQty: number,
  partialQty?: number | null
) {
  if (!productId) return;
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

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).$dynamic();
  if (params.data.status) query = query.where(eq(ordersTable.status, params.data.status as any));
  if (params.data.search) {
    const s = `%${params.data.search}%`;
    query = query.where(or(ilike(ordersTable.customerName, s), ilike(ordersTable.product, s)));
  }

  const orders = await query;
  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const totalPrice = parsed.data.quantity * parsed.data.unitPrice;
  const [order] = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending" }).returning();

  if (parsed.data.productId) {
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

  const productId = order.productId ?? existing.productId;
  if (productId && parsed.data.status && parsed.data.status !== existing.status) {
    await adjustInventory(productId, existing.status, parsed.data.status, order.quantity, parsed.data.partialQuantity);
  }

  res.json(UpdateOrderResponse.parse(order));
});

export default router;
