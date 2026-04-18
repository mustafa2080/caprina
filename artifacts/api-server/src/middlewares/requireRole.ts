import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@workspace/db";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "غير مصرح" });
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
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "هذه العملية تتطلب صلاحية المدير" });
    return;
  }
  next();
}

export function isAdmin(req: Request): boolean {
  return req.user?.role === "admin";
}
