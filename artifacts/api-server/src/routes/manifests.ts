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
  const seedOrders = await db
    .select()
    .from(ordersTable)
    .where(inArray(ordersTable.id, orderIds));

  if (seedOrders.length === 0) return [];

  const invoiceNumbers = Array.from(
    new Set(
      seedOrders
        .map((order) => order.invoiceNumber?.trim())
        .filter((invoiceNumber): invoiceNumber is string => Boolean(invoiceNumber))
    )
  );

  const soloIds = seedOrders
    .filter((order) => !order.invoiceNumber?.trim())
    .map((order) => order.id);

  const expandedOrders = invoiceNumbers.length > 0
    ? await db
        .select()
        .from(ordersTable)
        .where(
          and(
            isNull(ordersTable.deletedAt),
            inArray(ordersTable.invoiceNumber, invoiceNumbers)
          )
        )
    : [];

  const allIds = new Set<number>([
    ...soloIds,
    ...expandedOrders.map((order) => order.id),
  ]);

  return Array.from(allIds);
}

async function generateManifestNumber(companyId: number): Promise<string> {
  const [row] = await db
    .select({ cnt: count() })
    .from(shippingManifestsTable)
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

  const delivered = groupedOrders.filter((group) =>
    group.every((order) =>
      order.deliveryStatus === "delivered" || order.deliveryStatus === "partial_received"
    )
  ).length;

  const returned = groupedOrders.filter((group) =>
    group.every((order) => order.deliveryStatus === "returned")
  ).length;

  const pending = groupedOrders.filter((group) =>
    group.some((order) => ["pending", "postponed"].includes(order.deliveryStatus)) ||
    (!group.every((order) => order.deliveryStatus === "returned") &&
      !group.every((order) =>
        order.deliveryStatus === "delivered" || order.deliveryStatus === "partial_received"
      ))
  ).length;

  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  let totalRevenue = 0;
  let totalCost = 0;
  let totalShippingCost = 0;
  let returnLosses = 0;
  let deliveredGross = 0;

  for (const o of orders) {
    const qty =
      o.deliveryStatus === "partial_received" && o.partialQuantity
        ? o.partialQuantity
        : o.quantity;
    const cost = (o.costPrice ?? 0) * qty;
    const shipping = o.shippingCost ?? 0;

    if (o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received") {
      const revenue =
        o.deliveryStatus === "partial_received" && o.partialQuantity
          ? o.unitPrice * o.partialQuantity
          : o.totalPrice;
      totalRevenue += revenue;
      totalCost += cost;
      totalShippingCost += shipping;
      deliveredGross += revenue;
    } else if (o.deliveryStatus === "returned") {
      returnLosses += shipping;
      totalShippingCost += shipping;
    } else {
      totalShippingCost += shipping;
    }
  }

  const netProfit = totalRevenue - totalCost - totalShippingCost - returnLosses;

  return {
    total, delivered, returned, pending, deliveryRate,
    totalRevenue, totalCost, totalShippingCost, returnLosses, netProfit, deliveredGross,
  };
}

router.get("/shipping-manifests", async (req, res): Promise<void> => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;

  const manifests = await db
    .select({ manifest: shippingManifestsTable, company: shippingCompaniesTable })
    .from(shippingManifestsTable)
    .leftJoin(shippingCompaniesTable, eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id))
    .where(companyId ? eq(shippingManifestsTable.shippingCompanyId, companyId) : undefined)
    .orderBy(desc(shippingManifestsTable.createdAt));

  const manifestIds = manifests.map((m) => m.manifest.id);
  if (manifestIds.length === 0) { res.json([]); return; }

  const allLinks = await db
    .select({ manifestId: shippingManifestOrdersTable.manifestId })
    .from(shippingManifestOrdersTable)
    .where(inArray(shippingManifestOrdersTable.manifestId, manifestIds));

  const countMap: Record<number, number> = {};
  for (const link of allLinks) {
    countMap[link.manifestId] = (countMap[link.manifestId] ?? 0) + 1;
  }

  res.json(
    manifests.map((m) => ({
      ...m.manifest,
      invoicePrice: m.manifest.invoicePrice ? Number(m.manifest.invoicePrice) : null,
      companyName: m.company?.name ?? "غير محدد",
      orderCount: countMap[m.manifest.id] ?? 0,
    }))
  );
});

router.post("/shipping-manifests", async (req, res): Promise<void> => {
  const parsed = CreateManifestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { shippingCompanyId, orderIds, notes } = parsed.data;
  const normalizedOrderIds = await expandOrderIdsByInvoice(orderIds);

  const company = await db.select().from(shippingCompaniesTable)
    .where(eq(shippingCompaniesTable.id, shippingCompanyId)).then((r) => r[0]);
  if (!company) { res.status(404).json({ error: "شركة الشحن غير موجودة" }); return; }

  const manifestNumber = await generateManifestNumber(shippingCompanyId);
  const insertResult = await db.insert(shippingManifestsTable).values({
    manifestNumber, shippingCompanyId, notes: notes ?? null, status: "open", createdAt: new Date(),
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, insertId));

  await db.insert(shippingManifestOrdersTable).values(
    normalizedOrderIds.map((orderId) => ({
      manifestId: manifest.id, orderId, deliveryStatus: "pending", addedAt: new Date(),
    }))
  );

  const ordersToShip = await db.select().from(ordersTable).where(inArray(ordersTable.id, normalizedOrderIds));
  for (const order of ordersToShip) {
    await processToShipping(
      { variantId: order.variantId, productId: order.productId, product: order.product,
        color: order.color, size: order.size, warehouseId: order.warehouseId },
      order.quantity, order.id,
    );
  }

  await db.update(ordersTable)
    .set({ status: "in_shipping", shippingCompanyId })
    .where(inArray(ordersTable.id, normalizedOrderIds));

  res.status(201).json({
    ...manifest, invoicePrice: null, companyName: company.name, orderCount: normalizedOrderIds.length,
  });
});

router.get("/shipping-manifests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({ manifest: shippingManifestsTable, company: shippingCompaniesTable })
    .from(shippingManifestsTable)
    .leftJoin(shippingCompaniesTable, eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id))
    .where(eq(shippingManifestsTable.id, id));
  if (!row) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  const links = await db.select().from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.manifestId, id));

  const orderIds = links.map((l) => l.orderId);
  const expandedOrderIds = await expandOrderIdsByInvoice(orderIds);

  let orders: OrderWithDelivery[] = [];
  if (expandedOrderIds.length > 0) {
    const rawOrders = await db.select().from(ordersTable)
      .where(inArray(ordersTable.id, expandedOrderIds))
      .orderBy(desc(ordersTable.createdAt));

    const linkedRawOrders = rawOrders.filter((order) => orderIds.includes(order.id));
    const invoiceLinkMap = new Map<string, (typeof links)[0]>();
    linkedRawOrders.forEach((order) => {
      if (order.invoiceNumber?.trim()) {
        const link = links.find((item) => item.orderId === order.id);
        if (link) invoiceLinkMap.set(order.invoiceNumber.trim(), link);
      }
    });

    const linkMap = new Map(links.map((l) => [l.orderId, l]));
    orders = rawOrders.map((o) => {
      const link = linkMap.get(o.id) ?? (o.invoiceNumber?.trim() ? invoiceLinkMap.get(o.invoiceNumber.trim()) : undefined);
      if (!link) {
        return { ...o, deliveryStatus: "pending", deliveryNote: null, deliveredAt: null, manifestOrderId: 0 };
      }
      return {
        ...o,
        deliveryStatus: link.deliveryStatus,
        deliveryNote: link.deliveryNote,
        deliveredAt: link.deliveredAt,
        partialQuantity: (link as any).partialQuantity ?? o.partialQuantity,
        manifestOrderId: link.id,
        returnReceived: link.returnReceived ?? null,
      };
    });
  }

  const stats = computeStats(orders);
  res.json({
    ...row.manifest,
    invoicePrice: row.manifest.invoicePrice ? Number(row.manifest.invoicePrice) : null,
    manualShippingCost: row.manifest.manualShippingCost ? Number(row.manifest.manualShippingCost) : null,
    companyName: row.company?.name ?? "غير محدد",
    companyPhone: row.company?.phone ?? null,
    orders, stats,
  });
});

router.patch("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const Schema = z.object({
    status: z.enum(["open", "closed"]).optional(),
    notes: z.string().nullish(),
    invoicePrice: z.number().nonnegative().nullish(),
    invoiceNotes: z.string().nullish(),
    manualShippingCost: z.number().nonnegative().nullish(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ?? null;
  if (parsed.data.invoicePrice !== undefined)
    updateData.invoicePrice = parsed.data.invoicePrice != null ? String(parsed.data.invoicePrice) : null;
  if (parsed.data.invoiceNotes !== undefined)
    updateData.invoiceNotes = parsed.data.invoiceNotes ?? null;
  if (parsed.data.manualShippingCost !== undefined)
    updateData.manualShippingCost = parsed.data.manualShippingCost != null ? String(parsed.data.manualShippingCost) : null;
  if (parsed.data.status === "closed") updateData.closedAt = new Date();
  if (parsed.data.status === "open") updateData.closedAt = null;

  if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "لا توجد بيانات للتحديث" }); return; }

  await db.update(shippingManifestsTable).set(updateData).where(eq(shippingManifestsTable.id, id));
  const [updated] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!updated) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  let rolledOverManifest: (typeof shippingManifestsTable.$inferSelect & { orderCount: number }) | null = null;

  if (parsed.data.status === "closed") {
    // اجمع الأوردرات:
    // 1) postponed أو pending أو in_shipping
    // 2) أو returned مع returnReceived = 0 (مازال في شركة الشحن)
    const pendingLinks = await db
      .select()
      .from(shippingManifestOrdersTable)
      .where(
        and(
          eq(shippingManifestOrdersTable.manifestId, id),
          or(
            inArray(shippingManifestOrdersTable.deliveryStatus, ["postponed", "pending", "in_shipping"]),
            and(
              eq(shippingManifestOrdersTable.deliveryStatus, "returned"),
              sql`${shippingManifestOrdersTable.returnReceived} = 0`
            )
          )
        )
      );

    if (pendingLinks.length > 0) {
      const rolloverOrderIds = pendingLinks.map((l) => l.orderId);

      const newManifestNumber = await generateManifestNumber(updated.shippingCompanyId);
      const insertResult = await db.insert(shippingManifestsTable).values({
        manifestNumber: newManifestNumber,
        shippingCompanyId: updated.shippingCompanyId,
        notes: `مُرحَّل من البيان ${updated.manifestNumber}`,
        status: "open",
        createdAt: new Date(),
      });
      const newId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
      const [newManifest] = await db.select().from(shippingManifestsTable)
        .where(eq(shippingManifestsTable.id, newId));

      await db.insert(shippingManifestOrdersTable).values(
        rolloverOrderIds.map((orderId) => ({
          manifestId: newManifest.id,
          orderId,
          deliveryStatus: "pending" as const,
          deliveryNote: null,
          deliveredAt: null,
          addedAt: new Date(),
        }))
      );

      // المرتجعات اللي كانت عند الشركة → in_shipping في البيان الجديد ونمسح returnReceived
      await db.update(ordersTable)
        .set({ status: "in_shipping", shippingCompanyId: updated.shippingCompanyId, returnReceived: null })
        .where(inArray(ordersTable.id, rolloverOrderIds));

      rolledOverManifest = { ...newManifest, orderCount: rolloverOrderIds.length };
    }
  }

  res.json({
    ...updated,
    invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null,
    rolledOverManifest,
  });
});

const DeliveryStatusSchema = z.object({
  deliveryStatus: z.enum(["pending", "delivered", "postponed", "partial_received", "returned"]),
  deliveryNote: z.string().nullish(),
  partialQuantity: z.number().int().positive().nullish(),
  returnReceived: z.boolean().nullish(),
});

const STATUS_MAP: Record<string, string> = {
  delivered: "received",
  postponed: "delayed",
  partial_received: "partial_received",
  returned: "returned",
  pending: "in_shipping",
};

router.patch("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id);
  const orderId = parseInt(req.params.orderId);
  if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = DeliveryStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { deliveryStatus, deliveryNote, partialQuantity, returnReceived } = parsed.data;

  const [link] = await db.select().from(shippingManifestOrdersTable).where(
    and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId))
  );
  if (!link) { res.status(404).json({ error: "الطلب غير موجود في هذا البيان" }); return; }

  const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!existingOrder) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const oldStatus = existingOrder.status;
  const newStatus = STATUS_MAP[deliveryStatus] ?? "in_shipping";
  const isDelivered = deliveryStatus === "delivered" || deliveryStatus === "partial_received";

  // 1. Update manifest order row
  await db.update(shippingManifestOrdersTable).set({
    deliveryStatus,
    deliveryNote: deliveryNote ?? null,
    partialQuantity: deliveryStatus === "partial_received" && partialQuantity ? partialQuantity : null,
    deliveredAt: isDelivered ? new Date() : null,
    ...(deliveryStatus === "returned" && returnReceived !== undefined && returnReceived !== null
      ? { returnReceived: returnReceived ? 1 : 0 }
      : deliveryStatus !== "returned"
      ? { returnReceived: null }
      : {}),
  }).where(eq(shippingManifestOrdersTable.id, link.id));

  // 2. Update order status
  const orderUpdate: Record<string, unknown> = { status: newStatus };
  if (deliveryStatus === "partial_received" && partialQuantity) orderUpdate.partialQuantity = partialQuantity;
  if (deliveryStatus === "returned" && returnReceived !== undefined && returnReceived !== null) {
    orderUpdate.returnReceived = returnReceived ? 1 : 0;
  } else if (deliveryStatus !== "returned") {
    orderUpdate.returnReceived = null;
  }
  await db.update(ordersTable).set(orderUpdate).where(eq(ordersTable.id, orderId));

  // 3. Inventory transitions
  if (newStatus !== oldStatus) {
    const orderRef = {
      variantId: existingOrder.variantId, productId: existingOrder.productId,
      product: existingOrder.product, color: existingOrder.color,
      size: existingOrder.size, warehouseId: existingOrder.warehouseId,
    };

    if (deliveryStatus === "delivered") {
      if (oldStatus === "partial_received") {
        const remainder = existingOrder.quantity - (existingOrder.partialQuantity ?? 0);
        if (remainder > 0) await processDelivery(orderRef, remainder, "sale", orderId, true);
      } else if (oldStatus !== "received") {
        await processDelivery(orderRef, existingOrder.quantity, "sale", orderId, true);
      }
    } else if (deliveryStatus === "partial_received") {
      const newPartial = partialQuantity ?? 0;
      const oldPartial = (oldStatus === "partial_received" ? existingOrder.partialQuantity : 0) ?? 0;
      const delta = newPartial - oldPartial;
      if (delta > 0) await processDelivery(orderRef, delta, "partial_sale", orderId, true);
      else if (delta < 0) await reverseDelivery(orderRef, Math.abs(delta), orderId);
    } else if (deliveryStatus === "returned") {
      if (returnReceived === true) {
        const wasPartial = oldStatus === "partial_received";
        const returnQty = wasPartial ? (existingOrder.partialQuantity ?? existingOrder.quantity) : existingOrder.quantity;
        await processReturn({ ...orderRef, quantity: returnQty }, oldStatus === "received" || wasPartial, false, orderId);
      } else if (returnReceived === false) {
        // مازال في شركة الشحن — لا تأثير على المخزن
      } else {
        const wasPartial = oldStatus === "partial_received";
        const returnQty = wasPartial ? (existingOrder.partialQuantity ?? existingOrder.quantity) : existingOrder.quantity;
        await processReturn({ ...orderRef, quantity: returnQty }, oldStatus === "received" || wasPartial, false, orderId);
      }
    } else {
      if (oldStatus === "received") await reverseDelivery(orderRef, existingOrder.quantity, orderId);
      else if (oldStatus === "partial_received") {
        const deducted = existingOrder.partialQuantity ?? 0;
        if (deducted > 0) await reverseDelivery(orderRef, deducted, orderId);
      }
    }
  }

  // 4. Sync invoice siblings
  if (existingOrder.invoiceNumber?.trim()) {
    const siblings = await db
      .select({ mo: shippingManifestOrdersTable, o: ordersTable })
      .from(shippingManifestOrdersTable)
      .innerJoin(ordersTable, eq(shippingManifestOrdersTable.orderId, ordersTable.id))
      .where(and(
        eq(shippingManifestOrdersTable.manifestId, manifestId),
        eq(ordersTable.invoiceNumber, existingOrder.invoiceNumber.trim()),
      ));
    for (const sib of siblings) {
      if (sib.mo.orderId === orderId) continue;
      const sibUpdate: Record<string, unknown> = { deliveryStatus, deliveryNote: deliveryNote ?? null };
      if (isDelivered) sibUpdate.deliveredAt = new Date(); else sibUpdate.deliveredAt = null;
      if (deliveryStatus === "partial_received" && partialQuantity) sibUpdate.partialQuantity = null;
      if (deliveryStatus === "returned" && returnReceived !== undefined && returnReceived !== null)
        sibUpdate.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned") sibUpdate.returnReceived = null;
      await db.update(shippingManifestOrdersTable).set(sibUpdate).where(eq(shippingManifestOrdersTable.id, sib.mo.id));

      const sibOrderUpdate: Record<string, unknown> = { status: STATUS_MAP[deliveryStatus] ?? "in_shipping" };
      if (deliveryStatus === "partial_received" && partialQuantity) sibOrderUpdate.partialQuantity = null;
      if (deliveryStatus === "returned" && returnReceived !== undefined && returnReceived !== null)
        sibOrderUpdate.returnReceived = returnReceived ? 1 : 0;
      else if (deliveryStatus !== "returned") sibOrderUpdate.returnReceived = null;
      await db.update(ordersTable).set(sibOrderUpdate).where(eq(ordersTable.id, sib.mo.orderId));
    }
  }

  res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null, returnReceived: returnReceived ?? null });
});

// ─── DELETE /shipping-manifests/:id/orders/:orderId ─────────────────────────
router.delete("/shipping-manifests/:id/orders/:orderId", async (req, res): Promise<void> => {
  try {
    const manifestId = parseInt(req.params.id);
    const orderId = parseInt(req.params.orderId);
    if (isNaN(manifestId) || isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, manifestId));
    if (!manifest) { res.status(404).json({ error: "البيان غير موجود" }); return; }
    if (manifest.status === "closed") { res.status(400).json({ error: "البيان مغلق لا يمكن التعديل عليه" }); return; }

    const [link] = await db.select().from(shippingManifestOrdersTable).where(
      and(eq(shippingManifestOrdersTable.manifestId, manifestId), eq(shippingManifestOrdersTable.orderId, orderId))
    );
    if (!link) { res.status(404).json({ error: "الطلبية غير موجودة في هذا البيان" }); return; }

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) { res.status(404).json({ error: "الطلبية غير موجودة" }); return; }

    const orderRef = {
      variantId: order.variantId, productId: order.productId, product: order.product,
      color: order.color, size: order.size, warehouseId: order.warehouseId,
    };
    const ds = link.deliveryStatus;
    if (ds === "pending" || ds === "postponed") {
      await reverseShipping(orderRef, order.quantity, order.id);
    } else if (ds === "delivered") {
      await reverseShipping(orderRef, order.quantity, order.id);
      await reverseDelivery(orderRef, order.quantity, order.id);
    } else if (ds === "partial_received") {
      const dQty = order.partialQuantity ?? 0;
      const rQty = order.quantity - dQty;
      if (dQty > 0) await reverseDelivery(orderRef, dQty, order.id);
      if (rQty > 0) await reverseShipping(orderRef, rQty, order.id);
    } else if (ds === "returned") {
      await reverseShipping(orderRef, order.quantity, order.id);
    }

    await db.delete(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.id, link.id));
    await db.update(ordersTable).set({ status: "pending", partialQuantity: null, updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    res.json({ success: true, orderId, message: "تم إلغاء الطلبية من البيان وإرجاعها للانتظار" });
  } catch (err: any) {
    console.error("[cancelOrder] Error:", err);
    res.status(500).json({ error: err?.message ?? "خطأ داخلي", stack: err?.stack });
  }
});

// ─── POST /shipping-manifests/:id/orders ────────────────────────────────────
router.post("/shipping-manifests/:id/orders", requireAdmin, async (req, res): Promise<void> => {
  const manifestId = parseInt(req.params.id);
  if (isNaN(manifestId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = z.object({ orderIds: z.array(z.number().int().positive()).min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "orderIds مطلوب" }); return; }

  const normalizedOrderIds = await expandOrderIdsByInvoice(parsed.data.orderIds);

  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, manifestId));
  if (!manifest) { res.status(404).json({ error: "البيان غير موجود" }); return; }
  if (manifest.status === "closed") { res.status(400).json({ error: "البيان مغلق لا يمكن الإضافة إليه" }); return; }

  const SHIPPABLE = ["pending", "delayed", "in_shipping"] as const;
  const orders = await db.select().from(ordersTable).where(
    and(inArray(ordersTable.id, normalizedOrderIds), isNull(ordersTable.deletedAt), inArray(ordersTable.status, [...SHIPPABLE]))
  );
  if (orders.length === 0) { res.status(400).json({ error: "لم يتم العثور على طلبيات مؤهلة" }); return; }

  const existing = await db.select({ orderId: shippingManifestOrdersTable.orderId })
    .from(shippingManifestOrdersTable)
    .where(and(eq(shippingManifestOrdersTable.manifestId, manifestId), inArray(shippingManifestOrdersTable.orderId, normalizedOrderIds)));
  const existingIds = new Set(existing.map(e => e.orderId));
  const toAdd = orders.filter(o => !existingIds.has(o.id));
  if (toAdd.length === 0) { res.status(400).json({ error: "جميع الطلبيات المختارة موجودة بالفعل في البيان" }); return; }

  await db.insert(shippingManifestOrdersTable).values(
    toAdd.map(o => ({ manifestId, orderId: o.id, deliveryStatus: "pending" as const, deliveryNote: null, deliveredAt: null }))
  );

  const needsShipping = toAdd.filter(o => o.status !== "in_shipping");
  if (needsShipping.length > 0) {
    await db.update(ordersTable).set({ status: "in_shipping", shippingCompanyId: manifest.shippingCompanyId })
      .where(inArray(ordersTable.id, needsShipping.map(o => o.id)));
    for (const order of needsShipping) {
      await processToShipping(
        { variantId: order.variantId, productId: order.productId, product: order.product,
          color: order.color, size: order.size, warehouseId: order.warehouseId },
        order.quantity, order.id,
      );
    }
  }

  const alreadyShipping = toAdd.filter(o => o.status === "in_shipping");
  if (alreadyShipping.length > 0) {
    await db.update(ordersTable).set({ shippingCompanyId: manifest.shippingCompanyId })
      .where(inArray(ordersTable.id, alreadyShipping.map(o => o.id)));
    for (const order of alreadyShipping) {
      await processToShipping(
        { variantId: order.variantId, productId: order.productId, product: order.product,
          color: order.color, size: order.size, warehouseId: order.warehouseId },
        order.quantity, order.id,
      );
    }
  }

  res.json({ added: toAdd.length, manifestNumber: manifest.manifestNumber });
});

router.delete("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [toDelete] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!toDelete) { res.status(404).json({ error: "البيان غير موجود" }); return; }

  const allLinks = await db.select().from(shippingManifestOrdersTable).where(eq(shippingManifestOrdersTable.manifestId, id));
  if (allLinks.length > 0) {
    const allOrderIds = allLinks.map((l) => l.orderId);
    const allOrders = await db.select().from(ordersTable).where(inArray(ordersTable.id, allOrderIds));
    const linkMap = new Map(allLinks.map((l) => [l.orderId, l]));

    for (const order of allOrders) {
      const link = linkMap.get(order.id);
      if (!link) continue;
      const orderRef = {
        variantId: order.variantId, productId: order.productId, product: order.product,
        color: order.color, size: order.size, warehouseId: order.warehouseId,
      };
      const ds = link.deliveryStatus;
      if (ds === "pending" || ds === "postponed") {
        await reverseShipping(orderRef, order.quantity, order.id);
      } else if (ds === "delivered") {
        await reverseShipping(orderRef, order.quantity, order.id);
        await reverseDelivery(orderRef, order.quantity, order.id);
      } else if (ds === "partial_received") {
        const dQty = order.partialQuantity ?? 0;
        const rQty = order.quantity - dQty;
        if (dQty > 0) { await reverseDelivery(orderRef, dQty, order.id); await reverseShipping(orderRef, dQty, order.id); }
        if (rQty > 0) await reverseShipping(orderRef, rQty, order.id);
      } else if (ds === "returned") {
        await reverseShipping(orderRef, order.quantity, order.id);
      }
    }
  }

  await db.delete(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  res.status(204).send();
});

router.get("/shipping-companies/:id/stats", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const companyManifests = await db.select({ id: shippingManifestsTable.id })
    .from(shippingManifestsTable)
    .where(eq(shippingManifestsTable.shippingCompanyId, id));

  const manifestCount = companyManifests.length;
  if (manifestCount === 0) {
    res.json({ total: 0, delivered: 0, returned: 0, pending: 0, deliveryRate: 0,
      totalRevenue: 0, totalCost: 0, totalShippingCost: 0, returnLosses: 0, netProfit: 0,
      deliveredGross: 0, manifestCount: 0 });
    return;
  }

  const mIds = companyManifests.map((m) => m.id);
  const manifestOrderRows = await db
    .select({ mo: shippingManifestOrdersTable, o: ordersTable })
    .from(shippingManifestOrdersTable)
    .innerJoin(ordersTable, eq(shippingManifestOrdersTable.orderId, ordersTable.id))
    .where(inArray(shippingManifestOrdersTable.manifestId, mIds));

  const ordersWithDelivery: OrderWithDelivery[] = manifestOrderRows.map(({ mo, o }) => ({
    ...o,
    deliveryStatus: mo.deliveryStatus,
    deliveryNote: mo.deliveryNote,
    deliveredAt: mo.deliveredAt,
    manifestOrderId: mo.id,
  }));

  const stats = computeStats(ordersWithDelivery);
  res.json({ ...stats, manifestCount });
});

router.get("/orders/:orderId/manifest-status", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId);
  if (isNaN(orderId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const links = await db
    .select({ mo: shippingManifestOrdersTable, manifest: shippingManifestsTable })
    .from(shippingManifestOrdersTable)
    .innerJoin(shippingManifestsTable, eq(shippingManifestOrdersTable.manifestId, shippingManifestsTable.id))
    .where(eq(shippingManifestOrdersTable.orderId, orderId))
    .orderBy(desc(shippingManifestsTable.createdAt));

  if (links.length === 0) { res.json(null); return; }

  const activeLink = links.find(l => l.manifest.status === "open") ?? links[0];
  res.json({
    manifestId: activeLink.manifest.id,
    manifestNumber: activeLink.manifest.manifestNumber,
    manifestStatus: activeLink.manifest.status,
    deliveryStatus: activeLink.mo.deliveryStatus,
    deliveryNote: activeLink.mo.deliveryNote,
    partialQuantity: activeLink.mo.partialQuantity,
    deliveredAt: activeLink.mo.deliveredAt,
    returnReceived: activeLink.mo.returnReceived,
  });
});

export default router;
