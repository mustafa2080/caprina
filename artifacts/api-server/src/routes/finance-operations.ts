import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and, sql, lt, isNull, like, or } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db, expensesTable, shippingFinancialInvoicesTable, ordersTable, shippingManifestsTable, shippingManifestOrdersTable, purchasesTable, cashRegistersTable, cashTransactionsTable } from "@workspace/db";
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
  cashRegisterId: z.number().nullish(),
  notes: z.string().nullish(),
  expenseDate: z.string(),
});

// ── helper: بناء شروط الفلترة للمصروفات ──────────────────────────────────
function buildExpenseConditions(query: Record<string, any>) {
  const { from, to, category, search } = query;
  const conditions: any[] = [];
  if (from)     conditions.push(gte(expensesTable.expenseDate, new Date(from as string)));
  if (to)       conditions.push(lte(expensesTable.expenseDate, new Date(to   as string)));
  if (category && category !== "all") conditions.push(eq(expensesTable.category, category as string));
  if (search) {
    const q = `%${search}%`;
    conditions.push(or(like(expensesTable.title, q), like(expensesTable.notes, q), like(expensesTable.referenceId, q)));
  }
  return conditions;
}

router.get("/finance/expenses", async (req, res): Promise<void> => {
  const { page = "1", limit = "25" } = req.query;
  const conditions = buildExpenseConditions(req.query);
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` })
    .from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const expenses = await db.select().from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expensesTable.expenseDate))
    .limit(parseInt(limit as string))
    .offset(offset);

  res.json({ expenses, total: Number(total), page: parseInt(page as string), limit: parseInt(limit as string) });
});

// ── تصدير Excel للمصروفات ─────────────────────────────────────────────────
router.get("/finance/expenses/export-excel", async (req, res): Promise<void> => {
  const conditions = buildExpenseConditions(req.query);
  const expenses = await db.select().from(expensesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expensesTable.expenseDate));

  const CAT_LABELS: Record<string, string> = {
    shipping_fees:"مصاريف شحن", warehouse_rent:"إيجار مخزن", salary:"مرتبات",
    marketing:"تسويق وإعلانات", packaging:"تغليف", utilities:"كهرباء / خدمات",
    maintenance:"صيانة", returns_loss:"خسائر مرتجعات", other:"أخرى",
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "Caprina"; wb.created = new Date();
  const ws = wb.addWorksheet("المصروفات", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { header: "#",          key: "id",          width: 8  },
    { header: "العنوان",    key: "title",        width: 30 },
    { header: "التصنيف",    key: "category",     width: 20 },
    { header: "المبلغ",     key: "amount",       width: 16 },
    { header: "التاريخ",    key: "expenseDate",  width: 14 },
    { header: "رقم مرجعي", key: "referenceId",  width: 16 },
    { header: "ملاحظات",   key: "notes",        width: 30 },
    { header: "بواسطة",    key: "createdByName",width: 18 },
  ];

  // تنسيق الهيدر
  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEA821" } };
    cell.font = { bold: true, color: { argb: "FF000000" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 22;

  let totalAmount = 0;
  expenses.forEach((e, i) => {
    const amt = parseFloat(e.amount ?? "0");
    totalAmount += amt;
    const row = ws.addRow({
      id: e.id,
      title: e.title,
      category: CAT_LABELS[e.category ?? ""] ?? e.category,
      amount: amt,
      expenseDate: e.expenseDate ? new Date(e.expenseDate).toLocaleDateString("ar-EG") : "",
      referenceId: e.referenceId ?? "",
      notes: e.notes ?? "",
      createdByName: e.createdByName ?? "",
    });
    row.getCell("amount").numFmt = '#,##0.00 "ج.م"';
    if (i % 2 === 1) {
      row.eachCell(cell => { cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFF9F9F9" } }; });
    }
  });

  // صف الإجمالي
  const totalRow = ws.addRow({ title: "الإجمالي", amount: totalAmount });
  totalRow.getCell("title").font = { bold: true };
  totalRow.getCell("amount").numFmt = '#,##0.00 "ج.م"';
  totalRow.getCell("amount").font = { bold: true, color: { argb: "FFC0392B" } };
  totalRow.eachCell(cell => { cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFF3CD" } }; });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="expenses-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.post("/finance/expenses", async (req, res): Promise<void> => {
  const parsed = ExpenseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const now = new Date();
  const user = (req as any).user;
  const data = parsed.data;
  const amt = data.amount;

  // ── تحديد الخزنة: المحددة من المستخدم أو الافتراضية تلقائياً ────────────
  let reg: any = null;
  let balBefore = 0;
  let balAfter  = 0;
  let resolvedRegisterId: number | null = data.cashRegisterId ?? null;

  if (resolvedRegisterId) {
    // خزنة محددة من المستخدم - تحقق منها
    const [found] = await db.select().from(cashRegistersTable)
      .where(and(eq(cashRegistersTable.id, resolvedRegisterId), eq(cashRegistersTable.isActive, true)));
    if (!found) { res.status(404).json({ error: "الخزنة المحددة غير موجودة أو غير نشطة" }); return; }
    balBefore = parseFloat(found.balance ?? "0");
    balAfter  = balBefore - amt;
    if (balAfter < 0) {
      res.status(400).json({ error: `رصيد الخزنة "${found.name}" مش كفاية — المتاح: ${balBefore.toLocaleString("ar-EG")} ج.م` });
      return;
    }
    reg = found;
  } else {
    // مفيش خزنة محددة → جيب الافتراضية أو أول خزنة نشطة
    const registers = await db.select().from(cashRegistersTable)
      .where(eq(cashRegistersTable.isActive, true))
      .orderBy(cashRegistersTable.id);
    const defaultReg = registers.find((r: any) => r.isDefault) ?? registers[0] ?? null;
    if (defaultReg) {
      balBefore = parseFloat(defaultReg.balance ?? "0");
      balAfter  = balBefore - amt;
      if (balAfter < 0) {
        res.status(400).json({ error: `رصيد الخزنة الافتراضية "${defaultReg.name}" مش كفاية — المتاح: ${balBefore.toLocaleString("ar-EG")} ج.م` });
        return;
      }
      reg = defaultReg;
      resolvedRegisterId = defaultReg.id;
    }
    // لو مفيش أي خزنة نشطة → نكمل بدون خصم (edge case نادر)
  }

  // ── إنشاء المصروف أولاً عشان ناخد الـ id ────────────────────────────────
  const result = await db.insert(expensesTable).values({
    ...data,
    cashRegisterId: resolvedRegisterId,
    expenseDate: new Date(data.expenseDate),
    createdByUserId: user?.id,
    createdByName: user?.displayName,
    createdAt: now,
  });
  const expenseId = (result as any)[0]?.insertId;

  // ── بعد ما عرفنا الـ id: خصم من الخزنة وسجّل الحركة ────────────────────
  if (reg && resolvedRegisterId) {
    await db.update(cashRegistersTable)
      .set({ balance: String(balAfter), updatedAt: now })
      .where(eq(cashRegistersTable.id, resolvedRegisterId));

    await db.insert(cashTransactionsTable).values({
      registerId: resolvedRegisterId,
      type: "expense_paid",
      amount: String(amt),
      balanceBefore: String(balBefore),
      balanceAfter: String(balAfter),
      description: data.title,
      referenceNumber: data.referenceId ?? undefined,
      expenseId,                          // ✅ الـ id الحقيقي دلوقتي
      transactionDate: new Date(data.expenseDate),
      createdByUserId: user?.id ?? null,
      createdByName: user?.displayName ?? null,
      createdAt: now,
    });
  }

  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, expenseId));
  res.status(201).json(expense);
});

// ── تقرير المصروفات شهر بشهر (MoM) ─────────────────────────────────────────
router.get("/finance/expenses/monthly-breakdown", async (req, res): Promise<void> => {
  // آخر 6 شهور افتراضياً
  const monthsBack = parseInt((req.query.months as string) ?? "6");
  const now = new Date();
  const results: Record<string, Record<string, number>> = {};
  const monthLabels: string[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "numeric" });
    monthLabels.push(label);

    const rows = await db.select({
      category: expensesTable.category,
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))), 0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, from),
      lte(expensesTable.expenseDate, to),
    )).groupBy(expensesTable.category);

    results[label] = {};
    for (const row of rows) {
      results[label][row.category ?? "other"] = Number(row.total);
    }
  }

  // كل التصنيفات الموجودة عبر الشهور
  const allCategories = Array.from(
    new Set(Object.values(results).flatMap(m => Object.keys(m)))
  );

  res.json({ months: monthLabels, categories: allCategories, data: results });
});

router.delete("/finance/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const now = new Date();
  const user = (req as any).user;

  // 1. جيب المصروف قبل الحذف
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, id));
  if (!expense) { res.status(404).json({ error: "المصروف غير موجود" }); return; }

  // 2. لو كان مرتبط بخزنة → ارجع الفلوس
  if (expense.cashRegisterId) {
    const [reg] = await db.select().from(cashRegistersTable)
      .where(eq(cashRegistersTable.id, expense.cashRegisterId));

    if (reg) {
      const balBefore = parseFloat(reg.balance ?? "0");
      const amt       = parseFloat(expense.amount ?? "0");
      const balAfter  = balBefore + amt;                  // رجوع المبلغ للخزنة

      // حدّث رصيد الخزنة
      await db.update(cashRegistersTable)
        .set({ balance: String(balAfter), updatedAt: now })
        .where(eq(cashRegistersTable.id, reg.id));

      // سجّل حركة عكسية (deposit كـ reversal)
      await db.insert(cashTransactionsTable).values({
        registerId:    reg.id,
        type:          "deposit",
        amount:        String(amt),
        balanceBefore: String(balBefore),
        balanceAfter:  String(balAfter),
        description:   `إلغاء مصروف: ${expense.title}`,
        referenceNumber: String(id),
        transactionDate: now,
        createdByUserId: user?.id   ?? null,
        createdByName:   user?.displayName ?? null,
        createdAt:     now,
      });
    }
  }

  // 3. احذف المصروف
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
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
    total: sql<number>`COALESCE(SUM(CAST(net_due AS DECIMAL(14,2)) - COALESCE(CAST(paid_amount AS DECIMAL(14,2)),0)), 0)`,
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