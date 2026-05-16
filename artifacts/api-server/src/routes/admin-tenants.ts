import { Router } from "express";
import { db, tenantsTable, usersTable } from "@workspace/db";
import { hashPassword } from "../lib/auth.js";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

// ── Middleware: super_admin فقط ───────────────────────────────────────────────
function requireSuperAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "super_admin") {
    res.status(403).json({ error: "ممنوع — هذه الصفحة للأدمن الرئيسي فقط" });
    return;
  }
  next();
}
router.use(requireSuperAdmin);

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

  // تحقق إن الـ username مش موجود
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername.trim().toLowerCase())).limit(1);
  if (existingUser) {
    res.status(409).json({ error: "اسم المستخدم موجود بالفعل، اختر اسماً آخر" });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

  // إنشاء الـ tenant
  const [result] = await db.insert(tenantsTable).values({
    name, slug, plan, planStatus: "active",
    expiresAt, contactEmail, contactPhone, notes,
  });
  const tenantId = result.insertId;

  // إنشاء admin user للـ tenant تلقائياً
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

// ── PATCH /api/admin/tenants/:id/activate — تفعيل/تجديد ──────────────────────
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

// ── PATCH /api/admin/tenants/:id/suspend — إيقاف ─────────────────────────────
router.patch("/admin/tenants/:id/suspend", async (req, res): Promise<void> => {
  await db.update(tenantsTable).set({
    planStatus: "suspended",
    updatedAt: sql`NOW()`,
  }).where(eq(tenantsTable.id, parseInt(req.params.id)));
  res.json({ message: "تم إيقاف الاشتراك" });
});

// ── PATCH /api/admin/tenants/:id/expire — إنهاء فوري ─────────────────────────
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
  // حذف الـ users المرتبطين أولاً
  await db.delete(usersTable).where(eq(usersTable.tenantId, tenantId));
  // حذف الـ tenant نهائياً
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  res.json({ message: "تم حذف العميل نهائياً" });
});

export default router;
