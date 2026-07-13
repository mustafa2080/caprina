import { mysqlTable, int, datetime, text, varchar } from "drizzle-orm/mysql-core";

export const zonesTable = mysqlTable("zones", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenant_id"),  // tenant isolation
  name: varchar("name", { length: 255 }).notNull(),
  notes: text("notes"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type Zone = typeof zonesTable.$inferSelect;
