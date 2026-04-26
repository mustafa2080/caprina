import { Router, type IRouter } from "express";
import { eq, desc, and, inArray, sql, count } from "drizzle-orm";
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
  const total = orders.length;

  const delivered = orders.filter(
    (o) => o.deliveryStatus === "delivered" || o.deliveryStatus === "partial_received"
  ).length;
  const returned = orders.filter((o) => o.deliveryStatus === "returned").length;
  const pending = orders.filter((o) =>
    ["pending", "postponed"].includes(o.deliveryStatus)
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
      returnLosses += cost + shipping;
      totalShippingCost += shipping;
    } else {
      totalShippingCost += shipping;
    }
  }

  const netProfit = totalRevenue - totalCost - totalShippingCost - returnLosses;

  return {
    total,
    delivered,
    returned,
    pending,
    deliveryRate,
    totalRevenue,
    totalCost,
    totalShippingCost,
    returnLosses,
    netProfit,
    deliveredGross,
  };
}

router.get("/shipping-manifests", async (req, res): Promise<void> => {
  const companyId = req.query.companyId
    ? parseInt(req.query.companyId as string)
    : undefined;

  const manifests = await db
    .select({
      manifest: shippingManifestsTable,
      company: shippingCompaniesTable,
    })
    .from(shippingManifestsTable)
    .leftJoin(
      shippingCompaniesTable,
      eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id)
    )
    .where(
      companyId
        ? eq(shippingManifestsTable.shippingCompanyId, companyId)
        : undefined
    )
    .orderBy(desc(shippingManifestsTable.createdAt));

  const manifestIds = manifests.map((m) => m.manifest.id);
  if (manifestIds.length === 0) {
    res.json([]);
    return;
  }

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
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { shippingCompanyId, orderIds, notes } = parsed.data;

  const company = await db
    .select()
    .from(shippingCompaniesTable)
    .where(eq(shippingCompaniesTable.id, shippingCompanyId))
    .then((r) => r[0]);
  if (!company) {
    res.status(404).json({ error: "شركة الشحن غير موجودة" });
    return;
  }

  const manifestNumber = await generateManifestNumber(shippingCompanyId);

  const insertResult = await db
    .insert(shippingManifestsTable)
    .values({
      manifestNumber,
      shippingCompanyId,
      notes: notes ?? null,
      status: "open",
      createdAt: new Date(),
    });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [manifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, insertId));

  await db.insert(shippingManifestOrdersTable).values(
    orderIds.map((orderId) => ({
      manifestId: manifest.id,
      orderId,
      deliveryStatus: "pending",
      addedAt: new Date(),
    }))
  );

  // Sync shippingCompanyId on all included orders
  await db
    .update(ordersTable)
    .set({ shippingCompanyId: shippingCompanyId })
    .where(inArray(ordersTable.id, orderIds));

  // Transfer stock from warehouse to shipping company for each order
  const ordersToShip = await db
    .select()
    .from(ordersTable)
    .where(inArray(ordersTable.id, orderIds));

  for (const order of ordersToShip) {
    await processToShipping(
      {
        variantId: order.variantId,
        productId: order.productId,
        product: order.product,
        color: order.color,
        size: order.size,
        warehouseId: order.warehouseId,
      },
      order.quantity,
      order.id,
    );
  }

  res.status(201).json({
    ...manifest,
    invoicePrice: null,
    companyName: company.name,
    orderCount: orderIds.length,
  });
});

router.get("/shipping-manifests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .select({
      manifest: shippingManifestsTable,
      company: shippingCompaniesTable,
    })
    .from(shippingManifestsTable)
    .leftJoin(
      shippingCompaniesTable,
      eq(shippingManifestsTable.shippingCompanyId, shippingCompaniesTable.id)
    )
    .where(eq(shippingManifestsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "البيان غير موجود" });
    return;
  }

  const links = await db
    .select()
    .from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.manifestId, id));

  const orderIds = links.map((l) => l.orderId);

  let orders: OrderWithDelivery[] = [];
  if (orderIds.length > 0) {
    const rawOrders = await db
      .select()
      .from(ordersTable)
      .where(inArray(ordersTable.id, orderIds))
      .orderBy(desc(ordersTable.createdAt));

    const linkMap = new Map(links.map((l) => [l.orderId, l]));
    orders = rawOrders.map((o) => {
      const link = linkMap.get(o.id)!;
      return {
        ...o,
        deliveryStatus: link.deliveryStatus,
        deliveryNote: link.deliveryNote,
        deliveredAt: link.deliveredAt,
        manifestOrderId: link.id,
      };
    });
  }

  const stats = computeStats(orders);

  res.json({
    ...row.manifest,
    invoicePrice: row.manifest.invoicePrice
      ? Number(row.manifest.invoicePrice)
      : null,
    companyName: row.company?.name ?? "غير محدد",
    companyPhone: row.company?.phone ?? null,
    orders,
    stats,
  });
});

router.patch("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const Schema = z.object({
    status: z.enum(["open", "closed"]).optional(),
    notes: z.string().nullish(),
    invoicePrice: z.number().nonnegative().nullish(),
    invoiceNotes: z.string().nullish(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes ?? null;
  if ("invoicePrice" in parsed.data)
    updateData.invoicePrice =
      parsed.data.invoicePrice != null
        ? String(parsed.data.invoicePrice)
        : null;
  if ("invoiceNotes" in parsed.data)
    updateData.invoiceNotes = parsed.data.invoiceNotes ?? null;
  if (parsed.data.status === "closed") updateData.closedAt = new Date();
  if (parsed.data.status === "open") updateData.closedAt = null;

  await db
    .update(shippingManifestsTable)
    .set(updateData)
    .where(eq(shippingManifestsTable.id, id));
  const [updated] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!updated) {
    res.status(404).json({ error: "البيان غير موجود" });
    return;
  }

  // ── Rollover: when closing, move pending/postponed orders to a new manifest ──
  let rolledOverManifest: { id: number; manifestNumber: string; orderCount: number } | null = null;

  if (parsed.data.status === "closed") {
    const pendingLinks = await db
      .select()
      .from(shippingManifestOrdersTable)
      .where(
        and(
          eq(shippingManifestOrdersTable.manifestId, id),
          inArray(shippingManifestOrdersTable.deliveryStatus, ["pending", "postponed"])
        )
      );

    if (pendingLinks.length > 0) {
      const pendingOrderIds = pendingLinks.map((l) => l.orderId);
      const newManifestNumber = await generateManifestNumber(updated.shippingCompanyId);

      const rollInsertResult = await db
        .insert(shippingManifestsTable)
        .values({
          manifestNumber: newManifestNumber,
          shippingCompanyId: updated.shippingCompanyId,
          notes: `مرحَّل من ${updated.manifestNumber}`,
          status: "open",
          createdAt: new Date(),
        });
      const rollInsertId = (rollInsertResult as any)[0]?.insertId ?? (rollInsertResult as any).insertId;
      const [newManifest] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, rollInsertId));

      await db.insert(shippingManifestOrdersTable).values(
        pendingOrderIds.map((orderId) => ({
          manifestId: newManifest.id,
          orderId,
          deliveryStatus: "pending",
          addedAt: new Date(),
        }))
      );

      // Reset order status back to in_shipping for rolled-over orders
      await db
        .update(ordersTable)
        .set({ status: "in_shipping" })
        .where(inArray(ordersTable.id, pendingOrderIds));

      rolledOverManifest = {
        id: newManifest.id,
        manifestNumber: newManifest.manifestNumber,
        orderCount: pendingOrderIds.length,
      };
    }
  }

  res.json({
    ...updated,
    invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null,
    rolledOverManifest,
  });
});

const DeliveryStatusSchema = z.object({
  deliveryStatus: z.enum([
    "pending",
    "delivered",
    "postponed",
    "partial_received",
    "returned",
  ]),
  deliveryNote: z.string().nullish(),
  partialQuantity: z.number().int().positive().nullish(),
});

const STATUS_MAP: Record<string, string> = {
  delivered: "received",
  postponed: "delayed",
  partial_received: "partial_received",
  returned: "returned",
  pending: "in_shipping",
};

router.patch(
  "/shipping-manifests/:id/orders/:orderId",
  async (req, res): Promise<void> => {
    const manifestId = parseInt(req.params.id);
    const orderId = parseInt(req.params.orderId);
    if (isNaN(manifestId) || isNaN(orderId)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const parsed = DeliveryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { deliveryStatus, deliveryNote, partialQuantity } = parsed.data;

    // Fetch manifest order link
    const [link] = await db
      .select()
      .from(shippingManifestOrdersTable)
      .where(
        and(
          eq(shippingManifestOrdersTable.manifestId, manifestId),
          eq(shippingManifestOrdersTable.orderId, orderId)
        )
      );
    if (!link) {
      res.status(404).json({ error: "الطلب غير موجود في هذا البيان" });
      return;
    }

    // Fetch current order (needed for inventory transitions)
    const [existingOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (!existingOrder) {
      res.status(404).json({ error: "الطلب غير موجود" });
      return;
    }

    const oldStatus = existingOrder.status;
    const newStatus = STATUS_MAP[deliveryStatus] ?? "in_shipping";
    const isDelivered =
      deliveryStatus === "delivered" || deliveryStatus === "partial_received";

    // 1. Update manifest order row
    await db
      .update(shippingManifestOrdersTable)
      .set({
        deliveryStatus,
        deliveryNote: deliveryNote ?? null,
        deliveredAt: isDelivered ? new Date() : null,
      })
      .where(eq(shippingManifestOrdersTable.id, link.id));

    // 2. Update order status in orders table
    const orderUpdate: Record<string, unknown> = { status: newStatus };
    if (deliveryStatus === "partial_received" && partialQuantity) {
      orderUpdate.partialQuantity = partialQuantity;
    }
    await db
      .update(ordersTable)
      .set(orderUpdate)
      .where(eq(ordersTable.id, orderId));

    // 3. Apply inventory transitions (mirrors orders.ts logic)
    if (newStatus !== oldStatus) {
      const orderRef = {
        variantId: existingOrder.variantId,
        productId: existingOrder.productId,
        product: existingOrder.product,
        color: existingOrder.color,
        size: existingOrder.size,
        warehouseId: existingOrder.warehouseId,
      };

      if (deliveryStatus === "delivered") {
        // البضاعة كانت اتخصمت من المخزن بـ processToShipping — skipWarehouseStock = true
        if (oldStatus === "partial_received") {
          const alreadyDeducted = existingOrder.partialQuantity ?? 0;
          const remainder = existingOrder.quantity - alreadyDeducted;
          if (remainder > 0)
            await processDelivery(orderRef, remainder, "sale", orderId, true);
        } else if (oldStatus !== "received") {
          await processDelivery(orderRef, existingOrder.quantity, "sale", orderId, true);
        }
      } else if (deliveryStatus === "partial_received") {
        const newPartial = partialQuantity ?? 0;
        const oldPartial = (oldStatus === "partial_received" ? existingOrder.partialQuantity : 0) ?? 0;
        const delta = newPartial - oldPartial;
        if (delta > 0)
          await processDelivery(orderRef, delta, "partial_sale", orderId, true);
        else if (delta < 0)
          await reverseDelivery(orderRef, Math.abs(delta), orderId);
      } else if (deliveryStatus === "returned") {
        // Return: restore stock only if the order was previously delivered
        const wasFullyDelivered = oldStatus === "received";
        const wasPartiallyDelivered = oldStatus === "partial_received";
        const returnQty = wasPartiallyDelivered
          ? (existingOrder.partialQuantity ?? existingOrder.quantity)
          : existingOrder.quantity;
        await processReturn(
          { ...orderRef, quantity: returnQty },
          wasFullyDelivered || wasPartiallyDelivered,
          false, // not damaged — return to stock
          orderId
        );
      } else {
        // postponed / pending — reverse any previous delivery
        if (oldStatus === "received") {
          await reverseDelivery(orderRef, existingOrder.quantity, orderId);
        } else if (oldStatus === "partial_received") {
          const deducted = existingOrder.partialQuantity ?? 0;
          if (deducted > 0)
            await reverseDelivery(orderRef, deducted, orderId);
        }
      }
    }

    res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null });
  }
);

router.delete("/shipping-manifests/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [toDelete] = await db.select().from(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  if (!toDelete) {
    res.status(404).json({ error: "البيان غير موجود" });
    return;
  }

  // جيب كل الطلبات في البيان مع حالتها
  const allLinks = await db
    .select()
    .from(shippingManifestOrdersTable)
    .where(eq(shippingManifestOrdersTable.manifestId, id));

  if (allLinks.length > 0) {
    const allOrderIds = allLinks.map((l) => l.orderId);
    const allOrders = await db
      .select()
      .from(ordersTable)
      .where(inArray(ordersTable.id, allOrderIds));

    const linkMap = new Map(allLinks.map((l) => [l.orderId, l]));

    for (const order of allOrders) {
      const link = linkMap.get(order.id);
      if (!link) continue;

      const orderRef = {
        variantId: order.variantId,
        productId: order.productId,
        product: order.product,
        color: order.color,
        size: order.size,
        warehouseId: order.warehouseId,
      };

      const deliveryStatus = link.deliveryStatus;

      if (deliveryStatus === "pending" || deliveryStatus === "postponed") {
        // لسه في الشحن → ارجع الكمية للمخزن
        await reverseShipping(orderRef, order.quantity, order.id);

      } else if (deliveryStatus === "delivered") {
        // اتسلم كامل → الخصم حصل مرتين (to_shipping + sale) → ارجع مرتين
        await reverseShipping(orderRef, order.quantity, order.id);
        await reverseDelivery(orderRef, order.quantity, order.id);

      } else if (deliveryStatus === "partial_received") {
        // اتسلم جزئي
        const deliveredQty = order.partialQuantity ?? 0;
        const remainingQty = order.quantity - deliveredQty;

        // الجزء اللي اتسلم → عكس sale + عكس to_shipping
        if (deliveredQty > 0) {
          await reverseDelivery(orderRef, deliveredQty, order.id);
          await reverseShipping(orderRef, deliveredQty, order.id);
        }
        // الجزء اللي لسه في الشحن → عكس to_shipping بس
        if (remainingQty > 0) {
          await reverseShipping(orderRef, remainingQty, order.id);
        }

      } else if (deliveryStatus === "returned") {
        // مرتجع → processReturn رجّع للمخزون العام
        // reverseShipping يرجع للـ warehouseStock اللي ما اتأثرش بـ processReturn
        await reverseShipping(orderRef, order.quantity, order.id);
      }
    }
  }

  await db.delete(shippingManifestsTable).where(eq(shippingManifestsTable.id, id));
  res.status(204).send();
});

router.get(
  "/shipping-companies/:id/stats",
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    // Get all manifests for this company
    const companyManifests = await db
      .select({ id: shippingManifestsTable.id })
      .from(shippingManifestsTable)
      .where(eq(shippingManifestsTable.shippingCompanyId, id));

    const manifestCount = companyManifests.length;

    if (manifestCount === 0) {
      res.json({
        total: 0, delivered: 0, returned: 0, pending: 0,
        deliveryRate: 0, totalRevenue: 0, totalCost: 0,
        totalShippingCost: 0, returnLosses: 0, netProfit: 0,
        deliveredGross: 0, manifestCount: 0,
      });
      return;
    }

    const mIds = companyManifests.map((m) => m.id);

    // Aggregate from manifest_orders (accurate delivery status per order)
    const manifestOrderRows = await db
      .select({
        mo: shippingManifestOrdersTable,
        o: ordersTable,
      })
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
  }
);

export default router;
