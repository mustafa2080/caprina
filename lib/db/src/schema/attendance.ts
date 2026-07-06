import { mysqlTable, int, varchar, real, datetime, text } from "drizzle-orm/mysql-core";
import { employeeProfilesTable } from "./employee_profiles";

// ─── Attendance Records ───────────────────────────────────────────────────────
export const attendanceTable = mysqlTable("attendance", {
  id:           int("id").primaryKey().autoincrement(),
  profileId:    int("profile_id").notNull().references(() => employeeProfilesTable.id, { onDelete: "cascade" }),
  date:         varchar("date", { length: 10 }).notNull(),          // YYYY-MM-DD
  status:       varchar("status", { length: 20 }).notNull().default("present"), // present | absent | late | half_day | holiday | excused
  checkIn:      varchar("check_in", { length: 8 }),                 // HH:MM
  checkOut:     varchar("check_out", { length: 8 }),                // HH:MM
  checkInPhoto:    text("check_in_photo"),                          // مسار صورة الحضور
  checkInLat:      real("check_in_lat"),
  checkInLng:      real("check_in_lng"),
  checkInAddress:  varchar("check_in_address", { length: 500 }),
  checkOutPhoto:   text("check_out_photo"),                         // مسار صورة الانصراف
  checkOutLat:     real("check_out_lat"),
  checkOutLng:     real("check_out_lng"),
  checkOutAddress: varchar("check_out_address", { length: 500 }),
  lateMinutes:  int("late_minutes").default(0),
  deduction:    real("deduction").notNull().default(0),
  notes:        text("notes"),
  createdAt:    datetime("created_at").notNull().default(new Date()),
});

export type Attendance = typeof attendanceTable.$inferSelect;

// ─── Payroll Adjustments (Bonus / Deductions) ────────────────────────────────
export const payrollAdjustmentsTable = mysqlTable("payroll_adjustments", {
  id:        int("id").primaryKey().autoincrement(),
  profileId: int("profile_id").notNull().references(() => employeeProfilesTable.id, { onDelete: "cascade" }),
  month:     varchar("month", { length: 7 }).notNull(),             // YYYY-MM
  type:      varchar("type", { length: 10 }).notNull(),             // bonus | deduction
  amount:    real("amount").notNull(),
  reason:    varchar("reason", { length: 500 }).notNull(),
  createdAt: datetime("created_at").notNull().default(new Date()),
});

export type PayrollAdjustment = typeof payrollAdjustmentsTable.$inferSelect;
