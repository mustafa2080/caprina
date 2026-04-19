import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { employeeKpisTable } from "./employee_kpis";

export const employeeDailyLogsTable = pgTable("employee_daily_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kpiId: integer("kpi_id").notNull().references(() => employeeKpisTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  value: real("value").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EmployeeDailyLog = typeof employeeDailyLogsTable.$inferSelect;
