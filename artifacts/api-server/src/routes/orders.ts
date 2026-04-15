import { Router, type IRouter } from "express";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
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

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).$dynamic();

  if (params.data.status) {
    query = query.where(eq(ordersTable.status, params.data.status));
  }

  if (params.data.search) {
    const searchTerm = `%${params.data.search}%`;
    query = query.where(
      or(
        ilike(ordersTable.customerName, searchTerm),
        ilike(ordersTable.product, searchTerm)
      )
    );
  }

  const orders = await query;
  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const totalPrice = parsed.data.quantity * parsed.data.unitPrice;

  const [order] = await db
    .insert(ordersTable)
    .values({
      ...parsed.data,
      totalPrice,
    })
    .returning();

  res.status(201).json(GetOrderResponse.parse(order));
});

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable);

  const summary = {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    processingOrders: orders.filter((o) => o.status === "processing").length,
    shippedOrders: orders.filter((o) => o.status === "shipped").length,
    deliveredOrders: orders.filter((o) => o.status === "delivered").length,
    cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
    totalRevenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalPrice, 0),
  };

  res.json(GetOrdersSummaryResponse.parse(summary));
});

router.get("/orders/recent", async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

  res.json(GetRecentOrdersResponse.parse(orders));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  if (parsed.data.quantity != null || parsed.data.unitPrice != null) {
    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.id));

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const quantity = parsed.data.quantity ?? existing.quantity;
    const unitPrice = parsed.data.unitPrice ?? existing.unitPrice;
    updateData.totalPrice = quantity * unitPrice;
  }

  const [order] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(UpdateOrderResponse.parse(order));
});

export default router;
