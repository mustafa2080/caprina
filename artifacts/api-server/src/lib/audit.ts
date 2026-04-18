import { db, auditLogsTable, type AuditAction } from "@workspace/db";

interface AuditOptions {
  action: AuditAction;
  entityType: string;
  entityId?: number;
  entityName?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  userId?: number;
  userName?: string;
}

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      entityName: opts.entityName ?? null,
      changesBefore: opts.before ?? null,
      changesAfter: opts.after ?? null,
      userId: opts.userId ?? null,
      userName: opts.userName ?? "غير معروف",
    });
  } catch {
    // audit failures should never crash the app
  }
}

export function diffObjects(before: Record<string, unknown>, after: Record<string, unknown>): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (["updatedAt", "createdAt"].includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}
