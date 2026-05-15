import { Router } from "express";
import { db, tenantsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

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
  const tenants = await db.select().from(tenantsTable).orderBy(desc(tenantsTable.createdAt));
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
  const { name, slug, plan, contactEmail, contactPhone, notes, durationDays } = req.body;
  if (!name || !slug || !plan || !durationDays) {
    res.status(400).json({ error: "name, slug, plan, durationDays مطلوبة" });
    return;
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

  const [result] = await db.insert(tenantsTable).values({
    name, slug, plan, planStatus: "active",
    expiresAt, contactEmail, contactPhone, notes,
  });
  res.status(201).json({ id: result.insertId, message: "تم إنشاء الاشتراك" });
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
  await db.update(tenantsTable).set({ isActive: false, updatedAt: sql`NOW()` })
    .where(eq(tenantsTable.id, parseInt(req.params.id)));
  res.json({ message: "تم حذف الاشتراك" });
});

export default router;
