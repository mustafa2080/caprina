import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, productVariantsTable, shippingCompaniesTable, shippingManifestsTable } from "@workspace/db";
import { eq, isNull, and, desc, lte } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();

// ─── Dynamic cost resolver ──────────────────────────────────────────────────────
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
router.get("/analytics/profit", requireAdmin, async (req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── فلتر من/إلى ──
  const fromParam = req.query.from as string | undefined;
  const toParam   = req.query.to   as string | undefined;
  const period    = req.query.period as string | undefined;

  const [allOrdersRaw, products, variants] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  // تحديد نطاق الفلتر
  let filteredOrders = allOrdersRaw;
  if (fromParam || toParam || period) {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (period === "week") {
      fromDate = startOfWeek;
      toDate = now;
    } else if (period === "month") {
      fromDate = startOfMonth;
      toDate = now;
    } else if (period === "year") {
      fromDate = new Date(now.getFullYear(), 0, 1);
      toDate = now;
    } else if (fromParam || toParam) {
      fromDate = fromParam ? new Date(fromParam) : null;
      toDate   = toParam   ? new Date(new Date(toParam).setHours(23, 59, 59, 999)) : null;
    }

    filteredOrders = allOrdersRaw.filter(o => {
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  const allOrders = filteredOrders;

  const today = periodStats(filterByPeriod(allOrders, startOfToday), variantMap, productMap);
  const week = periodStats(filterByPeriod(allOrders, startOfWeek), variantMap, productMap);
  const month = periodStats(filterByPeriod(allOrders, startOfMonth), variantMap, productMap);
  const allTime = periodStats(allOrders, variantMap, productMap);

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
router.get("/analytics/financial-summary", requireAdmin, async (req, res): Promise<void> => {
  const fromParam = req.query.from as string | undefined;
  const toParam   = req.query.to   as string | undefined;
  const period    = req.query.period as string | undefined;
  const now = new Date();

  const [allOrdersRaw, products, variants, allManifests] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
    db.select({ manualShippingCost: shippingManifestsTable.manualShippingCost, createdAt: shippingManifestsTable.createdAt })
      .from(shippingManifestsTable),
  ]);

  // فلتر التاريخ
  let allOrders = allOrdersRaw;
  if (fromParam || toParam || period) {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (period === "week") {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      fromDate = new Date(now.getFullYear(), 0, 1);
    } else {
      fromDate = fromParam ? new Date(fromParam) : null;
      toDate   = toParam   ? new Date(new Date(toParam).setHours(23, 59, 59, 999)) : null;
    }
    allOrders = allOrdersRaw.filter(o => {
      const d = new Date(o.createdAt);
      if (fromDate && d < fromDate) return false;
      if (toDate   && d > toDate)   return false;
      return true;
    });
  }

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  // تكلفة الشحن اليدوية من البيانات (مفلترة بنفس الفترة الزمنية)
  let fromDate2: Date | null = null;
  let toDate2: Date | null = null;
  if (period === "today") {
    fromDate2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    toDate2 = now;
  } else if (period === "week") {
    fromDate2 = new Date(now); fromDate2.setDate(now.getDate() - 7);
    toDate2 = now;
  } else if (period === "month") {
    fromDate2 = new Date(now.getFullYear(), now.getMonth(), 1);
    toDate2 = now;
  }
  const manualShippingTotal = allManifests
    .filter(m => {
      if (!m.manualShippingCost) return false;
      if (!fromDate2 && !toDate2) return true;
      const d = new Date(m.createdAt);
      if (fromDate2 && d < fromDate2) return false;
      if (toDate2 && d > toDate2) return false;
      return true;
    })
    .reduce((sum, m) => sum + Number(m.manualShippingCost ?? 0), 0);

  let cashIn = 0, costOfGoods = 0, shippingSpend = 0;
  let returnLoss = 0, returnRevLost = 0, pendingRevenue = 0;

  const completedOrders: Array<{ profit: number; value: number; cost: number }> = [];

  for (const o of allOrders) {
    const rc = resolveCost(o, variantMap, productMap);
    const sc = o.shippingCost ?? 0;

    if (o.status === "received") {
      const revenue = o.quantity * o.unitPrice;
      const cost = o.quantity * rc;
      cashIn += revenue;
      costOfGoods += cost;
      shippingSpend += sc;
      completedOrders.push({ profit: revenue - cost - sc, value: revenue, cost: cost + sc });
    } else if (o.status === "partial_received") {
      const qty = o.partialQuantity ?? o.quantity;
      const revenue = qty * o.unitPrice;
      const cost = qty * rc;
      cashIn += revenue;
      costOfGoods += cost;
      shippingSpend += sc;
      completedOrders.push({ profit: revenue - cost - sc, value: revenue, cost: cost + sc });
    } else if (o.status === "returned") {
      const cost = o.quantity * rc;
      costOfGoods += cost;
      shippingSpend += sc;
      returnLoss += cost + sc;
      returnRevLost += o.quantity * o.unitPrice;
    } else if (o.status === "pending" || o.status === "in_shipping" || o.status === "delayed") {
      pendingRevenue += o.quantity * o.unitPrice;
    }
  }

  // أضف تكلفة الشحن اليدوية من البيانات (manualShippingCost) للـ shippingSpend
  shippingSpend += manualShippingTotal;

  const netProfit = cashIn - costOfGoods - shippingSpend;
  const grossProfit = cashIn - costOfGoods;
  const grossMargin = cashIn > 0 ? Math.round((grossProfit / cashIn) * 100) : 0;
  const netMargin = cashIn > 0 ? Math.round((netProfit / cashIn) * 100) : 0;

  // Order metrics
  const avgProfitPerOrder = completedOrders.length > 0
    ? Math.round(completedOrders.reduce((s, o) => s + o.profit, 0) / completedOrders.length)
    : 0;
  const avgOrderValue = completedOrders.length > 0
    ? Math.round(completedOrders.reduce((s, o) => s + o.value, 0) / completedOrders.length)
    : 0;
  const avgCostPerOrder = completedOrders.length > 0
    ? Math.round(completedOrders.reduce((s, o) => s + o.cost, 0) / completedOrders.length)
    : 0;

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
    cashIn, costOfGoods, shippingSpend, grossProfit, grossMargin, netProfit, netMargin,
    returnLoss, returnRevLost, pendingRevenue, returnCount, returnRate,
    totalOrders: allOrders.length,
    completedOrders: completedOrders.length,
    avgProfitPerOrder, avgOrderValue, avgCostPerOrder,
    inventoryAtCost, inventoryAtSell,
    potentialInventoryProfit: inventoryAtSell - inventoryAtCost,
  });
});

// ─── GET /api/analytics/product-performance ─────────────────────────────────────
// Full per-product breakdown: revenue, profit, returns, margin, avg price
router.get("/analytics/product-performance", requireAdmin, async (_req, res): Promise<void> => {
  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));
  // productId lookup by name
  const productIdByName = new Map<string, number>(products.map(p => [p.name.trim().toLowerCase(), p.id]));

  type ProductStats = {
    name: string;
    productId: number | null;
    totalOrders: number;
    completedOrders: number;
    totalSalesQty: number;
    totalRevenue: number;
    totalCost: number;
    totalShipping: number;
    returnCount: number;
    returnCostLoss: number;
    netProfit: number;
    avgSalePrice: number;
    margin: number;
    returnRate: number;
    roi: number;
  };

  const statsMap = new Map<string, Omit<ProductStats, "avgSalePrice" | "margin" | "returnRate" | "roi">>();

  for (const o of allOrders) {
    const key = o.product.trim();
    if (!statsMap.has(key)) {
      const pid = o.productId ?? productIdByName.get(key.toLowerCase()) ?? null;
      statsMap.set(key, {
        name: key, productId: pid,
        totalOrders: 0, completedOrders: 0, totalSalesQty: 0,
        totalRevenue: 0, totalCost: 0, totalShipping: 0,
        returnCount: 0, returnCostLoss: 0, netProfit: 0,
      });
    }

    const s = statsMap.get(key)!;
    const rc = resolveCost(o, variantMap, productMap);
    const sc = o.shippingCost ?? 0;
    s.totalOrders++;

    if (o.status === "received") {
      const qty = o.quantity;
      const rev = qty * o.unitPrice;
      const cost = qty * rc;
      s.completedOrders++;
      s.totalSalesQty += qty;
      s.totalRevenue += rev;
      s.totalCost += cost;
      s.totalShipping += sc;
      s.netProfit += rev - cost - sc;
    } else if (o.status === "partial_received") {
      const qty = o.partialQuantity ?? o.quantity;
      const rev = qty * o.unitPrice;
      const cost = qty * rc;
      s.completedOrders++;
      s.totalSalesQty += qty;
      s.totalRevenue += rev;
      s.totalCost += cost;
      s.totalShipping += sc;
      s.netProfit += rev - cost - sc;
    } else if (o.status === "returned") {
      const cost = o.quantity * rc;
      s.returnCount++;
      s.totalCost += cost;
      s.totalShipping += sc;
      s.returnCostLoss += cost + sc;
      s.netProfit -= cost + sc;
    }
  }

  const productList: ProductStats[] = Array.from(statsMap.values()).map(s => {
    const avgSalePrice = s.totalSalesQty > 0 ? Math.round(s.totalRevenue / s.totalSalesQty) : 0;
    const margin = s.totalRevenue > 0 ? Math.round((s.netProfit / s.totalRevenue) * 100) : 0;
    const returnRate = s.totalOrders > 0 ? Math.round((s.returnCount / s.totalOrders) * 100) : 0;
    const roi = s.totalCost > 0 ? Math.round((s.netProfit / s.totalCost) * 100) : 0;
    return { ...s, avgSalePrice, margin, returnRate, roi };
  });

  // Sort variants: by profit desc, by loss asc, by return rate desc
  const byProfit = [...productList].sort((a, b) => b.netProfit - a.netProfit);
  const byLoss = [...productList].filter(p => p.netProfit < 0).sort((a, b) => a.netProfit - b.netProfit);
  const byReturns = [...productList]
    .filter(p => p.returnCount > 0)
    .sort((a, b) => b.returnRate - a.returnRate || b.returnCount - a.returnCount);

  res.json({
    products: byProfit,
    byProfit,
    byLoss,
    byReturns,
    summary: {
      totalProducts: productList.length,
      profitableCount: productList.filter(p => p.netProfit > 0).length,
      losingCount: productList.filter(p => p.netProfit < 0).length,
      highReturnCount: productList.filter(p => p.returnRate >= 30).length,
      totalNetProfit: productList.reduce((s, p) => s + p.netProfit, 0),
      totalRevenue: productList.reduce((s, p) => s + p.totalRevenue, 0),
    },
  });
});

// ─── GET /api/analytics/alerts ──────────────────────────────────────────────────
// Smart automatic alerts: high returns, losing products, low stock, low margin
router.get("/analytics/alerts", async (_req, res): Promise<void> => {
  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  type Alert = {
    id: string;
    type: "HIGH_RETURN" | "LOSING_PRODUCT" | "LOW_STOCK" | "LOW_MARGIN" | "STALE_STOCK" | "NO_COST_DATA";
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    productName?: string;
    value?: number;
  };

  const alerts: Alert[] = [];

  // Build product stats for alerts
  const statsMap = new Map<string, { name: string; orders: number; returned: number; revenue: number; profit: number; costMissing: boolean }>();

  for (const o of allOrders) {
    const key = o.product.trim();
    if (!statsMap.has(key)) {
      statsMap.set(key, { name: key, orders: 0, returned: 0, revenue: 0, profit: 0, costMissing: false });
    }
    const s = statsMap.get(key)!;
    const rc = resolveCost(o, variantMap, productMap);
    if (rc === 0) s.costMissing = true;

    s.orders++;
    if (o.status === "returned") {
      s.returned++;
      s.profit -= (o.quantity * rc) + (o.shippingCost ?? 0);
    } else if (o.status === "received" || o.status === "partial_received") {
      const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
      const rev = qty * o.unitPrice;
      const cost = qty * rc;
      const sc = o.shippingCost ?? 0;
      s.revenue += rev;
      s.profit += rev - cost - sc;
    }
  }

  for (const [, s] of statsMap) {
    const returnRate = s.orders > 0 ? (s.returned / s.orders) * 100 : 0;
    const margin = s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0;

    // Alert: high return rate (>= 30%, min 2 orders)
    if (s.orders >= 2 && returnRate >= 30) {
      alerts.push({
        id: `high_return_${s.name}`,
        type: "HIGH_RETURN",
        severity: returnRate >= 50 ? "high" : "medium",
        title: `نسبة إرجاع عالية`,
        detail: `${s.name} — ${Math.round(returnRate)}% مرتجع (${s.returned} من ${s.orders} طلب)`,
        productName: s.name,
        value: Math.round(returnRate),
      });
    }

    // Alert: losing product (negative profit, at least 1 completed order)
    if (s.profit < 0 && s.orders - s.returned > 0) {
      alerts.push({
        id: `losing_${s.name}`,
        type: "LOSING_PRODUCT",
        severity: s.profit < -500 ? "high" : "medium",
        title: `منتج خاسر`,
        detail: `${s.name} — خسارة ${Math.abs(Math.round(s.profit))} ج.م`,
        productName: s.name,
        value: Math.round(s.profit),
      });
    }

    // Alert: low margin (<= 10% and > 0, has sales)
    if (s.revenue > 0 && margin > 0 && margin <= 10) {
      alerts.push({
        id: `low_margin_${s.name}`,
        type: "LOW_MARGIN",
        severity: "low",
        title: `هامش ربح منخفض`,
        detail: `${s.name} — هامش ${Math.round(margin)}% فقط`,
        productName: s.name,
        value: Math.round(margin),
      });
    }

    // Alert: no cost data (orders exist but cost unknown)
    if (s.costMissing && s.orders > 0) {
      alerts.push({
        id: `no_cost_${s.name}`,
        type: "NO_COST_DATA",
        severity: "low",
        title: `بيانات تكلفة ناقصة`,
        detail: `${s.name} — لا يوجد سعر تكلفة، الأرباح غير دقيقة`,
        productName: s.name,
      });
    }
  }

  // Low stock alerts (products + variants)
  for (const p of products) {
    const avail = p.totalQuantity - p.reservedQuantity - p.soldQuantity;
    if (avail <= p.lowStockThreshold && p.totalQuantity > 0) {
      alerts.push({
        id: `low_stock_p_${p.id}`,
        type: "LOW_STOCK",
        severity: avail <= 0 ? "high" : "medium",
        title: avail <= 0 ? `نفد المخزون` : `مخزون منخفض`,
        detail: `${p.name} — ${avail <= 0 ? "نفد الستوك" : `باقي ${avail} وحدة`}`,
        productName: p.name,
        value: avail,
      });
    }
  }

  for (const v of variants) {
    const avail = v.totalQuantity - v.reservedQuantity - v.soldQuantity;
    if (avail <= v.lowStockThreshold && v.totalQuantity > 0) {
      const label = [v.color, v.size].filter(Boolean).join(" / ");
      alerts.push({
        id: `low_stock_v_${v.id}`,
        type: "LOW_STOCK",
        severity: avail <= 0 ? "high" : "medium",
        title: avail <= 0 ? `نفد المخزون` : `مخزون منخفض`,
        detail: `متغير ${label} — ${avail <= 0 ? "نفد الستوك" : `باقي ${avail} وحدة`}`,
        value: avail,
      });
    }
  }

  // Sort: high → medium → low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  res.json({
    alerts,
    counts: {
      total: alerts.length,
      high: alerts.filter(a => a.severity === "high").length,
      medium: alerts.filter(a => a.severity === "medium").length,
      low: alerts.filter(a => a.severity === "low").length,
    },
  });
});

// ─── GET /api/analytics/stock-intelligence ──────────────────────────────────────
// Stock velocity (units/day), days until stockout, frozen capital
router.get("/analytics/stock-intelligence", async (_req, res): Promise<void> => {
  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  // Calculate sales velocity per product name
  // Use last 30 days sold qty to estimate daily velocity
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Days since first order per product (to determine active period)
  const firstOrderDate = new Map<string, Date>();
  const last30DaysSales = new Map<string, number>();
  const allTimeSales = new Map<string, number>();

  for (const o of allOrders) {
    const key = o.product.trim();
    const oDate = new Date(o.createdAt);

    if (!firstOrderDate.has(key) || oDate < firstOrderDate.get(key)!) {
      firstOrderDate.set(key, oDate);
    }

    if (o.status === "received" || o.status === "partial_received") {
      const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
      allTimeSales.set(key, (allTimeSales.get(key) ?? 0) + qty);
      if (oDate >= thirtyDaysAgo) {
        last30DaysSales.set(key, (last30DaysSales.get(key) ?? 0) + qty);
      }
    }
  }

  type StockItem = {
    name: string;
    productId: number | null;
    availableQty: number;
    reservedQty: number;
    soldQty: number;
    costPrice: number;
    unitPrice: number;
    last30DaysSales: number;
    velocityPerDay: number;      // units sold per day (last 30d)
    daysUntilStockout: number | null; // null = never sold / infinite
    category: "out" | "fast" | "medium" | "slow" | "stale";
    frozenCapital: number;       // availableQty × costPrice
    potentialRevenue: number;    // availableQty × unitPrice
  };

  const items: StockItem[] = products.map(p => {
    const key = p.name.trim();
    const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
    const sold30 = last30DaysSales.get(key) ?? 0;
    const costPrice = (productMap.get(p.id) ?? 0);

    // Velocity: avg per day over last 30 days
    const velocity = sold30 / 30;

    let daysUntilStockout: number | null = null;
    if (avail <= 0) {
      daysUntilStockout = 0;
    } else if (velocity > 0) {
      daysUntilStockout = Math.round(avail / velocity);
    }

    let category: StockItem["category"] = "stale";
    if (avail <= 0) {
      category = "out";
    } else if (daysUntilStockout !== null) {
      if (daysUntilStockout <= 7) category = "fast";
      else if (daysUntilStockout <= 30) category = "medium";
      else category = "slow";
    }

    return {
      name: key,
      productId: p.id,
      availableQty: avail,
      reservedQty: p.reservedQuantity,
      soldQty: p.soldQuantity,
      costPrice,
      unitPrice: p.unitPrice,
      last30DaysSales: sold30,
      velocityPerDay: Math.round(velocity * 100) / 100,
      daysUntilStockout,
      category,
      frozenCapital: avail * costPrice,
      potentialRevenue: avail * p.unitPrice,
    };
  });

  // Sort: fast first (most urgent), then medium, slow, stale, out
  const categoryOrder = { fast: 0, medium: 1, slow: 2, stale: 3, out: 4 };
  items.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category] || b.velocityPerDay - a.velocityPerDay);

  const totalFrozenCapital = items.filter(i => i.category === "slow" || i.category === "stale").reduce((s, i) => s + i.frozenCapital, 0);
  const totalFastMovers = items.filter(i => i.category === "fast").length;
  const totalSlowMovers = items.filter(i => i.category === "slow" || i.category === "stale").length;

  res.json({
    items,
    summary: {
      totalProducts: items.length,
      fastMovers: totalFastMovers,
      slowMovers: totalSlowMovers,
      outOfStock: items.filter(i => i.category === "out").length,
      totalFrozenCapital,
    },
  });
});

// ─── GET /api/analytics/smart-insights ──────────────────────────────────────
// Comprehensive smart analytics: ad attribution, stars, dead stock,
// return insights, stock predictor
router.get("/analytics/smart-insights", async (_req, res): Promise<void> => {
  const [allOrders, products, variants] = await Promise.all([
    db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)),
    db.select().from(productsTable),
    db.select().from(productVariantsTable),
  ]);

  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));
  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── 1. Ad Attribution ────────────────────────────────────────────────────────
  const sourceMap: Record<string, { orders: number; revenue: number; cost: number; profit: number; adSpend: number; returned: number }> = {};

  for (const o of allOrders) {
    const src = o.adSource ?? "organic";
    if (!sourceMap[src]) sourceMap[src] = { orders: 0, revenue: 0, cost: 0, profit: 0, adSpend: 0, returned: 0 };
    const s = sourceMap[src];
    const rc = resolveCost(o, variantMap, productMap);
    s.orders++;
    if (o.status === "returned") {
      s.returned++;
      const p = calcOrderProfit(o, rc);
      s.cost += p.cost;
      s.profit += p.netProfit;
    } else if (o.status === "received" || o.status === "partial_received") {
      const p = calcOrderProfit(o, rc);
      s.revenue += p.revenue;
      s.cost += p.cost;
      s.profit += p.netProfit;
    }
  }

  const adBreakdown = Object.entries(sourceMap)
    .map(([source, s]) => ({
      source,
      orders: s.orders,
      revenue: Math.round(s.revenue),
      profit: Math.round(s.profit),
      returnRate: s.orders > 0 ? Math.round((s.returned / s.orders) * 100) : 0,
      roi: s.cost > 0 ? Math.round(((s.profit) / s.cost) * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  const bestSource = adBreakdown.length > 0 ? adBreakdown[0] : null;

  // ── 2. Stars vs Dead Stock ───────────────────────────────────────────────────
  const productStatsMap: Record<string, {
    name: string; revenue: number; cost: number; profit: number;
    quantity: number; orderCount: number; returnCount: number;
  }> = {};

  for (const o of allOrders) {
    const key = o.product.trim();
    if (!productStatsMap[key]) {
      productStatsMap[key] = { name: key, revenue: 0, cost: 0, profit: 0, quantity: 0, orderCount: 0, returnCount: 0 };
    }
    const pm = productStatsMap[key];
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

  // Track last sale date and 30d sales per product name
  const lastSaleDate = new Map<string, Date>();
  const sales30d = new Map<string, number>();

  for (const o of allOrders) {
    if (o.status === "received" || o.status === "partial_received") {
      const key = o.product.trim();
      const oDate = new Date(o.createdAt);
      if (!lastSaleDate.has(key) || oDate > lastSaleDate.get(key)!) {
        lastSaleDate.set(key, oDate);
      }
      if (oDate >= thirtyDaysAgo) {
        const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
        sales30d.set(key, (sales30d.get(key) ?? 0) + qty);
      }
    }
  }

  const productList = Object.values(productStatsMap).map(p => ({
    ...p,
    returnRate: p.orderCount > 0 ? Math.round((p.returnCount / p.orderCount) * 100) : 0,
    margin: p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0,
    revenue: Math.round(p.revenue),
    cost: Math.round(p.cost),
    profit: Math.round(p.profit),
  }));

  const stars = productList
    .filter(p => p.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  // Dead stock: products with available inventory but fewer than 5 units sold in 30d
  const deadStock = products
    .map(p => {
      const key = p.name.trim();
      const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
      const s30 = sales30d.get(key) ?? 0;
      const last = lastSaleDate.get(key);
      const daysSinceLastSale = last
        ? Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const frozenCapital = avail * (p.costPrice ?? 0);
      return { name: key, availableQty: avail, frozenCapital: Math.round(frozenCapital), last30DaysSales: s30, daysSinceLastSale };
    })
    .filter(p => p.availableQty > 0 && p.last30DaysSales < 5)
    .sort((a, b) => b.frozenCapital - a.frozenCapital)
    .slice(0, 8);

  // ── 3. Return Insights ───────────────────────────────────────────────────────
  const returnedOrders = allOrders.filter(o => o.status === "returned");
  const reasonCount: Record<string, number> = {};
  let noReasonCount = 0;

  for (const o of returnedOrders) {
    const reason = o.returnReason ?? "__none__";
    if (reason === "__none__") { noReasonCount++; continue; }
    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
  }

  const REASON_LABELS: Record<string, string> = {
    size_mismatch: "مقاس غير مناسب",
    quality: "جودة المنتج",
    customer_refused: "رفض العميل",
    other: "سبب آخر",
  };

  const totalReturns = returnedOrders.length;
  const byReason = [
    ...Object.entries(reasonCount).map(([reason, count]) => ({
      reason,
      label: REASON_LABELS[reason] ?? reason,
      count,
      pct: totalReturns > 0 ? Math.round((count / totalReturns) * 100) : 0,
    })),
    ...(noReasonCount > 0 ? [{ reason: "__none__", label: "غير محدد", count: noReasonCount, pct: Math.round((noReasonCount / totalReturns) * 100) }] : []),
  ].sort((a, b) => b.count - a.count);

  const totalOrderCount = allOrders.length;
  const totalReturnRate = totalOrderCount > 0 ? Math.round((totalReturns / totalOrderCount) * 100) : 0;

  // High return products (>= 50%, min 3 orders)
  const highReturnProducts = productList
    .filter(p => p.orderCount >= 3 && p.returnRate >= 50)
    .sort((a, b) => b.returnRate - a.returnRate)
    .map(p => ({ name: p.name, returnRate: p.returnRate, returnCount: p.returnCount, orderCount: p.orderCount }));

  // ── 4. Stock Predictor ───────────────────────────────────────────────────────
  const stockPredictor = products
    .map(p => {
      const key = p.name.trim();
      const avail = Math.max(0, p.totalQuantity - p.reservedQuantity - p.soldQuantity);
      const sold30 = sales30d.get(key) ?? 0;
      const velocity = sold30 / 30;
      const daysUntilStockout = avail > 0 && velocity > 0 ? Math.round(avail / velocity) : null;
      const frozenCapital = avail * (p.costPrice ?? 0);
      return { name: key, availableQty: avail, velocityPerDay: Math.round(velocity * 100) / 100, daysUntilStockout, frozenCapital: Math.round(frozenCapital) };
    })
    .filter(p => p.daysUntilStockout !== null && p.daysUntilStockout <= 14 && p.availableQty > 0)
    .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999))
    .slice(0, 8);

  res.json({
    adAttribution: { bestSource, breakdown: adBreakdown },
    stars,
    deadStock,
    returnInsights: { byReason, highReturnProducts, totalReturnRate, totalReturns },
    stockPredictor,
  });
});

// ─── GET /api/analytics/charts ──────────────────────────────────────────────
// Returns all data needed for visual charts: status breakdown, weekly sales, ad sources
router.get("/analytics/charts", async (_req, res): Promise<void> => {
  const allOrders = await db
    .select()
    .from(ordersTable)
    .where(isNull(ordersTable.deletedAt));

  // 1. Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const o of allOrders) {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  }
  const total = allOrders.length;
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  // 2. Weekly sales — last 7 days (today + 6 previous), counting by createdAt date
  const days: { date: string; label: string; orders: number; revenue: number }[] = [];
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, label: dayNames[d.getDay()], orders: 0, revenue: 0 });
  }
  for (const o of allOrders) {
    const dateStr = new Date(o.createdAt).toISOString().split("T")[0];
    const day = days.find(d => d.date === dateStr);
    if (day) {
      day.orders += 1;
      // only count revenue from completed orders
      if (o.status === "received" || o.status === "partial_received") {
        const qty = o.status === "partial_received" ? (o.partialQuantity ?? o.quantity) : o.quantity;
        day.revenue += qty * o.unitPrice;
      }
    }
  }

  // 3. Ad source breakdown
  const sourceCounts: Record<string, number> = {};
  for (const o of allOrders) {
    const src = o.adSource ?? "other";
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const adSourceBreakdown = Object.entries(sourceCounts)
    .map(([source, count]) => ({
      source,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  res.json({ statusBreakdown, weeklySales: days, adSourceBreakdown, total });
});

// ─── GET /api/analytics/shipping-followup ───────────────────────────────────
// Returns in_shipping orders that have been pending for > 3 days
router.get("/analytics/shipping-followup", async (_req, res): Promise<void> => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        isNull(ordersTable.deletedAt),
        eq(ordersTable.status, "in_shipping" as any),
        lte(ordersTable.updatedAt, threeDaysAgo),
      )
    )
    .orderBy(desc(ordersTable.updatedAt));

  const shippingCompanies = await db.select().from(shippingCompaniesTable);
  const companyMap = new Map(shippingCompanies.map(c => [c.id, c.name]));

  const result = orders.map(o => ({
    id: o.id,
    customerName: o.customerName,
    phone: o.phone,
    product: o.product,
    city: o.city,
    trackingNumber: o.trackingNumber,
    shippingCompany: o.shippingCompanyId ? companyMap.get(o.shippingCompanyId) ?? null : null,
    daysPending: Math.floor((Date.now() - new Date(o.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
    totalPrice: o.totalPrice,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }));

  res.json(result);
});

export default router;
