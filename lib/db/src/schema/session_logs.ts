import { mysqlTable, int, datetime, varchar } from "drizzle-orm/mysql-core";

export const sessionLogsTable = mysqlTable("session_logs", {
  id:        int("id").primaryKey().autoincrement(),
  userId:    int("user_id").notNull(),
  loginAt:   datetime("login_at").notNull().default(new Date()),
  logoutAt:  datetime("logout_at"),
  duration:  int("duration_seconds"), // مدة الجلسة بالثواني
  ipAddress: varchar("ip_address", { length: 100 }),
});

export type SessionLog = typeof sessionLogsTable.$inferSelect;
