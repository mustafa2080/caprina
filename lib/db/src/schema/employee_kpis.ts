import { pgTable, serial, integer, real, text, boolean, timestamp } from "drizzle-orm/pg-core";
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

export const employeeKpisTable = pgTable("employee_kpis", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => employeeProfilesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  metric: text("metric").notNull().default("manual"),
  targetValue: real("target_value").notNull(),
  unit: text("unit").notNull().default("%"),
  direction: text("direction").notNull().default("higher_is_better"),
  weight: real("weight").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EmployeeKpi = typeof employeeKpisTable.$inferSelect;
