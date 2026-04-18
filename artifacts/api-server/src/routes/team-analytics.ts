import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

function profitFromOrder(o: typeof ordersTable.$inferSelect): number {
  const qty =
    o.status === "partial_received" && o.partialQuantity
      ? o.partialQuantity
      : o.quantity;
  const cost = (o.costPrice ?? 0) * qty;
  const shipping = o.shippingCost ?? 0;
  if (o.status === "received" || o.status === "partial_received") {
    const revenue =
      o.status === "partial_received" && o.partialQuantity
        ? o.unitPrice * o.partialQuantity
        : o.totalPrice;
    return revenue - cost - shipping;
  }
  if (o.status === "returned") return -(cost + shipping);
  return 0;
}

// ─── Team Performance ──────────────────────────────────────────────────────────
router.get("/analytics/team-performance", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let conditions: any[] = [];
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Aggregate per assignedUserId
  const stats: Record<
    number,
    {
      userId: number;
      userName: string;
      displayName: string;
      total: number;
      delivered: number;
      returned: number;
      pending: number;
      profit: number;
      deliveryRate: number;
      returnRate: number;
    }
  > = {};

  for (const o of orders) {
    const uid = o.assignedUserId ?? 0; // 0 = unassigned
    if (!stats[uid]) {
      const user = uid ? userMap.get(uid) : null;
      stats[uid] = {
        userId: uid,
        userName: user?.username ?? "غير محدد",
        displayName: user?.displayName ?? "غير محدد",
        total: 0,
        delivered: 0,
        returned: 0,
        pending: 0,
        profit: 0,
        deliveryRate: 0,
        returnRate: 0,
      };
    }
    stats[uid].total++;
    if (o.status === "received" || o.status === "partial_received") stats[uid].delivered++;
    else if (o.status === "returned") stats[uid].returned++;
    else stats[uid].pending++;
    stats[uid].profit += profitFromOrder(o);
  }

  // Compute rates
  const result = Object.values(stats).map((s) => ({
    ...s,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    returnRate: s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0,
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});

// ─── Campaign / Ads Analytics ──────────────────────────────────────────────────
router.get("/analytics/campaigns", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let conditions: any[] = [];
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Aggregate per adSource + adCampaign
  type CampaignKey = string;
  const stats: Record<
    CampaignKey,
    {
      adSource: string;
      adCampaign: string | null;
      total: number;
      delivered: number;
      returned: number;
      pending: number;
      revenue: number;
      cost: number;
      profit: number;
      deliveryRate: number;
      roi: number;
    }
  > = {};

  for (const o of orders) {
    const src = o.adSource ?? "organic";
    const camp = o.adCampaign ?? null;
    const key = `${src}||${camp ?? ""}`;

    if (!stats[key]) {
      stats[key] = {
        adSource: src,
        adCampaign: camp,
        total: 0,
        delivered: 0,
        returned: 0,
        pending: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        deliveryRate: 0,
        roi: 0,
      };
    }

    const s = stats[key];
    s.total++;

    const qty =
      o.status === "partial_received" && o.partialQuantity
        ? o.partialQuantity
        : o.quantity;
    const orderCost = (o.costPrice ?? 0) * qty + (o.shippingCost ?? 0);
    const orderProfit = profitFromOrder(o);

    if (o.status === "received" || o.status === "partial_received") {
      s.delivered++;
      const revenue =
        o.status === "partial_received" && o.partialQuantity
          ? o.unitPrice * o.partialQuantity
          : o.totalPrice;
      s.revenue += revenue;
      s.cost += orderCost;
      s.profit += orderProfit;
    } else if (o.status === "returned") {
      s.returned++;
      s.cost += orderCost;
      s.profit += orderProfit;
    } else {
      s.pending++;
    }
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    roi: s.cost > 0 ? Math.round((s.profit / s.cost) * 100) : 0,
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});

export default router;
