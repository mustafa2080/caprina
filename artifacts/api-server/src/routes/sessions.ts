import { Router, type IRouter } from "express";
import { db, sessionLogsTable, usersTable } from "@workspace/db";
import { eq, desc, gte, and, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();
router.use(requireAuth);

// POST /sessions/login — يُسجَّل تلقائياً عند الدخول
router.post("/login", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? null;
  const result = await db.insert(sessionLogsTable).values({
    userId: req.user!.id,
    loginAt: new Date(),
    ipAddress: ip,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  res.json({ sessionId: insertId });
});

// PATCH /sessions/:id/logout — يُسجَّل عند الخروج
router.patch("/:id/logout", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionLogsTable)
    .where(eq(sessionLogsTable.id, id)).limit(1);
  if (!session) { res.status(404).json({ error: "session not found" }); return; }

  const logoutAt = new Date();
  const duration = Math.round((logoutAt.getTime() - new Date(session.loginAt).getTime()) / 1000);
  await db.update(sessionLogsTable).set({ logoutAt, duration })
    .where(eq(sessionLogsTable.id, id));
  res.json({ ok: true, duration });
});

// GET /sessions/report?period=week|month|year&from=&to= — للمدير فقط
router.get("/report", requireAdmin, async (req, res): Promise<void> => {
  const { period, from, to } = req.query as Record<string, string>;

  let since: Date;
  const now = new Date();
  if (from && to) {
    since = new Date(from);
  } else {
    switch (period) {
      case "year":  since = new Date(now.getFullYear(), 0, 1); break;
      case "month": since = new Date(now.getFullYear(), now.getMonth(), 1); break;
      default:      // week
        since = new Date(now); since.setDate(since.getDate() - 7); break;
    }
  }

  const toDate = to ? new Date(to) : now;

  const sessions = await db
    .select({
      id:          sessionLogsTable.id,
      userId:      sessionLogsTable.userId,
      loginAt:     sessionLogsTable.loginAt,
      logoutAt:    sessionLogsTable.logoutAt,
      duration:    sessionLogsTable.duration,
      ipAddress:   sessionLogsTable.ipAddress,
      displayName: usersTable.displayName,
      username:    usersTable.username,
      role:        usersTable.role,
    })
    .from(sessionLogsTable)
    .leftJoin(usersTable, eq(sessionLogsTable.userId, usersTable.id))
    .where(and(gte(sessionLogsTable.loginAt, since)))
    .orderBy(desc(sessionLogsTable.loginAt))
    .limit(500);

   // ملخص لكل يوزر
   const userMap = new Map<number, {
     userId: number; displayName: string; username: string; role: string;
     totalSessions: number; totalDuration: number; lastLogin: Date | null;
     lastIp: string | null;
   }>();

  for (const s of sessions) {
    if (!s.userId) continue;
     if (!userMap.has(s.userId)) {
       userMap.set(s.userId, {
         userId: s.userId,
         displayName: s.displayName ?? "—",
         username: s.username ?? "—",
         role: s.role ?? "—",
         totalSessions: 0,
         totalDuration: 0,
         lastLogin: null,
         lastIp: null,
       });
     }
     const u = userMap.get(s.userId)!;
     u.totalSessions++;
     u.totalDuration += s.duration ?? 0;
     if (!u.lastLogin || new Date(s.loginAt) > u.lastLogin) {
       u.lastLogin = new Date(s.loginAt);
     }
     // Update last IP if available
     if (s.ipAddress && (!u.lastIp || new Date(s.loginAt) > (u.lastLogin ?? new Date(0)))) {
       u.lastIp = s.ipAddress;
     }
  }

   res.json({
     sessions,
     summary: Array.from(userMap.values()).map(u => ({
       ...u,
       lastLogin: u.lastLogin?.toISOString() ?? null,
       lastIp: u.lastIp
     })).sort((a, b) => b.totalSessions - a.totalSessions),
     period: period ?? "week",
     from: since.toISOString(),
     to: toDate.toISOString(),
   });
});

// GET /sessions/me — الجلسات الخاصة بالمستخدم الحالي
router.get("/me", async (req, res): Promise<void> => {
  const sessions = await db.select().from(sessionLogsTable)
    .where(eq(sessionLogsTable.userId, req.user!.id))
    .orderBy(desc(sessionLogsTable.loginAt))
    .limit(20);
  res.json(sessions);
});

export default router;
