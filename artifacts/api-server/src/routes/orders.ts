import { Router, type IRouter } from "express";
import { eq, desc, like, or, gte, lte, and, isNull, isNotNull, inArray, notInArray } from "drizzle-orm";
import { db, ordersTable, productsTable, productVariantsTable, shippingManifestOrdersTable, shippingManifestsTable, shippingCompaniesTable, inventoryMovementsTable } from "@workspace/db";
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
import { processDelivery, reverseDelivery, processReturn, processToShipping, reverseShipping, updateMovementReason, resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses, recordMovement } from "../lib/inventory.js";
import { logAudit, diffObjects } from "../lib/audit.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { isAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();
router.use(requireAuth);

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

  const groupByInvoice = (records: typeof all) => {
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
  const filterGroups = (from: Date) => allGroups.filter(g => new Date(g.createdAt) >= from);
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
  const isDashboard = (req.query as any).source === "dashboard";

  if (params.data.status) {
    if (isDashboard) {
      conditions.push(eq(ordersTable.status, params.data.status as any));
    } else {
      const statusRows = await db
        .select({ invoiceNumber: ordersTable.invoiceNumber, id: ordersTable.id })
        .from(ordersTable)
        .where(and(isNull(ordersTable.deletedAt), eq(ordersTable.status, params.data.status as any)));
      const invNums = new Set<string>();
      const soloIds = new Set<number>();
      for (const r of statusRows) {
        if (r.invoiceNumber) invNums.add(r.invoiceNumber);
        else soloIds.add(r.id);
      }
      const statusFilterInvoiceNumbers = Array.from(invNums);
      if (statusFilterInvoiceNumbers.length > 0 && soloIds.size > 0) {
        conditions.push(or(
          inArray(ordersTable.invoiceNumber, statusFilterInvoiceNumbers),
          and(isNull(ordersTable.invoiceNumber), inArray(ordersTable.id, Array.from(soloIds)))
        ));
      } else if (statusFilterInvoiceNumbers.length > 0) {
        conditions.push(or(
          inArray(ordersTable.invoiceNumber, statusFilterInvoiceNumbers),
          and(isNull(ordersTable.invoiceNumber), eq(ordersTable.status, params.data.status as any))
        ));
      } else if (soloIds.size > 0) {
        conditions.push(and(isNull(ordersTable.invoiceNumber), inArray(ordersTable.id, Array.from(soloIds))));
      } else {
        res.json([]);
        return;
      }
    }
  }

  let manifestOrderIdsSet = new Set<number>();
  const skipManifestFilter = (req.query as any).includeInManifest === "true" || (req.query as any).source === "dashboard";
  if (params.data.status === "in_shipping" && !skipManifestFilter) {
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
      manifestOrderIdsSet = new Set(inManifest.map(r => r.orderId));
    }
  }

  if (params.data.search) {
    const s = `%${params.data.search}%`;
    conditions.push(or(like(ordersTable.customerName, s), like(ordersTable.product, s), like(ordersTable.phone, s)));
  }
  if ((req.query as any).dateFrom) {
    conditions.push(gte(ordersTable.createdAt, new Date((req.query as any).dateFrom as string)));
  }
  if ((req.query as any).dateTo) {
    const dateTo = new Date((req.query as any).dateTo as string);
    dateTo.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, dateTo));
  }
  if ((req.query as any).shippingCompanyId) {
    const cid = parseInt((req.query as any).shippingCompanyId as string);
    if (!isNaN(cid)) conditions.push(eq(ordersTable.shippingCompanyId, cid));
  }

  if (conditions.length === 1) query = query.where(conditions[0]);
  else if (conditions.length > 1) query = query.where(and(...conditions));

  const rows = await query;

  const returnedNullIds = rows.filter(o => o.status === "returned" && (o as any).returnReceived == null).map(o => o.id);
  const manifestReturnMap = new Map<number, number | null>();
  if (returnedNullIds.length > 0) {
    try {
      const manifestLinks = await db
        .select({ orderId: shippingManifestOrdersTable.orderId, returnReceived: shippingManifestOrdersTable.returnReceived })
        .from(shippingManifestOrdersTable)
        .where(inArray(shippingManifestOrdersTable.orderId, returnedNullIds));
      for (const link of manifestLinks) {
        const existing = manifestReturnMap.get(link.orderId);
        if (existing === undefined || (link.returnReceived !== null && existing === null)) {
          manifestReturnMap.set(link.orderId, link.returnReceived ?? null);
        }
      }
    } catch (_) { /* تجاهل */ }
  }

  const partialIds = rows.filter(o => o.status === "partial_received").map(o => o.id);
  const manifestPartialMap = new Map<number, number | null>();
  if (partialIds.length > 0) {
    try {
      const manifestLinks = await db
        .select({ orderId: shippingManifestOrdersTable.orderId, partialQuantity: shippingManifestOrdersTable.partialQuantity })
        .from(shippingManifestOrdersTable)
        .where(inArray(shippingManifestOrdersTable.orderId, partialIds))
        .orderBy(desc(shippingManifestOrdersTable.id));
      for (const link of manifestLinks) {
        if (!manifestPartialMap.has(link.orderId) && link.partialQuantity != null) {
          manifestPartialMap.set(link.orderId, link.partialQuantity);
        }
      }
    } catch (_) { /* تجاهل */ }
  }

  const groupMap = new Map<string, typeof rows>();
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(o);
  }

  const filteredGroups = Array.from(groupMap.values()).filter(grp => {
    if (manifestOrderIdsSet.size === 0) return true;
    const allInManifest = grp.every(o => manifestOrderIdsSet.has(o.id));
    return !allInManifest;
  });

  const getReturnReceived = (o: (typeof rows)[0]): number | null => {
    const fromOrder = (o as any).returnReceived;
    if (fromOrder !== null && fromOrder !== undefined) return fromOrder;
    return manifestReturnMap.get(o.id) ?? null;
  };

  const getPartialQuantity = (o: (typeof rows)[0]): number | null => {
    const fromManifest = manifestPartialMap.get(o.id);
    if (fromManifest != null) return fromManifest;
    return o.partialQuantity ?? null;
  };

  const calcReceivedPrice = (o: (typeof rows)[0], pq: number | null): number => {
    if (o.status === "partial_received" && pq != null) {
      const unit = (o as any).unitPrice ?? (o.quantity > 0 ? Math.round(o.totalPrice / o.quantity) : o.totalPrice);
      return Math.round(unit * pq);
    }
    return o.totalPrice;
  };

  const grouped = filteredGroups.map(grp => {
    if (grp.length === 1) {
      const rep = { ...grp[0] } as any;
      rep._invoiceOrders = [grp[0]];
      if (rep.status === "returned") rep.returnReceived = getReturnReceived(grp[0]);
      if (rep.status === "partial_received") {
        const pq = getPartialQuantity(grp[0]);
        rep.partialQuantity = pq;
        rep._receivedPrice = calcReceivedPrice(grp[0], pq);
        rep._fullPrice = grp[0].totalPrice;
      }
      return rep;
    }
    const rep = { ...grp[0] } as any;
    rep.totalPrice     = grp.reduce((s, o) => s + o.totalPrice, 0);
    rep.quantity       = grp.reduce((s, o) => s + o.quantity,   0);
    rep.product        = grp.map(o => `${o.product}×${o.quantity}`).join("، ");
    rep._groupIds      = grp.map(o => o.id);
    rep._groupCount    = grp.length;
    rep._groupStatuses = grp.map(o => o.status);
    rep._invoiceOrders = grp;
    const allReturned = grp.every(o => o.status === "returned");
    if (allReturned) {
      let rr: number | null = null;
      for (const o of grp) { const val = getReturnReceived(o); if (val !== null) { rr = val; break; } }
      rep.returnReceived = rr;
    }
    const allPartial = grp.every(o => o.status === "partial_received");
    if (allPartial) {
      rep.partialQuantity = grp.reduce((s, o) => s + (getPartialQuantity(o) ?? 0), 0);
      rep._receivedPrice  = grp.reduce((s, o) => s + calcReceivedPrice(o, getPartialQuantity(o)), 0);
      rep._fullPrice      = rep.totalPrice;
    }
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
  const result = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending", costPrice, invoiceNumber, createdByUserId: req.user?.id ?? null, createdByName: req.user?.displayName ?? null, createdAt: new Date(), updatedAt: new Date() });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, insertId));

  await logAudit({
    action: "create", entityType: "order", entityId: order.id,
    entityName: `${order.customerName} — ${order.product}`,
    after: { customerName: order.customerName, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, status: order.status },
    userId: req.user?.id, userName: req.user?.displayName,
  });

  res.status(201).json(GetOrderResponse.parse(order));
});

// ─── Create batch orders ──────────────────────────────────────────────────────

router.post("/orders/batch", async (req, res): Promise<void> => {
  const { items, ...sharedFields } = req.body;
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "يجب إرسال قائمة منتجات (items)" }); return; }

  const invoiceNumber = generateInvoiceNumber();
  const shippingPerItem = sharedFields.shippingCost ? Number(sharedFields.shippingCost) / items.length : 0;
  const createdOrders = [];

  for (const item of items) {
    const parsed = CreateOrderBody.safeParse({ ...sharedFields, product: item.product, color: item.color ?? null, size: item.size ?? null, quantity: item.quantity, unitPrice: item.unitPrice, costPrice: item.costPrice ?? null, shippingCost: shippingPerItem, productId: item.productId ?? null, variantId: item.variantId ?? null });
    if (!parsed.success) { res.status(400).json({ error: `منتج غير صالح: ${parsed.error.message}` }); return; }
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
    const result = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending", costPrice, invoiceNumber, createdByUserId: req.user?.id ?? null, createdByName: req.user?.displayName ?? null, createdAt: new Date(), updatedAt: new Date() });
    const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, insertId));
    createdOrders.push(order);
    await logAudit({ action: "create", entityType: "order", entityId: order.id, entityName: `${order.customerName} — ${order.product} [${invoiceNumber}]`, after: { customerName: order.customerName, product: order.product, quantity: order.quantity, unitPrice: order.unitPrice, status: order.status, invoiceNumber }, userId: req.user?.id, userName: req.user?.displayName });
  }
  res.status(201).json({ invoiceNumber, orders: createdOrders });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));
  type InvoiceGroup = { status: string; totalPrice: number };
  const invoiceMap = new Map<string, InvoiceGroup>();
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceMap.has(key)) invoiceMap.set(key, { status: o.status, totalPrice: 0 });
    invoiceMap.get(key)!.totalPrice += o.totalPrice;
    invoiceMap.get(key)!.status = o.status;
  }
  const invoices = Array.from(invoiceMap.values());
  const summary = {
    totalOrders: invoices.length,
    pendingOrders: invoices.filter(o => o.status === "pending").length,
    warehouseReadyOrders: invoices.filter(o => o.status === "warehouse_ready").length,
    shippingOrders: invoices.filter(o => o.status === "in_shipping").length,
    receivedOrders: invoices.filter(o => o.status === "received").length,
    delayedOrders: invoices.filter(o => o.status === "delayed").length,
    returnedOrders: invoices.filter(o => o.status === "returned").length,
    partialOrders: invoices.filter(o => o.status === "partial_received").length,
    totalRevenue: invoices.filter(o => o.status === "received" || o.status === "partial_received").reduce((s, o) => s + o.totalPrice, 0),
  };
  res.json(GetOrdersSummaryResponse.parse(summary));
});

// ─── Recent orders ────────────────────────────────────────────────────────────

router.get("/orders/recent", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.createdAt)).limit(80);
  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const o of rows) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!seen.has(key)) { seen.add(key); unique.push(o); if (unique.length === 8) break; }
  }
  res.json(GetRecentOrdersResponse.parse(unique));
});

// ─── Archived orders ──────────────────────────────────────────────────────────

router.get("/orders/archived", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).where(isNotNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.deletedAt));
  res.json(orders);
});

// ─── Purge archived orders permanently (admin only) ──────────────────────────
router.delete("/orders/archived/purge", async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids مطلوبة" });
    return;
  }
  const numericIds = ids.map(Number).filter(n => !isNaN(n));
  // حذف نهائي — بس للطلبات المؤرشفة (deletedAt IS NOT NULL)
  await db.delete(ordersTable).where(
    and(inArray(ordersTable.id, numericIds), isNotNull(ordersTable.deletedAt))
  );
  res.json({ success: true, deleted: numericIds.length });
});

// ─── Orders in manifest ───────────────────────────────────────────────────────

router.get("/orders/in-manifest-ids", async (_req, res): Promise<void> => {
  const openManifests = await db.select({ id: shippingManifestsTable.id }).from(shippingManifestsTable).where(eq(shippingManifestsTable.status, "open"));
  if (openManifests.length === 0) { res.json({ ids: [] }); return; }
  const openIds = openManifests.map(m => m.id);
  const rows = await db.select({ orderId: shippingManifestOrdersTable.orderId }).from(shippingManifestOrdersTable).where(inArray(shippingManifestOrdersTable.manifestId, openIds));
  res.json({ ids: rows.map(r => r.orderId) });
});

// ─── Bulk delete orders (must be BEFORE /:id routes) ─────────────────────────

router.delete("/orders/bulk", async (req, res): Promise<void> => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "يجب إرسال قائمة IDs" });
    return;
  }
  const userRole = (req as any).user?.role;
  const numericIds = ids.map(Number).filter(n => !isNaN(n));
  const orders = await db.select().from(ordersTable)
    .where(and(inArray(ordersTable.id, numericIds), isNull(ordersTable.deletedAt)));
  let deleted = 0;
  let skipped = 0;
  for (const order of orders) {
    if (LOCKED_STATUSES.includes(order.status as any) && userRole !== "admin") {
      skipped++;
      continue;
    }
    await db.update(ordersTable).set({ deletedAt: new Date() }).where(eq(ordersTable.id, order.id));
    await logAudit({
      action: "delete", entityType: "order", entityId: order.id,
      entityName: `${order.customerName} — ${order.product}`,
      before: { customerName: order.customerName, product: order.product, status: order.status },
      userId: (req as any).user?.id, userName: (req as any).user?.displayName,
    });
    deleted++;
  }
  res.json({ deleted, skipped });
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
  await logAudit({ action: "restore", entityType: "order", entityId: id, entityName: `${existing.customerName} — ${existing.product}`, after: { status: existing.status, restoredAt: new Date().toISOString() }, userId: req.user?.id, userName: req.user?.displayName });
  res.json(restored);
});

// ─── Invoice manifest status ──────────────────────────────────────────────────

router.get("/orders/invoice-manifest-status/:invoiceNumber", async (req, res): Promise<void> => {
  const { invoiceNumber } = req.params;
  if (!invoiceNumber) { res.status(400).json({ error: "invoiceNumber مطلوب" }); return; }

  const invoiceOrders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.invoiceNumber, invoiceNumber), isNull(ordersTable.deletedAt)))
    .orderBy(ordersTable.id);

  if (invoiceOrders.length === 0) { res.json([]); return; }

  const orderIds = invoiceOrders.map(o => o.id);
  const links = await db.select({ mo: shippingManifestOrdersTable, m: shippingManifestsTable })
    .from(shippingManifestOrdersTable)
    .innerJoin(shippingManifestsTable, eq(shippingManifestOrdersTable.manifestId, shippingManifestsTable.id))
    .where(inArray(shippingManifestOrdersTable.orderId, orderIds))
    .orderBy(desc(shippingManifestOrdersTable.id));

  const latestByOrder = new Map<number, typeof links[0]>();
  for (const link of links) {
    if (!latestByOrder.has(link.mo.orderId)) latestByOrder.set(link.mo.orderId, link);
  }

  const result = invoiceOrders.map(order => {
    const link = latestByOrder.get(order.id);
    const rr = link?.mo.returnReceived;
    return {
      orderId: order.id, product: order.product, quantity: order.quantity, status: order.status,
      manifestId: link?.m.id ?? null, manifestNumber: link?.m.manifestNumber ?? null,
      manifestStatus: link?.m.status ?? null, deliveryStatus: link?.mo.deliveryStatus ?? null,
      deliveryNote: link?.mo.deliveryNote ?? null, manifestPartialQuantity: link?.mo.partialQuantity ?? null,
      deliveredAt: link?.mo.deliveredAt ?? null, returnReceived: rr == null ? null : Number(rr),
    };
  });

  res.json(result);
});

// ─── Orders by invoice ────────────────────────────────────────────────────────

router.get("/orders/by-invoice/:invoiceNumber", async (req, res): Promise<void> => {
  const { invoiceNumber } = req.params;
  if (!invoiceNumber) { res.status(400).json({ error: "invoiceNumber مطلوب" }); return; }
  const orders = await db.select().from(ordersTable).where(and(eq(ordersTable.invoiceNumber, invoiceNumber), isNull(ordersTable.deletedAt))).orderBy(ordersTable.id);
  res.json(orders);
});

// ─── Get order manifest status ────────────────────────────────────────────────

router.get("/orders/:id/manifest-status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const links = await db.select({ mo: shippingManifestOrdersTable, m: shippingManifestsTable })
    .from(shippingManifestOrdersTable)
    .innerJoin(shippingManifestsTable, eq(shippingManifestOrdersTable.manifestId, shippingManifestsTable.id))
    .where(eq(shippingManifestOrdersTable.orderId, id))
    .orderBy(desc(shippingManifestOrdersTable.id));
  if (links.length === 0) { res.json(null); return; }
  const link = links[0];
  // اقرأ returnReceived من جدول orders مباشرة (مصدر الحقيقة)
  const [orderRow] = await db.select({ returnReceived: ordersTable.returnReceived }).from(ordersTable).where(eq(ordersTable.id, id));
  const rr = (orderRow?.returnReceived != null) ? Number(orderRow.returnReceived) : (link.mo.returnReceived == null ? null : Number(link.mo.returnReceived));
  res.json({
    manifestId: link.m.id, manifestNumber: link.m.manifestNumber, manifestStatus: link.m.status,
    deliveryStatus: link.mo.deliveryStatus, deliveryNote: link.mo.deliveryNote,
    partialQuantity: link.mo.partialQuantity ?? null, deliveredAt: link.mo.deliveredAt,
    returnReceived: rr,
  });
});

// ─── Get single order ─────────────────────────────────────────────────────────

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, params.data.id), isNull(ordersTable.deletedAt)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(GetOrderResponse.parse(order));
});

// ─── Update order (PATCH) ─────────────────────────────────────────────────────

router.patch("/orders/:id", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, params.data.id), isNull(ordersTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const userRole = (req as any).user?.role;
  if (LOCKED_STATUSES.includes(existing.status as any) && userRole !== "admin") {
    res.status(403).json({ error: "هذا الطلب مقفل ولا يمكن تعديله" });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data = parsed.data as Record<string, any>;
  const newQty        = data.quantity  ?? existing.quantity;
  const newUnitPrice  = data.unitPrice ?? existing.unitPrice;
  const newTotalPrice = newQty * newUnitPrice;

  const oldStatus = existing.status;
  const newStatus = data.status ?? oldStatus;

  // لو الطلب في بيان شحن → حركات المخزون مسؤولية البيان فقط، لا نعملها هنا
  const [manifestLink] = await db
    .select({ id: shippingManifestOrdersTable.id })
    .from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.orderId, existing.id))
    .limit(1)
    .catch(() => []);
  const isInManifest = !!manifestLink;

  if (newStatus !== oldStatus && !isInManifest) {
    const orderRef = { variantId: existing.variantId, productId: existing.productId, product: existing.product, color: existing.color, size: existing.size, warehouseId: existing.warehouseId };

    // ── منطق حركات المخزون ──────────────────────────────────────────────────
    // القاعدة الجديدة:
    //   warehouse_ready = الطلب جاهز في المخزن، لكن لم يخصم بعد (يُخصم عند إضافته لبيان)
    //   in_shipping = الطلب في شركة الشحن (خُصم من المخزن عند إنشاء البيان)

    // ── لو الحالة الجديدة warehouse_ready: لا يحدث خصم في المخزون ──────────
    // نتجاهل أي تغيير مخزون هنا — الخصم يحدث لما يتضاف للبيان

    // هل في حركة موجودة للأوردر ده في جدول المخزون؟
    const [existingMovement] = await db
      .select({ id: inventoryMovementsTable.id, reason: inventoryMovementsTable.reason })
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.orderId, existing.id))
      .orderBy(desc(inventoryMovementsTable.id))
      .limit(1)
      .catch(() => []);

    // ── warehouse_ready → لا حركة مخزون ──────────────────────────────────
    if (newStatus === "warehouse_ready") {
      // لا يوجد خصم من المخزون هنا — الخصم يحدث لما يدخل البيان
    }

    if (newStatus === "in_shipping" && oldStatus !== "in_shipping") {
      if (existingMovement) {
        // لو الحركة الموجودة adjustment (المنتج كان في المخزون) → لازم نخصم المخزون دلوقتي
        if (existingMovement.reason === "adjustment") {
          const { variantId, productId } = await resolveInventoryTarget(orderRef);
          await adjustWarehouseStock(existing.warehouseId, variantId, productId, -existing.quantity).catch(() => {});
          await syncProductQuantityFromWarehouses(variantId, productId).catch(() => {});
        }
        await updateMovementReason(existing.id, existingMovement.reason as any, "to_shipping" as any, "تحويل لشركة الشحن").catch(() => {});
      } else {
        // مفيش حركة → اخصم من المخزون وسجّل to_shipping
        await processToShipping(orderRef, existing.quantity, existing.id).catch(() => {});
      }
    }

    if (newStatus === "received") {
      if (existingMovement) {
        // في حركة موجودة → غيّر reason لـ sale فقط (لا خصم جديد)
        await updateMovementReason(existing.id, existingMovement.reason as any, "sale", "تم الاستلام — بيع").catch(() => {});
      } else {
        // مفيش حركة → اخصم كبيع مباشرة
        await processDelivery(orderRef, existing.quantity, "sale", existing.id).catch(() => {});
      }
    }

    if (newStatus === "partial_received") {
      if (existingMovement) {
        // في حركة موجودة → غيّر reason لـ partial_sale فقط (لا خصم جديد)
        await updateMovementReason(existing.id, existingMovement.reason as any, "partial_sale", "استلام جزئي").catch(() => {});
      } else {
        // مفيش حركة → اخصم كبيع جزئي
        await processDelivery(orderRef, existing.quantity, "partial_sale", existing.id).catch(() => {});
      }
    }

    if (newStatus === "returned") {
      const returnReceived = data.returnReceived === true || data.returnReceived === 1;
      const { variantId, productId } = await resolveInventoryTarget(orderRef);

      if (existingMovement) {
        const wasDeducted = ["sale", "partial_sale", "to_shipping"].includes(existingMovement.reason ?? "");
        if (returnReceived) {
          // تم الاستلام → أرجع المخزون بالموجب (IN) لو كانت متخصومة
          if (wasDeducted) {
            await adjustWarehouseStock(existing.warehouseId, variantId, productId, existing.quantity).catch(() => {});
            await syncProductQuantityFromWarehouses(variantId, productId).catch(() => {});
          }
          await updateMovementReason(existing.id, existingMovement.reason as any, "return", "مرتجع — تم الاستلام ودخل المخزن").catch(() => {});
        } else {
          // مازال عند الشحن → لا ترجع المخزون، سجل OUT
          await updateMovementReason(existing.id, existingMovement.reason as any, "return", "مرتجع — مازال عند شركة الشحن").catch(() => {});
        }
      } else {
        const wasReceived = oldStatus === "received" || oldStatus === "partial_received";
        if (returnReceived) {
          // تم الاستلام → IN موجب
          await processReturn({ ...orderRef, quantity: existing.quantity }, wasReceived, false, existing.id).catch(() => {});
        } else {
          // مازال عند الشحن → OUT سالب (لا يدخل المخزن)
          if (variantId || productId) {
            await recordMovement({
              product: existing.product ?? "منتج",
              color: existing.color,
              size: existing.size,
              quantity: existing.quantity,
              type: "OUT",
              reason: "return" as any,
              productId: productId ?? null,
              variantId: variantId ?? null,
              warehouseId: existing.warehouseId ?? null,
              orderId: existing.id,
              notes: "مرتجع — مازال عند شركة الشحن",
            }).catch(() => {});
          }
        }
      }
    }

    if (oldStatus === "in_shipping" && newStatus !== "in_shipping" && newStatus !== "received" && newStatus !== "partial_received" && newStatus !== "returned") {
      // إلغاء الشحن (رجع لـ pending مثلاً) → أرجع المخزون وعدّل الحركة
      if (existingMovement) {
        const { variantId, productId } = await resolveInventoryTarget(orderRef);
        await adjustWarehouseStock(existing.warehouseId, variantId, productId, existing.quantity).catch(() => {});
        await syncProductQuantityFromWarehouses(variantId, productId).catch(() => {});
        await updateMovementReason(existing.id, existingMovement.reason as any, "adjustment" as any, "إلغاء شحن — إرجاع للمخزون").catch(() => {});
      } else {
        await reverseShipping(orderRef, existing.quantity, existing.id).catch(() => {});
      }
    }

    if (oldStatus === "received" && newStatus !== "received") {
      if (existingMovement) {
        // في حركة موجودة → أرجع المخزون وعدّل reason
        const { variantId, productId } = await resolveInventoryTarget(orderRef);
        await adjustWarehouseStock(existing.warehouseId, variantId, productId, existing.quantity).catch(() => {});
        await syncProductQuantityFromWarehouses(variantId, productId).catch(() => {});
        await updateMovementReason(existing.id, existingMovement.reason as any, "adjustment" as any, "إلغاء استلام").catch(() => {});
      } else {
        await reverseDelivery(orderRef, existing.quantity, existing.id).catch(() => {});
      }
    }
  }

  const before = { customerName: existing.customerName, product: existing.product, status: existing.status, quantity: existing.quantity, unitPrice: existing.unitPrice };

  await db.update(ordersTable)
    .set({ ...data, totalPrice: newTotalPrice, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id));

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!updated) { res.status(500).json({ error: "Update failed" }); return; }

  const after = { customerName: updated.customerName, product: updated.product, status: updated.status, quantity: updated.quantity, unitPrice: updated.unitPrice };
  await logAudit({ action: "update", entityType: "order", entityId: updated.id, entityName: `${updated.customerName} — ${updated.product}`, before, after: diffObjects(before, after), userId: (req as any).user?.id, userName: (req as any).user?.displayName });

  res.json(UpdateOrderResponse.parse(updated));
});

// ─── Delete single order (soft delete) ───────────────────────────────────────

router.delete("/orders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), isNull(ordersTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const userRole = (req as any).user?.role;
  if (LOCKED_STATUSES.includes(existing.status as any) && userRole !== "admin") {
    res.status(403).json({ error: "هذا الطلب مقفل ولا يمكن حذفه" });
    return;
  }

  await db.update(ordersTable).set({ deletedAt: new Date() }).where(eq(ordersTable.id, id));

  await logAudit({
    action: "delete", entityType: "order", entityId: id,
    entityName: `${existing.customerName} — ${existing.product}`,
    before: { customerName: existing.customerName, product: existing.product, status: existing.status },
    userId: (req as any).user?.id, userName: (req as any).user?.displayName,
  });

  res.status(204).send();
});

export default router;
