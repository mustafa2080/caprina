import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth.js";
import type { SafeUser } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول" });
    return;
  }
  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً" });
    return;
  }
  req.user = user;
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
