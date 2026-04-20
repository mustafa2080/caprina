import { mysqlTable, text, int, boolean, datetime, json, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const USER_ROLES = ["admin", "employee", "warehouse"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["*"],
  employee: ["orders", "dashboard"],
  warehouse: ["inventory", "movements", "dashboard"],
};

export const usersTable = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("employee"),
  permissions: json("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true, passwordHash: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
