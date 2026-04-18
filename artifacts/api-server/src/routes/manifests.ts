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

  const [manifest] = await db
    .insert(shippingManifestsTable)
    .values({
      manifestNumber,
      shippingCompanyId,
      notes: notes ?? null,
      status: "open",
    })
    .returning();

  await db.insert(shippingManifestOrdersTable).values(
    orderIds.map((orderId) => ({
      manifestId: manifest.id,
      orderId,
      deliveryStatus: "pending",
    }))
  );

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

router.patch("/shipping-manifests/:id", async (req, res): Promise<void> => {
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

  const [updated] = await db
    .update(shippingManifestsTable)
    .set(updateData)
    .where(eq(shippingManifestsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "البيان غير موجود" });
    return;
  }
  res.json({
    ...updated,
    invoicePrice: updated.invoicePrice ? Number(updated.invoicePrice) : null,
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

    const isDelivered =
      deliveryStatus === "delivered" ||
      deliveryStatus === "partial_received";

    await db
      .update(shippingManifestOrdersTable)
      .set({
        deliveryStatus,
        deliveryNote: deliveryNote ?? null,
        deliveredAt: isDelivered ? new Date() : null,
      })
      .where(eq(shippingManifestOrdersTable.id, link.id));

    const orderUpdate: Record<string, unknown> = {
      status: STATUS_MAP[deliveryStatus] ?? "in_shipping",
    };
    if (deliveryStatus === "partial_received" && partialQuantity) {
      orderUpdate.partialQuantity = partialQuantity;
    }

    await db
      .update(ordersTable)
      .set(orderUpdate)
      .where(eq(ordersTable.id, orderId));

    res.json({ success: true, deliveryStatus, deliveryNote: deliveryNote ?? null });
  }
);

router.delete("/shipping-manifests/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(shippingManifestsTable)
    .where(eq(shippingManifestsTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "البيان غير موجود" });
    return;
  }
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

    const allOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.shippingCompanyId, id));

    const allManifests = await db
      .select({ cnt: count() })
      .from(shippingManifestsTable)
      .where(eq(shippingManifestsTable.shippingCompanyId, id));

    const ordersWithDelivery: OrderWithDelivery[] = allOrders.map((o) => ({
      ...o,
      deliveryStatus: o.status === "received"
        ? "delivered"
        : o.status === "partial_received"
        ? "partial_received"
        : o.status === "returned"
        ? "returned"
        : o.status === "delayed"
        ? "postponed"
        : "pending",
      deliveryNote: null,
      deliveredAt: null,
      manifestOrderId: 0,
    }));

    const stats = computeStats(ordersWithDelivery);

    res.json({
      ...stats,
      manifestCount: Number(allManifests[0]?.cnt ?? 0),
    });
  }
);

export default router;
