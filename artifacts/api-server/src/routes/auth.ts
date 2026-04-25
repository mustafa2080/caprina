import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, comparePassword, hashPassword } from "../lib/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { logAudit } from "../lib/audit.js";

// Helper: parse permissions from MariaDB (returns JSON as string)
function parsePermissions(permissions: any): string[] {
  if (Array.isArray(permissions)) return permissions;
  if (typeof permissions === "string") {
    try { return JSON.parse(permissions); } catch { return []; }
  }
  return [];
}

// صلاحيات يجب أن يمتلكها الأدمن دايماً — تُضاف تلقائياً لو ناقصة
const ADMIN_DEFAULT_PERMISSIONS = ["edit_brand"];

/**
 * يضيف الصلاحيات الافتراضية للأدمن لو ناقصة في الـ DB ويحفظها.
 * بيتعمل عند login و /me عشان الأدمنز القدامى يتحدثوا تلقائياً.
 */
async function ensureAdminDefaults(user: typeof usersTable.$inferSelect): Promise<string[]> {
  const perms = parsePermissions(user.permissions);
  if (user.role !== "admin") return perms;

  const missing = ADMIN_DEFAULT_PERMISSIONS.filter(p => !perms.includes(p));
  if (missing.length === 0) return perms;

  const updated = [...perms, ...missing];
  await db
    .update(usersTable)
    .set({ permissions: JSON.stringify(updated) })
    .where(eq(usersTable.id, user.id));
  return updated;
}

// ─── Brute-force protection: max 10 login attempts per 15 min per IP ────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات تسجيل دخول كثيرة، يرجى الانتظار 15 دقيقة" },
  skipSuccessfulRequests: true,
});

const router: IRouter = Router();

// POST /auth/login
router.post("/login", loginLimiter, async (req, res): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase())).limit(1);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const token = signToken(user);

  await logAudit({
    action: "login",
    entityType: "user",
    entityId: user.id,
    entityName: user.displayName,
    userId: user.id,
    userName: user.displayName,
  });

  const finalPerms = await ensureAdminDefaults(user);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: { ...safeUser, permissions: finalPerms } });
});

// GET /auth/me
router.get("/me", requireAuth, async (req, res): Promise<void> => {
  // منع الـ caching عشان الصلاحيات تيجي fresh من الـ DB دايماً
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  const finalPerms = await ensureAdminDefaults(user);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...safeUser, permissions: finalPerms });
});

// POST /auth/change-password
router.post("/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "كلمة المرور الحالية والجديدة مطلوبتان" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" }); return; }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

export default router;
