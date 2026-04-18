import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, productVariantsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── Profit helpers ────────────────────────────────────────────────────────────

function calcOrderProfit(order: {
  status: string;
  quantity: number;
  partialQuantity: number | null;
  unitPrice: number;
  costPrice: number | null;
  shippingCost: number | null;
}): { revenue: number; cost: number; shippingCost: number; netProfit: number } {
  const cp = order.costPrice ?? 0;
  const sc = order.shippingCost ?? 0;

  if (order.status === "received") {
    const revenue = order.quantity * order.unitPrice;
    const cost = order.quantity * cp;
    return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
  }
  if (order.status === "partial_received") {
    const qty = order.partialQuantity ?? order.quantity;
    const revenue = qty * order.unitPrice;
    const cost = qty * cp;
    return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
  }
  if (order.status === "returned") {
    const cost = order.quantity * cp;
    return { revenue: 0, cost, shippingCost: sc, netProfit: -(cost + sc) };
  }
  // pending / in_shipping / delayed — projected
  const revenue = order.quantity * order.unitPrice;
  const cost = order.quantity * cp;
  return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
}

function filterByPeriod(orders: any[], from: Date) {
  return orders.filter(o => new Date(o.createdAt) >= from);
}

function periodStats(orders: any[]) {
  const completed = orders.filter(o => o.status === "received" || o.status === "partial_received");
  const returned = orders.filter(o => o.status === "returned");
  const active = orders.filter(o => o.status !== "returned");

  let revenue = 0, cost = 0, shipping = 0, netProfit = 0;
  for (const o of completed) {
    const p = calcOrderProfit(o);
    revenue += p.revenue;
    cost += p.cost;
    shipping += p.shippingCost;
    netProfit += p.netProfit;
  }
  for (const o of returned) {
    const p = calcOrderProfit(o);
    cost += p.cost;
    shipping += p.shippingCost;
    netProfit += p.netProfit;
  }

  const totalOrders = orders.length;
  const returnRate = totalOrders > 0 ? Math.round((returned.length / totalOrders) * 100) : 0;

  return { orders: totalOrders, revenue, cost, shippingCost: shipping, netProfit, returnRate, returnCount: returned.length };
}

// ─── GET /api/analytics/profit ─────────────────────────────────────────────────
router.get("/analytics/profit", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [all, products, variants] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  // Period stats
  const today = periodStats(filterByPeriod(all, startOfToday));
  const week = periodStats(filterByPeriod(all, startOfWeek));
  const month = periodStats(filterByPeriod(all, startOfMonth));
  const allTime = periodStats(all);

  // Top products by profit
  const productMap: Record<string, {
    name: string; revenue: number; cost: number; profit: number;
    quantity: number; orderCount: number; returnCount: number;
  }> = {};

  for (const o of all) {
    if (!productMap[o.product]) {
      productMap[o.product] = { name: o.product, revenue: 0, cost: 0, profit: 0, quantity: 0, orderCount: 0, returnCount: 0 };
    }
    const pm = productMap[o.product];
    pm.orderCount++;
    if (o.status === "returned") {
      pm.returnCount++;
      const p = calcOrderProfit(o);
      pm.cost += p.cost;
      pm.profit += p.netProfit;
    } else if (o.status === "received" || o.status === "partial_received") {
      const p = calcOrderProfit(o);
      const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
      pm.revenue += p.revenue;
      pm.cost += p.cost;
      pm.profit += p.netProfit;
      pm.quantity += qty;
    }
  }

  const productList = Object.values(productMap).map(p => ({
    ...p,
    returnRate: p.orderCount > 0 ? Math.round((p.returnCount / p.orderCount) * 100) : 0,
    margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0,
  }));

  const topProducts = productList
    .filter(p => p.quantity > 0 || p.returnCount > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10);

  const losingProducts = productList
    .filter(p => p.orderCount >= 2 && p.returnRate > 30)
    .sort((a, b) => b.returnRate - a.returnRate)
    .slice(0, 5);

  // Inventory value
  const inventoryValue = {
    byProduct: products.reduce((s, p) => {
      const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
      return s + avail * (p.costPrice ?? p.unitPrice * 0.6);
    }, 0),
    totalUnits: products.reduce((s, p) => s + Math.max(0, p.totalQuantity - p.soldQuantity), 0),
    lowStock: products.filter(p => (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold),
  };

  res.json({ today, week, month, allTime, topProducts, losingProducts, inventoryValue });
});

export default router;
