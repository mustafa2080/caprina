import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, or, sql, count, isNull } from "drizzle-orm";
import {
  db,
  shippingManifestsTable,
  shippingManifestOrdersTable,
  shippingCompaniesTable,
  ordersTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";
import {
  processDelivery,
  reverseDelivery,
  processReturn,
  processToShipping,
  reverseShipping,
} from "../lib/inventory";

const router: IRouter = Router();
router.use(requireAuth);

const CreateManifestSchema = z.object({
  shippingCompanyId: z.number().int().positive(),
  orderIds: z.array(z.number().int().positive()).min(1),
  notes: z.string().nullish(),
});

async function expandOrderIdsByInvoice(orderIds: number[]) {
  const seedOrders = await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds));
  if (seedOrders.length === 0) return [];
  const invoiceNumbers = Array.from(new Set(
    seedOrders.map((o) => o.invoiceNumber?.trim()).filter((n): n is string => Boolean(n))
  ));
  const soloIds = seedOrders.filter((o) => !o.invoiceNumber?.trim()).map((o) => o.id);
  const expandedOrders = invoiceNumbers.length > 0
    ? await db.select().from(ordersTable).where(and(isNull(ordersTable.deletedAt), inArray(ordersTable.invoiceNumber, invoiceNumbers)))
    : [];
  const allIds = new Set<number>([...soloIds, ...expandedOrders.map((o) => o.id)]);
  return Array.from(allIds);
}

async function generateManifestNumber(companyId: number): Promise<string> {
  const [row] = await db.select({ cnt: count() }).from(shippingManifestsTable)
    .where(eq(shippingManifestsTable.shippingCompanyId, companyId));
  const seq = (Number(row?.cnt ?? 0) + 1).toString().padStart(3, "0");
  return `MNF-${companyId}-${seq}`;
}

type OrderWithDelivery = typeof ordersTable.$inferSelect & {
  deliveryStatus: string;
  deliveryNote: string | null;
  deliveredAt: Date | null;
  manifestOrderId: number;
};

function computeStats(orders: OrderWithDelivery[]) {
  const groupMap = new Map<string, OrderWithDelivery[]>();
  for (const order of orders) {
    const key = order.invoiceNumber?.trim() || `solo-${order.id}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(order);
  }
  const groupedOrders = Array.from(groupMap.values());
  const total = groupedOrders.length;
  const delivered = groupedOrders.filter((g) => g.every((o) => o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received")).length;
  const returned = groupedOrders.filter((g) => g.every((o) => o.deliveryStatus === "returned")).length;
  const pending = groupedOrders.filter((g) =>
    g.some((o) => ["pending", "postponed"].includes(o.deliveryStatus)) ||
    (!g.every((o) => o.deliveryStatus === "returned") && !g.every((o) => o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received"))
  ).length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  let totalRevenue = 0, totalCost = 0, totalShippingCost = 0, returnLosses = 0, deliveredGross = 0;
  let stillAtShippingCount = 0, stillAtShippingAmount = 0;
  for (const o of orders) {
    const isPartial = o.deliveryStatus === "partial_received";
    const partialQty = isPartial && o.partialQuantity != null ? o.partialQuantity : null;
    const qty = partialQty !== null ? partialQty : o.quantity;
    const cost = (o.costPrice ?? 0) * qty;
    const shipping = o.shippingCost ?? 0;
    const rv = (o as any).returnReceived;
    if (o.deliveryStatus === "delivered" || isPartial) {
      const revenue = partialQty !== null ? o.unitPrice * partialQty : o.totalPrice;
      totalRevenue += revenue; totalCost += cost; totalShippingCost += shipping; deliveredGross += revenue;
      if (isPartial && rv !== 1) { stillAtShippingCount++; const remainQty = o.quantity - (partialQty ?? 0); stillAtShippingAmount += o.unitPrice * remainQty; }
    } else if (o.deliveryStatus === "returned") {
      returnLosses += shipping; totalShippingCost += shipping;
      if (rv !== 1) { stillAtShippingCount++; stillAtShippingAmount += o.totalPrice; }
    } else { totalShippingCost += shipping; }
  }
  const actuallyDeliveredShipping = orders
    .filter(o => o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received")
    .reduce((sum, o) => sum + (o.shippingCost ?? 0), 0);
  const dueFromCompany = deliveredGross - actuallyDeliveredShipping;
  return {
    total, delivered, returned, pending, deliveryRate,
    totalRevenue, totalCost, totalShippingCost, returnLosses,
    netProfit: totalRevenue - totalCost - totalShippingCost - returnLosses,
    deliveredGross, dueFromCompany, stillAtShippingCount, stillAtShippingAmount, actuallyDeliveredShipping,
  };
}

// ─── List manifests ───────────────────────────────────────────────────────────

router.get("/shipping-manifests", async (req, res): Promise<void> => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
  const manifests = await db.select({ manifest: shippingManifestsTable, company: shippingCompaniesTable })
    .from(shippingManifestsTable)
    .leftJoin(shippingCompaniesTable, eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id))
    .where(companyId ? eq(shippingManifestsTable.shippingCompanyId, companyId) : undefined)
    .orderBy(desc(shippingManifestsTable.createdAt));
  const manifestIds = manifests.map((m) => m.manifest.id);
  if (manifestIds.length === 0) { res.json([]); return; }
  const allLinks = await db.select({ manifestId: shippingManifestOrdersTable.manifestId })
    .from(shippingManifestOrdersTable).where(inArray(shippingManifestOrdersTable.manifestId, manifestIds));
  const countMap: Record<number, number> = {};
  for (const link of allLinks) countMap[link.manifestId] = (countMap[link.manifestId] ?? 0) + 1;
  res.json(manifests.map((m) => ({
    ...m.manifest, invoicePrice: m.manifest.invoicePrice ? Number(m.manifest.invoicePrice) : null,
    companyName: m.company?.name ?? "غير محدد", orderCount: countMap[m.manifest.id] ?? 0,
  })));
});

// ─── Create manifest ──────────────────────────────────────────────────────────

router.post("/shipping-manifests", async (req, res): Promise<void> => {
  const parsed = CreateManifestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { shippingCompanyId, orderIds, notes } = parsed.data;
  const normalizedOrderIds = await expandOrderIdsByInvoice(orderIds);
  const company = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, shippingCompanyId)).then((r) => r[0]);
  if (!company) { res.status(404).json({ error: "شركة الشحن غير موجودة" }); return; }
  const manifestNumber = await generateManifestNumber(shippingCompanyId);
  const insertResult = await db.insert(shippingManifestsTable).values({ manifestNumber, shippingCompanyId, notes: notes ?? null, status: "open", createdAt: new Date() });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, insertId));
  await db.insert(shippingManifestOrdersTable).values(normalizedOrderIds.map((orderId) => ({ manifestId: manifest.id, orderId, deliveryStatus: "pending", addedAt: new Date() })));
  const ordersToShip = await db.select().from(ordersTable).where(inArray(ordersTable.id, normalizedOrderIds));
  for (const order of ordersToShip) {
    await processToShipping({ variantId: order.variantId, productId: order.productId, product: order.product, color: order.color, size: order.size, warehouseId: order.warehouseId }, order.quantity, order.id);
  }
  await db.update(ordersTable).set({ status: "in_shipping", shippingCompanyId }).where(inArray(ordersTable.id, normalizedOrderIds));
  res.status(201).json({ ...manifest, invoicePrice: null, companyName: company.name, orderCount: normalizedOrderIds.length });
});

// ─── Get manifest ─────────────────────────────────────────────────────────────

router.get("/shipping-manifests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.select({ manifest: shippingManifestsTable, company: shippingCompaniesTable })
    .from(shippingManifestsTable)
    .leftJoin(shippingCompaniesTable, eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id))
    .where(eq(shippingManifestsTable.id, id));
  if (!row) { res.status(404).json({ error: "البيان غير موجود" }); return; }
  const links = await db.select().from(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.manifestId, id));
  const orderIds = links.map((l) => l.orderId);
  const expandedOrderIds = await expandOrderIdsByInvoice(orderIds);
  let orders: OrderWithDelivery[] = [];
  if (expandedOrderIds.length > 0) {
    const rawOrders = await db.select().from(ordersTable).where(inArray(ordersTable.id, expandedOrderIds)).orderBy(desc(ordersTable.createdAt));
    const linkedRawOrders = rawOrders.filter((o) => orderIds.includes(o.id));
    const invoiceLinkMap = new Map<string, (typeof links)[0]>();
    linkedRawOrders.forEach((o) => {
      if (o.invoiceNumber?.trim()) { const link = links.find((l) => l.orderId === o.id); if (link) invoiceLinkMap.set(o.invoiceNumber.trim(), link); }
    });
    const linkMap = new Map(links.map((l) => [l.orderId, l]));
    orders = rawOrders.map((o) => {
      const directLink = linkMap.get(o.id);
      const invoiceLink = o.invoiceNumber?.trim() ? invoiceLinkMap.get(o.invoiceNumber.trim()) : undefined;
      const link = directLink ?? invoiceLink;
      if (!link) return { ...o, deliveryStatus: "pending", deliveryNote: null, deliveredAt: null, manifestOrderId: 0 };
      const _rr = (directLink ?? invoiceLink)?.returnReceived;
      const _rrNum = _rr == null ? null : Number(_rr);
      return { ...o, deliveryStatus: link.deliveryStatus, deliveryNote: link.deliveryNote, deliveredAt: link.deliveredAt, partialQuantity: (link as any).partialQuantity ?? o.partialQuantity, manifestOrderId: link.id, returnReceived: _rrNum };
    });
  }
  res.json({ ...row.manifest, invoicePrice: row.manifest.invoicePrice ? Number(row.manifest.invoicePrice) : null, manualShippingCost: row.manifest.manualShippingCost ? Number(row.manifest.manualShippingCost) : null, companyName: row.company?.name ?? "غير محدد", companyPhone: row.company?.phone ?? null, orders, stats: computeStats(orders) });
});

// ─── Update manifest (PATCH) ──────────────────────────────────────────────────

router.patch("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const Schema = z.object({ status: z.enum(["open", "closed"]).optional(), notes: z.string().nullish(), invoicePrice: z.number().nonnegative().nullish(), invoiceNotes: z.string().nullish(), manualShippingCost: z.number().nonnegative().nullish() });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;
  if (parsed.data.invoicePrice !== undefined) updateData.invoicePrice = parsed.data.invoicePrice != null ? String(parsed.data.invoicePrice) : null;
  if (parsed.data.invoiceNotes !== undefined) updateData.invoiceNotes = parsed.data.invoiceNotes ?? null;
  if (parsed.data.manualShippingCost !== undefined) updateData.manualShippingCost = parsed.data.manualShippingCost != null ? String(parsed.data.manualShippingCost) : null;
  if (parsed.data.status === "closed") updateData.closedAt = new Date();
  if (parsed.data.status === "open") updateData.closedAt = null;
  if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "لا توجد بيانات للتحديث" }); return; }
  await db.update(shippingManifestsTable).set(updateData).where(eq(shippingManifestsTable.id, id));
  const [updated] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!updated) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  let rolledOverManifest: any = null;

  if (parsed.data.status === "closed") {
    // الطلبات اللي "مازال في شركة الشحن" = pending/postponed/in_shipping + returned/partial بدون returnReceived
    const pendingLinks = await db.select().from(shippingManifestOrdersTable).where(
      and(
        eq(shippingManifestOrdersTable.manifestId, id),
        or(
          inArray(shippingManifestOrdersTable.deliveryStatus, ["postponed", "pending", "in_shipping"]),
          and(eq(shippingManifestOrdersTable.deliveryStatus, "returned"), sql`${shippingManifestOrdersTable.returnReceived} = 0`),
          and(eq(shippingManifestOrdersTable.deliveryStatus, "partial_received"), sql`${shippingManifestOrdersTable.returnReceived} = 0`)
        )
      )
    );

    if (pendingLinks.length > 0) {
      // ── أرجع المخزون للطلبات اللي لسه عند شركة الشحن (pending/postponed) ──────
      const stillAtShippingLinks = pendingLinks.filter(
        (l) => l.deliveryStatus === "pending" || l.deliveryStatus === "postponed" || l.deliveryStatus === "in_shipping"
      );
      for (const link of stillAtShippingLinks) {
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, link.orderId));
        if (!order) continue;
        const oRef = {
          variantId: order.variantId, productId: order.productId,
          product: order.product, color: order.color, size: order.size,
          warehouseId: order.warehouseId,
        };
        // الكمية كانت خرجت بـ to_shipping → نرجعها للمخزن بـ from_shipping
        await reverseShipping(oRef, order.quantity, order.id);
      }

      // ── رحّل كل الطلبات لبيان جديد ───────────────────────────────────────────
      const newManifestNumber = await generateManifestNumber(updated.shippingCompanyId);
      const insertResult = await db.insert(shippingManifestsTable).values({
        manifestNumber: newManifestNumber, shippingCompanyId: updated.shippingCompanyId,
        notes: `مُرحَّل من البيان ${updated.manifestNumber}`, status: "open", createdAt: new Date(),
      });
      const newId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
      const [newManifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, newId));
      await db.insert(shippingManifestOrdersTable).values(
        pendingLinks.map((link) => ({
          manifestId: newManifest.id, orderId: link.orderId,
          deliveryStatus: link.deliveryStatus as any,
          deliveryNote: link.deliveryNote ?? null, deliveredAt: null,
          partialQuantity: link.deliveryStatus === "partial_received" ? link.partialQuantity : null,
          returnReceived: (link.deliveryStatus === "returned" || link.deliveryStatus === "partial_received")
            ? (link.returnReceived == null ? null : Number(link.returnReceived)) : null,
          addedAt: new Date(),
        }))
      );

      // ── أرجع الطلبات اللي كانت pending/postponed لـ pending (خرجت من الشحن) ─
      if (stillAtShippingLinks.length > 0) {
        const stillIds = stillAtShippingLinks.map((l) => l.orderId);
        await db.update(ordersTable)
          .set({ status: "pending", shippingCompanyId: null })
          .where(inArray(ordersTable.id, stillIds));
      }

      // ── الطلبات المرتجعة/الجزئية تفضل in_shipping في البيان الجديد ───────────
      const nonReturnedIds = pendingLinks
        .filter((l) => l.deliveryStatus !== "returned" && l.deliveryStatus !== "partial_received"
                    && l.deliveryStatus !== "pending" && l.deliveryStatus !== "postponed"
                    && l.deliveryStatus !== "in_shipping")
        .map((l) => l.orderId);
      if (nonReturnedIds.length > 0) {
        await db.update(ordersTable)
          .set({ status: "in_shipping", shippingCompanyId: updated.shippingCompanyId })
          .where(inArray(ordersTable.id, nonReturnedIds));
      }

      rolledOverManifest = {
        ...newManifest, orderCount: pendingLinks.length,
        postponedCount: pendingLinks.filter((l) => l.deliveryStatus === "postponed").length,
        pendingCount: pendingLinks.filter((l) => l.deliveryStatus === "pending" || l.deliveryStatus === "in_shipping").length,
        returnedInShippingCount: pendingLinks.filter((l) => l.deliveryStatus === "returned").length,
      };
    }
  }

  res.json({ ...updated, invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null, rolledOverManifest });
});

// ─── Delete manifest ──────────────────────────────────────────────────────────

router.delete("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!manifest) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  // جيب كل الطلبات في البيان
  const links = await db.select().from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.manifestId, id));

  // ارجع حالة كل طلب لـ pending وامسح shippingCompanyId
  if (links.length > 0) {
    const orderIds = links.map((l) => l.orderId);
    await db.update(ordersTable)
      .set({ status: "pending", shippingCompanyId: null })
      .where(inArray(ordersTable.id, orderIds));
  }

  // احذف ربط الطلبات بالبيان
  await db.delete(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.manifestId, id));

  // احذف البيان نفسه
  await db.delete(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));

  res.status(204).send();
});

// ─── Remove order from manifest ───────────────────────────────────────────────

router.delete("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id);
  const orderId = parseInt(req.params.orderId);
  if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [link] = await db.select().from(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));
  if (!link) { res.status(404).json({ error: "الطلب غير موجود في هذا البيان" }); return; }

  // احذف ربط الطلب بالبيان
  await db.delete(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));

  // ارجع حالة الطلب لـ pending
  await db.update(ordersTable)
    .set({ status: "pending", shippingCompanyId: null })
    .where(eq(ordersTable.id, orderId));

  res.json({ success: true, orderId, message: "تم إزالة الطلب من البيان" });
});

// ─── Add orders to manifest ───────────────────────────────────────────────────

router.post("/shipping-manifests/:id/orders", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id);
  if (isNaN(manifestId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, manifestId));
  if (!manifest) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  const { orderIds } = req.body as { orderIds: number[] };
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    res.status(400).json({ error: "يجب إرسال قائمة orderIds" }); return;
  }

  const normalizedOrderIds = await expandOrderIdsByInvoice(orderIds);
  const existing = await db.select({ orderId: shippingManifestOrdersTable.orderId })
    .from(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.manifestId, manifestId));
  const existingIds = new Set(existing.map((e) => e.orderId));
  const newIds = normalizedOrderIds.filter((id) => !existingIds.has(id));

  if (newIds.length > 0) {
    await db.insert(shippingManifestOrdersTable).values(
      newIds.map((orderId) => ({ manifestId, orderId, deliveryStatus: "pending", addedAt: new Date() }))
    );
    await db.update(ordersTable)
      .set({ status: "in_shipping", shippingCompanyId: manifest.shippingCompanyId })
      .where(inArray(ordersTable.id, newIds));
  }

  res.json({ added: newIds.length, manifestNumber: manifest.manifestNumber });
});

// ─── Update order delivery status in manifest ─────────────────────────────────

const DeliveryStatusSchema = z.object({
  deliveryStatus: z.enum(["pending", "delivered", "postponed", "partial_received", "returned"]),
  deliveryNote: z.string().nullish(),
  partialQuantity: z.number().int().min(0).nullish(),
  partialReturnReceived: z.boolean().nullish(),
  returnReceived: z.boolean().nullish(),
});
const STATUS_MAP: Record<string, string> = {
  delivered: "received", postponed: "delayed", partial_received: "partial_received",
  returned: "returned", pending: "in_shipping",
};

router.patch("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id), orderId = parseInt(req.params.orderId);
  if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = DeliveryStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { deliveryStatus, deliveryNote, partialQuantity, returnReceived, partialReturnReceived } = parsed.data;

  const [link] = await db.select().from(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));
  if (!link) { res.status(404).json({ error: "الطلب غير موجود في هذا البيان" }); return; }

  const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!existingOrder) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  // ─── الحالات القديمة ───────────────────────────────────────────────────────
  const oldDeliveryStatus = link.deliveryStatus; // الحالة القديمة في البيان
  const oldOrderStatus    = existingOrder.status; // الحالة القديمة في الطلب
  const oldReturnReceived = link.returnReceived;  // هل تم استلام المرتجع قبل كده؟

  const newStatus  = STATUS_MAP[deliveryStatus] ?? "in_shipping";
  const isDelivered = deliveryStatus === "delivered" || deliveryStatus === "partial_received";

  // ─── تحديث جدول البيان ────────────────────────────────────────────────────
  await db.update(shippingManifestOrdersTable).set({
    deliveryStatus,
    deliveryNote: deliveryNote ?? null,
    partialQuantity: deliveryStatus === "partial_received" && partialQuantity != null ? partialQuantity : null,
    deliveredAt: isDelivered ? new Date() : null,
    ...(deliveryStatus === "partial_received" && partialReturnReceived != null ? { returnReceived: partialReturnReceived ? 1 : 0 } : {}),
    ...(deliveryStatus === "returned" && returnReceived != null
      ? { returnReceived: returnReceived ? 1 : 0 }
      : deliveryStatus !== "returned" && deliveryStatus !== "partial_received"
        ? { returnReceived: null }
        : {}),
  }).where(eq(shippingManifestOrdersTable.id, link.id));

  // ─── تحديث جدول الطلبات ───────────────────────────────────────────────────
  const orderUpdate: Record<string, unknown> = { status: newStatus };
  if (deliveryStatus === "partial_received" && partialQuantity != null) orderUpdate.partialQuantity = partialQuantity;
  if (deliveryStatus === "partial_received" && partialReturnReceived != null) orderUpdate.returnReceived = partialReturnReceived ? 1 : 0;
  if (deliveryStatus === "returned" && returnReceived != null) orderUpdate.returnReceived = returnReceived ? 1 : 0;
  else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") orderUpdate.returnReceived = null;
  await db.update(ordersTable).set(orderUpdate).where(eq(ordersTable.id, orderId));

  // ─── منطق المخزون ─────────────────────────────────────────────────────────
  // نشتغل على الحالة القديمة في البيان (oldDeliveryStatus) مش على status الطلب
  // لأن status الطلب ممكن يكون نفسه لو الحالة اتغيرت جزئياً
  const orderRef = {
    variantId:   existingOrder.variantId,
    productId:   existingOrder.productId,
    product:     existingOrder.product,
    color:       existingOrder.color,
    size:        existingOrder.size,
    warehouseId: existingOrder.warehouseId,
  };
  const totalQty   = existingOrder.quantity;
  const oldPartial = existingOrder.partialQuantity ?? 0;

  // ── CASE 1: تم الاستلام الكامل ─────────────────────────────────────────────
  if (deliveryStatus === "delivered") {
    if (oldDeliveryStatus === "partial_received") {
      // الجزء المتبقي كان عند شركة الشحن → سجل بيع للجزء الباقي
      // skipWarehouseStock=false لأن الكمية لسه عند شركة الشحن (خرجت من المخزن بـ to_shipping)
      const remaining = totalQty - oldPartial;
      if (remaining > 0) await processDelivery(orderRef, remaining, "sale", orderId, false);
    } else if (oldDeliveryStatus !== "delivered") {
      // كان عند شركة الشحن → سجل بيع للكمية كلها
      // الكمية خرجت من المخزن بـ to_shipping → مش محتاجين نخصم تاني (skipWarehouseStock=true)
      await processDelivery(orderRef, totalQty, "sale", orderId, true);
    }

  // ── CASE 2: استلام جزئي ────────────────────────────────────────────────────
  } else if (deliveryStatus === "partial_received") {
    const prevPartial = oldDeliveryStatus === "partial_received" ? oldPartial : 0;
    const delta = (partialQuantity ?? 0) - prevPartial;
    // skipWarehouseStock=true لأن الكمية الكلية خرجت مسبقاً بـ to_shipping
    if (delta > 0) await processDelivery(orderRef, delta, "partial_sale", orderId, true);
    else if (delta < 0) await reverseDelivery(orderRef, Math.abs(delta), orderId);

  // ── CASE 3: مرتجع ─────────────────────────────────────────────────────────
  } else if (deliveryStatus === "returned") {
    const alreadyReturnedToStock = Number(oldReturnReceived) === 1;
    if (!alreadyReturnedToStock) {
      // لو returnReceived = true → المستخدم بيقول "المرتجع وصل المخزن" → ارجع الكمية
      if (returnReceived === true) {
        if (oldDeliveryStatus === "partial_received") {
          // أرجع الجزء اللي استُلم للمخزون
          if (oldPartial > 0) await processReturn({ ...orderRef, quantity: oldPartial }, true, false, orderId);
          // أرجع الجزء اللي كان عند شركة الشحن للمخزون
          const remaining = totalQty - oldPartial;
          if (remaining > 0) await reverseShipping(orderRef, remaining, orderId);
        } else if (oldDeliveryStatus === "delivered" || oldDeliveryStatus === "returned") {
          // كان استلمه وبيرجعه → أرجع للمخزون
          await processReturn({ ...orderRef, quantity: totalQty }, true, false, orderId);
        } else {
          // كان عند شركة الشحن ولسه ما استُلمش → أرجع الكمية كلها للمخزون من الشحن
          await reverseShipping(orderRef, totalQty, orderId);
        }
      }
      // لو returnReceived = false أو null → المرتجع لسه عند شركة الشحن → لا تغيير في المخزون
    }

  // ── CASE 4: تغيير لحالة أخرى (pending/postponed) ─────────────────────────
  } else {
    if (oldDeliveryStatus === "delivered") {
      await reverseDelivery(orderRef, totalQty, orderId);
    } else if (oldDeliveryStatus === "partial_received") {
      if (oldPartial > 0) await reverseDelivery(orderRef, oldPartial, orderId);
    }
  }
  if (existingOrder.invoiceNumber?.trim()) {
    const siblings = await db.select({ mo: shippingManifestOrdersTable, o: ordersTable })
      .from(shippingManifestOrdersTable).innerJoin(ordersTable, eq(shippingManifestOrdersTable.orderId, ordersTable.id))
      .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(ordersTable.invoiceNumber, existingOrder.invoiceNumber.trim())));
    for (const sib of siblings) {
      if (sib.mo.orderId === orderId) continue;
      const su: Record<string, unknown> = { deliveryStatus, deliveryNote: deliveryNote ?? null, deliveredAt: isDelivered ? new Date() : null };
      if (deliveryStatus === "returned" && returnReceived != null) su.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus === "partial_received" && partialReturnReceived != null) su.returnReceived = partialReturnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") su.returnReceived = null;
      await db.update(shippingManifestOrdersTable).set(su).where(eq(shippingManifestOrdersTable.id, sib.mo.id));
      const sou: Record<string, unknown> = { status: STATUS_MAP[deliveryStatus] ?? "in_shipping" };
      if (deliveryStatus === "returned" && returnReceived != null) sou.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus === "partial_received" && partialReturnReceived != null) sou.returnReceived = partialReturnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") sou.returnReceived = null;
      await db.update(ordersTable).set(sou).where(eq(ordersTable.id, sib.mo.orderId));
    }
  }
  res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null, returnReceived: returnReceived ?? null });
});

export default router;
