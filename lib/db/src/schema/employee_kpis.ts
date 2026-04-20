import { mysqlTable, int, real, text, boolean, datetime, varchar } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";
import { employeeProfilesTable } from "./employee_profiles";

export const KPI_METRICS = [
  "delivery_rate",
  "return_rate",
  "total_orders",
  "profit",
  "revenue",
  "manual",
] as const;
export type KpiMetric = (typeof KPI_METRICS)[number];

export const KPI_DIRECTIONS = ["higher_is_better", "lower_is_better"] as const;
export type KpiDirection = (typeof KPI_DIRECTIONS)[number];

export const employeeKpisTable = mysqlTable("employee_kpis", {
  id: int("id").primaryKey().autoincrement(),
  profileId: int("profile_id").references(() => employeeProfilesTable.id, { onDelete: "cascade" }),
  userId: int("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  metric: varchar("metric", { length: 50 }).notNull().default("manual"),
  targetValue: real("target_value").notNull(),
  unit: varchar("unit", { length: 20 }).notNull().default("%"),
  direction: varchar("direction", { length: 50 }).notNull().default("higher_is_better"),
  weight: real("weight").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type EmployeeKpi = typeof employeeKpisTable.$inferSelect;
