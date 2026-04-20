import { mysqlTable, int, real, text, datetime, varchar } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";
import { employeeKpisTable } from "./employee_kpis";
import { employeeProfilesTable } from "./employee_profiles";

export const employeeDailyLogsTable = mysqlTable("employee_daily_logs", {
  id: int("id").primaryKey().autoincrement(),
  profileId: int("profile_id").references(() => employeeProfilesTable.id, { onDelete: "cascade" }),
  userId: int("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  kpiId: int("kpi_id").notNull().references(() => employeeKpisTable.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 20 }).notNull(),
  value: real("value").notNull(),
  notes: text("notes"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type EmployeeDailyLog = typeof employeeDailyLogsTable.$inferSelect;
