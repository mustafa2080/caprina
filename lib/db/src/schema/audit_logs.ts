import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const AUDIT_ACTIONS = ["create", "update", "delete", "status_change", "add_stock", "login"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  changesBefore: jsonb("changes_before"),
  changesAfter: jsonb("changes_after"),
  userId: integer("user_id"),
  userName: text("user_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
