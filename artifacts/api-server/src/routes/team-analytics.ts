import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, isNull } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getTenantId } from "../middlewares/requireTenant.js";

const router: IRouter = Router();
router.use(requireAuth);

// Status priority — must match orders.ts STATUS_PRIORITY_FILTER exactly.
// Lower number = higher priority (wins when invoice has mixed statuses).
const STATUS_PRIORITY: Record<string, number> = {
  pending: 1, in_shipping: 2, warehouse_ready: 3, delayed: 4,
  partial_received: 5, received: 6, returned: 7,
};

function resolveInvoiceStatus(statuses: string[]): string {
  if (statuses.length === 1) return statuses[0];
  return [...statuses].sort(
    (a, b) => (STATUS_PRIORITY[a] ?? 99) - (STATUS_PRIORITY[b] ?? 99)
  )[0];
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
  if (o.status === "returned") return -shipping; // البضاعة رجعت للمخزن → خسارة الشحن فقط
  return 0;
}

/** Classify a resolved invoice status into one of 4 display buckets */
function classifyStatus(status: string): "delivered" | "returned" | "inProgress" | "delayed" {
  if (status === "received" || status === "partial_received") return "delivered";
  if (status === "returned") return "returned";
  if (status === "delayed") return "delayed";
  return "inProgress";
}


/**
 * The core counting logic — matches orders.tsx exactly:
 *
 * Each unique invoiceNumber = 1 order in the orders list page.
 * For team analytics, a member "owns" an invoice if ANY of its rows
 * has createdByUserId == that member.  The invoice's resolved status
 * is computed from ALL rows (same priority logic as orders.ts).
 *
 * Result: Map<userId, Set<invoiceKey>>  +  per-invoice metadata.
 */
function buildPerUserInvoices(rawOrders: (typeof ordersTable.$inferSelect)[]) {
  // Step 1 – Build a global invoice map (invoiceKey → all rows)
  const invoiceRowsMap = new Map<string, (typeof ordersTable.$inferSelect)[]>();
  for (const o of rawOrders) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceRowsMap.has(key)) invoiceRowsMap.set(key, []);
    invoiceRowsMap.get(key)!.push(o);
  }

  // Step 2 – Resolve each invoice into a single logical record
  type InvoiceRecord = {
    invoiceKey: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    adSource: string | null;
    adCampaign: string | null;
    profit: number;
    ownerUserIds: Set<number>; // all userIds that have a row in this invoice
  };

  const invoiceMap = new Map<string, InvoiceRecord>();
  for (const [key, rows] of invoiceRowsMap.entries()) {
    const statuses = rows.map(r => r.status);
    const ownerUserIds = new Set<number>();
    let profit = 0;
    let createdAt = new Date(rows[0].createdAt);
    let updatedAt = new Date(rows[0].updatedAt);
    let adSource = rows[0].adSource ?? null;
    let adCampaign = rows[0].adCampaign ?? null;

    for (const r of rows) {
      if (r.createdByUserId) ownerUserIds.add(r.createdByUserId);
      profit += profitFromOrder(r);
      const upd = new Date(r.updatedAt);
      if (upd > updatedAt) updatedAt = upd;
    }

    invoiceMap.set(key, {
      invoiceKey: key,
      status: resolveInvoiceStatus(statuses),
      createdAt,
      updatedAt,
      adSource,
      adCampaign,
      profit,
      ownerUserIds: ownerUserIds.size > 0 ? ownerUserIds : new Set([0]), // 0 = unassigned
    });
  }

  return invoiceMap;
}


// ─── Team Performance ──────────────────────────────────────────────────────────
router.get("/analytics/team-performance", async (req, res): Promise<void> => {
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo   = req.query.dateTo   as string | undefined;
  const tenantId = getTenantId(req);

  const conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) conditions.push(eq(ordersTable.tenantId, tenantId));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db.select().from(ordersTable).where(and(...conditions));
  const invoiceMap = buildPerUserInvoices(rawOrders);

  // فلتر المستخدمين بالـ tenant
  const userConditions: any[] = [];
  if (tenantId !== null) userConditions.push(eq(usersTable.tenantId, tenantId));
  else userConditions.push(isNull(usersTable.tenantId));
  const users = await db.select().from(usersTable).where(and(...userConditions));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const stats: Record<number, {
    userId: number; userName: string; displayName: string;
    total: number; delivered: number; returned: number;
    delayed: number; inProgress: number;
    profit: number; deliveryRate: number; returnRate: number;
  }> = {};

  for (const inv of invoiceMap.values()) {
    for (const uid of inv.ownerUserIds) {
      if (!stats[uid]) {
        const user = uid ? userMap.get(uid) : null;
        stats[uid] = {
          userId: uid,
          userName:    user?.username    ?? "غير محدد",
          displayName: user?.displayName ?? "غير محدد",
          total: 0, delivered: 0, returned: 0, delayed: 0, inProgress: 0,
          profit: 0, deliveryRate: 0, returnRate: 0,
        };
      }
      const s = stats[uid];
      s.total++;
      // Profit: split evenly among owners so we don't double-count
      s.profit += inv.profit / inv.ownerUserIds.size;
      const bucket = classifyStatus(inv.status);
      if (bucket === "delivered")       s.delivered++;
      else if (bucket === "returned")   s.returned++;
      else if (bucket === "delayed")    s.delayed++;
      else                              s.inProgress++;
    }
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    pending: s.inProgress + s.delayed,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    returnRate:   s.total > 0 ? Math.round((s.returned  / s.total) * 100) : 0,
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});


// ─── Team Performance Extended ─────────────────────────────────────────────────
router.get("/analytics/team-performance-extended", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo   = req.query.dateTo   as string | undefined;

  const conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) conditions.push(eq(ordersTable.tenantId, tenantId));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db.select().from(ordersTable).where(and(...conditions));
  const invoiceMap = buildPerUserInvoices(rawOrders);

  const userConditions: any[] = [];
  if (tenantId !== null) userConditions.push(eq(usersTable.tenantId, tenantId));
  const users = userConditions.length > 0
    ? await db.select().from(usersTable).where(and(...userConditions))
    : await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  type ExtStats = {
    userId: number; userName: string; displayName: string;
    total: number; delivered: number; returned: number;
    delayed: number; inProgress: number;
    profit: number; deliveryRate: number; returnRate: number;
    avgProcessingHours: number | null;
    sourceCounts: Record<string, number>;
    topSource: string | null;
    ordersPerDay: number; score: number;
    _processingHoursSum: number; _processingCount: number;
    _firstOrder: Date | null; _lastOrder: Date | null;
  };

  const stats: Record<number, ExtStats> = {};

  for (const inv of invoiceMap.values()) {
    for (const uid of inv.ownerUserIds) {
      if (!stats[uid]) {
        const user = uid ? userMap.get(uid) : null;
        stats[uid] = {
          userId: uid,
          userName:    user?.username    ?? "غير محدد",
          displayName: user?.displayName ?? "غير محدد",
          total: 0, delivered: 0, returned: 0, delayed: 0, inProgress: 0,
          profit: 0, deliveryRate: 0, returnRate: 0,
          avgProcessingHours: null, sourceCounts: {}, topSource: null,
          ordersPerDay: 0, score: 0,
          _processingHoursSum: 0, _processingCount: 0,
          _firstOrder: null, _lastOrder: null,
        };
      }
      const s = stats[uid];
      s.total++;
      s.profit += inv.profit / inv.ownerUserIds.size;

      const oDate = new Date(inv.createdAt);
      if (!s._firstOrder || oDate < s._firstOrder) s._firstOrder = oDate;
      if (!s._lastOrder  || oDate > s._lastOrder)  s._lastOrder  = oDate;

      const src = inv.adSource ?? "organic";
      s.sourceCounts[src] = (s.sourceCounts[src] ?? 0) + 1;

      const bucket = classifyStatus(inv.status);
      if (bucket === "delivered") {
        s.delivered++;
        const diffHours = (inv.updatedAt.getTime() - inv.createdAt.getTime()) / 3600000;
        if (diffHours >= 0) { s._processingHoursSum += diffHours; s._processingCount++; }
      } else if (bucket === "returned")  { s.returned++; }
      else if (bucket === "delayed")     { s.delayed++; }
      else                               { s.inProgress++; }
    }
  }

  const result = Object.values(stats).map((s) => {
    const deliveryRate = s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0;
    const returnRate   = s.total > 0 ? Math.round((s.returned  / s.total) * 100) : 0;
    const avgProcessingHours = s._processingCount > 0
      ? Math.round(s._processingHoursSum / s._processingCount) : null;

    let topSource: string | null = null, topCount = 0;
    for (const [src, cnt] of Object.entries(s.sourceCounts)) {
      if (cnt > topCount) { topCount = cnt; topSource = src; }
    }

    let ordersPerDay = 0;
    if (s._firstOrder && s._lastOrder && s.total > 0) {
      const days = Math.max(1,
        Math.round((s._lastOrder.getTime() - s._firstOrder.getTime()) / 86400000) + 1);
      ordersPerDay = Math.round((s.total / days) * 10) / 10;
    }

    const score = (s.delivered * 3)
      + Math.max(0, Math.round(s.profit / 100))
      + (avgProcessingHours !== null && avgProcessingHours <= 24 ? s.delivered * 2 : 0)
      - (s.returned * 1);

    return {
      userId: s.userId, userName: s.userName, displayName: s.displayName,
      total: s.total,
      delivered:  s.delivered,
      returned:   s.returned,
      delayed:    s.delayed,
      inProgress: s.inProgress,
      pending: s.inProgress + s.delayed,
      profit: Math.round(s.profit),
      deliveryRate, returnRate,
      avgProcessingHours, sourceCounts: s.sourceCounts, topSource,
      ordersPerDay, score: Math.max(0, score),
    };
  });

  result.sort((a, b) => b.score - a.score);
  res.json(result);
});


// ─── Campaign / Ads Analytics ──────────────────────────────────────────────────
router.get("/analytics/campaigns", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo   = req.query.dateTo   as string | undefined;

  const conditions: any[] = [isNull(ordersTable.deletedAt)];
  if (tenantId !== null) conditions.push(eq(ordersTable.tenantId, tenantId));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const rawOrders = await db.select().from(ordersTable).where(and(...conditions));
  const invoiceMap = buildPerUserInvoices(rawOrders);

  type CampaignStats = {
    adSource: string; adCampaign: string | null;
    total: number; delivered: number; returned: number;
    delayed: number; inProgress: number;
    profit: number; deliveryRate: number; roi: number;
  };
  const stats: Record<string, CampaignStats> = {};

  for (const inv of invoiceMap.values()) {
    const src  = inv.adSource   ?? "organic";
    const camp = inv.adCampaign ?? null;
    const key  = `${src}||${camp ?? ""}`;

    if (!stats[key]) {
      stats[key] = {
        adSource: src, adCampaign: camp,
        total: 0, delivered: 0, returned: 0, delayed: 0, inProgress: 0,
        profit: 0, deliveryRate: 0, roi: 0,
      };
    }
    const s = stats[key];
    s.total++;
    s.profit += inv.profit;

    const bucket = classifyStatus(inv.status);
    if (bucket === "delivered")      s.delivered++;
    else if (bucket === "returned")  s.returned++;
    else if (bucket === "delayed")   s.delayed++;
    else                             s.inProgress++;
  }

  const result = Object.values(stats).map((s) => ({
    ...s,
    pending: s.inProgress + s.delayed,
    deliveryRate: s.total > 0 ? Math.round((s.delivered / s.total) * 100) : 0,
    roi: 0,
  }));

  result.sort((a, b) => b.profit - a.profit);
  res.json(result);
});

export default router;
