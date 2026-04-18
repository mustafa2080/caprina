import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, productVariantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─── Dynamic cost resolver ──────────────────────────────────────────────────────
// For each order, we use the CURRENT cost from the linked product/variant.
// If no product/variant linked (or cost not set there), we fall back to order's own costPrice.
// This means changing a product's cost price automatically updates all profit calculations.

function resolveCost(
  order: { costPrice: number | null; variantId: number | null; productId: number | null },
  variantMap: Map<number, number | null>,
  productMap: Map<number, number | null>,
): number {
  if (order.variantId && variantMap.has(order.variantId)) {
    const variantCost = variantMap.get(order.variantId);
    if (variantCost !== null && variantCost !== undefined && variantCost > 0) return variantCost;
  }
  if (order.productId && productMap.has(order.productId)) {
    const productCost = productMap.get(order.productId);
    if (productCost !== null && productCost !== undefined && productCost > 0) return productCost;
  }
  return order.costPrice ?? 0;
}

// ─── Profit calculation ─────────────────────────────────────────────────────────
function calcOrderProfit(
  order: {
    status: string;
    quantity: number;
    partialQuantity: number | null;
    unitPrice: number;
    shippingCost: number | null;
  },
  resolvedCost: number,
): { revenue: number; cost: number; shippingCost: number; netProfit: number } {
  const sc = order.shippingCost ?? 0;

  if (order.status === "received") {
    const revenue = order.quantity * order.unitPrice;
    const cost = order.quantity * resolvedCost;
    return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
  }
  if (order.status === "partial_received") {
    const qty = order.partialQuantity ?? order.quantity;
    const revenue = qty * order.unitPrice;
    const cost = qty * resolvedCost;
    return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
  }
  if (order.status === "returned") {
    const cost = order.quantity * resolvedCost;
    return { revenue: 0, cost, shippingCost: sc, netProfit: -(cost + sc) };
  }
  // pending / in_shipping / delayed — projected
  const revenue = order.quantity * order.unitPrice;
  const cost = order.quantity * resolvedCost;
  return { revenue, cost, shippingCost: sc, netProfit: revenue - cost - sc };
}

function filterByPeriod(orders: any[], from: Date) {
  return orders.filter(o => new Date(o.createdAt) >= from);
}

function periodStats(
  orders: any[],
  variantMap: Map<number, number | null>,
  productMap: Map<number, number | null>,
) {
  const completed = orders.filter(o => o.status === "received" || o.status === "partial_received");
  const returned = orders.filter(o => o.status === "returned");

  let revenue = 0, cost = 0, shipping = 0, netProfit = 0;
  for (const o of completed) {
    const rc = resolveCost(o, variantMap, productMap);
    const p = calcOrderProfit(o, rc);
    revenue += p.revenue;
    cost += p.cost;
    shipping += p.shippingCost;
    netProfit += p.netProfit;
  }
  for (const o of returned) {
    const rc = resolveCost(o, variantMap, productMap);
    const p = calcOrderProfit(o, rc);
    cost += p.cost;
    shipping += p.shippingCost;
    netProfit += p.netProfit;
  }

  const totalOrders = orders.length;
  const returnRate = totalOrders > 0 ? Math.round((returned.length / totalOrders) * 100) : 0;

  return { orders: totalOrders, revenue, cost, shippingCost: shipping, netProfit, returnRate, returnCount: returned.length };
}

// ─── GET /api/analytics/profit ──────────────────────────────────────────────────
router.get("/analytics/profit", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  // Build lookup maps: current cost from products/variants
  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  // Period stats
  const today = periodStats(filterByPeriod(allOrders, startOfToday), variantMap, productMap);
  const week = periodStats(filterByPeriod(allOrders, startOfWeek), variantMap, productMap);
  const month = periodStats(filterByPeriod(allOrders, startOfMonth), variantMap, productMap);
  const allTime = periodStats(allOrders, variantMap, productMap);

  // Top products by profit
  const productProfitMap: Record<string, {
    name: string; revenue: number; cost: number; profit: number;
    quantity: number; orderCount: number; returnCount: number;
  }> = {};

  for (const o of allOrders) {
    const key = o.product;
    if (!productProfitMap[key]) {
      productProfitMap[key] = { name: o.product, revenue: 0, cost: 0, profit: 0, quantity: 0, orderCount: 0, returnCount: 0 };
    }
    const pm = productProfitMap[key];
    const rc = resolveCost(o, variantMap, productMap);
    pm.orderCount++;
    if (o.status === "returned") {
      pm.returnCount++;
      const p = calcOrderProfit(o, rc);
      pm.cost += p.cost;
      pm.profit += p.netProfit;
    } else if (o.status === "received" || o.status === "partial_received") {
      const p = calcOrderProfit(o, rc);
      const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
      pm.revenue += p.revenue;
      pm.cost += p.cost;
      pm.profit += p.netProfit;
      pm.quantity += qty;
    }
  }

  const productList = Object.values(productProfitMap).map(p => ({
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

  // Inventory value: use variants first, fall back to product-level
  const variantInventoryValue = variants.reduce((s, v) => {
    const avail = Math.max(0, v.totalQuantity - v.reservedQuantity - v.soldQuantity);
    return s + avail * (v.costPrice ?? 0);
  }, 0);

  const productInventoryValue = products.reduce((s, p) => {
    const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
    return s + avail * (p.costPrice ?? 0);
  }, 0);

  const inventoryValue = {
    byProduct: productInventoryValue,
    byVariant: variantInventoryValue,
    total: variantInventoryValue + productInventoryValue,
    totalUnits: products.reduce((s, p) => s + Math.max(0, p.totalQuantity - p.soldQuantity), 0),
    lowStock: products.filter(p => (p.totalQuantity - p.reservedQuantity - p.soldQuantity) <= p.lowStockThreshold),
  };

  res.json({ today, week, month, allTime, topProducts, losingProducts, inventoryValue });
});

// ─── GET /api/analytics/financial-summary ──────────────────────────────────────
// Comprehensive financial view: real money in/out, net profit, losses from returns
router.get("/analytics/financial-summary", async (_req, res): Promise<void> => {
  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  let cashIn = 0;         // actual money received (received orders)
  let costOfGoods = 0;    // total cost of goods sold
  let shippingSpend = 0;  // total shipping paid
  let returnLoss = 0;     // loss from returns (cost + shipping on returned orders)
  let returnRevLost = 0;  // revenue that was expected but lost to returns
  let pendingRevenue = 0; // money in pipeline (pending/in_shipping orders)

  for (const o of allOrders) {
    const rc = resolveCost(o, variantMap, productMap);
    const sc = o.shippingCost ?? 0;

    if (o.status === "received") {
      cashIn += o.quantity * o.unitPrice;
      costOfGoods += o.quantity * rc;
      shippingSpend += sc;
    } else if (o.status === "partial_received") {
      const qty = o.partialQuantity ?? o.quantity;
      cashIn += qty * o.unitPrice;
      costOfGoods += qty * rc;
      shippingSpend += sc;
    } else if (o.status === "returned") {
      costOfGoods += o.quantity * rc;
      shippingSpend += sc;
      returnLoss += (o.quantity * rc) + sc;
      returnRevLost += o.quantity * o.unitPrice;
    } else if (o.status === "pending" || o.status === "in_shipping" || o.status === "delayed") {
      pendingRevenue += o.quantity * o.unitPrice;
    }
  }

  const netProfit = cashIn - costOfGoods - shippingSpend;
  const grossProfit = cashIn - costOfGoods;
  const grossMargin = cashIn > 0 ? Math.round((grossProfit / cashIn) * 100) : 0;
  const netMargin = cashIn > 0 ? Math.round((netProfit / cashIn) * 100) : 0;

  // Inventory value
  const inventoryAtCost = variants.reduce((s, v) => {
    const avail = Math.max(0, v.totalQuantity - v.reservedQuantity - v.soldQuantity);
    return s + avail * (v.costPrice ?? 0);
  }, 0) + products.reduce((s, p) => {
    const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
    return s + avail * (p.costPrice ?? 0);
  }, 0);

  const inventoryAtSell = variants.reduce((s, v) => {
    const avail = Math.max(0, v.totalQuantity - v.reservedQuantity - v.soldQuantity);
    return s + avail * v.unitPrice;
  }, 0) + products.reduce((s, p) => {
    const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
    return s + avail * p.unitPrice;
  }, 0);

  const returnCount = allOrders.filter(o => o.status === "returned").length;
  const returnRate = allOrders.length > 0 ? Math.round((returnCount / allOrders.length) * 100) : 0;

  res.json({
    cashIn,
    costOfGoods,
    shippingSpend,
    grossProfit,
    grossMargin,
    netProfit,
    netMargin,
    returnLoss,
    returnRevLost,
    pendingRevenue,
    returnCount,
    returnRate,
    totalOrders: allOrders.length,
    inventoryAtCost,
    inventoryAtSell,
    potentialInventoryProfit: inventoryAtSell - inventoryAtCost,
  });
});

export default router;
