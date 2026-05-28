import { Router } from "express";
import { db, tenantsTable, usersTable, appSettingsTable } from "@workspace/db";
import { hashPassword } from "../lib/auth.js";
import { eq, desc, sql } from "drizzle-orm";

// ── Default plan prices (fallback) ───────────────────────────────────────────
const DEFAULT_PLAN_PRICES = {
  free_trial: { monthlyPrice: null, yearlyPrice: null, yearlySaving: null, priceDisplay: "مجاناً",       period: "14 يوم"   },
  starter:    { monthlyPrice: 199,  yearlyPrice: 1990, yearlySaving: 398,  priceDisplay: "١٩٩",           period: "شهرياً"   },
  pro:        { monthlyPrice: 399,  yearlyPrice: 3990, yearlySaving: 798,  priceDisplay: "٣٩٩",           period: "شهرياً"   },
  enterprise: { monthlyPrice: null, yearlyPrice: null, yearlySaving: null, priceDisplay: "تواصل معنا",   period: ""          },
};
const PRICES_KEY = "plan_prices";

function parseJson(val: string | null | undefined): Record<string, any> {
  if (!val) return {};
  try { return JSON.parse(val); } catch { return {}; }
}

async function getStoredPrices(): Promise<typeof DEFAULT_PLAN_PRICES> {
  const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, PRICES_KEY));
  if (!row) return DEFAULT_PLAN_PRICES;
  const stored = parseJson(row.value);
  return { ...DEFAULT_PLAN_PRICES, ...stored };
}

const router = Router();

// ── PUBLIC: GET /api/public/plan-prices — بدون auth ──────────────────────────
router.get("/public/plan-prices", async (_req, res): Promise<void> => {
  try {
    const prices = await getStoredPrices();
    res.json(prices);
  } catch (e: any) {
    res.json(DEFAULT_PLAN_PRICES);
  }
});

// ── Middleware: super_admin فقط ───────────────────────────────────────────────
function requireSuperAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "super_admin") {
    res.status(403).json({ error: "ممنوع — هذه الصفحة للأدمن الرئيسي فقط" });
    return;
  }
  next();
}
router.use(requireSuperAdmin);

// ── GET /api/admin/plan-prices — جلب الأسعار الحالية ─────────────────────────
router.get("/admin/plan-prices", async (_req, res): Promise<void> => {
  const prices = await getStoredPrices();
  res.json(prices);
});

// ── PATCH /api/admin/plan-prices — تعديل الأسعار ─────────────────────────────
router.patch("/admin/plan-prices", async (req, res): Promise<void> => {
  try {
    const incoming = req.body as Record<string, any>;
    const existing = await getStoredPrices();
    const merged: any = { ...existing };

    // دمج الأسعار القادمة لكل plan
    for (const planKey of Object.keys(DEFAULT_PLAN_PRICES)) {
      if (incoming[planKey]) {
        merged[planKey] = { ...existing[planKey as keyof typeof existing], ...incoming[planKey] };
        // حساب العرض العربي تلقائياً لو في سعر شهري
        if (merged[planKey].monthlyPrice) {
          const n = parseInt(merged[planKey].monthlyPrice);
          if (!isNaN(n)) {
            merged[planKey].priceDisplay = n.toLocaleString("ar-EG");
          }
        }
        // حساب توفير السنوي تلقائياً
        if (merged[planKey].monthlyPrice && merged[planKey].yearlyPrice) {
          const monthly = parseInt(merged[planKey].monthlyPrice);
          const yearly = parseInt(merged[planKey].yearlyPrice);
          if (!isNaN(monthly) && !isNaN(yearly)) {
            merged[planKey].yearlySaving = (monthly * 12) - yearly;
          }
        }
      }
    }

    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, PRICES_KEY));
    if (row) {
      await db.update(appSettingsTable)
        .set({ value: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(appSettingsTable.key, PRICES_KEY));
    } else {
      await db.insert(appSettingsTable).values({
        key: PRICES_KEY,
        value: JSON.stringify(merged),
        updatedAt: new Date(),
      });
    }

    res.json(merged);
  } catch (e: any) {
    res.status(500).json({ error: "فشل حفظ الأسعار", detail: e?.message });
  }
});

// ── GET /api/admin/tenants ────────────────────────────────────────────────────
router.get("/admin/tenants", async (_req, res): Promise<void> => {
  const tenants = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.isActive, true))
    .orderBy(desc(tenantsTable.createdAt));
  res.json(tenants);
});

// ── GET /api/admin/tenants/:id ────────────────────────────────────────────────
router.get("/admin/tenants/:id", async (req, res): Promise<void> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, parseInt(req.params.id)));
  if (!tenant) { res.status(404).json({ error: "غير موجود" }); return; }
  res.json(tenant);
});

// ── POST /api/admin/tenants — إنشاء tenant جديد ──────────────────────────────
router.post("/admin/tenants", async (req, res): Promise<void> => {
  const { name, slug, plan, contactEmail, contactPhone, notes, durationDays, adminUsername, adminPassword, adminDisplayName } = req.body;
  if (!name || !slug || !plan || !durationDays || !adminUsername || !adminPassword) {
    res.status(400).json({ error: "name, slug, plan, durationDays, adminUsername, adminPassword مطلوبة" });
    return;
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername.trim().toLowerCase())).limit(1);
  if (existingUser) {
    res.status(409).json({ error: "اسم المستخدم موجود بالفعل، اختر اسماً آخر" });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

  const [result] = await db.insert(tenantsTable).values({
    name, slug, plan, planStatus: "active",
    expiresAt, contactEmail, contactPhone, notes,
  });
  const tenantId = result.insertId;

  const passwordHash = await hashPassword(adminPassword);
  await db.insert(usersTable).values({
    username: adminUsername.trim().toLowerCase(),
    passwordHash,
    displayName: adminDisplayName || name,
    role: "admin",
    tenantId,
    permissions: ["*"],
    isActive: true,
  });

  res.status(201).json({ id: tenantId, message: "تم إنشاء الاشتراك والمستخدم بنجاح" });
});

// ── PATCH /api/admin/tenants/:id/activate ─────────────────────────────────────
router.patch("/admin/tenants/:id/activate", async (req, res): Promise<void> => {
  const { plan, durationDays } = req.body;
  if (!durationDays) { res.status(400).json({ error: "durationDays مطلوب" }); return; }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

  await db.update(tenantsTable).set({
    planStatus: "active",
    plan: plan ?? undefined,
    expiresAt,
    graceUntil: null as any,
    updatedAt: sql`NOW()`,
  }).where(eq(tenantsTable.id, parseInt(req.params.id)));

  res.json({ message: "تم تفعيل الاشتراك" });
});

// ── PATCH /api/admin/tenants/:id/suspend ─────────────────────────────────────
router.patch("/admin/tenants/:id/suspend", async (req, res): Promise<void> => {
  await db.update(tenantsTable).set({
    planStatus: "suspended",
    updatedAt: sql`NOW()`,
  }).where(eq(tenantsTable.id, parseInt(req.params.id)));
  res.json({ message: "تم إيقاف الاشتراك" });
});

// ── PATCH /api/admin/tenants/:id/expire ──────────────────────────────────────
router.patch("/admin/tenants/:id/expire", async (req, res): Promise<void> => {
  await db.update(tenantsTable).set({
    planStatus: "expired",
    expiresAt: sql`NOW()`,
    updatedAt: sql`NOW()`,
  }).where(eq(tenantsTable.id, parseInt(req.params.id)));
  res.json({ message: "تم إنهاء الاشتراك" });
});

// ── DELETE /api/admin/tenants/:id ────────────────────────────────────────────
router.delete("/admin/tenants/:id", async (req, res): Promise<void> => {
  const tenantId = parseInt(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.tenantId, tenantId));
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json({ message: "تم حذف العميل نهائياً" });
});

export default router;
