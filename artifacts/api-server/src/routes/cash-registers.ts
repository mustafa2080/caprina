import { Router } from "express";
import { db } from "@db";
import {
  cashRegistersTable, cashTransactionsTable,
  type InsertCashRegister,
} from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export const cashRegistersRouter = Router();

// ─── GET /api/cash-registers  (كل الخزن + رصيدها) ───────────────────────────
cashRegistersRouter.get("/", async (req, res) => {
  try {
    const registers = await db
      .select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.isActive, true))
      .orderBy(cashRegistersTable.type); // main أولاً

    // إجمالي كل الخزن
    const total = registers.reduce((s, r) => s + parseFloat(r.balance ?? "0"), 0);

    res.json({ registers, totalBalance: total });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب الخزن" });
  }
});

// ─── POST /api/cash-registers  (خزنة جديدة) ─────────────────────────────────
cashRegistersRouter.post("/", async (req, res) => {
  try {
    const { name, type = "branch", description, initialBalance = 0 } = req.body as any;
    const now = new Date();

    const [result] = await db.insert(cashRegistersTable).values({
      name,
      type,
      description,
      balance: String(initialBalance),
      createdByUserId: req.body.userId ?? null,
      createdByName:   req.body.userName ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const newId = (result as any).insertId;

    // لو في رصيد افتتاحي → نسجله كحركة إيداع
    if (parseFloat(initialBalance) > 0) {
      await db.insert(cashTransactionsTable).values({
        registerId:      newId,
        type:            "deposit",
        amount:          String(initialBalance),
        balanceBefore:   "0",
        balanceAfter:    String(initialBalance),
        description:     "رصيد افتتاحي",
        transactionDate: now,
        createdByUserId: req.body.userId ?? null,
        createdByName:   req.body.userName ?? null,
        createdAt:       now,
      });
    }

    res.json({ success: true, id: newId });
  } catch (err) {
    res.status(500).json({ error: "فشل إنشاء الخزنة" });
  }
});

// ─── POST /api/cash-registers/:id/transaction  (حركة جديدة: إيداع/سحب/etc) ─
cashRegistersRouter.post("/:id/transaction", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { type, amount, description, referenceNumber, transactionDate } = req.body as any;
    const amt = parseFloat(amount);
    const now = new Date();

    // جلب الخزنة
    const [register] = await db
      .select()
      .from(cashRegistersTable)
      .where(eq(cashRegistersTable.id, registerId));

    if (!register) return res.status(404).json({ error: "الخزنة مش موجودة" });

    const balanceBefore = parseFloat(register.balance ?? "0");
    const isDebit = ["withdrawal", "expense_paid", "purchase_paid", "transfer_out"].includes(type);
    const balanceAfter = isDebit ? balanceBefore - amt : balanceBefore + amt;

    if (isDebit && balanceAfter < 0)
      return res.status(400).json({ error: "الرصيد مش كفاية" });

    // تحديث الرصيد
    await db.update(cashRegistersTable)
      .set({ balance: String(balanceAfter), updatedAt: now })
      .where(eq(cashRegistersTable.id, registerId));

    // تسجيل الحركة
    await db.insert(cashTransactionsTable).values({
      registerId,
      type,
      amount:          String(amt),
      balanceBefore:   String(balanceBefore),
      balanceAfter:    String(balanceAfter),
      description,
      referenceNumber,
      transactionDate: transactionDate ? new Date(transactionDate) : now,
      createdByUserId: req.body.userId ?? null,
      createdByName:   req.body.userName ?? null,
      createdAt:       now,
    });

    res.json({ success: true, newBalance: balanceAfter });
  } catch (err) {
    res.status(500).json({ error: "فشل تسجيل الحركة" });
  }
});

// ─── POST /api/cash-registers/transfer  (تحويل من رئيسية لفرع) ──────────────
cashRegistersRouter.post("/transfer", async (req, res) => {
  try {
    const { fromId, toId, amount, description } = req.body as any;
    const amt = parseFloat(amount);
    const now = new Date();

    const [from] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, fromId));
    const [to]   = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, toId));

    if (!from || !to) return res.status(404).json({ error: "خزنة غير موجودة" });
    if (from.type !== "main")
      return res.status(400).json({ error: "التحويل يبدأ من الخزنة الرئيسية بس" });

    const fromBefore = parseFloat(from.balance ?? "0");
    const toBefore   = parseFloat(to.balance   ?? "0");

    if (fromBefore - amt < 0)
      return res.status(400).json({ error: "الرصيد في الخزنة الرئيسية مش كفاية" });

    const fromAfter = fromBefore - amt;
    const toAfter   = toBefore   + amt;

    await db.update(cashRegistersTable).set({ balance: String(fromAfter), updatedAt: now }).where(eq(cashRegistersTable.id, fromId));
    await db.update(cashRegistersTable).set({ balance: String(toAfter),   updatedAt: now }).where(eq(cashRegistersTable.id, toId));

    // حركتين في جدول الحركات
    await db.insert(cashTransactionsTable).values([
      {
        registerId: fromId, type: "transfer_out", amount: String(amt),
        balanceBefore: String(fromBefore), balanceAfter: String(fromAfter),
        transferToRegisterId: toId,
        description: description ?? `تحويل إلى ${to.name}`,
        transactionDate: now, createdAt: now,
        createdByUserId: req.body.userId ?? null,
        createdByName:   req.body.userName ?? null,
      },
      {
        registerId: toId, type: "transfer_in", amount: String(amt),
        balanceBefore: String(toBefore), balanceAfter: String(toAfter),
        transferToRegisterId: fromId,
        description: description ?? `تحويل من ${from.name}`,
        transactionDate: now, createdAt: now,
        createdByUserId: req.body.userId ?? null,
        createdByName:   req.body.userName ?? null,
      },
    ]);

    res.json({ success: true, fromBalance: fromAfter, toBalance: toAfter });
  } catch (err) {
    res.status(500).json({ error: "فشل التحويل" });
  }
});

// ─── GET /api/cash-registers/:id/transactions  (كشف حساب خزنة) ──────────────
cashRegistersRouter.get("/:id/transactions", async (req, res) => {
  try {
    const registerId = parseInt(req.params.id);
    const { from, to, limit = 50 } = req.query as any;

    const conditions = [eq(cashTransactionsTable.registerId, registerId)];
    if (from) conditions.push(gte(cashTransactionsTable.transactionDate, new Date(from)));
    if (to)   conditions.push(lte(cashTransactionsTable.transactionDate, new Date(to)));

    const transactions = await db
      .select()
      .from(cashTransactionsTable)
      .where(and(...conditions))
      .orderBy(desc(cashTransactionsTable.transactionDate))
      .limit(parseInt(limit));

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: "فشل جلب الحركات" });
  }
});

// ─── PATCH /api/cash-registers/:id  (تعديل اسم الخزنة) ──────────────────────
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

// ─── DELETE /api/cash-registers/:id  (تعطيل خزنة فرع) ───────────────────────
cashRegistersRouter.delete("/:id", async (req, res) => {
  try {
    const [reg] = await db.select().from(cashRegistersTable).where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    if (reg?.type === "main") return res.status(400).json({ error: "مش ممكن تحذف الخزنة الرئيسية" });
    await db.update(cashRegistersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cashRegistersTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل الحذف" });
  }
});
