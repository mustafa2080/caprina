import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, shippingCompaniesTable, shippingManifestsTable, shippingManifestOrdersTable, ordersTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  notes: z.string().nullish(),
  isActive: z.boolean().default(true),
});

const UpdateSchema = CreateSchema.partial();

router.get("/shipping-companies", async (_req, res): Promise<void> => {
  const companies = await db.select().from(shippingCompaniesTable).orderBy(desc(shippingCompaniesTable.createdAt));
  res.json(companies);
});

router.post("/shipping-companies", async (req, res): Promise<void> => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertResult = await db.insert(shippingCompaniesTable).values({ ...parsed.data, createdAt: new Date() });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [company] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, insertId));
  res.status(201).json(company);
});


router.get("/shipping-companies/:id/stats", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Get all manifests for this company
  const manifests = await db.select().from(shippingManifestsTable)
    .where(eq(shippingManifestsTable.shippingCompanyId, id));

  const manifestCount = manifests.length;

  if (manifestCount === 0) {
    res.json({ delivered: 0, returned: 0, pending: 0, deliveryRate: 0, netProfit: 0, manifestCount: 0 });
    return;
  }

  const manifestIds = manifests.map(m => m.id);

  // Get all orders in these manifests
  const links = await db
    .select({
      deliveryStatus: shippingManifestOrdersTable.deliveryStatus,
      partialQuantity: shippingManifestOrdersTable.partialQuantity,
      orderId: shippingManifestOrdersTable.orderId,
    })
    .from(shippingManifestOrdersTable)
    .where(inArray(shippingManifestOrdersTable.manifestId, manifestIds));

  if (links.length === 0) {
    res.json({ delivered: 0, returned: 0, pending: 0, deliveryRate: 0, netProfit: 0, manifestCount });
    return;
  }

  const orderIds = links.map(l => l.orderId);
  const orders = await db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds));
  const orderMap = new Map(orders.map(o => [o.id, o]));

  let delivered = 0, returned = 0, pending = 0;
  let totalRevenue = 0, totalCost = 0, totalShipping = 0, returnLosses = 0;

  for (const link of links) {
    const order = orderMap.get(link.orderId);
    if (!order) continue;

    const status = link.deliveryStatus;
    const qty = status === "partial_received" && link.partialQuantity != null ? link.partialQuantity : order.quantity;

    if (status === "delivered" || status === "partial_received") {
      delivered++;
      const revenue = status === "partial_received" && link.partialQuantity != null
        ? order.unitPrice * link.partialQuantity
        : order.totalPrice;
      totalRevenue += revenue;
      totalCost += (order.costPrice ?? 0) * qty;
      totalShipping += order.shippingCost ?? 0;
    } else if (status === "returned") {
      returned++;
      returnLosses += order.shippingCost ?? 0;
      totalShipping += order.shippingCost ?? 0;
    } else {
      pending++;
      totalShipping += order.shippingCost ?? 0;
    }
  }

  const total = delivered + returned + pending;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const netProfit = totalRevenue - totalCost - totalShipping - returnLosses;

  res.json({ delivered, returned, pending, deliveryRate, netProfit, manifestCount });
});

router.patch("/shipping-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.update(shippingCompaniesTable).set(parsed.data).where(eq(shippingCompaniesTable.id, id));
  const [company] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(company);
});

router.delete("/shipping-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [toDelete] = await db.select().from(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  if (!toDelete) { res.status(404).json({ error: "Company not found" }); return; }
  await db.delete(shippingCompaniesTable).where(eq(shippingCompaniesTable.id, id));
  res.status(204).send();
});

export default router;
