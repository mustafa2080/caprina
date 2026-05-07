import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import { db, expensesTable, shippingFinancialInvoicesTable, ordersTable, shippingManifestsTable, shippingManifestOrdersTable } from "@workspace/db";
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

export default router;
