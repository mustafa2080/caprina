import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, or, sql, count, isNull } from "drizzle-orm";
import {
  db,
  shippingManifestsTable,
  shippingManifestOrdersTable,
  shippingCompaniesTable,
  ordersTable,
  inventoryMovementsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";
import {
  processToShipping,
  reverseShipping,
  reverseDelivery,
  resolveInventoryTarget,
  recordMovement,
  resolveProductIdFromVariant,
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
      if (rv === 1) {
        // رجع للمخزن — خسارة الشحن فقط
        totalShippingCost += shipping;
      } else {
        // مازال عند شركة الشحن — خسارة كاملة (تكلفة البضاعة + الشحن)
        returnLosses += cost + shipping;
        totalCost += cost;
        totalShippingCost += shipping;
        stillAtShippingCount++;
        stillAtShippingAmount += o.totalPrice;
      }
    } else { totalShippingCost += shipping; }
  }
  const actuallyDeliveredShipping = orders
    .filter(o => o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received")
    .reduce((sum, o) => sum + (o.shippingCost ?? 0), 0);
  const dueFromCompany = deliveredGross - actuallyDeliveredShipping;
  return {
    total, delivered, returned, pending, deliveryRate,
    totalRevenue, totalCost, totalShippingCost, returnLosses,
    netProfit: totalRevenue - totalCost - totalShippingCost,
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
  // الطلبات pending    → processToShipping عادي (خصم مخزون + حركة)
  // الطلبات in_shipping → سجّل حركة to_shipping فقط بدون خصم (الكمية خرجت قبل كده)
  const ordersToShip = await db.select().from(ordersTable).where(inArray(ordersTable.id, normalizedOrderIds));
  for (const order of ordersToShip) {
    if (order.status === "in_shipping") {
      // الطلب كان في شحن سابق → سجّل حركة to_shipping بدون خصم من المخزون
      const ref = buildOrderRef(order);
      const { variantId, productId } = await resolveInventoryTarget(ref);
      if (variantId || productId) {
        const resolved = await resolveProductIdFromVariant(variantId, productId);
        await recordMovement({
          product: order.product ?? "منتج",
          color: order.color,
          size: order.size,
          quantity: order.quantity,
          type: "OUT",
          reason: "to_shipping",
          productId: resolved.productId,
          variantId: resolved.variantId,
          warehouseId: order.warehouseId,
          orderId: order.id,
          notes: "تحويل لشركة الشحن (نُقل من بيان سابق)",
        });
      }
    } else {
      // الطلب pending → processToShipping عادي (خصم من المخزن + حركة)
      await processToShipping(buildOrderRef(order), order.quantity, order.id);
    }
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

      // ── الطلبات المرحّلة: لما ترجعت للمخزن عبر reverseShipping ──
      // processToShipping هتخصمها تاني وتسجل to_shipping في البيان الجديد
      for (const order of pendingOrders) {
        await processToShipping(buildOrderRef(order), order.quantity, order.id);
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
   * القاعدة الجديدة: حركة واحدة فقط per order
   *   إنشاء البيان → to_shipping (خرجت المخزن مرة واحدة)
   *   أي تغيير حالة بعد كده → غيّر reason نفس الحركة فقط
   *     pending/postponed  → to_shipping   (لسه عند الشحن)
   *     delivered          → sale          (تم الاستلام)
   *     partial_received   → partial_sale  (استلام جزئي)
   *     returned           → from_shipping (مرتجع وصل المخزن)
   *                          أو to_shipping (مرتجع لسه في الشحن)
   */

  const noChange = deliveryStatus === oldDeliveryStatus &&
    (deliveryStatus !== "returned" || returnReceived === null || (Number(oldReturnReceived) === 1) === returnReceived);

  if (!noChange) {
    if (deliveryStatus === "returned" && returnReceived === true && Number(oldReturnReceived) !== 1) {
      // ── المرتجع وصل المخزن ────────────────────────────────────────────────
      // 1. أضف الكمية للمخزن فعلياً
      const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses } = await import("../lib/inventory.js");
      const { variantId: vid, productId: pid } = await resolveInventoryTarget(ref);
      if (vid || pid) {
        await adjustWarehouseStock(ref.warehouseId, vid, pid, +totalQty);
        await syncProductQuantityFromWarehouses(vid, pid);
      }
      // 2. غيّر حركة to_shipping الخاصة بالطلب ده (OUT→IN, from_shipping)
      //    بنستهدف الحركة بـ reason=to_shipping عشان ما نلمسش أي حركة تانية
      const [toShipMov] = await db
        .select({ id: inventoryMovementsTable.id })
        .from(inventoryMovementsTable)
        .where(and(
          eq(inventoryMovementsTable.orderId, orderId),
          eq(inventoryMovementsTable.reason, "to_shipping" as any),
        ))
        .orderBy(desc(inventoryMovementsTable.id))
        .limit(1);
      if (toShipMov) {
        await db.update(inventoryMovementsTable)
          .set({ type: "IN", reason: "from_shipping" as any, notes: "مرتجع — وصل المخزن من شركة الشحن" })
          .where(eq(inventoryMovementsTable.id, toShipMov.id));
      }
    } else {
      // باقي الحالات: غيّر reason نفس الحركة الموجودة (بدون خصم أو إضافة)
      let newReason: string;
      let movementNotes: string;

      if (deliveryStatus === "delivered") {
        newReason     = "sale";
        movementNotes = "تم الاستلام — بيع";
      } else if (deliveryStatus === "partial_received") {
        newReason     = "partial_sale";
        movementNotes = partialQuantity != null ? `استلام جزئي — ${partialQuantity} قطعة` : "استلام جزئي";
      } else if (deliveryStatus === "returned") {
        // returnReceived=false → لسه عند شركة الشحن
        newReason     = "to_shipping";
        movementNotes = "مرتجع — لسه عند شركة الشحن";
      } else {
        // pending / postponed
        newReason     = "to_shipping";
        movementNotes = deliveryStatus === "postponed" ? "مؤجل — عند شركة الشحن" : "قيد الانتظار — عند شركة الشحن";
      }

      // جيب الحركة الحالية عشان نشوف الـ type بتاعها
      const [lastMov] = await db
        .select({ id: inventoryMovementsTable.id, type: inventoryMovementsTable.type })
        .from(inventoryMovementsTable)
        .where(eq(inventoryMovementsTable.orderId, orderId))
        .orderBy(desc(inventoryMovementsTable.id))
        .limit(1);

      // لو الحركة الحالية IN (يعني المرتجع كان وصل المخزن) وبنرجعها OUT → نخصم من المخازن والمخزون
      if (lastMov?.type === "IN") {
        const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses } = await import("../lib/inventory.js");
        const { variantId: vid, productId: pid } = await resolveInventoryTarget(ref);
        if (vid || pid) {
          await adjustWarehouseStock(ref.warehouseId, vid, pid, -totalQty);
          await syncProductQuantityFromWarehouses(vid, pid);
        }
      }

      if (lastMov) {
        await db
          .update(inventoryMovementsTable)
          .set({ type: "OUT", reason: newReason as any, notes: movementNotes })
          .where(eq(inventoryMovementsTable.id, lastMov.id));
      } else {
        // مفيش حركة موجودة → سجّل حركة جديدة وخصم من المخازن (حالة استثنائية)
        const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses, recordMovement } = await import("../lib/inventory.js");
        const { variantId: vid, productId: pid } = await resolveInventoryTarget(ref);
        if (vid || pid) {
          await adjustWarehouseStock(ref.warehouseId, vid, pid, -totalQty);
          await syncProductQuantityFromWarehouses(vid, pid);
          await recordMovement({
            type: "OUT",
            reason: newReason as any,
            quantity: totalQty,
            warehouseId: ref.warehouseId,
            variantId: vid,
            productId: pid,
            product: ref.product,
            color: ref.color,
            size: ref.size,
            orderId,
            notes: movementNotes,
          });
        }
      }
    }
  } // end if (!noChange)

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

  // ─── فواتير متعددة (siblings): نفس المنطق — غيّر reason الحركة الموجودة ──
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

      // غيّر reason آخر حركة مخزون للـ sibling (نفس منطق الطلب الرئيسي)
      if (!noChange) {
        const sibRef = buildOrderRef(sib.o);

        if (deliveryStatus === "returned" && returnReceived === true && Number(sib.mo.returnReceived) !== 1) {
          const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses } = await import("../lib/inventory.js");
          const { variantId: sv, productId: sp } = await resolveInventoryTarget(sibRef);
          if (sv || sp) {
            await adjustWarehouseStock(sibRef.warehouseId, sv, sp, +sib.o.quantity);
            await syncProductQuantityFromWarehouses(sv, sp);
          }
          const [sibToShipMov] = await db
            .select({ id: inventoryMovementsTable.id })
            .from(inventoryMovementsTable)
            .where(and(
              eq(inventoryMovementsTable.orderId, sib.mo.orderId),
              eq(inventoryMovementsTable.reason, "to_shipping" as any),
            ))
            .orderBy(desc(inventoryMovementsTable.id))
            .limit(1);
          if (sibToShipMov) {
            await db.update(inventoryMovementsTable)
              .set({ type: "IN", reason: "from_shipping" as any, notes: "مرتجع — وصل المخزن من شركة الشحن" })
              .where(eq(inventoryMovementsTable.id, sibToShipMov.id));
          }
        } else {
          let sibReason: string;
          let sibNotes: string;

          if (deliveryStatus === "delivered") {
            sibReason = "sale"; sibNotes = "تم الاستلام — بيع";
          } else if (deliveryStatus === "partial_received") {
            sibReason = "partial_sale";
            sibNotes = partialQuantity != null ? `استلام جزئي — ${partialQuantity} قطعة` : "استلام جزئي";
          } else if (deliveryStatus === "returned") {
            sibReason = "to_shipping";
            sibNotes = "مرتجع — لسه عند شركة الشحن";
          } else {
            sibReason = "to_shipping";
            sibNotes = deliveryStatus === "postponed" ? "مؤجل — عند شركة الشحن" : "قيد الانتظار — عند شركة الشحن";
          }

          const [sibLastMov] = await db
            .select({ id: inventoryMovementsTable.id, type: inventoryMovementsTable.type })
            .from(inventoryMovementsTable)
            .where(eq(inventoryMovementsTable.orderId, sib.mo.orderId))
            .orderBy(desc(inventoryMovementsTable.id))
            .limit(1);

          // لو الحركة الحالية IN وبنرجعها OUT → نخصم من المخازن والمخزون
          if (sibLastMov?.type === "IN") {
            const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses } = await import("../lib/inventory.js");
            const { variantId: sv2, productId: sp2 } = await resolveInventoryTarget(sibRef);
            if (sv2 || sp2) {
              await adjustWarehouseStock(sibRef.warehouseId, sv2, sp2, -sib.o.quantity);
              await syncProductQuantityFromWarehouses(sv2, sp2);
            }
          }

          if (sibLastMov) {
            await db
              .update(inventoryMovementsTable)
              .set({ type: "OUT", reason: sibReason as any, notes: sibNotes })
              .where(eq(inventoryMovementsTable.id, sibLastMov.id));
          } else {
            // مفيش حركة → سجّل جديدة وخصم من المخازن (حالة استثنائية)
            const { resolveInventoryTarget, adjustWarehouseStock, syncProductQuantityFromWarehouses, recordMovement } = await import("../lib/inventory.js");
            const { variantId: sv2, productId: sp2 } = await resolveInventoryTarget(sibRef);
            if (sv2 || sp2) {
              await adjustWarehouseStock(sibRef.warehouseId, sv2, sp2, -sib.o.quantity);
              await syncProductQuantityFromWarehouses(sv2, sp2);
              await recordMovement({
                type: "OUT",
                reason: sibReason as any,
                quantity: sib.o.quantity,
                warehouseId: sibRef.warehouseId,
                variantId: sv2,
                productId: sp2,
                product: sibRef.product,
                color: sibRef.color,
                size: sibRef.size,
                orderId: sib.mo.orderId,
                notes: sibNotes,
              });
            }
          }
        }
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
