import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  ordersTable,
  employeeProfilesTable,
  employeeKpisTable,
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
  if (target <= 0) return 100;
  if (direction === "lower_is_better") {
    if (actual <= target) return 100;
    const over = (actual - target) / target;
    return Math.max(0, Math.round(100 - over * 100));
  } else {
    return Math.min(100, Math.round((actual / target) * 100));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Employee Profiles CRUD
// ────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  userId: z.number().int().positive(),
  jobTitle: z.string().nullish(),
  department: z.string().nullish(),
  monthlySalary: z.number().min(0).nullish(),
  hireDate: z.string().nullish(),
  notes: z.string().nullish(),
});

router.get("/employee-profiles", async (req, res): Promise<void> => {
  const profiles = await db
    .select({
      profile: employeeProfilesTable,
      user: usersTable,
    })
    .from(employeeProfilesTable)
    .innerJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .orderBy(usersTable.displayName);

  res.json(
    profiles.map((p) => ({
      ...p.profile,
      username: p.user.username,
      displayName: p.user.displayName,
      role: p.user.role,
      isActive: p.user.isActive,
    }))
  );
});

router.get("/employee-profiles/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const [row] = await db
    .select({ profile: employeeProfilesTable, user: usersTable })
    .from(employeeProfilesTable)
    .innerJoin(usersTable, eq(employeeProfilesTable.userId, usersTable.id))
    .where(eq(employeeProfilesTable.userId, userId));

  if (!row) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(eq(employeeKpisTable.userId, userId))
    .orderBy(employeeKpisTable.createdAt);

  res.json({
    ...row.profile,
    username: row.user.username,
    displayName: row.user.displayName,
    role: row.user.role,
    isActive: row.user.isActive,
    kpis,
  });
});

router.post("/employee-profiles", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Upsert
  const [existing] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, parsed.data.userId));

  if (existing) {
    const [updated] = await db
      .update(employeeProfilesTable)
      .set({
        jobTitle: parsed.data.jobTitle ?? null,
        department: parsed.data.department ?? null,
        monthlySalary: parsed.data.monthlySalary ?? 0,
        hireDate: parsed.data.hireDate ?? null,
        notes: parsed.data.notes ?? null,
      })
      .where(eq(employeeProfilesTable.userId, parsed.data.userId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(employeeProfilesTable)
      .values({
        userId: parsed.data.userId,
        jobTitle: parsed.data.jobTitle ?? null,
        department: parsed.data.department ?? null,
        monthlySalary: parsed.data.monthlySalary ?? 0,
        hireDate: parsed.data.hireDate ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    res.status(201).json(created);
  }
});

router.patch("/employee-profiles/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const Schema = ProfileSchema.partial().omit({ userId: true });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(employeeProfilesTable)
    .set(parsed.data as any)
    .where(eq(employeeProfilesTable.userId, userId))
    .returning();
  if (!updated) { res.status(404).json({ error: "الملف الشخصي غير موجود" }); return; }
  res.json(updated);
});

// ────────────────────────────────────────────────────────────────────────────
// Employee KPIs CRUD
// ────────────────────────────────────────────────────────────────────────────

const KpiSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().min(1),
  metric: z.string().default("manual"),
  targetValue: z.number(),
  unit: z.string().default("%"),
  direction: z.enum(["higher_is_better", "lower_is_better"]).default("higher_is_better"),
  weight: z.number().min(0).max(100).default(100),
  isActive: z.boolean().default(true),
  description: z.string().nullish(),
});

router.get("/employee-kpis/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(eq(employeeKpisTable.userId, userId))
    .orderBy(employeeKpisTable.createdAt);
  res.json(kpis);
});

router.post("/employee-kpis", requireAdmin, async (req, res): Promise<void> => {
  const parsed = KpiSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [kpi] = await db
    .insert(employeeKpisTable)
    .values({
      userId: parsed.data.userId,
      name: parsed.data.name,
      metric: parsed.data.metric,
      targetValue: parsed.data.targetValue,
      unit: parsed.data.unit,
      direction: parsed.data.direction,
      weight: parsed.data.weight,
      isActive: parsed.data.isActive,
      description: parsed.data.description ?? null,
    })
    .returning();
  res.status(201).json(kpi);
});

router.patch("/employee-kpis/:kpiId", requireAdmin, async (req, res): Promise<void> => {
  const kpiId = parseInt(req.params.kpiId);
  if (isNaN(kpiId)) { res.status(400).json({ error: "Invalid kpiId" }); return; }

  const Schema = KpiSchema.partial().omit({ userId: true });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [updated] = await db
    .update(employeeKpisTable)
    .set(parsed.data as any)
    .where(eq(employeeKpisTable.id, kpiId))
    .returning();
  if (!updated) { res.status(404).json({ error: "المؤشر غير موجود" }); return; }
  res.json(updated);
});

router.delete("/employee-kpis/:kpiId", requireAdmin, async (req, res): Promise<void> => {
  const kpiId = parseInt(req.params.kpiId);
  if (isNaN(kpiId)) { res.status(400).json({ error: "Invalid kpiId" }); return; }
  await db.delete(employeeKpisTable).where(eq(employeeKpisTable.id, kpiId));
  res.status(204).send();
});

// ────────────────────────────────────────────────────────────────────────────
// Monthly Report
// ────────────────────────────────────────────────────────────────────────────

router.get("/analytics/employee-report/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  // Determine month range
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

  // Get user + profile
  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!userRow) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  const [profile] = await db
    .select()
    .from(employeeProfilesTable)
    .where(eq(employeeProfilesTable.userId, userId));

  // Get KPIs
  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(and(eq(employeeKpisTable.userId, userId), eq(employeeKpisTable.isActive, true)));

  // Compute order stats for the period
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
  const deliveryRate = orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0;
  const returnRate = orders.length > 0 ? Math.round((returned / orders.length) * 100) : 0;

  // Evaluate KPIs
  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      const actualValue = await computeActualValue(kpi.metric, userId, dateFrom, dateTo);
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;

      return {
        ...kpi,
        actualValue,
        score,
        achieved,
      };
    })
  );

  // Compute overall score (weighted average of non-null scores)
  const scoredKpis = evaluatedKpis.filter((k) => k.score !== null);
  let overallScore: number | null = null;
  if (scoredKpis.length > 0) {
    const totalWeight = scoredKpis.reduce((s, k) => s + k.weight, 0);
    overallScore =
      totalWeight > 0
        ? Math.round(
            scoredKpis.reduce((s, k) => s + k.score! * k.weight, 0) / totalWeight
          )
        : null;
  }

  const rating =
    overallScore === null
      ? "غير محدد"
      : overallScore >= 90
      ? "ممتاز"
      : overallScore >= 75
      ? "جيد جداً"
      : overallScore >= 60
      ? "جيد"
      : overallScore >= 40
      ? "مقبول"
      : "ضعيف";

  res.json({
    userId,
    username: userRow.username,
    displayName: userRow.displayName,
    role: userRow.role,
    profile: profile ?? null,
    period: {
      month: monthParam || `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, "0")}`,
      from: dateFrom.toISOString(),
      to: dateTo.toISOString(),
    },
    orderStats: {
      total: orders.length,
      delivered,
      returned,
      pending,
      deliveryRate,
      returnRate,
      totalRevenue,
      totalProfit,
    },
    kpis: evaluatedKpis,
    overallScore,
    rating,
    salary: profile?.monthlySalary ?? 0,
  });
});

// All users without profile (for setup)
router.get("/users-without-profile", async (req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable).where(eq(usersTable.isActive, true));
  const profiles = await db.select().from(employeeProfilesTable);
  const profiledUserIds = new Set(profiles.map((p) => p.userId));
  const unprofiledUsers = allUsers.filter((u) => !profiledUserIds.has(u.id));
  res.json(unprofiledUsers);
});

export default router;
