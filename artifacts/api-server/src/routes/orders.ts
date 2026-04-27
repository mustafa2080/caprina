import { Router, type IRouter } from "express";
import { eq, desc, like, or, gte, and, isNull, isNotNull, inArray, notInArray } from "drizzle-orm";
import { db, ordersTable, productsTable, productVariantsTable, shippingManifestOrdersTable, shippingManifestsTable } from "@workspace/db";
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
import { processDelivery, reverseDelivery, processReturn, processToShipping, reverseShipping } from "../lib/inventory.js";
import { logAudit, diffObjects } from "../lib/audit.js";
import { isAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();

const LOCKED_STATUSES = ["received", "partial_received"] as const;

// ─── Helper: generate invoice number ─────────────────────────────────────────
function generateInvoiceNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${yy}${mm}${dd}-${rand}`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/orders/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const all = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));

  // ── Group DB records by invoiceNumber into logical "orders" (invoices) ────
  const groupByInvoice = (records: typeof all) => {
    const seen = new Set<string>();
    const grouped: typeof all = [];
    const aggregated = new Map<string, { totalPrice: number; status: string; createdAt: Date }>();
    for (const o of records) {
      const key = o.invoiceNumber ?? `solo-${o.id}`;
      if (!aggregated.has(key)) {
        aggregated.set(key, { totalPrice: 0, status: o.status, createdAt: o.createdAt });
      }
      aggregated.get(key)!.totalPrice += o.totalPrice;
    }
    return Array.from(aggregated.values());
  };

  const allGroups = groupByInvoice(all);
  const filterGroups = (from: Date) =>
    allGroups.filter(g => new Date(g.createdAt) >= from);
  const revenue = (groups: ReturnType<typeof groupByInvoice>) =>
    groups.filter(g => g.status === "received" || g.status === "partial_received")
      .reduce((s, g) => s + g.totalPrice, 0);

  const productCount: Record<string, number> = {};
  all.forEach(o => { productCount[o.product] = (productCount[o.product] || 0) + o.quantity; });
  const bestProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0];

  res.json({
    today: { orders: filterGroups(startOfToday).length, revenue: revenue(filterGroups(startOfToday)) },
    week: { orders: filterGroups(startOfWeek).length, revenue: revenue(filterGroups(startOfWeek)) },
    month: { orders: filterGroups(startOfMonth).length, revenue: revenue(filterGroups(startOfMonth)) },
    bestProduct: bestProduct ? { name: bestProduct[0], quantity: bestProduct[1] } : null,
  });
});

// ─── List orders ──────────────────────────────────────────────────────────────

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).$dynamic();
  const conditions: any[] = [isNull(ordersTable.deletedAt)];

  if (params.data.status) conditions.push(eq(ordersTable.status, params.data.status as any));

  if (params.data.status === "in_shipping" && !(req.query as any).includeInManifest) {
    const openManifests = await db
      .select({ id: shippingManifestsTable.id })
      .from(shippingManifestsTable)
      .where(eq(shippingManifestsTable.status, "open"));
    const openManifestIds = openManifests.map(m => m.id);
    if (openManifestIds.length > 0) {
      const inManifest = await db
        .select({ orderId: shippingManifestOrdersTable.orderId })
        .from(shippingManifestOrdersTable)
        .where(inArray(shippingManifestOrdersTable.manifestId, openManifestIds));
      const inManifestIds = inManifest.map(r => r.orderId);
      if (inManifestIds.length > 0) {
        conditions.push(notInArray(ordersTable.id, inManifestIds));
      }
    }
  }
  if (params.data.search) {
    const s = `%${params.data.search}%`;
    conditions.push(or(like(ordersTable.customerName, s), like(ordersTable.product, s), like(ordersTable.phone, s)));
  }
  if ((req.query as any).dateFrom) {
    conditions.push(gte(ordersTable.createdAt, new Date((req.query as any).dateFrom as string)));
  }
  if ((req.query as any).shippingCompanyId) {
    const cid = parseInt((req.query as any).shippingCompanyId as string);
    if (!isNaN(cid)) conditions.push(eq(ordersTable.shippingCompanyId, cid));
  }

  if (conditions.length === 1) query = query.where(conditions[0]);
  else if (conditions.length > 1) query = query.where(and(...conditions));

  const rows = ListOrdersResponse.parse(await query);

  // ─── Group rows by invoiceNumber — return one merged row per invoice ──────
  const groupMap = new Map<string, typeof rows>();
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(o);
  }

  const grouped = Array.from(groupMap.values()).map(grp => {
    if (grp.length === 1) return grp[0];
    const rep = { ...grp[0] };
    rep.totalPrice = grp.reduce((s, o) => s + o.totalPrice, 0);
    rep.quantity   = grp.reduce((s, o) => s + o.quantity,   0);
    rep.product    = grp.map(o => `${o.product}×${o.quantity}`).join("، ");
    (rep as any)._groupIds   = grp.map(o => o.id);
    (rep as any)._groupCount = grp.length;
    return rep;
  });

  res.json(grouped);
});

// ─── Create order (single) ────────────────────────────────────────────────────

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const totalPrice = parsed.data.quantity * parsed.data.unitPrice;

  let costPrice = (parsed.data as any).costPrice ?? null;
  if (!costPrice && (parsed.data as any).variantId) {
    const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, (parsed.data as any).variantId));
    if (variant?.costPrice) costPrice = variant.costPrice;
  }
  if (!costPrice && (parsed.data as any).productId) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, (parsed.data as any).productId));
    if (product?.costPrice) costPrice = product.costPrice;
  }

  const invoiceNumber = (parsed.data as any).invoiceNumber || generateInvoiceNumber();
  const result = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending", costPrice, invoiceNumber, createdAt: new Date(), updatedAt: new Date() });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, insertId));

  await logAudit({
    action: "create",
    entityType: "order",
    entityId: order.id,
    entityName: `${order.customerName} — ${order.product}`,
    after: { customerName: order.customerName, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, status: order.status },
    userId: req.user?.id,
    userName: req.user?.displayName,
  });

  res.status(201).json(GetOrderResponse.parse(order));
});

// ─── Create batch orders (multiple items = one invoice) ───────────────────────

router.post("/orders/batch", async (req, res): Promise<void> => {
  const { items, ...sharedFields } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "يجب إرسال قائمة منتجات (items)" });
    return;
  }

  const invoiceNumber = generateInvoiceNumber();
  const shippingPerItem = sharedFields.shippingCost
    ? Number(sharedFields.shippingCost) / items.length
    : 0;

  const createdOrders = [];

  for (const item of items) {
    const parsed = CreateOrderBody.safeParse({
      ...sharedFields,
      product:   item.product,
      color:     item.color ?? null,
      size:      item.size ?? null,
      quantity:  item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice ?? null,
      shippingCost: shippingPerItem,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
    });

    if (!parsed.success) {
      res.status(400).json({ error: `منتج غير صالح: ${parsed.error.message}` });
      return;
    }

    const totalPrice = parsed.data.quantity * parsed.data.unitPrice;
    let costPrice = (parsed.data as any).costPrice ?? null;
    if (!costPrice && (parsed.data as any).variantId) {
      const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, (parsed.data as any).variantId));
      if (variant?.costPrice) costPrice = variant.costPrice;
    }
    if (!costPrice && (parsed.data as any).productId) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, (parsed.data as any).productId));
      if (product?.costPrice) costPrice = product.costPrice;
    }

    const result = await db.insert(ordersTable).values({
      ...parsed.data, totalPrice, status: "pending", costPrice, invoiceNumber,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, insertId));
    createdOrders.push(order);

    await logAudit({
      action: "create",
      entityType: "order",
      entityId: order.id,
      entityName: `${order.customerName} — ${order.product} [${invoiceNumber}]`,
      after: { customerName: order.customerName, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, status: order.status, invoiceNumber },
      userId: req.user?.id,
      userName: req.user?.displayName,
    });
  }

  res.status(201).json({ invoiceNumber, orders: createdOrders });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));

  // Group DB rows by invoiceNumber — each unique invoice = one logical order
  type InvoiceGroup = { status: string; totalPrice: number };
  const invoiceMap = new Map<string, InvoiceGroup>();
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, { status: o.status, totalPrice: 0 });
    }
    invoiceMap.get(key)!.totalPrice += o.totalPrice;
    // Use the worst/latest status if rows in same invoice differ
    invoiceMap.get(key)!.status = o.status;
  }
  const invoices = Array.from(invoiceMap.values());

  const summary = {
    totalOrders: invoices.length,
    pendingOrders: invoices.filter(o => o.status === "pending").length,
    shippingOrders: invoices.filter(o => o.status === "in_shipping").length,
    receivedOrders: invoices.filter(o => o.status === "received").length,
    delayedOrders: invoices.filter(o => o.status === "delayed").length,
    returnedOrders: invoices.filter(o => o.status === "returned").length,
    partialOrders: invoices.filter(o => o.status === "partial_received").length,
    totalRevenue: invoices
      .filter(o => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => s + o.totalPrice, 0),
  };
  res.json(GetOrdersSummaryResponse.parse(summary));
});

// ─── Recent orders ────────────────────────────────────────────────────────────

router.get("/orders/recent", async (_req, res): Promise<void> => {
  // Fetch more rows to ensure we get 8 unique invoices after grouping
  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.createdAt)).limit(80);

  // Deduplicate by invoiceNumber — keep the first (most recent) row per invoice
  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(o);
      if (unique.length === 8) break;
    }
  }

  res.json(GetRecentOrdersResponse.parse(unique));
});

// ─── Archived orders ──────────────────────────────────────────────────────────

router.get("/orders/archived", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).where(isNotNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.deletedAt));
  res.json(orders);
});

// ─── Orders that have a shipping manifest ─────────────────────────────────────

router.get("/orders/in-manifest-ids", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ orderId: shippingManifestOrdersTable.orderId })
    .from(shippingManifestOrdersTable);
  const ids = rows.map((r) => r.orderId);
  res.json({ ids });
});

// ─── Restore archived order ───────────────────────────────────────────────────

router.post("/orders/:id/restore", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }
  if (!existing.deletedAt) { res.status(400).json({ error: "Order is not archived" }); return; }

  await db.update(ordersTable).set({ deletedAt: null }).where(eq(ordersTable.id, id));
  const [restored] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));

  await logAudit({
    action: "restore",
    entityType: "order",
    entityId: id,
    entityName: `${existing.customerName} — ${existing.product}`,
    after: { status: existing.status, restoredAt: new Date().toISOString() },
    userId: req.user?.id,
    userName: req.user?.displayName,
  });

  res.json(restored);
});

// ─── Get orders by invoiceNumber ──────────────────────────────────────────────

router.get("/orders/by-invoice/:invoiceNumber", async (req, res): Promise<void> => {
  const { invoiceNumber } = req.params;
  if (!invoiceNumber) { res.status(400).json({ error: "invoiceNumber مطلوب" }); return; }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.invoiceNumber, invoiceNumber), isNull(ordersTable.deletedAt)))
    .orderBy(ordersTable.id);

  res.json(orders);
});

// ─── Get single order ─────────────────────────────────────────────────────────

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, params.data.id), isNull(ordersTable.deletedAt)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(GetOrderResponse.parse(order));
});

// ─── Update order ─────────────────────────────────────────────────────────────

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const isDamaged = req.body.isDamaged === true || req.body.isDamaged === "true";

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const isLockedStatus = LOCKED_STATUSES.includes(existing.status as any);

  if (isLockedStatus && !isAdmin(req)) {
    const onlyChangingStatus = Object.keys(parsed.data).every(k => ["status", "partialQuantity", "returnReason", "returnNote"].includes(k));
    if (!onlyChangingStatus) {
      res.status(403).json({ error: "هذا الطلب مُسلَّم ومقفل — فقط المدير يمكنه تعديل بياناته", locked: true });
      return;
    }
  }

  if (!isAdmin(req) && (parsed.data.unitPrice !== undefined || parsed.data.quantity !== undefined)) {
    const priceChanging = parsed.data.unitPrice !== undefined && parsed.data.unitPrice !== existing.unitPrice;
    const qtyChanging = parsed.data.quantity !== undefined && parsed.data.quantity !== existing.quantity;
    if (priceChanging || qtyChanging) {
      res.status(403).json({ error: "تعديل السعر أو الكمية يتطلب صلاحية المدير" });
      return;
    }
  }

  const quantity = parsed.data.quantity ?? existing.quantity;
  const unitPrice = parsed.data.unitPrice ?? existing.unitPrice;
  const totalPrice = quantity * unitPrice;

  await db.update(ordersTable).set({ ...parsed.data, totalPrice, updatedAt: new Date() }).where(eq(ordersTable.id, params.data.id));
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const oldStatus = existing.status;
  const newStatus = parsed.data.status;

  if (newStatus && newStatus !== oldStatus) {
    const orderRef = {
      variantId: order.variantId ?? existing.variantId,
      productId: order.productId ?? existing.productId,
      product: order.product ?? existing.product,
      color: order.color ?? existing.color,
      size: order.size ?? existing.size,
      warehouseId: existing.warehouseId ?? null,
    };

    if (newStatus === "in_shipping" && (oldStatus === "pending" || oldStatus === "delayed")) {
      // no deduction — happens at manifest creation
    } else if (newStatus === "received" && oldStatus === "in_shipping") {
      await processDelivery(orderRef, order.quantity, "sale", existing.id, true);
      await reverseShipping(orderRef, order.quantity, existing.id);
    } else if (newStatus === "received" && (oldStatus === "pending" || oldStatus === "delayed")) {
      await processDelivery(orderRef, order.quantity, "sale", existing.id);
    } else if (newStatus === "received" && oldStatus === "partial_received") {
      const alreadyDeducted = existing.partialQuantity ?? 0;
      const remainder = order.quantity - alreadyDeducted;
      if (remainder > 0) await processDelivery(orderRef, remainder, "sale", existing.id, true);
    } else if (newStatus === "partial_received" && oldStatus === "in_shipping") {
      const newPartial = parsed.data.partialQuantity ?? 0;
      await reverseShipping(orderRef, order.quantity, existing.id);
      if (newPartial > 0) await processDelivery(orderRef, newPartial, "partial_sale", existing.id);
    } else if (newStatus === "partial_received") {
      const newPartial = parsed.data.partialQuantity ?? 0;
      const oldPartial = (oldStatus === "partial_received" ? existing.partialQuantity : 0) ?? 0;
      const delta = newPartial - oldPartial;
      if (delta > 0) await processDelivery(orderRef, delta, "partial_sale", existing.id);
      else if (delta < 0) await reverseDelivery(orderRef, Math.abs(delta), existing.id);
    } else if (newStatus === "returned" && oldStatus === "in_shipping") {
      await reverseShipping(orderRef, order.quantity, existing.id);
    } else if (newStatus === "returned" && (oldStatus === "received" || oldStatus === "partial_received")) {
      const wasPartially = oldStatus === "partial_received";
      const returnQty = wasPartially ? (existing.partialQuantity ?? order.quantity) : order.quantity;
      await processReturn({ ...orderRef, quantity: returnQty }, true, isDamaged, existing.id);
    } else if (newStatus === "returned") {
      await processReturn({ ...orderRef, quantity: order.quantity }, false, isDamaged, existing.id);
    } else if (oldStatus === "in_shipping" && (newStatus === "pending" || newStatus === "delayed")) {
      const [manifestLink] = await db.select().from(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.orderId, existing.id)).limit(1);
      if (manifestLink) await reverseShipping(orderRef, order.quantity, existing.id);
    } else if (oldStatus === "received") {
      await reverseDelivery(orderRef, order.quantity, existing.id);
    } else if (oldStatus === "partial_received") {
      const deducted = existing.partialQuantity ?? 0;
      if (deducted > 0) await reverseDelivery(orderRef, deducted, existing.id);
    }
  }

  const diff = diffObjects(
    { status: existing.status, unitPrice: existing.unitPrice, quantity: existing.quantity, partialQuantity: existing.partialQuantity, notes: existing.notes, returnReason: existing.returnReason },
    { status: order.status, unitPrice: order.unitPrice, quantity: order.quantity, partialQuantity: order.partialQuantity, notes: order.notes, returnReason: order.returnReason },
  );

  const auditAction = newStatus && newStatus !== oldStatus ? "status_change" : "update";
  await logAudit({
    action: auditAction,
    entityType: "order",
    entityId: order.id,
    entityName: `${order.customerName} — ${order.product}`,
    before: diff.before,
    after: diff.after,
    userId: req.user?.id,
    userName: req.user?.displayName,
  });

  res.json(UpdateOrderResponse.parse(order));
});

// ─── Bulk Delete orders ───────────────────────────────────────────────────────

router.delete("/orders/bulk", async (req, res): Promise<void> => {
  const ids: number[] = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "يجب إرسال قائمة ids" });
    return;
  }

  const orders = await db.select().from(ordersTable).where(inArray(ordersTable.id, ids));
  const deleted: number[] = [];
  const skipped: number[] = [];

  for (const existing of orders) {
    if (LOCKED_STATUSES.includes(existing.status as any) && !isAdmin(req)) {
      skipped.push(existing.id);
      continue;
    }

    if (existing.status === "received") {
      await reverseDelivery(
        { variantId: existing.variantId, productId: existing.productId, product: existing.product, color: existing.color, size: existing.size },
        existing.quantity, existing.id,
      );
    } else if (existing.status === "partial_received") {
      const deducted = existing.partialQuantity ?? 0;
      if (deducted > 0) await reverseDelivery(
        { variantId: existing.variantId, productId: existing.productId, product: existing.product, color: existing.color, size: existing.size },
        deducted, existing.id,
      );
    }

    await logAudit({
      action: "delete",
      entityType: "order",
      entityId: existing.id,
      entityName: `${existing.customerName} — ${existing.product}`,
      before: { status: existing.status, totalPrice: existing.totalPrice, quantity: existing.quantity },
      userId: req.user?.id,
      userName: req.user?.displayName,
    });

    deleted.push(existing.id);
  }

  if (deleted.length > 0) {
    await db.update(ordersTable).set({ deletedAt: new Date() }).where(inArray(ordersTable.id, deleted));
  }

  res.json({ deleted: deleted.length, skipped: skipped.length, skippedIds: skipped });
});

// ─── Delete order ─────────────────────────────────────────────────────────────

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  if (LOCKED_STATUSES.includes(existing.status as any) && !isAdmin(req)) {
    res.status(403).json({ error: "هذا الطلب مُسلَّم ومقفل — فقط المدير يمكنه حذفه", locked: true });
    return;
  }

  if (existing.status === "received") {
    await reverseDelivery(
      { variantId: existing.variantId, productId: existing.productId, product: existing.product, color: existing.color, size: existing.size },
      existing.quantity, existing.id,
    );
  } else if (existing.status === "partial_received") {
    const deducted = existing.partialQuantity ?? 0;
    if (deducted > 0) await reverseDelivery(
      { variantId: existing.variantId, productId: existing.productId, product: existing.product, color: existing.color, size: existing.size },
      deducted, existing.id,
    );
  }

  await logAudit({
    action: "delete",
    entityType: "order",
    entityId: id,
    entityName: `${existing.customerName} — ${existing.product}`,
    before: { status: existing.status, totalPrice: existing.totalPrice, quantity: existing.quantity },
    userId: req.user?.id,
    userName: req.user?.displayName,
  });

  await db.update(ordersTable).set({ deletedAt: new Date() }).where(eq(ordersTable.id, id));
  res.status(204).end();
});

export default router;
