import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc, eq, and, gte, lte, like, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireAdmin } from "../middlewares/requireRole.js";

const router: IRouter = Router();
router.use(requireAuth);
router.use(requireAdmin);

// GET /audit-logs
router.get("/", async (req, res): Promise<void> => {
  const { limit = "100", offset = "0", entityType, action, search, from, to } = req.query as Record<string, string>;

  const conditions = [];
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (action) conditions.push(eq(auditLogsTable.action, action as any));
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(to)));
  if (search) {
    conditions.push(
      or(
        like(auditLogsTable.entityName, `%${search}%`),
        like(auditLogsTable.userName, `%${search}%`),
      )!,
    );
  }

  const logs = await db.select().from(auditLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(Math.min(parseInt(limit), 500))
    .offset(parseInt(offset));

  const parsed = logs.map(log => ({
    ...log,
    changesBefore: typeof log.changesBefore === "string"
      ? (() => { try { return JSON.parse(log.changesBefore as string); } catch { return log.changesBefore; } })()
      : log.changesBefore,
    changesAfter: typeof log.changesAfter === "string"
      ? (() => { try { return JSON.parse(log.changesAfter as string); } catch { return log.changesAfter; } })()
      : log.changesAfter,
  }));

  res.json(parsed);
});

export default router;
