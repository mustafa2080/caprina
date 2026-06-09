import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { SafeUser } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

function parsePermissions(raw: any): string[] {
  let parsed = raw;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const flat: string[] = [];
  for (const item of parsed) {
    if (typeof item === "string") flat.push(item);
    else if (Array.isArray(item)) {
      for (const sub of item) { if (typeof sub === "string") flat.push(sub); }
    }
  }
  return [...new Set(flat)];
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول" });
    return;
  }
  const token = authHeader.slice(7);
  const tokenUser = verifyToken(token);
  if (!tokenUser) {
    res.status(401).json({ error: "انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً" });
    return;
  }

  // للـ custom role: اجيب الـ permissions الحالية من الـ DB مباشرةً
  // عشان الـ JWT القديم ممكن يكون عنده permissions قديمة
  if (tokenUser.role === "custom") {
    db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
      permissions: usersTable.permissions,
      isActive: usersTable.isActive,
      tenantId: usersTable.tenantId,
    })
      .from(usersTable)
      .where(eq(usersTable.id, tokenUser.id))
      .limit(1)
      .then(([dbUser]) => {
        if (!dbUser || !dbUser.isActive) {
          res.status(401).json({ error: "الحساب غير نشط أو غير موجود" });
          return;
        }
        req.user = {
          ...tokenUser,
          ...dbUser,
          permissions: parsePermissions(dbUser.permissions),
        } as any;
        next();
      })
      .catch(() => {
        // fallback على الـ token لو فشل الـ DB query
        req.user = tokenUser;
        next();
      });
    return;
  }

  req.user = tokenUser;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const user = verifyToken(authHeader.slice(7));
    if (user) req.user = user;
  }
  next();
}
