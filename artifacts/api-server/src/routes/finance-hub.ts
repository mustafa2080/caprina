import { Router } from "express";
import { db, cashRegistersTable, cashTransactionsTable, expensesTable, ordersTable, purchaseOrdersTable, shippingFinancialInvoicesTable, CREDIT_TYPES, DEBIT_TYPES } from "@workspace/db";
import { eq, desc, gte, lte, and, sql, lt, isNull } from "drizzle-orm";
import { getTenantId } from "../middlewares/requireTenant.js";

const router = Router();

// ── GET /api/finance/hub — جلب كل بيانات الـ Finance Hub في call واحد ─────────
router.get("/finance/hub", async (req, res): Promise<void> => {
  try {
    const { from, to } = req.query;
    const tenantId = getTenantId(req);
    const now = new Date();
    const curFrom = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), 1);
    const curTo   = to   ? new Date(to   as string) : now;
    const curToEnd = new Date(curTo); curToEnd.setHours(23, 59, 59, 999);

    // tenant conditions
    const tOrder   = tenantId !== null ? [eq(ordersTable.tenantId, tenantId)]                         : [];
    const tExp     = tenantId !== null ? [eq(expensesTable.tenantId, tenantId)]                       : [];
    const tReg     = tenantId !== null ? [eq(cashRegistersTable.tenantId, tenantId)]                  : [];
    const tShipInv = tenantId !== null ? [eq(shippingFinancialInvoicesTable.tenantId, tenantId)]      : [];

    // الفترة السابقة للمقارنة
    const diffMs   = curTo.getTime() - curFrom.getTime();
    const prevTo   = new Date(curFrom.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - diffMs);
    const prevToEnd = new Date(prevTo); prevToEnd.setHours(23, 59, 59, 999);

    const creditSql = sql.raw([...CREDIT_TYPES].map(t=>`'${t}'`).join(","));
    const debitSql  = sql.raw([...DEBIT_TYPES].map(t=>`'${t}'`).join(","));

    // ── 1. الخزن ────────────────────────────────────────────────────────────
    const registers = await db.select().from(cashRegistersTable)
      .where(and(eq(cashRegistersTable.isActive, true), ...tReg))
      .orderBy(cashRegistersTable.type);

    const totalCash = registers.reduce((s, r) => s + parseFloat(r.balance ?? "0"), 0);

    // ملخص شهري لكل خزنة
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const regSummaries = await Promise.all(registers.map(async (r) => {
      const [s] = await db.select({
        totalIn:  sql<number>`COALESCE(SUM(CASE WHEN type IN (${creditSql}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END),0)`,
        totalOut: sql<number>`COALESCE(SUM(CASE WHEN type IN (${debitSql})  THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END),0)`,
        txCount:  sql<number>`COUNT(*)`,
      }).from(cashTransactionsTable).where(
        and(eq(cashTransactionsTable.registerId, r.id), gte(cashTransactionsTable.transactionDate, monthStart))
      );
      return { ...r, balance: parseFloat(r.balance ?? "0"), monthlyIn: Number(s?.totalIn??0), monthlyOut: Number(s?.totalOut??0), txCount: Number(s?.txCount??0) };
    }));

    // تنبيهات رصيد منخفض
    const lowBalanceAlerts = regSummaries
      .filter(r => r.lowBalanceThreshold && r.balance <= parseFloat(String(r.lowBalanceThreshold)))
      .map(r => ({ registerId: r.id, name: r.name, balance: r.balance, threshold: parseFloat(String(r.lowBalanceThreshold)) }));

    // ── 2. Chart التدفق النقدي آخر 30 يوم ───────────────────────────────────
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const dailyFlow = await db.select({
      day:      sql<string>`DATE(transaction_date)`,
      totalIn:  sql<number>`COALESCE(SUM(CASE WHEN type IN (${creditSql}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END),0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN type IN (${debitSql})  THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END),0)`,
    }).from(cashTransactionsTable)
      .where(gte(cashTransactionsTable.transactionDate, thirtyDaysAgo))
      .groupBy(sql`DATE(transaction_date)`)
      .orderBy(sql`DATE(transaction_date)`);

    // ── 3. مؤشرات المبيعات (الفترة الحالية) ─────────────────────────────────
    // الطلبات المُسلَّمة: الإيراد + التكلفة + الشحن
    const [salesCur] = await db.select({
      revenue:  sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN partial_quantity * unit_price
          ELSE total_price
        END
      ),0)`,
      cogs:     sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN cost_price * partial_quantity
          ELSE cost_price * quantity
        END
      ),0)`,
      shipping: sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND quantity > 0
            THEN shipping_cost * partial_quantity / quantity
          ELSE shipping_cost
        END
      ),0)`,
      count:    sql<number>`COUNT(*)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status IN ('received','partial_received')`,
      gte(ordersTable.createdAt, curFrom),
      lte(ordersTable.createdAt, curToEnd),
      ...tOrder,
    ));

    // خسائر المرتجعات = فقط المرتجعات التالفة (is_damaged=1) — المرتجع العادي لا خسارة
    const [returnsCur] = await db.select({
      returnCogs:     sql<number>`COALESCE(SUM(cost_price * quantity),0)`,
      returnShipping: sql<number>`COALESCE(SUM(shipping_cost),0)`,
      count:          sql<number>`COUNT(*)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status = 'returned' AND is_damaged = 1`,
      gte(ordersTable.createdAt, curFrom),
      lte(ordersTable.createdAt, curToEnd),
      ...tOrder,
    ));

    const [salesPrev] = await db.select({
      revenue:  sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN partial_quantity * unit_price
          ELSE total_price
        END
      ),0)`,
      cogs:     sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN cost_price * partial_quantity
          ELSE cost_price * quantity
        END
      ),0)`,
      shipping: sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND quantity > 0
            THEN shipping_cost * partial_quantity / quantity
          ELSE shipping_cost
        END
      ),0)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status IN ('received','partial_received')`,
      gte(ordersTable.createdAt, prevFrom),
      lte(ordersTable.createdAt, prevToEnd),
      ...tOrder,
    ));


    const [returnsPrev] = await db.select({
      returnCogs:     sql<number>`COALESCE(SUM(cost_price * quantity),0)`,
      returnShipping: sql<number>`COALESCE(SUM(shipping_cost),0)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status = 'returned' AND is_damaged = 1`,
      gte(ordersTable.createdAt, prevFrom),
      lte(ordersTable.createdAt, prevToEnd),
      ...tOrder,
    ));

    const [orderStats] = await db.select({
      total:     sql<number>`COUNT(DISTINCT COALESCE(invoice_number, CONCAT('solo-', id)))`,
      delivered: sql<number>`COUNT(DISTINCT CASE WHEN status IN ('received','partial_received') THEN COALESCE(invoice_number, CONCAT('solo-', id)) END)`,
      returned:  sql<number>`COUNT(DISTINCT CASE WHEN status='returned' THEN COALESCE(invoice_number, CONCAT('solo-', id)) END)`,
      pending:   sql<number>`COUNT(DISTINCT CASE WHEN status IN ('pending','in_shipping','warehouse_ready') THEN COALESCE(invoice_number, CONCAT('solo-', id)) END)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      gte(ordersTable.createdAt, curFrom),
      lte(ordersTable.createdAt, curToEnd),
      ...tOrder,
    ));

    // ── 4. المصروفات (الفترة الحالية) ───────────────────────────────────────
    const [expCur] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))),0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, curFrom),
      lte(expensesTable.expenseDate, curToEnd),
      ...tExp,
    ));

    const [expPrev] = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))),0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, prevFrom),
      lte(expensesTable.expenseDate, prevToEnd),
      ...tExp,
    ));

    // توزيع المصروفات بالفئة
    const expByCategory = await db.select({
      category: expensesTable.category,
      total:    sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))),0)`,
      count:    sql<number>`COUNT(*)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.expenseDate, curFrom),
      lte(expensesTable.expenseDate, curToEnd),
      ...tExp,
    )).groupBy(expensesTable.category).orderBy(desc(sql`SUM(CAST(amount AS DECIMAL(14,2)))`));

    // ── 5. Chart شهري آخر 6 شهور (مبيعات + مصروفات) ────────────────────────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRevenue = await db.select({
      month:   sql<string>`DATE_FORMAT(created_at, '%Y-%m')`,
      revenue: sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN partial_quantity * unit_price
          ELSE total_price
        END
      ),0)`,
      cogs:    sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND partial_quantity > 0
            THEN cost_price * partial_quantity
          ELSE cost_price * quantity
        END
      ),0)`,
      shipping: sql<number>`COALESCE(SUM(
        CASE
          WHEN status = 'partial_received' AND partial_quantity IS NOT NULL AND quantity > 0
            THEN shipping_cost * partial_quantity / quantity
          ELSE shipping_cost
        END
      ),0)`,
      count:   sql<number>`COUNT(*)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status IN ('received','partial_received')`,
      gte(ordersTable.createdAt, sixMonthsAgo),
      ...tOrder,
    )).groupBy(sql`DATE_FORMAT(created_at, '%Y-%m')`).orderBy(sql`DATE_FORMAT(created_at, '%Y-%m')`);

    // المرتجعات الشهرية لحساب الخسارة في الـ chart
    const monthlyReturns = await db.select({
      month:       sql<string>`DATE_FORMAT(created_at, '%Y-%m')`,
      returnCogs:  sql<number>`COALESCE(SUM(cost_price * quantity),0)`,
      returnShip:  sql<number>`COALESCE(SUM(shipping_cost),0)`,
    }).from(ordersTable).where(and(
      isNull(ordersTable.deletedAt),
      sql`status = 'returned'`,
      gte(ordersTable.createdAt, sixMonthsAgo),
      ...tOrder,
    )).groupBy(sql`DATE_FORMAT(created_at, '%Y-%m')`).orderBy(sql`DATE_FORMAT(created_at, '%Y-%m')`);

    const monthlyExpenses = await db.select({
      month: sql<string>`DATE_FORMAT(expense_date, '%Y-%m')`,
      total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL(14,2))),0)`,
    }).from(expensesTable)
      .where(and(gte(expensesTable.expenseDate, sixMonthsAgo), ...tExp))
      .groupBy(sql`DATE_FORMAT(expense_date, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(expense_date, '%Y-%m')`);

    // دمج المبيعات والمصروفات في chart موحد
    const allMonths = [...new Set([
      ...monthlyRevenue.map(r => r.month),
      ...monthlyExpenses.map(e => e.month),
    ])].sort();

    const monthlyChart = allMonths.map(month => {
      const rev = monthlyRevenue.find(r => r.month === month);
      const exp = monthlyExpenses.find(e => e.month === month);
      const ret = monthlyReturns.find(r => r.month === month);
      const revenue    = Number(rev?.revenue ?? 0);
      const expenses   = Number(exp?.total ?? 0);
      const returnLoss = Number(ret?.returnCogs ?? 0) + Number(ret?.returnShip ?? 0);
      const profit     = revenue - Number(rev?.cogs ?? 0) - Number(rev?.shipping ?? 0) - returnLoss - expenses;
      return { month, revenue, expenses, profit, orders: Number(rev?.count ?? 0) };
    });

    // ── 6. أوامر الشراء المعلقة ──────────────────────────────────────────────
    const [pendingPurchases] = await db.select({
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(CAST(total_amount AS DECIMAL(14,2))),0)`,
    }).from(purchaseOrdersTable).where(sql`status IN ('pending','ordered','partial_received')`);

    // ── 7. فواتير الشحن غير المسددة ─────────────────────────────────────────
    // COALESCE على كل عمود على حدة عشان NULL في paid_amount ما يخليش الطرح NULL
    const [unpaidShipping] = await db.select({
      count: sql<number>`COUNT(*)`,
      total: sql<number>`COALESCE(SUM(CAST(net_due AS DECIMAL(14,2)) - COALESCE(CAST(paid_amount AS DECIMAL(14,2)),0)),0)`,
    }).from(shippingFinancialInvoicesTable).where(sql`status IN ('pending','verified')`);

    // فواتير شحن متأخرة
    const overdueShipping = await db.select({
      id: shippingFinancialInvoicesTable.id,
      invoiceNumber: shippingFinancialInvoicesTable.invoiceNumber,
      netDue: shippingFinancialInvoicesTable.netDue,
      paidAmount: shippingFinancialInvoicesTable.paidAmount,
      dueDate: shippingFinancialInvoicesTable.dueDate,
    }).from(shippingFinancialInvoicesTable).where(and(
      sql`status IN ('pending','verified')`,
      sql`due_date IS NOT NULL`,
      lt(shippingFinancialInvoicesTable.dueDate as any, now),
    ));

    // ── 8. حساب الأرباح ──────────────────────────────────────────────────────
    const revenue  = Number(salesCur?.revenue ?? 0);
    const cogs     = Number(salesCur?.cogs    ?? 0);
    const shipping = Number(salesCur?.shipping ?? 0);
    const expenses = Number(expCur?.total ?? 0);
    // خسارة المرتجعات = تكلفة البضاعة + تكلفة الشحن المدفوعة
    const returnLoss = Number(returnsCur?.returnCogs ?? 0) + Number(returnsCur?.returnShipping ?? 0);
    const grossProfit = revenue - cogs - shipping - returnLoss;
    const netProfit   = grossProfit - expenses;
    const netMargin   = revenue > 0 ? +((netProfit / revenue) * 100).toFixed(1) : 0;
    const grossMargin = revenue > 0 ? +((grossProfit / revenue) * 100).toFixed(1) : 0;

    const prevRevenue    = Number(salesPrev?.revenue ?? 0);
    const prevCogs       = Number(salesPrev?.cogs    ?? 0);
    const prevExp        = Number(expPrev?.total ?? 0);
    const prevReturnLoss = Number(returnsPrev?.returnCogs ?? 0) + Number(returnsPrev?.returnShipping ?? 0);
    const prevProfit     = prevRevenue - prevCogs - Number(salesPrev?.shipping ?? 0) - prevReturnLoss - prevExp;

    const pct = (a:number, b:number) => b === 0 ? null : +((( a - b) / b) * 100).toFixed(1);

    // ── 9. أحدث حركات الخزنة ────────────────────────────────────────────────
    const recentTx = await db.select().from(cashTransactionsTable)
      .orderBy(desc(cashTransactionsTable.createdAt)).limit(10);

    // ── 10. Smart Alerts ─────────────────────────────────────────────────────
    const alerts: { type:string; title:string; detail:string }[] = [];
    if (netProfit < 0 && revenue > 0)
      alerts.push({ type:"danger", title:"الشهر بخسارة صافية", detail:`الخسارة: ${Math.abs(netProfit).toLocaleString("ar-EG")} ج.م` });
    else if (netMargin < 10 && revenue > 0)
      alerts.push({ type:"warning", title:"هامش ربح منخفض", detail:`الهامش ${netMargin}% — المثالي فوق 20%` });
    if (Number(orderStats?.returned ?? 0) / Math.max(Number(orderStats?.total ?? 1), 1) > 0.25)
      alerts.push({ type:"danger", title:"نسبة مرتجعات مرتفعة", detail:`${Number(orderStats?.returned??0)} طلب مرتجع` });
    if (lowBalanceAlerts.length > 0)
      alerts.push({ type:"warning", title:`${lowBalanceAlerts.length} خزنة رصيدها منخفض`, detail: lowBalanceAlerts.map(a=>a.name).join(" — ") });
    if (overdueShipping.length > 0)
      alerts.push({ type:"danger", title:`${overdueShipping.length} فاتورة شحن متأخرة`, detail:`إجمالي: ${overdueShipping.reduce((s,i)=>s+Number(i.netDue??0)-Math.max(0,parseFloat(String(i.paidAmount??0))||0),0).toLocaleString("ar-EG")} ج.م` });
    if (Number(pendingPurchases?.count ?? 0) > 0)
      alerts.push({ type:"info", title:`${pendingPurchases?.count} أمر شراء معلق`, detail:`إجمالي: ${Number(pendingPurchases?.total??0).toLocaleString("ar-EG")} ج.م` });
    if (netProfit > 0 && prevProfit > 0 && netProfit > prevProfit * 1.2)
      alerts.push({ type:"success", title:"أداء ممتاز — الربح ارتفع", detail:`+${pct(netProfit,prevProfit)}% مقارنة بالفترة السابقة` });

    res.json({
      period: { from: curFrom, to: curTo },
      cash: { registers: regSummaries, totalBalance: totalCash, lowBalanceAlerts },
      dailyFlow: dailyFlow.map(r=>({ day: r.day, in: Number(r.totalIn), out: Number(r.totalOut), net: Number(r.totalIn)-Number(r.totalOut) })),
      pnl: {
        revenue, cogs, shipping, expenses, grossProfit, netProfit, netMargin, grossMargin,
        returnLoss, returnCount: Number(returnsCur?.count ?? 0),
        prevRevenue, prevProfit,
        changes: { revenue: pct(revenue,prevRevenue), netProfit: pct(netProfit,prevProfit), expenses: pct(expenses,prevExp) },
      },
      orders: {
        total: Number(orderStats?.total??0),
        delivered: Number(orderStats?.delivered??0),
        returned: Number(orderStats?.returned??0),
        pending: Number(orderStats?.pending??0),
        deliveryRate: Number(orderStats?.total??0) > 0 ? +((Number(orderStats?.delivered??0)/Number(orderStats?.total??1))*100).toFixed(1) : 0,
        returnRate: Number(orderStats?.total??0) > 0 ? +((Number(orderStats?.returned??0)/Number(orderStats?.total??1))*100).toFixed(1) : 0,
      },
      monthlyChart,
      expByCategory: expByCategory.map(e=>({ category: e.category, total: Number(e.total), count: Number(e.count) })),
      pendingPurchases: { count: Number(pendingPurchases?.count??0), total: Number(pendingPurchases?.total??0) },
      unpaidShipping: { count: Number(unpaidShipping?.count??0), total: Number(unpaidShipping?.total??0), overdueCount: overdueShipping.length },
      recentTransactions: recentTx,
      alerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "فشل تحميل بيانات الماليات" });
  }
});

export default router;
