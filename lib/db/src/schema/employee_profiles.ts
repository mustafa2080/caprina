import { mysqlTable, int, real, text, datetime, varchar, longtext } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const employeeProfilesTable = mysqlTable("employee_profiles", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenant_id"),
  userId: int("user_id").unique().references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  department: varchar("department", { length: 255 }),
  monthlySalary: real("monthly_salary").default(0),
  shiftStart: varchar("shift_start", { length: 5 }).default("09:00"), // HH:MM
  hireDate: varchar("hire_date", { length: 20 }),
  notes: text("notes"),
  avatar: longtext("avatar"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type EmployeeProfile = typeof employeeProfilesTable.$inferSelect;
