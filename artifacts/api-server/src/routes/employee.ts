import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, isNotNull, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  employeeProfilesTable,
  employeeKpisTable,
  employeeDailyLogsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireRole";

const router: IRouter = Router();
router.use(requireAuth);

// ────────────────────────────────────────────────────────────────────────────
// Helper: compute actual KPI value from orders
// ────────────────────────────────────────────────────────────────────────────
function profitFromOrder(o: typeof ordersTable.$inferSelect): number {
  const qty =
    o.status === "partial_received" && o.partialQuantity ? o.partialQuantity : o.quantity;
  const cost = (o.costPrice ?? 0) * qty;
  const shipping = o.shippingCost ?? 0;
  if (o.status === "received" || o.status === "partial_received") {
    const rev =
      o.status === "partial_received" && o.partialQuantity
        ? o.unitPrice * o.partialQuantity
        : o.totalPrice;
    return rev - cost - shipping;
  }
  if (o.status === "returned") return -(cost + shipping);
  return 0;
}

async function computeActualValue(
  metric: string,
  userId: number,
  dateFrom: Date,
  dateTo: Date
): Promise<number | null> {
  if (metric === "manual") return null;

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.assignedUserId, userId),
        gte(ordersTable.createdAt, dateFrom),
        lte(ordersTable.createdAt, dateTo)
      )
    );

  if (orders.length === 0) {
    if (metric === "delivery_rate" || metric === "return_rate") return 0;
    return 0;
  }

  switch (metric) {
    case "delivery_rate": {
      const delivered = orders.filter(
        (o) => o.status === "received" || o.status === "partial_received"
      ).length;
      return Math.round((delivered / orders.length) * 100);
    }
    case "return_rate": {
      const returned = orders.filter((o) => o.status === "returned").length;
      return Math.round((returned / orders.length) * 100);
    }
    case "total_orders":
      return orders.length;
    case "profit":
      return Math.round(orders.reduce((s, o) => s + profitFromOrder(o), 0));
    case "revenue":
      return Math.round(
        orders
          .filter((o) => o.status === "received" || o.status === "partial_received")
          .reduce((s, o) => {
            const rev =
              o.status === "partial_received" && o.partialQuantity
                ? o.unitPrice * o.partialQuantity
                : o.totalPrice;
            return s + rev;
          }, 0)
      );
    default:
      return null;
  }
}

function computeKpiScore(
  actual: number,
  target: number,
  direction: string
): number {
  if (target === 0) return actual === 0 ? 100 : 0;
  if (direction === "lower_is_better") {
    return actual <= target ? 100 : Math.max(0, Math.round((target / actual) * 100));
  }
  return Math.min(100, Math.round((actual / target) * 100));
}

// ────────────────────────────────────────────────────────────────────────────
// Resolve profile with merged displayName
// ────────────────────────────────────────────────────────────────────────────
function mergeProfile(profile: typeof employeeProfilesTable.$inferSelect, user: typeof usersTable.$inferSelect | null) {
  return {
    ...profile,
    displayName: profile.displayName ?? user?.displayName ?? "—",
    username: user?.username ?? null,
    role: user?.role ?? "team_only",
    isActive: user?.isActive ?? true,
    isSystemUser: user !== null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Employee Profiles CRUD
// ────────────────────────────────────────────────────────────────────────────

router.get("/employee-profiles", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      profile: employeeProfilesTable,
      user: usersTable,
    })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id));

  res.json(rows.map((r) => mergeProfile(r.profile, r.user)));
});

// GET by profile ID
router.get("/employee-profiles/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const [row] = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .where(eq(employeeProfilesTable.id, profileId));

  if (!row) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(eq(employeeKpisTable.profileId, profileId))
    .orderBy(employeeKpisTable.createdAt);

  res.json({
    ...mergeProfile(row.profile, row.user),
    kpis,
  });
});

const ProfileSchema = z.object({
  userId: z.number().int().positive().optional(),
  displayName: z.string().min(1).optional(),
  jobTitle: z.string().nullish(),
  department: z.string().nullish(),
  monthlySalary: z.number().min(0).optional(),
  hireDate: z.string().nullish(),
  notes: z.string().nullish(),
});

// POST — create or upsert profile
router.post("/employee-profiles", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;

  // If userId given, check if profile already exists
  if (data.userId) {
    const [existing] = await db
      .select()
      .from(employeeProfilesTable)
      .where(eq(employeeProfilesTable.userId, data.userId));

    if (existing) {
      await db
        .update(employeeProfilesTable)
        .set({
          jobTitle: data.jobTitle ?? null,
          department: data.department ?? null,
          monthlySalary: data.monthlySalary ?? 0,
          hireDate: data.hireDate ?? null,
          notes: data.notes ?? null,
        })
        .where(eq(employeeProfilesTable.userId, data.userId));
      const [updated] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.userId, data.userId!));
      res.json(updated);
      return;
    }
  }

  // Create new profile
  const insertResult = await db
    .insert(employeeProfilesTable)
    .values({
      userId: data.userId ?? null,
      displayName: data.displayName ?? null,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      monthlySalary: data.monthlySalary ?? 0,
      hireDate: data.hireDate ?? null,
      notes: data.notes ?? null,
    });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [created] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.id, insertId));
  res.status(201).json(created);
});

router.patch("/employee-profiles/:profileId", requireAdmin, async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const Schema = ProfileSchema.partial();
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const patchResult = await db
    .update(employeeProfilesTable)
    .set(parsed.data as any)
    .where(eq(employeeProfilesTable.id, profileId));
  if (!(patchResult as any)[0]?.affectedRows) { res.status(404).json({ error: "الملف الشخصي غير موجود" }); return; }
  const [updated] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.id, profileId));
  res.json(updated);
});

router.delete("/employee-profiles/:profileId", requireAdmin, async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }
  await db.delete(employeeProfilesTable).where(eq(employeeProfilesTable.id, profileId));
  res.status(204).send();
});

// ────────────────────────────────────────────────────────────────────────────
// Employee KPIs CRUD  (all keyed by profileId)
// ────────────────────────────────────────────────────────────────────────────

const KpiSchema = z.object({
  profileId: z.number().int().positive(),
  name: z.string().min(1),
  metric: z.string().default("manual"),
  targetValue: z.number(),
  unit: z.string().default("%"),
  direction: z.enum(["higher_is_better", "lower_is_better"]).default("higher_is_better"),
  weight: z.number().min(0).max(100).default(100),
  isActive: z.boolean().default(true),
  description: z.string().nullish(),
});

router.get("/employee-kpis/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }
  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(eq(employeeKpisTable.profileId, profileId))
    .orderBy(employeeKpisTable.createdAt);
  res.json(kpis);
});

router.post("/employee-kpis", requireAdmin, async (req, res): Promise<void> => {
  const parsed = KpiSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Resolve userId from profile for auto-computed metrics
  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, parsed.data.profileId));
  const userId = profile?.userId ?? null;

  const kpiInsertResult = await db
    .insert(employeeKpisTable)
    .values({
      profileId: parsed.data.profileId,
      userId,
      name: parsed.data.name,
      metric: parsed.data.metric,
      targetValue: parsed.data.targetValue,
      unit: parsed.data.unit,
      direction: parsed.data.direction,
      weight: parsed.data.weight,
      isActive: parsed.data.isActive,
      description: parsed.data.description ?? null,
    });
  const kpiInsertId = (kpiInsertResult as any)[0]?.insertId ?? (kpiInsertResult as any).insertId;
  const [kpi] = await db.select().from(employeeKpisTable).where(eq(employeeKpisTable.id, kpiInsertId));
  res.status(201).json(kpi);
});

router.patch("/employee-kpis/:kpiId", requireAdmin, async (req, res): Promise<void> => {
  const kpiId = parseInt(req.params.kpiId);
  if (isNaN(kpiId)) { res.status(400).json({ error: "Invalid kpiId" }); return; }

  const Schema = KpiSchema.partial().omit({ profileId: true });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const kpiUpdateResult = await db
    .update(employeeKpisTable)
    .set(parsed.data as any)
    .where(eq(employeeKpisTable.id, kpiId));
  if (!(kpiUpdateResult as any)[0]?.affectedRows) { res.status(404).json({ error: "المؤشر غير موجود" }); return; }
  const [updated] = await db.select().from(employeeKpisTable).where(eq(employeeKpisTable.id, kpiId));
  res.json(updated);
});

router.delete("/employee-kpis/:kpiId", requireAdmin, async (req, res): Promise<void> => {
  const kpiId = parseInt(req.params.kpiId);
  if (isNaN(kpiId)) { res.status(400).json({ error: "Invalid kpiId" }); return; }
  await db.delete(employeeKpisTable).where(eq(employeeKpisTable.id, kpiId));
  res.status(204).send();
});

// ────────────────────────────────────────────────────────────────────────────
// Monthly Report  (by profileId)
// ────────────────────────────────────────────────────────────────────────────

router.get("/analytics/employee-report/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const monthParam = (req.query.month as string) || "";
  let dateFrom: Date, dateTo: Date;
  if (monthParam) {
    const [year, month] = monthParam.split("-").map(Number);
    dateFrom = new Date(year, month - 1, 1);
    dateTo = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    const now = new Date();
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const [row] = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .where(eq(employeeProfilesTable.id, profileId));

  if (!row) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const profile = row.profile;
  const userRow = row.user;
  const userId = profile.userId;

  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));

  // Order stats (only for system users)
  let orderStats = {
    total: 0, delivered: 0, returned: 0, pending: 0,
    deliveryRate: 0, returnRate: 0, totalRevenue: 0, totalProfit: 0,
  };

  if (userId) {
    const orders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.assignedUserId, userId),
          gte(ordersTable.createdAt, dateFrom),
          lte(ordersTable.createdAt, dateTo)
        )
      );

    const delivered = orders.filter(
      (o) => o.status === "received" || o.status === "partial_received"
    ).length;
    const returned = orders.filter((o) => o.status === "returned").length;
    const pending = orders.filter(
      (o) => o.status !== "received" && o.status !== "partial_received" && o.status !== "returned"
    ).length;
    const totalRevenue = orders
      .filter((o) => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => {
        const rev =
          o.status === "partial_received" && o.partialQuantity
            ? o.unitPrice * o.partialQuantity
            : o.totalPrice;
        return s + rev;
      }, 0);
    const totalProfit = orders.reduce((s, o) => s + profitFromOrder(o), 0);
    orderStats = {
      total: orders.length,
      delivered,
      returned,
      pending,
      deliveryRate: orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0,
      returnRate: orders.length > 0 ? Math.round((returned / orders.length) * 100) : 0,
      totalRevenue,
      totalProfit,
    };
  }

  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      const actualValue = userId
        ? await computeActualValue(kpi.metric, userId, dateFrom, dateTo)
        : kpi.metric === "manual" ? null : 0;
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved };
    })
  );

  const scoredKpis = evaluatedKpis.filter((k) => k.score !== null);
  let overallScore: number | null = null;
  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((s, k) => s + k.weight, 0);
    overallScore =
      totalWeight > 0
        ? Math.round(scoredKpis.reduce((s, k) => s + k.score! * k.weight, 0) / totalWeight)
        : null;
  }

  const rating =
    overallScore === null ? "غير محدد"
    : overallScore >= 90 ? "ممتاز"
    : overallScore >= 75 ? "جيد جداً"
    : overallScore >= 60 ? "جيد"
    : overallScore >= 40 ? "مقبول"
    : "ضعيف";

  res.json({
    profileId,
    userId: userId ?? null,
    username: userRow?.username ?? null,
    displayName: profile.displayName ?? userRow?.displayName ?? "—",
    role: userRow?.role ?? "team_only",
    isSystemUser: userRow !== null,
    profile,
    period: {
      month: monthParam || `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, "0")}`,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
    },
    orderStats,
    kpis: evaluatedKpis,
    overallScore,
    rating,
    salary: profile.monthlySalary ?? 0,
  });
});

// All users without profile (for setup)
router.get("/users-without-profile", async (req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
  const profiles = await db.select().from(employeeProfilesTable);
  const profiledUserIds = new Set(profiles.map((p) => p.userId).filter(Boolean));
  const unprofiledUsers = allUsers.filter((u) => !profiledUserIds.has(u.id));
  res.json(unprofiledUsers);
});

// ────────────────────────────────────────────────────────────────────────────
// Daily Logs  (all keyed by profileId)
// ────────────────────────────────────────────────────────────────────────────

router.get("/employee-daily-logs/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  // Get userId from profile for auto-computed metrics
  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));
  const userId = profile?.userId ?? null;

  const [kpis, logs] = await Promise.all([
    db.select().from(employeeKpisTable).where(
      and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true))
    ),
    db.select().from(employeeDailyLogsTable).where(
      and(eq(employeeDailyLogsTable.profileId, profileId), eq(employeeDailyLogsTable.date, date))
    ),
  ]);

  const logsMap = new Map(logs.map(l => [l.kpiId, l]));

  const result = await Promise.all(
    kpis.map(async (kpi) => {
      const log = logsMap.get(kpi.id);
      let autoValue: number | null = null;
      if (kpi.metric !== "manual" && userId) {
        autoValue = await computeActualValue(kpi.metric, userId, dayStart, dayEnd);
      }
      const actualValue = kpi.metric === "manual" ? (log?.value ?? null) : autoValue;
      const dailyTarget = kpi.targetValue / 30;
      const score = actualValue !== null
        ? computeKpiScore(actualValue, dailyTarget, kpi.direction)
        : null;
      const achieved = score !== null
        ? (kpi.direction === "lower_is_better" ? actualValue! <= dailyTarget : actualValue! >= dailyTarget)
        : null;
      return {
        ...kpi,
        date,
        actualValue,
        dailyTarget,
        logId: log?.id ?? null,
        logNotes: log?.notes ?? null,
        score,
        achieved,
      };
    })
  );

  res.json({ date, kpis: result });
});

router.get("/employee-daily-logs/:profileId/week", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const endDate = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const end = new Date(endDate);

  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));
  const userId = profile?.userId ?? null;

  const kpis = await db.select().from(employeeKpisTable).where(
    and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true))
  );

  const logs = await db.select().from(employeeDailyLogsTable).where(
    and(
      eq(employeeDailyLogsTable.profileId, profileId),
      gte(employeeDailyLogsTable.date, dates[0]),
      lte(employeeDailyLogsTable.date, endDate)
    )
  );

  const kpiWeeks = await Promise.all(
    kpis.map(async (kpi) => {
      const weekDays = await Promise.all(
        dates.map(async (date) => {
          const log = logs.find(l => l.kpiId === kpi.id && l.date === date);
          let actualValue: number | null = null;
          if (kpi.metric !== "manual" && userId) {
            const dayStart = new Date(`${date}T00:00:00.000Z`);
            const dayEnd = new Date(`${date}T23:59:59.999Z`);
            actualValue = await computeActualValue(kpi.metric, userId, dayStart, dayEnd);
          } else {
            actualValue = log?.value ?? null;
          }
          const dailyTarget = kpi.targetValue / 30;
          const achieved = actualValue !== null
            ? (kpi.direction === "lower_is_better" ? actualValue <= dailyTarget : actualValue >= dailyTarget)
            : null;
          return { date, actualValue, dailyTarget, achieved };
        })
      );
      return { kpiId: kpi.id, kpiName: kpi.name, days: weekDays };
    })
  );

  res.json({ dates, kpiWeeks });
});

const DailyLogSchema = z.object({
  profileId: z.number().int().positive(),
  kpiId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
  notes: z.string().nullish(),
});

router.post("/employee-daily-logs", async (req, res): Promise<void> => {
  const parsed = DailyLogSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { profileId, kpiId, date, value, notes } = parsed.data;

  // Resolve userId from profile
  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));
  const userId = profile?.userId ?? null;

  const [existing] = await db
    .select()
    .from(employeeDailyLogsTable)
    .where(
      and(
        eq(employeeDailyLogsTable.profileId, profileId),
        eq(employeeDailyLogsTable.kpiId, kpiId),
        eq(employeeDailyLogsTable.date, date)
      )
    );

  if (existing) {
    await db
      .update(employeeDailyLogsTable)
      .set({ value, notes: notes ?? null, updatedAt: new Date() })
      .where(eq(employeeDailyLogsTable.id, existing.id));
    const [updated] = await db.select().from(employeeDailyLogsTable).where(eq(employeeDailyLogsTable.id, existing.id));
    res.json(updated);
  } else {
    const logInsertResult = await db
      .insert(employeeDailyLogsTable)
      .values({ profileId, userId, kpiId, date, value, notes: notes ?? null });
    const logInsertId = (logInsertResult as any)[0]?.insertId ?? (logInsertResult as any).insertId;
    const [created] = await db.select().from(employeeDailyLogsTable).where(eq(employeeDailyLogsTable.id, logInsertId));
    res.status(201).json(created);
  }
});

export default router;
