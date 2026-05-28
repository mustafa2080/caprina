import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@workspace/db";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    // super_admin له كل الصلاحيات دايماً
    if (user.role === "super_admin") {
      next();
      return;
    }
    if (!roles.includes(user.role as UserRole)) {
      res.status(403).json({ error: "ليس لديك صلاحية لهذه العملية" });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    res.status(403).json({ error: "هذه العملية تتطلب صلاحية المدير" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || user.role !== "super_admin") {
    res.status(403).json({ error: "هذه الصفحة متاحة للـ Super Admin فقط" });
    return;
  }
  next();
}

export function isAdmin(req: Request): boolean {
  return req.user?.role === "admin" || req.user?.role === "super_admin";
}

// يسمح للمدير دايماً، أو لأي يوزر عنده الـ permission المحدد
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "غير مصرح" });
      return;
    }
    if (user.role === "admin" || user.role === "super_admin") {
      next();
      return;
    }
    const perms: string[] = Array.isArray((user as any).permissions) ? (user as any).permissions : [];
    if (perms.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: "ليس لديك صلاحية لهذه العملية" });
  };
}
