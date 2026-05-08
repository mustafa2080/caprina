import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and, sql, lt, isNull } from "drizzle-orm";
import { db, expensesTable, shippingFinancialInvoicesTable, ordersTable, shippingManifestsTable, shippingManifestOrdersTable, purchasesTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

// ── Expenses ────────────────────────────────────────────────────────────────
const ExpenseSchema = z.object({
  title: z.string().min(1),
  category: z.string().default("other"),
  amount: z.number().min(0),
  referenceId: z.string().nullish(),
  supplierId: z.number().nullish(),
  shippingCompanyId: z.number().nullish(),
  notes: z.string().nullish(),
  expenseDate: z.string(),
});

router.get("/finance/expenses", async (req, res): Promise<void> => {
  const { from, to, category } = req.query;
  const conditions = [];
  if (from) conditions.push(gte(expensesTable.expenseDate, new Date(from as string)));
  if (to) conditions.push(lte(expensesTable.expenseDate, new Date(to as string)));
  if (category) conditions.push(eq(expensesTable.category, category as string));
  const expenses = conditions.length
    ? await db.select().from(expensesTable).where(and(...conditions)).orderBy(desc(expensesTable.expenseDate))
    : await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate));
  res.json(expenses);
});

router.post("/finance/expenses", async (req, res): Promise<void> => {
  const parsed = ExpenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const user = (req as any).user;
  const result = await db.insert(expensesTable).values({
    ...parsed.data,
    expenseDate: new Date(parsed.data.expenseDate),
    createdByUserId: user?.id,
    createdByName: user?.displayName,
    createdAt: now,
  });
  const id = (result as any)[0]?.insertId;
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  res.status(201).json(expense);
});

router.delete("/finance/expenses/:id", async (req, res): Promise<void> => {
  await db.delete(expensesTable).where(eq(expensesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// ── Shipping Financial Invoices ─────────────────────────────────────────────
const ShipInvSchema = z.object({
  invoiceNumber: z.string().min(1),
  shippingCompanyId: z.number(),
  manifestId: z.number().nullish(),
  periodFrom: z.string().nullish(),
  periodTo: z.string().nullish(),
  totalOrders: z.number().int().default(0),
  deliveredOrders: z.number().int().default(0),
  returnedOrders: z.number().int().default(0),
  grossRevenue: z.number().default(0),
  shippingFees: z.number().default(0),
  returnFees: z.number().default(0),
  netDue: z.number().default(0),
  notes: z.string().nullish(),
  invoiceDate: z.string(),
  dueDate: z.string().nullish(),
});

router.get("/finance/shipping-invoices", async (_req, res): Promise<void> => {
  const invoices = await db.select().from(shippingFinancialInvoicesTable).orderBy(desc(shippingFinancialInvoicesTable.invoiceDate));
  res.json(invoices);
});

router.post("/finance/shipping-invoices", async (req, res): Promise<void> => {
  const parsed = ShipInvSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const user = (req as any).user;
  const data = parsed.data;
  const result = await db.insert(shippingFinancialInvoicesTable).values({
    ...data,
    grossRevenue: String(data.grossRevenue),
    shippingFees: String(data.shippingFees),
    returnFees: String(data.returnFees),
    netDue: String(data.netDue),
    paidAmount: "0",
    status: "pending",
    invoiceDate: new Date(data.invoiceDate),
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    periodFrom: data.periodFrom ? new Date(data.periodFrom) : undefined,
    periodTo: data.periodTo ? new Date(data.periodTo) : undefined,
    createdByUserId: user?.id,
    createdByName: user?.displayName,
    createdAt: now,
    updatedAt: now,
  });
  const id = (result as any)[0]?.insertId;
  const [inv] = await db.select().from(shippingFinancialInvoicesTable).where(eq(shippingFinancialInvoicesTable.id, id));
  res.status(201).json(inv);
});

router.patch("/finance/shipping-invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, paidAmount } = req.body;
  const updates: any = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (paidAmount !== undefined) { updates.paidAmount = String(paidAmount); if (parseFloat(paidAmount) > 0) updates.paidAt = new Date(); }
  await db.update(shippingFinancialInvoicesTable).set(updates).where(eq(shippingFinancialInvoicesTable.id, id));
  const [inv] = await db.select().from(shippingFinancialInvoicesTable).where(eq(shippingFinancialInvoicesTable.id, id));
  res.json(inv);
});

// ── Finance Dashboard Summary ───────────────────────────────────────────────
router.get("/finance/summary", async (req, res): Promise<void> => {
  const { from, to } = req.query;
  const dateFrom = from ? new Date(from as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const dateTo = to ? new Date(to as string) : new Date();

  // إجمالي المصروفات
  const [expensesAgg] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))), 0)`
  }).from(expensesTable).where(and(gte(expensesTable.expenseDate, dateFrom), lte(expensesTable.expenseDate, dateTo)));

  // إيرادات المبيعات من الطلبات المستلمة
  const [salesAgg] = await db.select({
    revenue: sql<number>`COALESCE(SUM(total_price), 0)`,
    cost: sql<number>`COALESCE(SUM(cost_price * quantity), 0)`,
    shipping: sql<number>`COALESCE(SUM(shipping_cost), 0)`,
  }).from(ordersTable).where(and(
    eq(ordersTable.status as any, "received"),
    gte(ordersTable.createdAt, dateFrom),
    lte(ordersTable.createdAt, dateTo)
  ));

  // مستحقات شركات الشحن غير المدفوعة
  const [unpaidShipping] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(net_due AS DECIMAL(14,2)) - CAST(paid_amount AS DECIMAL(14,2))), 0)`
  }).from(shippingFinancialInvoicesTable).where(eq(shippingFinancialInvoicesTable.status as any, "pending"));

  const totalExpenses = Number(expensesAgg?.total ?? 0);
  const totalRevenue = Number(salesAgg?.revenue ?? 0);
  const totalCOGS = Number(salesAgg?.cost ?? 0);
  const totalShipping = Number(salesAgg?.shipping ?? 0);
  const grossProfit = totalRevenue - totalCOGS - totalShipping;
  const netProfit = grossProfit - totalExpenses;

  res.json({
    period: { from: dateFrom, to: dateTo },
    revenue: totalRevenue,
    cogs: totalCOGS,
    shippingSpend: totalShipping,
    grossProfit,
    operatingExpenses: totalExpenses,
    netProfit,
    netMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0",
    unpaidShippingDues: Number(unpaidShipping?.total ?? 0),
  });
});

// ── Finance Analytics (P&L + Alerts + Trends) ─────────────────────────────
router.get("/finance/analytics", async (req, res): Promise<void> => {
  const { from, to } = req.query;

  // ── تحديد الفترة الحالية والسابقة ────────────────────────────────────────
  const now = new Date();
  const curFrom  = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), 1);
  const curTo    = to   ? new Date(to   as string) : now;
  const diffMs   = curTo.getTime() - curFrom.getTime();
  const prevTo   = new Date(curFrom.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - diffMs);

  // ── helper: جلب بيانات مالية لفترة معينة ─────────────────────────────────
  async function fetchPeriodData(pFrom: Date, pTo: Date) {
    const pToEnd = new Date(pTo); pToEnd.setHours(23, 59, 59, 999);

    // الطلبات المستلمة (received + partial_received)
    const ordersData = await db.select({
      revenue:  sql<number>`COALESCE(SUM(total_price), 0)`,
      cogs:     sql<number>`COALESCE(SUM(cost_price * quantity), 0)`,
      shipping: sql<number>`COALESCE(SUM(shipping_cost), 0)`,
      count:    sql<number>`COUNT(*)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status IN ('received','partial_received')`,
      gte(ordersTable.createdAt, pFrom),
      lte(ordersTable.createdAt, pToEnd),
    ));

    // الطلبات المرتجعة
    const [returnedData] = await db.select({
      count: sql<number>`COUNT(*)`,
      loss:  sql<number>`COALESCE(SUM(total_price), 0)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      eq(ordersTable.status as any, "returned"),
      gte(ordersTable.createdAt, pFrom),
      lte(ordersTable.createdAt, pToEnd),
    ));

    // المصروفات
    const [expData] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))), 0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, pFrom),
      lte(expensesTable.expenseDate, pToEnd),
    ));

    // المصروفات حسب فئة
    const expByCategory = await db.select({
      category: expensesTable.category,
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))), 0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, pFrom),
      lte(expensesTable.expenseDate, pToEnd),
    )).groupBy(expensesTable.category);

    // إجمالي الطلبات (كل الحالات) لحساب نسبة التسليم
    const [allOrdersData] = await db.select({
      total:     sql<number>`COUNT(*)`,
      delivered: sql<number>`SUM(CASE WHEN status IN ('received','partial_received') THEN 1 ELSE 0 END)`,
      returned:  sql<number>`SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      gte(ordersTable.createdAt, pFrom),
      lte(ordersTable.createdAt, pToEnd),
    ));

    const revenue  = Number(ordersData[0]?.revenue  ?? 0);
    const cogs     = Number(ordersData[0]?.cogs     ?? 0);
    const shipping = Number(ordersData[0]?.shipping ?? 0);
    const expenses = Number(expData?.total ?? 0);
    const grossProfit = revenue - cogs - shipping;
    const netProfit   = grossProfit - expenses;
    const returnLoss  = Number(returnedData?.loss ?? 0);

    return {
      revenue, cogs, shipping, expenses, grossProfit, netProfit, returnLoss,
      netMargin: revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0,
      grossMargin: revenue > 0 ? +((grossProfit / revenue) * 100).toFixed(1) : 0,
      ordersCount: Number(ordersData[0]?.count ?? 0),
      totalOrders: Number(allOrdersData?.total ?? 0),
      deliveredOrders: Number(allOrdersData?.delivered ?? 0),
      returnedOrders: Number(allOrdersData?.returned ?? 0),
      deliveryRate: Number(allOrdersData?.total ?? 0) > 0
        ? +((Number(allOrdersData?.delivered ?? 0) / Number(allOrdersData?.total ?? 0)) * 100).toFixed(1)
        : 0,
      returnRate: Number(allOrdersData?.total ?? 0) > 0
        ? +((Number(allOrdersData?.returned ?? 0) / Number(allOrdersData?.total ?? 0)) * 100).toFixed(1)
        : 0,
      expByCategory,
    };
  }

  const [cur, prev] = await Promise.all([
    fetchPeriodData(curFrom, curTo),
    fetchPeriodData(prevFrom, prevTo),
  ]);

  // ── مقارنة الفترتين ───────────────────────────────────────────────────────
  const pct = (a: number, b: number) => b === 0 ? null : +((( a - b) / b) * 100).toFixed(1);
  const comparison = {
    revenue:    pct(cur.revenue,    prev.revenue),
    netProfit:  pct(cur.netProfit,  prev.netProfit),
    expenses:   pct(cur.expenses,   prev.expenses),
    returnRate: pct(cur.returnRate, prev.returnRate),
    deliveryRate: pct(cur.deliveryRate, prev.deliveryRate),
  };

  // ── فواتير الشحن المستحقة (متأخرة) ───────────────────────────────────────
  const overdueInvoices = await db.select({
    id: shippingFinancialInvoicesTable.id,
    invoiceNumber: shippingFinancialInvoicesTable.invoiceNumber,
    netDue: shippingFinancialInvoicesTable.netDue,
    paidAmount: shippingFinancialInvoicesTable.paidAmount,
    dueDate: shippingFinancialInvoicesTable.dueDate,
  }).from(shippingFinancialInvoicesTable)
    .where(and(
      sql`status IN ('pending','verified')`,
      sql`due_date IS NOT NULL`,
      lt(shippingFinancialInvoicesTable.dueDate as any, now),
    ));

  // ── طلبات في الشحن (in_shipping) = كاش متوقع ────────────────────────────
  const [inShipping] = await db.select({
    count:           sql<number>`COUNT(*)`,
    expectedRevenue: sql<number>`COALESCE(SUM(total_price), 0)`,
  }).from(ordersTable).where(and(
    isNull(ordersTable.deletedAt),
    eq(ordersTable.status as any, "in_shipping"),
  ));

  // ── فواتير شحن غير مسددة (إجمالي) ───────────────────────────────────────
  const [unpaidShipping] = await db.select({
    total: sql<number>`COALESCE(SUM(CAST(net_due AS DECIMAL(14,2)) - CAST(paid_amount AS DECIMAL(14,2))), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(shippingFinancialInvoicesTable)
    .where(sql`status IN ('pending','verified')`);

  // ── أعلى 5 فئات مصروفات ──────────────────────────────────────────────────
  const topExpenseCategories = [...cur.expByCategory]
    .sort((a, b) => Number(b.total) - Number(a.total))
    .slice(0, 5)
    .map(e => ({ category: e.category, total: Number(e.total) }));

  // ── Smart Alerts ──────────────────────────────────────────────────────────
  const alerts: { type: "danger" | "warning" | "info" | "success"; message: string; detail?: string }[] = [];

  // خسارة صافية
  if (cur.netProfit < 0) {
    alerts.push({ type: "danger", message: "الشهر الحالي بخسارة صافية", detail: `الخسارة: ${Math.abs(cur.netProfit).toLocaleString("ar-EG")} ج.م` });
  }
  // هامش ربح منخفض
  else if (cur.netMargin < 10 && cur.revenue > 0) {
    alerts.push({ type: "warning", message: "هامش الربح الصافي منخفض", detail: `الهامش الحالي ${cur.netMargin}% — المثالي فوق 20%` });
  }

  // نسبة مرتجعات مرتفعة
  if (cur.returnRate > 25) {
    alerts.push({ type: "danger", message: "نسبة المرتجعات مرتفعة جداً", detail: `${cur.returnRate}% من الطلبات — المعدل الطبيعي أقل من 20%` });
  } else if (cur.returnRate > 18) {
    alerts.push({ type: "warning", message: "نسبة المرتجعات فوق المعدل", detail: `${cur.returnRate}% — راجع أسباب الرجوع` });
  }

  // فواتير شحن متأخرة
  if (overdueInvoices.length > 0) {
    const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.netDue) - Number(i.paidAmount), 0);
    alerts.push({ type: "danger", message: `${overdueInvoices.length} فاتورة شحن متأخر سدادها`, detail: `إجمالي المتأخر: ${totalOverdue.toLocaleString("ar-EG")} ج.م` });
  }

  // مصروفات ارتفعت كثيراً
  if (comparison.expenses !== null && comparison.expenses > 30) {
    alerts.push({ type: "warning", message: "المصروفات ارتفعت بشكل ملحوظ", detail: `+${comparison.expenses}% مقارنة بالفترة السابقة` });
  }

  // إيراد انخفض
  if (comparison.revenue !== null && comparison.revenue < -15) {
    alerts.push({ type: "warning", message: "انخفاض في الإيرادات", detail: `${comparison.revenue}% مقارنة بالفترة السابقة` });
  }

  // إيجابي: ربح ارتفع
  if (comparison.netProfit !== null && comparison.netProfit > 20 && cur.netProfit > 0) {
    alerts.push({ type: "success", message: "أداء ممتاز — الربح ارتفع", detail: `+${comparison.netProfit}% مقارنة بالفترة السابقة` });
  }

  res.json({
    period: { from: curFrom, to: curTo },
    current: cur,
    previous: prev,
    comparison,
    alerts,
    cashFlow: {
      inShippingOrders: Number(inShipping?.count ?? 0),
      expectedIncoming: Number(inShipping?.expectedRevenue ?? 0),
      unpaidShippingDues: Number(unpaidShipping?.total ?? 0),
      unpaidShippingCount: Number(unpaidShipping?.count ?? 0),
      overdueInvoicesCount: overdueInvoices.length,
    },
    topExpenseCategories,
  });
});

export default router;