import { mysqlTable, int, real, text, datetime, varchar } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const employeeProfilesTable = mysqlTable("employee_profiles", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").unique().references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  department: varchar("department", { length: 255 }),
  monthlySalary: real("monthly_salary").default(0),
  hireDate: varchar("hire_date", { length: 20 }),
  notes: text("notes"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type EmployeeProfile = typeof employeeProfilesTable.$inferSelect;
