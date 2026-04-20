import { mysqlTable, text, datetime, varchar } from "drizzle-orm/mysql-core";

export const appSettingsTable = mysqlTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
