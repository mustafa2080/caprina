import { Router } from "express";
import { db, cashRegistersTable, cashTransactionsTable } from "@workspace/db";
import { eq, desc, sql, and, gte, lte, ne, inArray } from "drizzle-orm";

export const cashRegistersRouter = Router();

// ─── GET /api/cash-registers ─────────────────────────────────────────────────
cashRegistersRouter.get("/", async (req, res) => {
  try {
    const registers = await db
      .select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.isActive, true))
      .orderBy(cashRegistersTable.type);

    const total = registers.reduce((s, r) => s + parseFloat(r.balance ?? "0"), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];
    const DEBIT_TYPES  = ["withdrawal","expense_paid","purchase_paid","transfer_out"];

    const summaries = await Promise.all(registers.map(async (reg) => {
      const [s] = await db.select({
        totalIn:  sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(CREDIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
        totalOut: sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(DEBIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
        txCount:  sql<number>`COUNT(*)`,
      }).from(cashTransactionsTable).where(
        and(
          eq(cashTransactionsTable.registerId, reg.id),
          gte(cashTransactionsTable.transactionDate, monthStart),
        )
      );
      return { registerId: reg.id, monthlyIn: Number(s?.totalIn??0), monthlyOut: Number(s?.totalOut??0), txCount: Number(s?.txCount??0) };
    }));

    const registersWithSummary = registers.map(r => ({
      ...r,
      monthlyIn:  summaries.find(s=>s.registerId===r.id)?.monthlyIn  ?? 0,
      monthlyOut: summaries.find(s=>s.registerId===r.id)?.monthlyOut ?? 0,
      txCount:    summaries.find(s=>s.registerId===r.id)?.txCount    ?? 0,
    }));

    res.json({ registers: registersWithSummary, totalBalance: total });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب الخزن" });
  }
});

// ─── POST /api/cash-registers ────────────────────────────────────────────────
cashRegistersRouter.post("/", async (req, res) => {
  try {
    const { name, type = "branch", description, initialBalance = 0 } = req.body as any;
    const now = new Date();

    const [result] = await db.insert(cashRegistersTable).values({
      name, type, description,
      balance: String(initialBalance),
      createdByUserId: req.body.userId ?? null,
      createdByName:   req.body.userName ?? null,
      createdAt: now, updatedAt: now,
    });
    const newId = (result as any).insertId;

    if (parseFloat(initialBalance) > 0) {
      await db.insert(cashTransactionsTable).values({
        registerId: newId, type: "deposit",
        amount: String(initialBalance), balanceBefore: "0", balanceAfter: String(initialBalance),
        description: "رصيد افتتاحي", transactionDate: now,
        createdByUserId: req.body.userId ?? null,
        createdByName:   req.body.userName ?? null,
        createdAt: now,
      });
    }
    res.json({ success: true, id: newId });
  } catch (err) {
    res.status(500).json({ error: "فشل إنشاء الخزنة" });
  }
});

// ─── GET /api/cash-registers/alerts (تنبيهات الرصيد المنخفض) ────────────────
cashRegistersRouter.get("/alerts", async (req, res) => {
  try {
    const registers = await db.select().from(cashRegistersTable)
      .where(eq(cashRegistersTable.isActive, true));
    const alerts = registers
      .filter(r => r.lowBalanceThreshold && parseFloat(r.balance ?? "0") <= parseFloat(r.lowBalanceThreshold))
      .map(r => ({
        registerId: r.id, name: r.name,
        balance: parseFloat(r.balance ?? "0"),
        threshold: parseFloat(r.lowBalanceThreshold ?? "0"),
        type: r.type,
      }));
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب التنبيهات" });
  }
});

// ─── POST /api/cash-registers/:id/transaction ────────────────────────────────
cashRegistersRouter.post("/:id/transaction", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { type, amount, description, referenceNumber, transactionDate } = req.body as any;
    const amt = parseFloat(amount);
    const now = new Date();

    const [register] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, registerId));
    if (!register) return res.status(404).json({ error: "الخزنة مش موجودة" });

    const balanceBefore = parseFloat(register.balance ?? "0");
    const DEBIT = ["withdrawal","expense_paid","purchase_paid","transfer_out"];
    const isDebit = DEBIT.includes(type);
    const balanceAfter = isDebit ? balanceBefore - amt : balanceBefore + amt;

    if (isDebit && balanceAfter < 0)
      return res.status(400).json({ error: `الرصيد مش كفاية — المتاح: ${balanceBefore.toLocaleString("ar-EG")} ج.م` });

    await db.update(cashRegistersTable)
      .set({ balance: String(balanceAfter), updatedAt: now })
      .where(eq(cashRegistersTable.id, registerId));

    await db.insert(cashTransactionsTable).values({
      registerId, type, amount: String(amt),
      balanceBefore: String(balanceBefore), balanceAfter: String(balanceAfter),
      description, referenceNumber,
      transactionDate: transactionDate ? new Date(transactionDate) : now,
      createdByUserId: req.body.userId ?? null,
      createdByName:   req.body.userName ?? null,
      createdAt: now,
    });

    res.json({ success: true, newBalance: balanceAfter });
  } catch (err) {
    res.status(500).json({ error: "فشل تسجيل الحركة" });
  }
});

// ─── POST /api/cash-registers/transfer (بين أي خزنتين) ──────────────────────
cashRegistersRouter.post("/transfer", async (req, res) => {
  try {
    const { fromId, toId, amount, description } = req.body as any;
    const amt = parseFloat(amount);
    const now = new Date();

    const [from] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, fromId));
    const [to]   = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, toId));
    if (!from || !to) return res.status(404).json({ error: "خزنة غير موجودة" });

    const fromBefore = parseFloat(from.balance ?? "0");
    const toBefore   = parseFloat(to.balance   ?? "0");
    if (fromBefore - amt < 0)
      return res.status(400).json({ error: `رصيد "${from.name}" مش كفاية — المتاح: ${fromBefore.toLocaleString("ar-EG")} ج.م` });

    const fromAfter = fromBefore - amt;
    const toAfter   = toBefore   + amt;

    await db.update(cashRegistersTable).set({ balance: String(fromAfter), updatedAt: now }).where(eq(cashRegistersTable.id, fromId));
    await db.update(cashRegistersTable).set({ balance: String(toAfter),   updatedAt: now }).where(eq(cashRegistersTable.id, toId));

    await db.insert(cashTransactionsTable).values([
      { registerId: fromId, type: "transfer_out", amount: String(amt), balanceBefore: String(fromBefore), balanceAfter: String(fromAfter), transferToRegisterId: toId, description: description ?? `تحويل إلى ${to.name}`, transactionDate: now, createdAt: now, createdByUserId: req.body.userId ?? null, createdByName: req.body.userName ?? null },
      { registerId: toId,   type: "transfer_in",  amount: String(amt), balanceBefore: String(toBefore),   balanceAfter: String(toAfter),   transferToRegisterId: fromId, description: description ?? `تحويل من ${from.name}`, transactionDate: now, createdAt: now, createdByUserId: req.body.userId ?? null, createdByName: req.body.userName ?? null },
    ]);

    res.json({ success: true, fromBalance: fromAfter, toBalance: toAfter });
  } catch (err) {
    res.status(500).json({ error: "فشل التحويل" });
  }
});

// ─── GET /api/cash-registers/:id/transactions (كشف حساب مع فلاتر) ───────────
cashRegistersRouter.get("/:id/transactions", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { from, to, type, page = "1", limit = "50" } = req.query as any;
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset   = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(cashTransactionsTable.registerId, registerId)];
    if (from) conditions.push(gte(cashTransactionsTable.transactionDate, new Date(from)));
    if (to) { const toDate = new Date(to); toDate.setHours(23,59,59,999); conditions.push(lte(cashTransactionsTable.transactionDate, toDate)); }
    if (type && type !== "all") conditions.push(eq(cashTransactionsTable.type, type));

    const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];
    const DEBIT_TYPES  = ["withdrawal","expense_paid","purchase_paid","transfer_out"];

    const [stats] = await db.select({
      totalIn:  sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(CREDIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(DEBIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
      txCount:  sql<number>`COUNT(*)`,
    }).from(cashTransactionsTable).where(and(...conditions));

    const transactions = await db.select().from(cashTransactionsTable)
      .where(and(...conditions)).orderBy(desc(cashTransactionsTable.transactionDate))
      .limit(limitNum).offset(offset);

    res.json({
      transactions,
      stats: { totalIn: Number(stats?.totalIn??0), totalOut: Number(stats?.totalOut??0), net: Number(stats?.totalIn??0) - Number(stats?.totalOut??0), txCount: Number(stats?.txCount??0) },
      pagination: { page: pageNum, limit: limitNum, total: Number(stats?.txCount ?? 0) },
    });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب الحركات" });
  }
});

// ─── GET /api/cash-registers/:id/export (تصدير CSV) ─────────────────────────
cashRegistersRouter.get("/:id/export", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { from, to, type } = req.query as any;
    const [register] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, registerId));
    if (!register) return res.status(404).json({ error: "الخزنة مش موجودة" });

    const conditions: any[] = [eq(cashTransactionsTable.registerId, registerId)];
    if (from) conditions.push(gte(cashTransactionsTable.transactionDate, new Date(from)));
    if (to) { const toDate = new Date(to); toDate.setHours(23,59,59,999); conditions.push(lte(cashTransactionsTable.transactionDate, toDate)); }
    if (type && type !== "all") conditions.push(eq(cashTransactionsTable.type, type));

    const transactions = await db.select().from(cashTransactionsTable)
      .where(and(...conditions)).orderBy(desc(cashTransactionsTable.transactionDate)).limit(5000);

    const TX_LABELS: Record<string, string> = { deposit:"إيداع", withdrawal:"سحب", order_collected:"تحصيل طلب", shipping_transfer:"تحويل شحن", cash_sale:"مبيعات نقدية", expense_paid:"دفع مصروف", purchase_paid:"دفع مورد", transfer_in:"تحويل وارد", transfer_out:"تحويل صادر" };
    const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];

    const rows = [
      ["التاريخ","نوع الحركة","الاتجاه","المبلغ","الرصيد قبل","الرصيد بعد","مرجع","ملاحظة","بواسطة"],
      ...transactions.map(tx => [
        new Date(tx.transactionDate).toLocaleDateString("ar-EG"),
        TX_LABELS[tx.type] ?? tx.type,
        CREDIT_TYPES.includes(tx.type) ? "دخل" : "خروج",
        tx.amount, tx.balanceBefore, tx.balanceAfter,
        tx.referenceNumber ?? "", tx.description ?? "", tx.createdByName ?? "",
      ])
    ];

    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cash-${register.name}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: "فشل التصدير" });
  }
});

// ─── GET /api/cash-registers/:id/flow (تدفق نقدي يومي) ──────────────────────
cashRegistersRouter.get("/:id/flow", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { days = "30" } = req.query as any;
    const daysNum = Math.min(90, parseInt(days));
    const since = new Date(); since.setDate(since.getDate() - daysNum);

    const CREDIT_TYPES = ["deposit","order_collected","shipping_transfer","cash_sale","transfer_in"];
    const DEBIT_TYPES  = ["withdrawal","expense_paid","purchase_paid","transfer_out"];

    const rows = await db.select({
      day:      sql<string>`DATE(transaction_date)`,
      totalIn:  sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(CREDIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
      totalOut: sql<number>`COALESCE(SUM(CASE WHEN type IN (${sql.raw(DEBIT_TYPES.map(t=>`'${t}'`).join(","))}) THEN CAST(amount AS DECIMAL(14,2)) ELSE 0 END), 0)`,
    }).from(cashTransactionsTable)
      .where(and(eq(cashTransactionsTable.registerId, registerId), gte(cashTransactionsTable.transactionDate, since)))
      .groupBy(sql`DATE(transaction_date)`)
      .orderBy(sql`DATE(transaction_date)`);

    res.json(rows.map(r => ({ day: r.day, in: Number(r.totalIn), out: Number(r.totalOut), net: Number(r.totalIn) - Number(r.totalOut) })));
  } catch (err) {
    res.status(500).json({ error: "فشل جلب التدفق" });
  }
});

// ─── PATCH /api/cash-registers/:id ───────────────────────────────────────────
cashRegistersRouter.patch("/:id", async (req, res) => {
  try {
    const { name, description } = req.body as any;
    await db.update(cashRegistersTable)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل التعديل" });
  }
});

// ─── PATCH /api/cash-registers/:id/threshold (ضبط حد رصيد التنبيه) ──────────
cashRegistersRouter.patch("/:id/threshold", async (req, res) => {
  try {
    const { lowBalanceThreshold } = req.body as any;
    await db.update(cashRegistersTable)
      .set({ lowBalanceThreshold: lowBalanceThreshold ? String(lowBalanceThreshold) : null, updatedAt: new Date() })
      .where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل ضبط الحد" });
  }
});

// ─── DELETE /api/cash-registers/:id ──────────────────────────────────────────
cashRegistersRouter.delete("/:id", async (req, res) => {
  try {
    const [reg] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    if (reg?.type === "main") return res.status(400).json({ error: "مش ممكن تحذف الخزنة الرئيسية" });
    if (parseFloat(reg?.balance ?? "0") > 0)
      return res.status(400).json({ error: "حول الرصيد المتبقي قبل التعطيل" });
    await db.update(cashRegistersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل الحذف" });
  }
});
