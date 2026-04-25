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

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/orders/stats", async (req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const all = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));
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
  const conditions: any[] = [isNull(ordersTable.deletedAt)];

  if (params.data.status) conditions.push(eq(ordersTable.status, params.data.status as any));

  // لو بيجيب in_shipping — اشيل بس اللي في بيان مفتوح حالياً
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

  res.json(ListOrdersResponse.parse(await query));
});

// ─── Create order ─────────────────────────────────────────────────────────────

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

  const result = await db.insert(ordersTable).values({ ...parsed.data, totalPrice, status: "pending", costPrice, createdAt: new Date(), updatedAt: new Date() });
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

// ─── Summary ──────────────────────────────────────────────────────────────────

router.get("/orders/summary", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));
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
  const orders = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.createdAt)).limit(8);
  res.json(GetRecentOrdersResponse.parse(orders));
});

// ─── Archived orders ──────────────────────────────────────────────────────────

router.get("/orders/archived", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).where(isNotNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.deletedAt));
  res.json(orders);
});

// ─── Orders that have a shipping manifest ─────────────────────────────────────
// Returns a Set of order IDs that are already in a manifest (in_shipping + in manifest)
// Used by frontend to show "still in warehouse" badge

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

  // ── Lock check: only admin can edit delivered orders ─────────────────────
  const isLockedStatus = LOCKED_STATUSES.includes(existing.status as any);
  const isStatusTransitionToDelivered = parsed.data.status && LOCKED_STATUSES.includes(parsed.data.status as any);

  // Non-admins can only CHANGE STATUS (not edit price/qty) of delivered orders
  if (isLockedStatus && !isAdmin(req)) {
    // Allow status transitions away from delivered (e.g., → returned)
    const onlyChangingStatus = Object.keys(parsed.data).every(k => ["status", "partialQuantity", "returnReason", "returnNote"].includes(k));
    if (!onlyChangingStatus) {
      res.status(403).json({
        error: "هذا الطلب مُسلَّم ومقفل — فقط المدير يمكنه تعديل بياناته",
        locked: true,
      });
      return;
    }
  }

  // Non-admins cannot edit price or quantity
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

  await db
    .update(ordersTable)
    .set({ ...parsed.data, totalPrice, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id));
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

    // ══════════════════════════════════════════════════════════════════════
    // منطق المخزن:
    //   pending       = الطلب في المخزن (لم يُخصم بعد)
    //   in_shipping   = قيد الشحن — لا يخصم من المخزون حتى يتعمل بيان شحن
    //   received      = سُلِّم للعميل (الخصم اتعمل عند إنشاء البيان)
    //   returned      = مرتجع للمخزن
    // ══════════════════════════════════════════════════════════════════════

    // ── pending → in_shipping: لا يخصم من المخزن هنا ──────────────────────
    // الخصم بيحصل فقط لما يتعمل بيان شحن في manifests.ts
    if (newStatus === "in_shipping" && oldStatus === "pending") {
      // لا يوجد خصم — الطلب لسه في المخزن حتى يتعمل البيان
    }

    // ── delayed → in_shipping: نفس المنطق ────────────────────────────────
    else if (newStatus === "in_shipping" && oldStatus === "delayed") {
      // لا يوجد خصم — الخصم يحصل عند إنشاء البيان فقط
    }

    // ── in_shipping → received: البضاعة وصلت للعميل ──────────────────────
    // الكمية اتخصمت من المخزن قبل كده بـ processToShipping
    // هنا بنسجل البيع بس في حركة المخزن (OUT/sale) بدون خصم إضافي
    else if (newStatus === "received" && oldStatus === "in_shipping") {
      // البضاعة اتخصمت من المخزن بـ processToShipping — skipWarehouseStock = true
      await processDelivery(orderRef, order.quantity, "sale", existing.id, true);
      await reverseShipping(orderRef, order.quantity, existing.id);
    }

    // ── pending/delayed → received مباشرة (بدون مرحلة شحن) ──────────────
    else if (newStatus === "received" && (oldStatus === "pending" || oldStatus === "delayed")) {
      // المخزن لم يتأثر بعد — خصم عادي
      await processDelivery(orderRef, order.quantity, "sale", existing.id);
    }

    // ── partial_received → received: تسليم باقي الكمية ───────────────────
    else if (newStatus === "received" && oldStatus === "partial_received") {
      const alreadyDeducted = existing.partialQuantity ?? 0;
      const remainder = order.quantity - alreadyDeducted;
      if (remainder > 0) await processDelivery(orderRef, remainder, "sale", existing.id, true);
    }

    // ── in_shipping → partial_received ────────────────────────────────────
    else if (newStatus === "partial_received" && oldStatus === "in_shipping") {
      const newPartial = parsed.data.partialQuantity ?? 0;
      await reverseShipping(orderRef, order.quantity, existing.id);
      if (newPartial > 0) await processDelivery(orderRef, newPartial, "partial_sale", existing.id);
    }

    // ── any → partial_received (من pending/delayed) ───────────────────────
    else if (newStatus === "partial_received") {
      const newPartial = parsed.data.partialQuantity ?? 0;
      const oldPartial = (oldStatus === "partial_received" ? existing.partialQuantity : 0) ?? 0;
      const delta = newPartial - oldPartial;
      if (delta > 0) await processDelivery(orderRef, delta, "partial_sale", existing.id);
      else if (delta < 0) await reverseDelivery(orderRef, Math.abs(delta), existing.id);
    }

    // ── in_shipping → returned: مرتجع من شركة الشحن ─────────────────────
    else if (newStatus === "returned" && oldStatus === "in_shipping") {
      // كانت عند الشحن (خُصمت بـ to_shipping) — نرجعها للمخزن
      await reverseShipping(orderRef, order.quantity, existing.id);
    }

    // ── received/partial_received → returned ──────────────────────────────
    else if (newStatus === "returned" && (oldStatus === "received" || oldStatus === "partial_received")) {
      const wasPartially = oldStatus === "partial_received";
      const returnQty = wasPartially
        ? (existing.partialQuantity ?? order.quantity)
        : order.quantity;
      await processReturn(
        { ...orderRef, quantity: returnQty },
        true, // كانت مستلَمة فعلاً
        isDamaged,
        existing.id,
      );
    }

    // ── pending/delayed → returned ────────────────────────────────────────
    else if (newStatus === "returned") {
      // لم تخصم من المخزن أصلاً — مجرد تسجيل
      await processReturn(
        { ...orderRef, quantity: order.quantity },
        false, // لم تُسلَّم
        isDamaged,
        existing.id,
      );
    }

    // ── in_shipping → pending/delayed (إلغاء الشحن) ───────────────────────
    // لو عنده بيان → ارجع الخصم. لو مفيش بيان → مفيش خصم حصل أصلاً
    else if (oldStatus === "in_shipping" && (newStatus === "pending" || newStatus === "delayed")) {
      const [manifestLink] = await db
        .select()
        .from(shippingManifestOrdersTable)
        .where(eq(shippingManifestOrdersTable.orderId, existing.id))
        .limit(1);
      if (manifestLink) {
        await reverseShipping(orderRef, order.quantity, existing.id);
      }
    }

    // ── received → other (تراجع عن التسليم) ──────────────────────────────
    else if (oldStatus === "received") {
      await reverseDelivery(orderRef, order.quantity, existing.id);
    }

    // ── partial_received → other (تراجع عن التسليم الجزئي) ───────────────
    else if (oldStatus === "partial_received") {
      const deducted = existing.partialQuantity ?? 0;
      if (deducted > 0) await reverseDelivery(orderRef, deducted, existing.id);
    }
  }

  // Audit log
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
    // Lock: only admin can delete delivered orders
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

  // Lock: only admin can delete delivered orders
  if (LOCKED_STATUSES.includes(existing.status as any) && !isAdmin(req)) {
    res.status(403).json({
      error: "هذا الطلب مُسلَّم ومقفل — فقط المدير يمكنه حذفه",
      locked: true,
    });
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

  // Soft delete — mark as deleted without removing from DB
  await db.update(ordersTable).set({ deletedAt: new Date() }).where(eq(ordersTable.id, id));
  res.status(204).end();
});

export default router;
