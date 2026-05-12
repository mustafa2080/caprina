import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, isNull } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

// Status priority for resolving invoice status when rows have mixed statuses
const STATUS_PRIORITY: Record<string, number> = {
  pending: 1, in_shipping: 2, warehouse_ready: 3, delayed: 4,
  partial_received: 5, received: 6, returned: 7,
};

function resolveInvoiceStatus(statuses: string[]): string {
  if (statuses.length === 1) return statuses[0];
  return [...statuses].sort((a, b) => (STATUS_PRIORITY[a] ?? 99) - (STATUS_PRIORITY[b] ?? 99))[0];
}

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

/**
 * Group raw order rows into logical "invoices" (same invoiceNumber = 1 order).
 * This matches the orders list page: invoice with 3 products = 1 order, not 3.
 */
function groupOrdersIntoInvoices(orders: (typeof ordersTable.$inferSelect)[]) {
  const invoiceMap = new Map<string, {
    createdByUserId: number | null;
    statuses: string[];
    createdAt: Date;
    updatedAt: Date;
    adSource: string | null;
    adCampaign: string | null;
    profit: number;
  }>();

  for (const o of orders) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        createdByUserId: o.createdByUserId ?? null,
        statuses: [],
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
        adSource: o.adSource ?? null,
        adCampaign: o.adCampaign ?? null,
        profit: 0,
      });
    }
    const inv = invoiceMap.get(key)!;
    inv.statuses.push(o.status);
    inv.profit += profitFromOrder(o);
    const upd = new Date(o.updatedAt);
    if (upd > inv.updatedAt) inv.updatedAt = upd;
  }

  return Array.from(invoiceMap.entries()).map(([key, inv]) => ({
    invoiceKey: key,
    createdByUserId: inv.createdByUserId,
    status: resolveInvoiceStatus(inv.statuses),
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    adSource: inv.adSource,
    adCampaign: inv.adCampaign,
    profit: inv.profit,
  }));
}

// ─── Team Performance ──────────────────────────────────────────────────────────
router.get("/analytics/team-performance", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions));

  // Group into invoices so counts match the orders list page
  const orders = groupOrdersIntoInvoices(rawOrders);

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const stats: Record<number, {
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
  }> = {};

  for (const o of orders) {
    const uid = o.createdByUserId ?? 0;
    if (!stats[uid]) {
      const user = uid ? userMap.get(uid) : null;
      stats[uid] = {
        userId: uid,
        userName: user?.username ?? "غير محدد",
        displayName: user?.displayName ?? "غير محدد",
        total: 0, delivered: 0, returned: 0, pending: 0,
        profit: 0, deliveryRate: 0, returnRate: 0,
      };
    }
    stats[uid].total++;
    if (o.status === "received" || o.status === "partial_received") stats[uid].delivered++;
    else if (o.status === "returned") stats[uid].returned++;
    else stats[uid].pending++;
    stats[uid].profit += o.profit;
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    returnRate: s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0,
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});

// ─── Team Performance Extended ─────────────────────────────────────────────────
router.get("/analytics/team-performance-extended", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions));

  // Group into invoices so counts match the orders list page
  const orders = groupOrdersIntoInvoices(rawOrders);

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  type ExtStats = {
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
    avgProcessingHours: number | null;
    sourceCounts: Record<string, number>;
    topSource: string | null;
    ordersPerDay: number;
    score: number;
    _processingHoursSum: number;
    _processingCount: number;
    _firstOrder: Date | null;
    _lastOrder: Date | null;
  };

  const stats: Record<number, ExtStats> = {};

  for (const o of orders) {
    const uid = o.createdByUserId ?? 0;
    if (!stats[uid]) {
      const user = uid ? userMap.get(uid) : null;
      stats[uid] = {
        userId: uid,
        userName: user?.username ?? "غير محدد",
        displayName: user?.displayName ?? "غير محدد",
        total: 0, delivered: 0, returned: 0, pending: 0,
        profit: 0, deliveryRate: 0, returnRate: 0,
        avgProcessingHours: null,
        sourceCounts: {},
        topSource: null,
        ordersPerDay: 0,
        score: 0,
        _processingHoursSum: 0,
        _processingCount: 0,
        _firstOrder: null,
        _lastOrder: null,
      };
    }
    const s = stats[uid];
    s.total++;

    const oDate = new Date(o.createdAt);
    if (!s._firstOrder || oDate < s._firstOrder) s._firstOrder = oDate;
    if (!s._lastOrder || oDate > s._lastOrder) s._lastOrder = oDate;

    const src = o.adSource ?? "organic";
    s.sourceCounts[src] = (s.sourceCounts[src] ?? 0) + 1;

    if (o.status === "received" || o.status === "partial_received") {
      s.delivered++;
      const diffHours = (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 3600000;
      if (diffHours >= 0) {
        s._processingHoursSum += diffHours;
        s._processingCount++;
      }
    } else if (o.status === "returned") {
      s.returned++;
    } else {
      s.pending++;
    }
    s.profit += o.profit;
  }

  const result = Object.values(stats).map((s) => {
    const deliveryRate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
    const returnRate = s.total > 0 ? Math.round((s.returned / s.total) * 100) : 0;
    const avgProcessingHours = s._processingCount > 0
      ? Math.round(s._processingHoursSum / s._processingCount)
      : null;

    let topSource: string | null = null;
    let topCount = 0;
    for (const [src, cnt] of Object.entries(s.sourceCounts)) {
      if (cnt > topCount) { topCount = cnt; topSource = src; }
    }

    let ordersPerDay = 0;
    if (s._firstOrder && s._lastOrder && s.total > 0) {
      const days = Math.max(1, Math.round((s._lastOrder.getTime() - s._firstOrder.getTime()) / 86400000) + 1);
      ordersPerDay = Math.round((s.total / days) * 10) / 10;
    }

    const score = (s.delivered * 3)
      + Math.max(0, Math.round(s.profit / 100))
      + (avgProcessingHours !== null && avgProcessingHours <= 24 ? s.delivered * 2 : 0)
      - (s.returned * 1);

    return {
      userId: s.userId,
      userName: s.userName,
      displayName: s.displayName,
      total: s.total,
      delivered: s.delivered,
      returned: s.returned,
      pending: s.pending,
      profit: s.profit,
      deliveryRate,
      returnRate,
      avgProcessingHours,
      sourceCounts: s.sourceCounts,
      topSource,
      ordersPerDay,
      score: Math.max(0, score),
    };
  });

  result.sort((a, b) => b.score - a.score);
  res.json(result);
});

// ─── Campaign / Ads Analytics ──────────────────────────────────────────────────
router.get("/analytics/campaigns", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  let conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions));

  // Group into invoices so counts match the orders list page
  const orders = groupOrdersIntoInvoices(rawOrders);

  type CampaignKey = string;
  const stats: Record<CampaignKey, {
    adSource: string;
    adCampaign: string | null;
    total: number;
    delivered: number;
    returned: number;
    pending: number;
    profit: number;
    deliveryRate: number;
    roi: number;
  }> = {};

  for (const o of orders) {
    const src = o.adSource ?? "organic";
    const camp = o.adCampaign ?? null;
    const key = `${src}||${camp ?? ""}`;

    if (!stats[key]) {
      stats[key] = {
        adSource: src, adCampaign: camp,
        total: 0, delivered: 0, returned: 0, pending: 0,
        profit: 0, deliveryRate: 0, roi: 0,
      };
    }

    const s = stats[key];
    s.total++;
    s.profit += o.profit;

    if (o.status === "received" || o.status === "partial_received") {
      s.delivered++;
    } else if (o.status === "returned") {
      s.returned++;
    } else {
      s.pending++;
    }
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    roi: 0, // ROI requires cost which isn't tracked at campaign level here
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});

export default router;
