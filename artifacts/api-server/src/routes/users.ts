import { Router, type IRouter } from "express";
import { db, usersTable, USER_ROLES } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";
import { logAudit } from "../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);
router.use(requireAdmin);

// GET /users
router.get("/", async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    displayName: usersTable.displayName,
    role: usersTable.role,
    permissions: usersTable.permissions,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
    updatedAt: usersTable.updatedAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /users
router.post("/", async (req, res): Promise<void> => {
  const { username, password, displayName, role, permissions } = req.body as {
    username: string; password: string; displayName: string;
    role: string; permissions?: string[];
  };

  if (!username || !password || !displayName) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور والاسم مطلوبة" });
    return;
  }
  if (!USER_ROLES.includes(role as any)) {
    res.status(400).json({ error: "الدور غير صحيح" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase())).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "اسم المستخدم موجود مسبقاً" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const insertResult = await db.insert(usersTable).values({
    username: username.trim().toLowerCase(),
    passwordHash,
    displayName: displayName.trim(),
    role: role as any,
    permissions: permissions ?? [],
    isActive: true,
  });
  const insertId = (insertResult as any)[0]?.insertId ?? (insertResult as any).insertId;
  const [newUser] = await db.select({
    id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName,
    role: usersTable.role, permissions: usersTable.permissions, isActive: usersTable.isActive,
    createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
  }).from(usersTable).where(eq(usersTable.id, insertId));

  await logAudit({
    action: "create",
    entityType: "user",
    entityId: newUser.id,
    entityName: newUser.displayName,
    after: { username: newUser.username, role: newUser.role },
    userId: req.user!.id,
    userName: req.user!.displayName,
  });

  res.status(201).json(newUser);
});

// PATCH /users/:id
router.patch("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { displayName, role, permissions, isActive, password } = req.body as {
    displayName?: string; role?: string; permissions?: string[];
    isActive?: boolean; password?: string;
  };

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  // Prevent deactivating the only admin
  if (isActive === false && existing.role === "admin") {
    const adminCount = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, "admin"));
    const activeAdmins = adminCount.filter(a => a.id !== id);
    if (activeAdmins.length === 0) {
      res.status(400).json({ error: "لا يمكن تعطيل المدير الوحيد في النظام" });
      return;
    }
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (displayName !== undefined) updates.displayName = displayName.trim();
  if (role !== undefined && USER_ROLES.includes(role as any)) updates.role = role as any;
  if (permissions !== undefined) updates.permissions = permissions;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) {
    if (password.length < 6) { res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }); return; }
    updates.passwordHash = await hashPassword(password);
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  const [updated] = await db.select({
    id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName,
    role: usersTable.role, permissions: usersTable.permissions, isActive: usersTable.isActive,
    createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
  }).from(usersTable).where(eq(usersTable.id, id));

  await logAudit({
    action: "update",
    entityType: "user",
    entityId: id,
    entityName: updated.displayName,
    before: { role: existing.role, isActive: existing.isActive, displayName: existing.displayName },
    after: { role: updated.role, isActive: updated.isActive, displayName: updated.displayName },
    userId: req.user!.id,
    userName: req.user!.displayName,
  });

  res.json(updated);
});

// DELETE /users/:id
router.delete("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, id));

  await logAudit({
    action: "delete",
    entityType: "user",
    entityId: id,
    entityName: existing.displayName,
    before: { username: existing.username, role: existing.role },
    userId: req.user!.id,
    userName: req.user!.displayName,
  });

  res.status(204).send();
});

export default router;
