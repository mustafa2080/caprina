import { Router, type IRouter } from "express";
import { eq, and, or, gte, lte, desc, isNotNull, isNull, like, sum } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  employeeProfilesTable,
  employeeKpisTable,
  employeeDailyLogsTable,
  attendanceTable,
  appSettingsTable,
} from "@workspace/db";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin, requireSuperAdmin } from "../middlewares/requireRole";
import { getTenantId } from "../middlewares/requireTenant.js";

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
  dateTo: Date,
  tenantId?: number | null
): Promise<number | null> {
  if (metric === "manual") return null;

  const orders = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        or(
          eq(ordersTable.assignedUserId, userId),
          eq(ordersTable.createdByUserId, userId)
        ),
        gte(ordersTable.createdAt, dateFrom),
        lte(ordersTable.createdAt, dateTo),
        isNull(ordersTable.deletedAt),
        tenantId != null ? eq(ordersTable.tenantId, tenantId) : undefined
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
    case "total_orders": {
      // عد الـ invoices الفريدة (مش الـ rows) — نفس منطق orders.tsx
      const uniqueInvoices = new Set(orders.map(o => o.invoiceNumber ?? `solo-${o.id}`));
      return uniqueInvoices.size;
    }
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


// ─── دالة حساب دورة الراتب: من 26 الشهر السابق لـ 25 الشهر الحالي ──────────
function getPayPeriod(monthParam: string): { dateFrom: Date; dateTo: Date; periodLabel: string } {
  let year: number, month: number;
  if (monthParam) {
    [year, month] = monthParam.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  // من: 26 الشهر السابق
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const dateFrom  = new Date(prevYear, prevMonth - 1, 26, 0, 0, 0, 0);
  // إلى: 25 الشهر الحالي
  const dateTo    = new Date(year, month - 1, 25, 23, 59, 59, 999);
  const periodLabel = `${prevYear}-${String(prevMonth).padStart(2,"0")}-26 → ${year}-${String(month).padStart(2,"0")}-25`;
  return { dateFrom, dateTo, periodLabel };
}

router.get("/employee-profiles", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);

  // جلب كل الـ profiles مع الـ users بـ leftJoin
  const rows = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id));

  // فلترة بالـ tenant من الـ profile مباشرة
  const filtered = tenantId !== null
    ? rows.filter(r => r.profile.tenantId === tenantId)
    : rows.filter(r => r.profile.tenantId === null);

  // جلب kpiCount لكل profile دفعة واحدة
  const allKpis = await db.select({ profileId: employeeKpisTable.profileId }).from(employeeKpisTable);
  const kpiCountMap: Record<number, number> = {};
  for (const k of allKpis) kpiCountMap[k.profileId] = (kpiCountMap[k.profileId] ?? 0) + 1;

  // جلب الحضور للشهر الحالي لكل profile
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const attRecords = await db.select({
    profileId: attendanceTable.profileId,
    status: attendanceTable.status,
  }).from(attendanceTable).where(like(attendanceTable.date, `${monthStr}-%`));

  const attMap: Record<number, { workedDays: number; absentDays: number; lateDays: number }> = {};
  for (const r of attRecords) {
    if (!attMap[r.profileId]) attMap[r.profileId] = { workedDays: 0, absentDays: 0, lateDays: 0 };
    if (r.status === "present") attMap[r.profileId].workedDays++;
    if (r.status === "late")    { attMap[r.profileId].workedDays++; attMap[r.profileId].lateDays++; }
    if (r.status === "absent")  attMap[r.profileId].absentDays++;
    if (r.status === "half_day") attMap[r.profileId].workedDays += 0.5;
  }

  res.json(filtered.map((r) => ({
    ...mergeProfile(r.profile, r.user),
    kpiCount: kpiCountMap[r.profile.id] ?? 0,
    attendanceSummary: attMap[r.profile.id] ?? { workedDays: 0, absentDays: 0, lateDays: 0 },
  })));
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
  avatar: z.string().nullish(),
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
          avatar: data.avatar !== undefined ? (data.avatar ?? null) : undefined,
        })
        .where(eq(employeeProfilesTable.userId, data.userId));
      const [updated] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.userId, data.userId!));
      res.json(updated);
      return;
    }
  }

  // Create new profile
  const creatorTenantId = getTenantId(req);
  const insertResult = await db
    .insert(employeeProfilesTable)
    .values({
      tenantId: creatorTenantId ?? undefined,
      userId: data.userId ?? null,
      displayName: data.displayName ?? null,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      monthlySalary: data.monthlySalary ?? 0,
      hireDate: data.hireDate ?? null,
      notes: data.notes ?? null,
      avatar: data.avatar ?? null,
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

  // تحقق من وجود الملف أولاً
  const [existing] = await db.select({ id: employeeProfilesTable.id }).from(employeeProfilesTable).where(eq(employeeProfilesTable.id, profileId));
  if (!existing) { res.status(404).json({ error: "الملف الشخصي غير موجود" }); return; }

  await db
    .update(employeeProfilesTable)
    .set({ ...parsed.data as any, updatedAt: new Date() })
    .where(eq(employeeProfilesTable.id, profileId));

  // ── sync users table لو الـ profile مرتبط بـ userId ──
  const [updatedProfile] = await db.select().from(employeeProfilesTable).where(eq(employeeProfilesTable.id, profileId));
  if (updatedProfile.userId) {
    const userUpdates: Record<string, any> = {};
    if (parsed.data.displayName !== undefined) userUpdates.displayName = parsed.data.displayName;
    if (parsed.data.avatar !== undefined) userUpdates.avatar = parsed.data.avatar ?? null;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, updatedProfile.userId));
    }
  }

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
  salaryWeight: z.number().min(0).max(100).default(0),
  overtargetBonus: z.number().min(0).max(100).default(0),
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
      salaryWeight: parsed.data.salaryWeight,
      overtargetBonus: parsed.data.overtargetBonus,
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

router.delete("/employee-kpis/:kpiId", requireSuperAdmin, async (req, res): Promise<void> => {
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
  const { dateFrom, dateTo } = getPayPeriod(monthParam);

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

  // Cumulative sum for manual KPIs from daily logs in this month
  const monthStart = dateFrom.toISOString().slice(0, 10);
  const monthEnd   = dateTo.toISOString().slice(0, 10);
  const manualLogs = await db
    .select({ kpiId: employeeDailyLogsTable.kpiId, total: sum(employeeDailyLogsTable.value) })
    .from(employeeDailyLogsTable)
    .where(
      and(
        eq(employeeDailyLogsTable.profileId, profileId),
        gte(employeeDailyLogsTable.date, monthStart),
        lte(employeeDailyLogsTable.date, monthEnd)
      )
    )
    .groupBy(employeeDailyLogsTable.kpiId);
  const manualCumulativeMap = new Map(
    manualLogs.map(r => [r.kpiId, parseFloat(String(r.total ?? "0"))])
  );

  // Order stats (only for system users)
  let orderStats = {
    total: 0, delivered: 0, returned: 0, pending: 0,
    deliveryRate: 0, returnRate: 0, totalRevenue: 0, totalProfit: 0,
  };

  if (userId) {
    const tenantId = profile.tenantId;
    const orders = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          or(
            eq(ordersTable.assignedUserId, userId),
            eq(ordersTable.createdByUserId, userId)
          ),
          gte(ordersTable.createdAt, dateFrom),
          lte(ordersTable.createdAt, dateTo),
          isNull(ordersTable.deletedAt),
          tenantId != null ? eq(ordersTable.tenantId, tenantId) : undefined
        )
      );

    // ── حساب الإحصائيات على مستوى الـ invoice (مش الـ rows) ──
    // نفس منطق buildPerUserInvoices في team-analytics.ts
    const STATUS_PRIORITY: Record<string, number> = {
      pending: 1, in_shipping: 2, warehouse_ready: 3, delayed: 4,
      partial_received: 5, received: 6, returned: 7,
    };
    const invoiceRowsMap = new Map<string, (typeof ordersTable.$inferSelect)[]>();
    for (const o of orders) {
      const key = o.invoiceNumber ?? `solo-${o.id}`;
      if (!invoiceRowsMap.has(key)) invoiceRowsMap.set(key, []);
      invoiceRowsMap.get(key)!.push(o);
    }
    const invoiceStatuses = Array.from(invoiceRowsMap.values()).map(rows => {
      const statuses = rows.map(r => r.status);
      if (statuses.length === 1) return { status: statuses[0], rows };
      const resolved = [...statuses].sort(
        (a, b) => (STATUS_PRIORITY[a] ?? 99) - (STATUS_PRIORITY[b] ?? 99)
      )[0];
      return { status: resolved, rows };
    });
    const totalInvoices = invoiceStatuses.length;
    const delivered = invoiceStatuses.filter(
      (i) => i.status === "received" || i.status === "partial_received"
    ).length;
    const returned = invoiceStatuses.filter((i) => i.status === "returned").length;
    const pending = invoiceStatuses.filter(
      (i) => i.status !== "received" && i.status !== "partial_received" && i.status !== "returned"
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
      total: totalInvoices,
      delivered,
      returned,
      pending,
      deliveryRate: totalInvoices > 0 ? Math.round((delivered / totalInvoices) * 100) : 0,
      returnRate: totalInvoices > 0 ? Math.round((returned / totalInvoices) * 100) : 0,
      totalRevenue,
      totalProfit,
    };
  }

  // For manual KPIs: if the month is still in progress, compare against
  // the progressive target (monthlyTarget * daysPassed / daysInMonth)
  // so the score reflects current-day pace, not the full monthly target.
  const now = new Date();
  const isCurrentMonth =
    dateFrom.getFullYear() === now.getFullYear() &&
    dateFrom.getMonth() === now.getMonth();
  const reportDayNumber  = isCurrentMonth ? now.getDate() : dateTo.getDate();
  const reportDaysInMonth = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0).getDate();

  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      let actualValue: number | null;
      if (kpi.metric === "manual") {
        // use cumulative monthly sum from daily logs
        actualValue = manualCumulativeMap.get(kpi.id) ?? null;
      } else {
        actualValue = userId
          ? await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId)
          : 0;
      }
      // Progressive target for current month — applies to ALL metric types.
      // For past months (completed): use full monthly target as-is.
      const effectiveTarget = isCurrentMonth
        ? Math.max(1, Math.round((kpi.targetValue / reportDaysInMonth) * reportDayNumber))
        : kpi.targetValue;
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, effectiveTarget, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved, effectiveTarget };
    })
  );

  const scoredKpis = evaluatedKpis.filter((k) => k.score !== null);
  const baseSalary = profile.monthlySalary ?? 0;
  const kpiFinancials = evaluatedKpis.reduce(
    (acc, kpi) => {
      const salaryWeight = kpi.salaryWeight ?? 0;
      const overtargetBonus = kpi.overtargetBonus ?? 0;
      const salaryImpact = baseSalary > 0 ? Math.round((salaryWeight / 100) * baseSalary) : 0;
      const bonusImpact = baseSalary > 0 ? Math.round((overtargetBonus / 100) * baseSalary) : 0;

      acc.totalSalaryWeight += salaryWeight;
      acc.achievedCount += kpi.achieved === true ? 1 : 0;
      acc.failedCount += kpi.achieved === false ? 1 : 0;
      acc.overTargetCount += kpi.score !== null && kpi.score > 100 ? 1 : 0;
      acc.totalDeduction += kpi.achieved === false && salaryWeight > 0 ? salaryImpact : 0;
      acc.totalBonus += kpi.score !== null && kpi.score > 100 && overtargetBonus > 0 ? bonusImpact : 0;
      return acc;
    },
    {
      totalSalaryWeight: 0,
      totalDeduction: 0,
      totalBonus: 0,
      achievedCount: 0,
      failedCount: 0,
      overTargetCount: 0,
    }
  );
  let overallScore: number | null = null;
  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((s, k) => s + k.weight, 0);
    overallScore =
      totalWeight > 0
        ? Math.round(scoredKpis.reduce((s, k) => s + k.score! * k.weight, 0) / totalWeight)
        : null;
  }

  // fallback: لو مفيش KPIs — نحسب من الطلبات المغلقة فقط (delivered + returned)
  if (overallScore === null && orderStats.total > 0) {
    const closedCount = orderStats.delivered + orderStats.returned;
    if (closedCount > 0) {
      const closedDeliveryRate = Math.round((orderStats.delivered / closedCount) * 100);
      const closedReturnRate   = Math.round((orderStats.returned  / closedCount) * 100);
      const returnPenalty      = Math.max(0, 100 - closedReturnRate * 2);
      overallScore = Math.round(closedDeliveryRate * 0.6 + returnPenalty * 0.4);
    }
    // لو مفيش طلبات مغلقة خالص → مفيش score بعد (كل الطلبات لسه pending)
  }

  const rating =
    overallScore === null ? "لا توجد بيانات"
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
    kpiFinancials: {
      ...kpiFinancials,
      totalSalaryWeight: Math.round(kpiFinancials.totalSalaryWeight),
      totalDeduction: Math.round(kpiFinancials.totalDeduction),
      totalBonus: Math.round(kpiFinancials.totalBonus),
      salaryAtRiskPercent: Math.round(kpiFinancials.totalSalaryWeight),
    },
    overallScore,
    rating,
    salary: baseSalary,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /analytics/my-report?month=YYYY-MM  (current user from token)
// ────────────────────────────────────────────────────────────────────────────
router.get("/analytics/my-report", async (req, res): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .where(eq(employeeProfilesTable.userId, userId));

  if (!row) {
    // No employee profile — return basic stats from orders only
  const monthParam = (req.query.month as string) || "";
  const { dateFrom, dateTo } = getPayPeriod(monthParam);

    const orders = await db
      .select()
      .from(ordersTable)
      .where(and(
        or(
          eq(ordersTable.assignedUserId, userId),
          eq(ordersTable.createdByUserId, userId)
        ),
        gte(ordersTable.createdAt, dateFrom),
        lte(ordersTable.createdAt, dateTo),
        isNull(ordersTable.deletedAt)
      ));

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    // ── عد الـ invoices الفريدة ──
    const _sp0: Record<string, number> = { pending:1,in_shipping:2,warehouse_ready:3,delayed:4,partial_received:5,received:6,returned:7 };
    const _imap0 = new Map<string, (typeof ordersTable.$inferSelect)[]>();
    for (const o of orders) { const k = o.invoiceNumber ?? `solo-${o.id}`; if (!_imap0.has(k)) _imap0.set(k,[]); _imap0.get(k)!.push(o); }
    const _inv0 = Array.from(_imap0.values()).map(rows => { const ss=rows.map(r=>r.status); return [...ss].sort((a,b)=>(_sp0[a]??99)-(_sp0[b]??99))[0]; });
    const totalInvoices0 = _inv0.length;
    const delivered = _inv0.filter(s => s === "received" || s === "partial_received").length;
    const returned = _inv0.filter(s => s === "returned").length;
    const pending = _inv0.filter(s => s !== "received" && s !== "partial_received" && s !== "returned").length;
    const totalRevenue = orders.filter(o => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => s + (o.status === "partial_received" && o.partialQuantity ? o.unitPrice * o.partialQuantity : o.totalPrice), 0);
    const totalProfit = orders.reduce((s, o) => s + profitFromOrder(o), 0);

    const deliveryRate = totalInvoices0 > 0 ? Math.round((delivered / totalInvoices0) * 100) : 0;
    const returnRate   = totalInvoices0 > 0 ? Math.round((returned  / totalInvoices0) * 100) : 0;

    // fallback score من الطلبات المغلقة فقط
    let noProfileScore: number | null = null;
    if (orders.length > 0) {
      const closedCount0 = delivered + returned;
      if (closedCount0 > 0) {
        const closedDR = Math.round((delivered / closedCount0) * 100);
        const closedRR = Math.round((returned  / closedCount0) * 100);
        const returnPenalty = Math.max(0, 100 - closedRR * 2);
        noProfileScore = Math.round(closedDR * 0.6 + returnPenalty * 0.4);
      }
    }
    const noProfileRating =
      noProfileScore === null ? "لا توجد بيانات"
      : noProfileScore >= 90 ? "ممتاز"
      : noProfileScore >= 75 ? "جيد جداً"
      : noProfileScore >= 60 ? "جيد"
      : noProfileScore >= 40 ? "مقبول"
      : "ضعيف";

    return res.json({
      profileId: null,
      userId,
      displayName: userRow?.displayName ?? "—",
      noProfile: true,
      period: { month: monthParam || `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, "0")}`, from: dateFrom.toISOString(), to: dateTo.toISOString() },
      orderStats: { total: totalInvoices0, delivered, returned, pending, deliveryRate, returnRate, totalRevenue, totalProfit },
      kpis: [],
      kpiFinancials: { totalSalaryWeight: 0, totalDeduction: 0, totalBonus: 0, achievedCount: 0, failedCount: 0, overTargetCount: 0, salaryAtRiskPercent: 0 },
      overallScore: noProfileScore,
      rating: noProfileRating,
      salary: 0,
    });
  }

  // Has profile — run full report logic directly (no redirect)
  const profileId = row.profile.id;
  const profile = row.profile;
  const userRow = row.user;

  const monthParam = (req.query.month as string) || "";
  const { dateFrom, dateTo } = getPayPeriod(monthParam);

  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));

  // Cumulative sum for manual KPIs from daily logs in this month
  const monthStartMR = dateFrom.toISOString().slice(0, 10);
  const monthEndMR   = dateTo.toISOString().slice(0, 10);
  const manualLogsMR = await db
    .select({ kpiId: employeeDailyLogsTable.kpiId, total: sum(employeeDailyLogsTable.value) })
    .from(employeeDailyLogsTable)
    .where(and(
      eq(employeeDailyLogsTable.profileId, profileId),
      gte(employeeDailyLogsTable.date, monthStartMR),
      lte(employeeDailyLogsTable.date, monthEndMR)
    ))
    .groupBy(employeeDailyLogsTable.kpiId);
  const manualCumulativeMapMR = new Map(
    manualLogsMR.map(r => [r.kpiId, parseFloat(String(r.total ?? "0"))])
  );

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(
      or(
        eq(ordersTable.assignedUserId, userId),
        eq(ordersTable.createdByUserId, userId)
      ),
      gte(ordersTable.createdAt, dateFrom),
      lte(ordersTable.createdAt, dateTo),
      isNull(ordersTable.deletedAt),
      profile.tenantId != null ? eq(ordersTable.tenantId, profile.tenantId) : undefined
    ));

  const totalRevenue = orders.filter(o => o.status === "received" || o.status === "partial_received")
    .reduce((s, o) => s + (o.status === "partial_received" && o.partialQuantity ? o.unitPrice * o.partialQuantity : o.totalPrice), 0);
  const totalProfit = orders.reduce((s, o) => s + profitFromOrder(o), 0);

  // ── عد الـ invoices الفريدة ──
  const _sp2: Record<string, number> = { pending:1,in_shipping:2,warehouse_ready:3,delayed:4,partial_received:5,received:6,returned:7 };
  const _imap2 = new Map<string, (typeof ordersTable.$inferSelect)[]>();
  for (const o of orders) { const k = o.invoiceNumber ?? `solo-${o.id}`; if (!_imap2.has(k)) _imap2.set(k,[]); _imap2.get(k)!.push(o); }
  const _inv2 = Array.from(_imap2.values()).map(rows => { const ss=rows.map(r=>r.status); return [...ss].sort((a,b)=>(_sp2[a]??99)-(_sp2[b]??99))[0]; });
  const totalInvoices2 = _inv2.length;
  const delivered = _inv2.filter(s => s === "received" || s === "partial_received").length;
  const returned  = _inv2.filter(s => s === "returned").length;
  const pending   = _inv2.filter(s => s !== "received" && s !== "partial_received" && s !== "returned").length;

  const orderStats = {
    total: totalInvoices2,
    delivered,
    returned,
    pending,
    deliveryRate: totalInvoices2 > 0 ? Math.round((delivered / totalInvoices2) * 100) : 0,
    returnRate:   totalInvoices2 > 0 ? Math.round((returned  / totalInvoices2) * 100) : 0,
    totalRevenue,
    totalProfit,
  };

  // Progressive target for manual KPIs (same logic as employee-report)
  const nowMR = new Date();
  const isCurrentMonthMR =
    dateFrom.getFullYear() === nowMR.getFullYear() &&
    dateFrom.getMonth() === nowMR.getMonth();
  const reportDayNumberMR   = isCurrentMonthMR ? nowMR.getDate() : dateTo.getDate();
  const reportDaysInMonthMR = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0).getDate();

  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      let actualValue: number | null;
      if (kpi.metric === "manual") {
        actualValue = manualCumulativeMapMR.get(kpi.id) ?? null;
      } else {
        actualValue = await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId);
      }
      const effectiveTarget = kpi.metric === "manual" && isCurrentMonthMR
        ? Math.max(1, Math.round((kpi.targetValue / reportDaysInMonthMR) * reportDayNumberMR))
        : kpi.targetValue;
      const score = actualValue !== null ? computeKpiScore(actualValue, effectiveTarget, kpi.direction) : null;
      const achieved = score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved, effectiveTarget };
    })
  );

  const scoredKpis = evaluatedKpis.filter(k => k.score !== null);
  const baseSalary = profile.monthlySalary ?? 0;
  const kpiFinancials = evaluatedKpis.reduce((acc, kpi) => {
    const salaryWeight    = kpi.salaryWeight ?? 0;
    const overtargetBonus = kpi.overtargetBonus ?? 0;
    const salaryImpact    = baseSalary > 0 ? Math.round((salaryWeight / 100) * baseSalary) : 0;
    const bonusImpact     = baseSalary > 0 ? Math.round((overtargetBonus / 100) * baseSalary) : 0;
    acc.totalSalaryWeight += salaryWeight;
    acc.achievedCount     += kpi.achieved === true  ? 1 : 0;
    acc.failedCount       += kpi.achieved === false ? 1 : 0;
    acc.overTargetCount   += kpi.score !== null && kpi.score > 100 ? 1 : 0;
    acc.totalDeduction    += kpi.achieved === false && salaryWeight > 0 ? salaryImpact : 0;
    acc.totalBonus        += kpi.score !== null && kpi.score > 100 && overtargetBonus > 0 ? bonusImpact : 0;
    return acc;
  }, { totalSalaryWeight: 0, totalDeduction: 0, totalBonus: 0, achievedCount: 0, failedCount: 0, overTargetCount: 0 });

  let overallScore: number | null = null;
  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((s, k) => s + k.weight, 0);
    overallScore = totalWeight > 0
      ? Math.round(scoredKpis.reduce((s, k) => s + k.score! * k.weight, 0) / totalWeight)
      : null;
  }

  // fallback: لو مفيش KPIs — نحسب من الطلبات المغلقة فقط (delivered + returned)
  if (overallScore === null && orderStats.total > 0) {
    const closedCount = orderStats.delivered + orderStats.returned;
    if (closedCount > 0) {
      const closedDeliveryRate = Math.round((orderStats.delivered / closedCount) * 100);
      const closedReturnRate   = Math.round((orderStats.returned  / closedCount) * 100);
      const returnPenalty      = Math.max(0, 100 - closedReturnRate * 2);
      overallScore = Math.round(closedDeliveryRate * 0.6 + returnPenalty * 0.4);
    }
    // لو كل الطلبات لسه pending → مفيش score
  }

  const rating =
    overallScore === null ? "لا توجد بيانات"
    : overallScore >= 90 ? "ممتاز"
    : overallScore >= 75 ? "جيد جداً"
    : overallScore >= 60 ? "جيد"
    : overallScore >= 40 ? "مقبول"
    : "ضعيف";

  return res.json({
    profileId,
    userId,
    displayName: profile.displayName ?? userRow?.displayName ?? "—",
    period: {
      month: monthParam || `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, "0")}`,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
    },
    orderStats,
    kpis: evaluatedKpis,
    kpiFinancials: {
      ...kpiFinancials,
      totalSalaryWeight: Math.round(kpiFinancials.totalSalaryWeight),
      totalDeduction: Math.round(kpiFinancials.totalDeduction),
      totalBonus: Math.round(kpiFinancials.totalBonus),
      salaryAtRiskPercent: Math.round(kpiFinancials.totalSalaryWeight),
    },
    overallScore,
    rating,
    salary: baseSalary,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /employee-orders/:profileId?month=YYYY-MM
// طلبات الموظف (createdBy أو assigned) مع إحصائياتها الكاملة
// ────────────────────────────────────────────────────────────────────────────
router.get("/employee-orders/:profileId", async (req, res): Promise<void> => {
  const profileId = parseInt(req.params.profileId);
  if (isNaN(profileId)) { res.status(400).json({ error: "Invalid profileId" }); return; }

  const monthParam = (req.query.month as string | undefined) || "";
  const { dateFrom, dateTo } = getPayPeriod(monthParam);

  // جلب الـ profile والـ userId
  const [row] = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .leftJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .where(eq(employeeProfilesTable.id, profileId));

  if (!row) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const reqUser = (req as any).user;
  const isSuperOrAdmin = reqUser?.role === "super_admin" || reqUser?.role === "admin";
  const tenantId = getTenantId(req);

  // جلب طلبات الموظف — دايماً فلتر على userId بتاع الموظف (مش الـ requester)
  const targetUserId = row.profile.userId;
  if (!targetUserId) {
    res.json({
      orders: [], stats: { total: 0, delivered: 0, returned: 0, pending: 0, inShipping: 0,
        deliveryRate: 0, returnRate: 0, totalRevenue: 0, totalProfit: 0 },
      kpiImpact: { deliveryRate: 0, returnRate: 0, totalOrders: 0, revenue: 0, profit: 0 },
    });
    return;
  }

  const orderConditions: any[] = [
    isNull(ordersTable.deletedAt),                        // استبعاد المحذوفة دايماً
    eq(ordersTable.createdByUserId, targetUserId),        // طلبات الموظف ده بالتحديد
    gte(ordersTable.createdAt, dateFrom),
    lte(ordersTable.createdAt, dateTo),
  ];
  if (tenantId !== null) orderConditions.push(eq(ordersTable.tenantId, tenantId));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(...orderConditions))
    .orderBy(desc(ordersTable.createdAt));

  // ── Group rows → invoices (نفس منطق buildPerUserInvoices) ──
  const _SP: Record<string, number> = { pending:1, in_shipping:2, warehouse_ready:3, delayed:4, partial_received:5, received:6, returned:7 };
  const invRowsMap = new Map<string, (typeof ordersTable.$inferSelect)[]>();
  for (const o of orders) {
    const k = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invRowsMap.has(k)) invRowsMap.set(k, []);
    invRowsMap.get(k)!.push(o);
  }

  // resolve كل invoice: status أولوية + بيانات من أول row
  type ResolvedInvoice = {
    id: number; invoiceNumber: string | null; customerName: string;
    product: string; quantity: number; unitPrice: number; totalPrice: number;
    status: string; city: string | null; adSource: string | null;
    shippingCost: number | null; createdAt: string; color: string | null; size: string | null;
    productCount: number; // عدد المنتجات داخل الفاتورة
  };

  const resolvedInvoices: ResolvedInvoice[] = Array.from(invRowsMap.values()).map(rows => {
    const statuses = rows.map(r => r.status);
    const resolvedStatus = [...statuses].sort((a, b) => (_SP[a] ?? 99) - (_SP[b] ?? 99))[0];
    const first = rows[0];
    const totalQty   = rows.reduce((s, r) => s + r.quantity, 0);
    const totalPrice = rows.reduce((s, r) => s + r.totalPrice, 0);
    // اسم المنتجات مجمعين
    const productNames = [...new Set(rows.map(r => r.product ?? ""))].join(" + ");
    return {
      id:            first.id,
      invoiceNumber: first.invoiceNumber,
      customerName:  first.customerName,
      product:       productNames,
      quantity:      totalQty,
      unitPrice:     first.unitPrice,
      totalPrice,
      status:        resolvedStatus,
      city:          first.city,
      adSource:      first.adSource,
      shippingCost:  first.shippingCost,
      createdAt:     first.createdAt instanceof Date ? first.createdAt.toISOString() : String(first.createdAt),
      color:         rows.length > 1 ? null : first.color,
      size:          rows.length > 1 ? null : first.size,
      productCount:  rows.length,
    };
  });

  // sort بالأحدث
  resolvedInvoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // حساب الإحصائيات على مستوى الـ invoice
  const totalInv    = resolvedInvoices.length;
  const deliveredInv  = resolvedInvoices.filter(i => i.status === "received" || i.status === "partial_received");
  const returnedInv   = resolvedInvoices.filter(i => i.status === "returned");
  const inShippingInv = resolvedInvoices.filter(i => i.status === "in_shipping");
  const pendingInv    = resolvedInvoices.filter(i => !["received","partial_received","returned"].includes(i.status));

  const totalRevenue = deliveredInv.reduce((s, i) => s + i.totalPrice, 0);
  const totalProfit  = orders.reduce((s, o) => s + profitFromOrder(o), 0);

  const stats = {
    total:        totalInv,
    delivered:    deliveredInv.length,
    returned:     returnedInv.length,
    inShipping:   inShippingInv.length,
    pending:      pendingInv.length,
    deliveryRate: totalInv > 0 ? Math.round((deliveredInv.length / totalInv) * 100) : 0,
    returnRate:   totalInv > 0 ? Math.round((returnedInv.length  / totalInv) * 100) : 0,
    totalRevenue: Math.round(totalRevenue),
    totalProfit:  Math.round(totalProfit),
  };

  const kpiImpact = {
    deliveryRate: stats.deliveryRate,
    returnRate:   stats.returnRate,
    totalOrders:  stats.total,
    revenue:      stats.totalRevenue,
    profit:       stats.totalProfit,
  };

  const simplifiedOrders = resolvedInvoices.map(i => ({
    id:            i.id,
    invoiceNumber: i.invoiceNumber,
    customerName:  i.customerName,
    product:       i.product,
    quantity:      i.quantity,
    unitPrice:     i.unitPrice,
    totalPrice:    i.totalPrice,
    status:        i.status,
    city:          i.city,
    adSource:      i.adSource,
    shippingCost:  i.shippingCost,
    createdAt:     i.createdAt,
    color:         i.color,
    size:          i.size,
    productCount:  i.productCount,
  }));

  res.json({ orders: simplifiedOrders, stats, kpiImpact });
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

  // month range for cumulative sum
  const monthStart = date.slice(0, 7) + "-01";
  const monthEnd   = date;

  // Get userId from profile for auto-computed metrics
  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.id, profileId));
  const userId = profile?.userId ?? null;

  const [kpis, logs, monthlyLogs] = await Promise.all([
    db.select().from(employeeKpisTable).where(
      and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true))
    ),
    // today's logs only (for the input field current value)
    db.select().from(employeeDailyLogsTable).where(
      and(eq(employeeDailyLogsTable.profileId, profileId), eq(employeeDailyLogsTable.date, date))
    ),
    // all logs this month (for cumulative sum)
    db.select().from(employeeDailyLogsTable).where(
      and(
        eq(employeeDailyLogsTable.profileId, profileId),
        gte(employeeDailyLogsTable.date, monthStart),
        lte(employeeDailyLogsTable.date, monthEnd)
      )
    ),
  ]);

  const logsMap = new Map(logs.map(l => [l.kpiId, l]));

  // build cumulative map per kpiId
  const cumulativeMap = new Map<number, number>();
  for (const log of monthlyLogs) {
    cumulativeMap.set(log.kpiId, (cumulativeMap.get(log.kpiId) ?? 0) + (log.value ?? 0));
  }

  const result = await Promise.all(
    kpis.map(async (kpi) => {
      const log = logsMap.get(kpi.id);
      let autoValue: number | null = null;
      if (kpi.metric !== "manual" && userId) {
        autoValue = await computeActualValue(kpi.metric, userId, dayStart, dayEnd);
      }

      // manual KPIs: use cumulative monthly sum for progress/achieved
      // todayValue: what was entered today (shown in input field)
      const todayValue      = kpi.metric === "manual" ? (log?.value ?? null) : null;
      const cumulativeValue = kpi.metric === "manual" ? (cumulativeMap.get(kpi.id) ?? null) : null;
      const actualValue     = kpi.metric === "manual" ? cumulativeValue : autoValue;

      // manual: progressive daily target = (monthlyTarget / daysInMonth) * dayNumber
      // e.g. target=1000, day 15 of 30 → expected so far = 500
      // auto:  compare today's value vs dailyTarget (target/30)
      let dailyTarget: number;
      if (kpi.metric === "manual") {
        const [yr, mo] = date.split("-").map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();
        const dayNumber   = parseInt(date.split("-")[2], 10);
        dailyTarget = Math.round((kpi.targetValue / daysInMonth) * dayNumber);
      } else {
        dailyTarget = kpi.targetValue / 30;
      }

      const score = actualValue !== null
        ? computeKpiScore(actualValue, dailyTarget, kpi.direction)
        : null;
      const achieved = actualValue !== null
        ? (kpi.direction === "lower_is_better" ? actualValue <= dailyTarget : actualValue >= dailyTarget)
        : null;
      return {
        ...kpi,
        date,
        actualValue,
        cumulativeValue,
        todayValue,
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

// ── GET /employee/team-ranking?month=YYYY-MM ──────────────────────────────
// يرجع كل الموظفين مرتبين حسب overallScore من الأعلى للأقل
router.get("/team-ranking", requireAdmin, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req);
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  // جيب كل الـ profiles في نفس الـ tenant
  const profiles = await db.select({
    id: employeeProfilesTable.id,
    displayName: employeeProfilesTable.displayName,
    jobTitle: employeeProfilesTable.jobTitle,
    department: employeeProfilesTable.department,
    avatar: employeeProfilesTable.avatar,
    userId: employeeProfilesTable.userId,
  }).from(employeeProfilesTable)
    .leftJoin(usersTable, eq(usersTable.id, employeeProfilesTable.userId))
    .where(tenantId !== null ? eq(usersTable.tenantId, tenantId) : undefined as any);

  // لكل profile احسب الـ overallScore
  const ranking = await Promise.all(profiles.map(async (profile) => {
    const kpis = await db.select().from(employeeKpisTable).where(
      and(eq(employeeKpisTable.profileId, profile.id), eq(employeeKpisTable.isActive, true))
    );
    if (kpis.length === 0) return { ...profile, overallScore: null, achievedCount: 0, totalKpis: 0 };

    const { dateFrom: kpiFrom, dateTo: kpiTo } = getPayPeriod(month);
    const startDate = kpiFrom.toISOString().slice(0, 10);
    const endDate   = kpiTo.toISOString().slice(0, 10);

    const evaluated = await Promise.all(kpis.map(async (kpi) => {
      const logs = await db.select({ value: employeeDailyLogsTable.value })
        .from(employeeDailyLogsTable)
        .where(and(
          eq(employeeDailyLogsTable.kpiId, kpi.id),
          eq(employeeDailyLogsTable.profileId, profile.id),
          gte(employeeDailyLogsTable.date, startDate),
          lte(employeeDailyLogsTable.date, endDate)
        ));
      const actualValue = logs.length > 0 ? logs.reduce((s, l) => s + (l.value ?? 0), 0) : null;
      const score = actualValue !== null ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction) : null;
      return { score, weight: kpi.weight ?? 1, achieved: score !== null ? score >= 100 : null };
    }));

    const scored = evaluated.filter(k => k.score !== null);
    const totalWeight = scored.reduce((s, k) => s + k.weight, 0);
    const overallScore = scored.length > 0 && totalWeight > 0
      ? Math.round(scored.reduce((s, k) => s + k.score! * k.weight, 0) / totalWeight)
      : null;
    const achievedCount = evaluated.filter(k => k.achieved === true).length;

    return { ...profile, overallScore, achievedCount, totalKpis: kpis.length };
  }));

  // رتّب من الأعلى للأقل (null في الآخر)
  ranking.sort((a, b) => {
    if (a.overallScore === null && b.overallScore === null) return 0;
    if (a.overallScore === null) return 1;
    if (b.overallScore === null) return -1;
    return b.overallScore - a.overallScore;
  });

  res.json(ranking);
});

// ── GET /employee/star-employees ─────────────────────────────────────────
router.get("/star-employees", requireAuth, async (req, res): Promise<void> => {
  const [setting] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "star_employees")).limit(1);
  if (!setting?.value) { res.json([]); return; }
  try {
    const ids: number[] = JSON.parse(setting.value);
    if (!ids.length) { res.json([]); return; }
    const profiles = await db.select({
      id: employeeProfilesTable.id,
      displayName: employeeProfilesTable.displayName,
      jobTitle: employeeProfilesTable.jobTitle,
      department: employeeProfilesTable.department,
      avatar: employeeProfilesTable.avatar,
    }).from(employeeProfilesTable).where(
      or(...ids.map(id => eq(employeeProfilesTable.id, id)))
    );
    // رتّبهم بنفس ترتيب الاختيار
    const ordered = ids.map(id => profiles.find(p => p.id === id)).filter(Boolean);
    res.json(ordered);
  } catch { res.json([]); }
});

// ── POST /employee/star-employees ────────────────────────────────────────
router.post("/star-employees", requireSuperAdmin, async (req, res): Promise<void> => {
  const { profileIds } = req.body as { profileIds: number[] };
  if (!Array.isArray(profileIds) || profileIds.length > 3) {
    res.status(400).json({ error: "أقصى 3 موظفين نجوم" }); return;
  }
  const value = JSON.stringify(profileIds);
  const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "star_employees")).limit(1);
  if (existing.length) {
    await db.update(appSettingsTable).set({ value, updatedAt: new Date() }).where(eq(appSettingsTable.key, "star_employees"));
  } else {
    await db.insert(appSettingsTable).values({ key: "star_employees", value, updatedAt: new Date() });
  }
  res.json({ success: true, profileIds });
});

export default router;
