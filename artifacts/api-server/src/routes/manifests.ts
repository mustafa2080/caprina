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
  for (const o of orders) {
    const qty = o.deliveryStatus === "partial_received" && o.partialQuantity ? o.partialQuantity : o.quantity;
    const cost = (o.costPrice ?? 0) * qty;
    const shipping = o.shippingCost ?? 0;
    if (o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received") {
      const revenue = o.deliveryStatus === "partial_received" && o.partialQuantity ? o.unitPrice * o.partialQuantity : o.totalPrice;
      totalRevenue += revenue; totalCost += cost; totalShippingCost += shipping; deliveredGross += revenue;
    } else if (o.deliveryStatus === "returned") {
      returnLosses += shipping; totalShippingCost += shipping;
    } else { totalShippingCost += shipping; }
  }
  return { total, delivered, returned, pending, deliveryRate, totalRevenue, totalCost, totalShippingCost, returnLosses, netProfit: totalRevenue - totalCost - totalShippingCost - returnLosses, deliveredGross };
}

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
      const link = linkMap.get(o.id) ?? (o.invoiceNumber?.trim() ? invoiceLinkMap.get(o.invoiceNumber.trim()) : undefined);
      if (!link) return { ...o, deliveryStatus: "pending", deliveryNote: null, deliveredAt: null, manifestOrderId: 0 };
      const _rr = link.returnReceived; const _rrNum = _rr == null ? null : Number(_rr);
      return { ...o, deliveryStatus: link.deliveryStatus, deliveryNote: link.deliveryNote, deliveredAt: link.deliveredAt, partialQuantity: (link as any).partialQuantity ?? o.partialQuantity, manifestOrderId: link.id, returnReceived: _rrNum };
    });
  }
  res.json({ ...row.manifest, invoicePrice: row.manifest.invoicePrice ? Number(row.manifest.invoicePrice) : null, manualShippingCost: row.manifest.manualShippingCost ? Number(row.manifest.manualShippingCost) : null, companyName: row.company?.name ?? "غير محدد", companyPhone: row.company?.phone ?? null, orders, stats: computeStats(orders) });
});

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

  let rolledOverManifest: (typeof shippingManifestsTable.$inferSelect & {
    orderCount: number;
    postponedCount: number;
    pendingCount: number;
    returnedInShippingCount: number;
  }) | null = null;

  if (parsed.data.status === "closed") {
    const pendingLinks = await db.select().from(shippingManifestOrdersTable).where(
      and(
        eq(shippingManifestOrdersTable.manifestId, id),
        or(
          inArray(shippingManifestOrdersTable.deliveryStatus, ["postponed", "pending", "in_shipping"]),
          and(eq(shippingManifestOrdersTable.deliveryStatus, "returned"), sql`${shippingManifestOrdersTable.returnReceived} = 0`)
        )
      )
    );

    if (pendingLinks.length > 0) {
      const newManifestNumber = await generateManifestNumber(updated.shippingCompanyId);
      const insertResult = await db.insert(shippingManifestsTable).values({
        manifestNumber: newManifestNumber, shippingCompanyId: updated.shippingCompanyId,
        notes: `مُرحَّل من البيان ${updated.manifestNumber}`, status: "open", createdAt: new Date(),
      });
      const newId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
      const [newManifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, newId));

      // ── أضف كل طلبية بنفس حالتها الأصلية (postponed تبقى postponed، returned تبقى returned) ──
      await db.insert(shippingManifestOrdersTable).values(
        pendingLinks.map((link) => ({
          manifestId: newManifest.id,
          orderId: link.orderId,
          deliveryStatus: link.deliveryStatus as any,
          deliveryNote: link.deliveryNote ?? null,
          deliveredAt: null,
          returnReceived: link.deliveryStatus === "returned" ? (link.returnReceived == null ? null : Number(link.returnReceived)) : null,
          addedAt: new Date(),
        }))
      );

      // ── حدّث orders.status: غير المرتجعات → in_shipping، المرتجعات تفضل كما هي ──
      const returnedIds = pendingLinks.filter((l) => l.deliveryStatus === "returned").map((l) => l.orderId);
      const nonReturnedIds = pendingLinks.filter((l) => l.deliveryStatus !== "returned").map((l) => l.orderId);
      if (nonReturnedIds.length > 0) {
        await db.update(ordersTable).set({ status: "in_shipping", shippingCompanyId: updated.shippingCompanyId }).where(inArray(ordersTable.id, nonReturnedIds));
      }
      // المرتجعات تفضل بحالتها returned مع returnReceived = 0 — مش بنغير حاجة فيها

      // ── إحصائيات للرسالة ──
      const postponedCount = pendingLinks.filter((l) => l.deliveryStatus === "postponed").length;
      const pendingCount = pendingLinks.filter((l) => l.deliveryStatus === "pending" || l.deliveryStatus === "in_shipping").length;
      const returnedInShippingCount = returnedIds.length;

      rolledOverManifest = { ...newManifest, orderCount: pendingLinks.length, postponedCount, pendingCount, returnedInShippingCount };
    }
  }

  res.json({ ...updated, invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null, rolledOverManifest });
});

const DeliveryStatusSchema = z.object({
  deliveryStatus: z.enum(["pending", "delivered", "postponed", "partial_received", "returned"]),
  deliveryNote: z.string().nullish(),
  partialQuantity: z.number().int().min(0).nullish(),
  returnReceived: z.boolean().nullish(),
});
const STATUS_MAP: Record<string, string> = { delivered: "received", postponed: "delayed", partial_received: "partial_received", returned: "returned", pending: "in_shipping" };

router.patch("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id), orderId = parseInt(req.params.orderId);
  if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = DeliveryStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { deliveryStatus, deliveryNote, partialQuantity, returnReceived } = parsed.data;
  const [link] = await db.select().from(shippingManifestOrdersTable).where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));
  if (!link) { res.status(404).json({ error: "الطلب غير موجود في هذا البيان" }); return; }
  const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!existingOrder) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  const oldStatus = existingOrder.status;
  const newStatus = STATUS_MAP[deliveryStatus] ?? "in_shipping";
  const isDelivered = deliveryStatus === "delivered" || deliveryStatus === "partial_received";
  await db.update(shippingManifestOrdersTable).set({
    deliveryStatus, deliveryNote: deliveryNote ?? null,
    partialQuantity: deliveryStatus === "partial_received" && partialQuantity != null ? partialQuantity : null,
    deliveredAt: isDelivered ? new Date() : null,
    ...(deliveryStatus === "returned" && returnReceived != null ? { returnReceived: returnReceived ? 1 : 0 } : deliveryStatus !== "returned" ? { returnReceived: null } : {}),
  }).where(eq(shippingManifestOrdersTable.id, link.id));
  const orderUpdate: Record<string, unknown> = { status: newStatus };
  if (deliveryStatus === "partial_received" && partialQuantity != null) orderUpdate.partialQuantity = partialQuantity;
  if (deliveryStatus === "returned" && returnReceived != null) orderUpdate.returnReceived = returnReceived ? 1 : 0;
  else if (deliveryStatus !== "returned") orderUpdate.returnReceived = null;
  await db.update(ordersTable).set(orderUpdate).where(eq(ordersTable.id, orderId));
  if (newStatus !== oldStatus) {
    const orderRef = { variantId: existingOrder.variantId, productId: existingOrder.productId, product: existingOrder.product, color: existingOrder.color, size: existingOrder.size, warehouseId: existingOrder.warehouseId };
    if (deliveryStatus === "delivered") {
      if (oldStatus === "partial_received") { const r = existingOrder.quantity - (existingOrder.partialQuantity ?? 0); if (r > 0) await processDelivery(orderRef, r, "sale", orderId, true); }
      else if (oldStatus !== "received") await processDelivery(orderRef, existingOrder.quantity, "sale", orderId, true);
    } else if (deliveryStatus === "partial_received") {
      const delta = (partialQuantity ?? 0) - ((oldStatus === "partial_received" ? existingOrder.partialQuantity : 0) ?? 0);
      if (delta > 0) await processDelivery(orderRef, delta, "partial_sale", orderId, true);
      else if (delta < 0) await reverseDelivery(orderRef, Math.abs(delta), orderId);
    } else if (deliveryStatus === "returned") {
      if (returnReceived === true) {
        const wasPartial = oldStatus === "partial_received";
        const qty = wasPartial ? (existingOrder.partialQuantity ?? existingOrder.quantity) : existingOrder.quantity;
        await processReturn({ ...orderRef, quantity: qty }, oldStatus === "received" || wasPartial, false, orderId);
      } else if (returnReceived === false) { /* مازال في شركة الشحن — لا تأثير */ }
      else {
        const wasPartial = oldStatus === "partial_received";
        const qty = wasPartial ? (existingOrder.partialQuantity ?? existingOrder.quantity) : existingOrder.quantity;
        await processReturn({ ...orderRef, quantity: qty }, oldStatus === "received" || wasPartial, false, orderId);
      }
    } else {
      if (oldStatus === "received") await reverseDelivery(orderRef, existingOrder.quantity, orderId);
      else if (oldStatus === "partial_received") { const d = existingOrder.partialQuantity ?? 0; if (d > 0) await reverseDelivery(orderRef, d, orderId); }
    }
  }
  if (existingOrder.invoiceNumber?.trim()) {
    const siblings = await db.select({ mo: shippingManifestOrdersTable, o: ordersTable })
      .from(shippingManifestOrdersTable).innerJoin(ordersTable, eq(shippingManifestOrdersTable.orderId, ordersTable.id))
      .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(ordersTable.invoiceNumber, existingOrder.invoiceNumber.trim())));
    for (const sib of siblings) {
      if (sib.mo.orderId === orderId) continue;
      const su: Record<string, unknown> = { deliveryStatus, deliveryNote: deliveryNote ?? null, deliveredAt: isDelivered ? new Date() : null };
      // لا نمس partialQuantity للـ siblings — كل order بيتبعت بكميته الخاصة من الـ frontend
      if (deliveryStatus === "returned" && returnReceived != null) su.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned") su.returnReceived = null;
      await db.update(shippingManifestOrdersTable).set(su).where(eq(shippingManifestOrdersTable.id, sib.mo.id));
      const sou: Record<string, unknown> = { status: STATUS_MAP[deliveryStatus] ?? "in_shipping" };
      // لا نمس partialQuantity للـ siblings
      if (deliveryStatus === "returned" && returnReceived != null) sou.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned") sou.returnReceived = null;
      await db.update(ordersTable).set(sou).where(eq(ordersTable.id, sib.mo.orderId));
    }
  }
  res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null, returnReceived: returnReceived ?? null });
});

export default router;
