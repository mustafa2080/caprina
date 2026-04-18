import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const employeeProfilesTable = pgTable("employee_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  jobTitle: text("job_title"),
  department: text("department"),
  monthlySalary: real("monthly_salary").default(0),
  hireDate: text("hire_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EmployeeProfile = typeof employeeProfilesTable.$inferSelect;
