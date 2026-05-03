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
  updateMovementReason,
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

// ─── Helper: بناء orderRef من طلب ────────────────────────────────────────────
function buildOrderRef(order: typeof ordersTable.$inferSelect) {
  return {
    variantId:   order.variantId,
    productId:   order.productId,
    product:     order.product,
    color:       order.color,
    size:        order.size,
    warehouseId: order.warehouseId,
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
// عند إنشاء البيان → processToShipping لكل طلب (خصم من المخزن + حركة to_shipping)

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

  // خصم من المخزن لكل طلب + حركة to_shipping
  const ordersToShip = await db.select().from(ordersTable).where(inArray(ordersTable.id, normalizedOrderIds));
  for (const order of ordersToShip) {
    await processToShipping(buildOrderRef(order), order.quantity, order.id);
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
      // ── الطلبات اللي لسه عند شركة الشحن (pending/postponed/in_shipping) ────────
      // كانت خرجت بـ to_shipping → نرجعها بـ from_shipping + نرجع حالتها لـ pending
      const stillAtShippingLinks = pendingLinks.filter(
        (l) => l.deliveryStatus === "pending" || l.deliveryStatus === "postponed" || l.deliveryStatus === "in_shipping"
      );
      for (const link of stillAtShippingLinks) {
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, link.orderId));
        if (!order) continue;
        // أرجع الكمية الكاملة للمخزن + سجل from_shipping
        await reverseShipping(buildOrderRef(order), order.quantity, order.id);
      }

      // ── الطلبات الجزئية (partial_received) بدون returnReceived ──────────────
      // الجزء المتبقي (لم يستلم) لسه عند شركة الشحن → نرجعه للمخزن
      const partialWithoutReturn = pendingLinks.filter((l) => l.deliveryStatus === "partial_received");
      for (const link of partialWithoutReturn) {
        const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, link.orderId));
        if (!order) continue;
        const deliveredQty  = link.partialQuantity ?? order.partialQuantity ?? 0;
        const remainingQty  = order.quantity - deliveredQty;
        // الجزء الباقي كان عند شركة الشحن → أرجعه للمخزن
        if (remainingQty > 0) await reverseShipping(buildOrderRef(order), remainingQty, order.id);
      }

      // ── رحّل كل الطلبات لبيان جديد ───────────────────────────────────────────
      const newManifestNumber = await generateManifestNumber(updated.shippingCompanyId);
      const insertResult = await db.insert(shippingManifestsTable).values({
        manifestNumber: newManifestNumber, shippingCompanyId: updated.shippingCompanyId,
        notes: `مُرحَّل من البيان ${updated.manifestNumber}`, status: "open", createdAt: new Date(),
      });
      const newId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
      const [newManifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, newId));

      // الطلبات في البيان الجديد تبقى pending (حتى الجزئية — الجزء المتبقي رجع المخزن)
      await db.insert(shippingManifestOrdersTable).values(
        pendingLinks.map((link) => ({
          manifestId: newManifest.id,
          orderId: link.orderId,
          deliveryStatus: "pending" as any, // كلها pending في البيان الجديد
          deliveryNote: null,
          deliveredAt: null,
          partialQuantity: null,
          returnReceived: null,
          addedAt: new Date(),
        }))
      );

      // ── جيب الطلبات وأضفها للبيان الجديد بدون خصم مخزون إضافي ─────────────
      // المخزون اتخصم بالفعل لما الطلبات دخلت البيان الأول
      // نعمل to_shipping جديدة في السجل بس (بدون تعديل المخزون = skipWarehouseStock=true)
      const allPendingIds = pendingLinks.map((l) => l.orderId);
      const pendingOrders = await db.select().from(ordersTable).where(inArray(ordersTable.id, allPendingIds));

      // ── سجّل حركة to_shipping للتوثيق فقط (بدون خصم من المخزون) ──────────
      const { recordMovement, resolveInventoryTarget } = await import("../lib/inventory.js");
      for (const order of pendingOrders) {
        const { variantId, productId } = await resolveInventoryTarget(buildOrderRef(order));
        await recordMovement({
          product: order.product,
          color: order.color,
          size: order.size,
          quantity: order.quantity,
          type: "OUT",
          reason: "to_shipping",
          productId: productId ?? order.productId,
          variantId: variantId ?? order.variantId,
          warehouseId: order.warehouseId,
          orderId: order.id,
          notes: `تحويل للبيان الجديد ${newManifestNumber} (مُرحَّل)`,
        });
      }

      await db.update(ordersTable)
        .set({ status: "in_shipping", shippingCompanyId: updated.shippingCompanyId })
        .where(inArray(ordersTable.id, allPendingIds));

      rolledOverManifest = {
        ...newManifest, orderCount: pendingLinks.length,
        postponedCount: pendingLinks.filter((l) => l.deliveryStatus === "postponed").length,
        pendingCount: pendingLinks.filter((l) => l.deliveryStatus === "pending" || l.deliveryStatus === "in_shipping").length,
        returnedInShippingCount: pendingLinks.filter((l) => l.deliveryStatus === "returned").length,
        partialInShippingCount: pendingLinks.filter((l) => l.deliveryStatus === "partial_received").length,
      };
    }
  }

  res.json({ ...updated, invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null, rolledOverManifest });
});

// ─── Delete manifest ──────────────────────────────────────────────────────────
// عند حذف البيان → reverseShipping لكل طلب كان لسه في الشحن

router.delete("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!manifest) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  const links = await db.select().from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.manifestId, id));

  if (links.length > 0) {
    const orderIds = links.map((l) => l.orderId);
    const orders = await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds));
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    for (const link of links) {
      const order = orderMap.get(link.orderId);
      if (!order) continue;
      const ref = buildOrderRef(order);
      const deliveredQty  = link.partialQuantity ?? order.partialQuantity ?? 0;
      const remainingQty  = order.quantity - deliveredQty;

      if (link.deliveryStatus === "delivered") {
        // كان استلم → أرجع الكمية كلها للمخزن
        await reverseDelivery(ref, order.quantity, order.id);
      } else if (link.deliveryStatus === "partial_received") {
        // الجزء اللي استُلم → عكسه
        if (deliveredQty > 0) await reverseDelivery(ref, deliveredQty, order.id);
        // الجزء الباقي كان عند شركة الشحن → أرجعه من الشحن
        if (remainingQty > 0) await reverseShipping(ref, remainingQty, order.id);
      } else if (link.deliveryStatus === "returned") {
        // لو المرتجع لم يصل المخزن → أرجعه من الشحن
        if (Number(link.returnReceived) !== 1) {
          await reverseShipping(ref, order.quantity, order.id);
        }
      } else {
        // pending/postponed/in_shipping → كانت عند شركة الشحن → أرجعها
        await reverseShipping(ref, order.quantity, order.id);
      }
    }

    await db.update(ordersTable)
      .set({ status: "pending", shippingCompanyId: null })
      .where(inArray(ordersTable.id, orderIds));
  }

  await db.delete(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.manifestId, id));
  await db.delete(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  res.status(204).send();
});

// ─── Remove order from manifest ───────────────────────────────────────────────
// عند إزالة طلب من البيان → reverseShipping (أرجع للمخزن)

router.delete("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id);
  const orderId    = parseInt(req.params.orderId);
  if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [link] = await db.select().from(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));
  if (!link) { res.status(404).json({ error: "الطلب غير موجود في هذا البيان" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (order) {
    const ref = buildOrderRef(order);
    const deliveredQty = link.partialQuantity ?? order.partialQuantity ?? 0;
    const remainingQty = order.quantity - deliveredQty;

    if (link.deliveryStatus === "delivered") {
      await reverseDelivery(ref, order.quantity, order.id);
    } else if (link.deliveryStatus === "partial_received") {
      if (deliveredQty > 0) await reverseDelivery(ref, deliveredQty, order.id);
      if (remainingQty > 0) await reverseShipping(ref, remainingQty, order.id);
    } else if (link.deliveryStatus === "returned") {
      if (Number(link.returnReceived) !== 1) await reverseShipping(ref, order.quantity, order.id);
    } else {
      // pending/postponed/in_shipping → عند شركة الشحن → أرجع للمخزن
      await reverseShipping(ref, order.quantity, order.id);
    }
  }

  await db.delete(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId)));
  await db.update(ordersTable)
    .set({ status: "pending", shippingCompanyId: null })
    .where(eq(ordersTable.id, orderId));

  res.json({ success: true, orderId, message: "تم إزالة الطلب من البيان" });
});

// ─── Add orders to manifest ───────────────────────────────────────────────────
// عند إضافة طلبات → processToShipping (خصم من المخزن + حركة to_shipping)

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
    // خصم من المخزن + حركة to_shipping لكل طلب جديد
    const newOrders = await db.select().from(ordersTable).where(inArray(ordersTable.id, newIds));
    for (const order of newOrders) {
      await processToShipping(buildOrderRef(order), order.quantity, order.id);
    }
    await db.update(ordersTable)
      .set({ status: "in_shipping", shippingCompanyId: manifest.shippingCompanyId })
      .where(inArray(ordersTable.id, newIds));
  }

  res.json({ added: newIds.length, manifestNumber: manifest.manifestNumber });
});

// ─── Update order delivery status in manifest ─────────────────────────────────
/**
 * منطق المخزون الكامل:
 *
 * FLOW الطبيعي:
 *   إنشاء البيان       → processToShipping  (OUT → to_shipping)   [كمية كاملة خرجت المخزن]
 *   تم الاستلام        → processDelivery    (OUT → sale)           [skip=true: الكمية مخرجة بالفعل]
 *   استلام جزئي        → processDelivery    (OUT → partial_sale)   [skip=true: الجزء المستلم]
 *   مرتجع وصل المخزن  → reverseShipping    (IN  → from_shipping)  [الجزء الباقي عند شركة الشحن]
 *                      + processReturn      (IN  → return)         [الجزء المستلم مسبقاً لو موجود]
 *   مازال في الشحن     → لا تغيير (الكمية خرجت بالفعل بـ to_shipping)
 */

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

  const oldDeliveryStatus = link.deliveryStatus;
  const oldReturnReceived = link.returnReceived;
  const isDelivered       = deliveryStatus === "delivered" || deliveryStatus === "partial_received";

  const ref      = buildOrderRef(existingOrder);
  const totalQty = existingOrder.quantity;
  const oldPartialQty = link.partialQuantity ?? existingOrder.partialQuantity ?? 0;

  // ─── منطق المخزون ─────────────────────────────────────────────────────────
  /**
   * تذكر: لما الطلب يدخل البيان → processToShipping أخد الكمية كلها من المخزن
   * يعني الكمية الكاملة موجودة عند شركة الشحن
   *
   * لما بتغير الحالة:
   *   → delivered:        الكمية كلها استُلمت → سجل بيع (skip=true لأنها خرجت بالفعل)
   *   → partial_received: جزء استُلم → سجل بيع للجزء ده فقط (skip=true)
   *                       الجزء المتبقي لسه عند شركة الشحن → لا تغيير
   *   → returned:
   *       returnReceived=false → المرتجع لسه عند شركة الشحن → لا تغيير في المخزن
   *       returnReceived=true  → المرتجع وصل المخزن:
   *           لو كان partial_received: الجزء الباقي (عند شركة الشحن) → reverseShipping
   *                                   + الجزء المستلم → processReturn
   *           لو كان delivered/returned: الكمية كلها → processReturn
   *           لو كان في الشحن: الكمية كلها → reverseShipping
   *   → pending/postponed: رجع لحالة الانتظار → لا تغيير في المخزن (الكمية لسه عند شركة الشحن)
   */

  // ── guard: لو الحالة ما اتغيرتش ومفيش تغيير في returnReceived → ما تعملش حركة مخزون ──
  const noChange = deliveryStatus === oldDeliveryStatus &&
    (deliveryStatus !== "returned" || returnReceived === null || (Number(oldReturnReceived) === 1) === returnReceived);
  if (noChange) {
    // بس حدّث جدول البيان والطلب بدون منطق مخزون
  } else if (deliveryStatus === "delivered") {
    if (oldDeliveryStatus === "partial_received") {
      // الجزء المتبقي (كان عند شركة الشحن) → الآن استُلم
      // غيّر reason الجزء الأول من partial_sale → sale
      await updateMovementReason(orderId, "partial_sale", "sale", "تم الاستلام الكامل");
      // الجزء الباقي لم يخرج من المخزن بحركة منفصلة → سجّل بيع للباقي فقط
      const remaining = totalQty - oldPartialQty;
      if (remaining > 0) {
        await processDelivery(ref, remaining, "sale", orderId, false);
      }
    } else if (oldDeliveryStatus !== "delivered") {
      // كان في الشحن (to_shipping) → استُلم كله → غيّر reason من to_shipping لـ sale
      const updated = await updateMovementReason(orderId, "to_shipping", "sale", "تم الاستلام — بيع");
      if (!updated) {
        // fallback: لو ما لقاش الحركة، سجّل بيع عادي (skip=true لأنها خرجت بالفعل)
        await processDelivery(ref, totalQty, "sale", orderId, true);
      } else {
        // حدّث soldQuantity بس (المخزون خرج بالفعل)
        // لا نعمل حركة جديدة — الحركة الموجودة اتغيرت reason بتاعتها
      }
    }

  } else if (deliveryStatus === "partial_received") {
    const newPartialQty = partialQuantity ?? 0;
    const prevPartialQty = oldDeliveryStatus === "partial_received" ? oldPartialQty : 0;
    const delta = newPartialQty - prevPartialQty;

    if (delta > 0) {
      // جزء إضافي استُلم → بيع الجزء ده (skip=true: الكمية كلها كانت خرجت بـ to_shipping)
      await processDelivery(ref, delta, "partial_sale", orderId, true);
    } else if (delta < 0) {
      // تصحيح: قلّل الكمية المستلمة → عكس الفرق
      await reverseDelivery(ref, Math.abs(delta), orderId);
    }
    // الجزء الباقي (totalQty - newPartialQty) لسه عند شركة الشحن → لا تغيير

  } else if (deliveryStatus === "returned") {
    const alreadyReturnedToStock = Number(oldReturnReceived) === 1;
    if (!alreadyReturnedToStock && returnReceived === true) {
      // المرتجع وصل المخزن دلوقتي
      if (oldDeliveryStatus === "partial_received") {
        // الجزء المستلم → processReturn (رجع للمخزن كمرتجع)
        if (oldPartialQty > 0) await processReturn({ ...ref, quantity: oldPartialQty }, true, false, orderId);
        // الجزء الباقي كان عند شركة الشحن → reverseShipping (رجع للمخزن من الشحن)
        const remaining = totalQty - oldPartialQty;
        if (remaining > 0) await reverseShipping(ref, remaining, orderId);
      } else if (oldDeliveryStatus === "delivered") {
        // كان مستلم كامل ثم مرتجع → processReturn
        await processReturn({ ...ref, quantity: totalQty }, true, false, orderId);
      } else {
        // كان في الشحن أو returned بدون استلام → reverseShipping
        await reverseShipping(ref, totalQty, orderId);
      }
    }
    // لو returnReceived=false → المرتجع لسه عند شركة الشحن → لا تغيير في المخزن

  } else {
    // pending/postponed → الطلب رجع لحالة الانتظار (لسه عند شركة الشحن)
    // لو كان delivered → عكس البيع
    if (oldDeliveryStatus === "delivered") {
      await reverseDelivery(ref, totalQty, orderId);
    } else if (oldDeliveryStatus === "partial_received") {
      if (oldPartialQty > 0) await reverseDelivery(ref, oldPartialQty, orderId);
      // الجزء الباقي كان عند شركة الشحن → لا تغيير
    }
    // لو كان في الشحن (pending/postponed) → لا تغيير
  } // end else (noChange guard)

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
  const orderUpdate: Record<string, unknown> = { status: STATUS_MAP[deliveryStatus] ?? "in_shipping" };
  if (deliveryStatus === "partial_received" && partialQuantity != null) orderUpdate.partialQuantity = partialQuantity;
  if (deliveryStatus === "partial_received" && partialReturnReceived != null) orderUpdate.returnReceived = partialReturnReceived ? 1 : 0;
  if (deliveryStatus === "returned" && returnReceived != null) orderUpdate.returnReceived = returnReceived ? 1 : 0;
  else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") orderUpdate.returnReceived = null;
  await db.update(ordersTable).set(orderUpdate).where(eq(ordersTable.id, orderId));

  // ─── فواتير متعددة (siblings): حدّث البيان والطلب بدون منطق مخزون إضافي ──
  // منطق المخزون اتعمل للـ orderId الرئيسي بس
  if (existingOrder.invoiceNumber?.trim()) {
    const siblings = await db.select({ mo: shippingManifestOrdersTable, o: ordersTable })
      .from(shippingManifestOrdersTable)
      .innerJoin(ordersTable, eq(shippingManifestOrdersTable.orderId, ordersTable.id))
      .where(and(
        eq(shippingManifestOrdersTable.manifestId, manifestId),
        eq(ordersTable.invoiceNumber, existingOrder.invoiceNumber.trim())
      ));

    for (const sib of siblings) {
      if (sib.mo.orderId === orderId) continue;

      // حركة مخزون للـ sibling كمان
      const sibRef = buildOrderRef(sib.o);
      const sibOldDeliveryStatus = sib.mo.deliveryStatus;
      const sibOldPartialQty = sib.mo.partialQuantity ?? sib.o.partialQuantity ?? 0;
      const sibTotalQty = sib.o.quantity;

      if (deliveryStatus === "delivered") {
        if (sibOldDeliveryStatus === "partial_received") {
          await updateMovementReason(sib.o.id, "partial_sale", "sale", "تم الاستلام الكامل");
          const remaining = sibTotalQty - sibOldPartialQty;
          if (remaining > 0) await processDelivery(sibRef, remaining, "sale", sib.o.id, false);
        } else if (sibOldDeliveryStatus !== "delivered") {
          const updated = await updateMovementReason(sib.o.id, "to_shipping", "sale", "تم الاستلام — بيع");
          if (!updated) await processDelivery(sibRef, sibTotalQty, "sale", sib.o.id, true);
        }
      } else if (deliveryStatus === "partial_received") {
        const newPQ = partialQuantity ?? 0;
        const prevPQ = sibOldDeliveryStatus === "partial_received" ? sibOldPartialQty : 0;
        const delta = newPQ - prevPQ;
        if (delta > 0) await processDelivery(sibRef, delta, "partial_sale", sib.o.id, true);
        else if (delta < 0) await reverseDelivery(sibRef, Math.abs(delta), sib.o.id);
      } else if (deliveryStatus === "returned" && returnReceived === true && Number(sib.mo.returnReceived) !== 1) {
        if (sibOldDeliveryStatus === "partial_received") {
          if (sibOldPartialQty > 0) await processReturn({ ...sibRef, quantity: sibOldPartialQty }, true, false, sib.o.id);
          const remaining = sibTotalQty - sibOldPartialQty;
          if (remaining > 0) await reverseShipping(sibRef, remaining, sib.o.id);
        } else if (sibOldDeliveryStatus === "delivered") {
          await processReturn({ ...sibRef, quantity: sibTotalQty }, true, false, sib.o.id);
        } else {
          await reverseShipping(sibRef, sibTotalQty, sib.o.id);
        }
      } else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") {
        if (sibOldDeliveryStatus === "delivered") await reverseDelivery(sibRef, sibTotalQty, sib.o.id);
        else if (sibOldDeliveryStatus === "partial_received" && sibOldPartialQty > 0) await reverseDelivery(sibRef, sibOldPartialQty, sib.o.id);
      }

      const su: Record<string, unknown> = { deliveryStatus, deliveryNote: deliveryNote ?? null, deliveredAt: isDelivered ? new Date() : null };
      if (deliveryStatus === "partial_received" && partialQuantity != null) su.partialQuantity = partialQuantity;
      if (deliveryStatus === "returned" && returnReceived != null) su.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus === "partial_received" && partialReturnReceived != null) su.returnReceived = partialReturnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") su.returnReceived = null;
      await db.update(shippingManifestOrdersTable).set(su).where(eq(shippingManifestOrdersTable.id, sib.mo.id));

      const sou: Record<string, unknown> = { status: STATUS_MAP[deliveryStatus] ?? "in_shipping" };
      if (deliveryStatus === "partial_received" && partialQuantity != null) sou.partialQuantity = partialQuantity;
      if (deliveryStatus === "returned" && returnReceived != null) sou.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus === "partial_received" && partialReturnReceived != null) sou.returnReceived = partialReturnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned" && deliveryStatus !== "partial_received") sou.returnReceived = null;
      await db.update(ordersTable).set(sou).where(eq(ordersTable.id, sib.mo.orderId));
    }
  }

  res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null, returnReceived: returnReceived ?? null });
});

export default router;
