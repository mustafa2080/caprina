import { mysqlTable, int, varchar, text, datetime, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PLAN_TYPES = ["free_trial", "starter", "pro", "enterprise"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUS = ["active", "grace", "expired", "suspended"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

// الحدود لكل خطة
export const PLAN_LIMITS: Record<PlanType, { maxOrders: number; maxProducts: number; maxUsers: number; label: string }> = {
  free_trial:  { maxOrders: 100,    maxProducts: 20,   maxUsers: 2,  label: "تجريبي"  },
  starter:     { maxOrders: 2000,   maxProducts: 100,  maxUsers: 5,  label: "أساسي"   },
  pro:         { maxOrders: 99999,  maxProducts: 999,  maxUsers: 20, label: "احترافي" },
  enterprise:  { maxOrders: 999999, maxProducts: 9999, maxUsers: 99, label: "مؤسسي"  },
};

export const tenantsTable = mysqlTable("tenants", {
  id:            int("id").primaryKey().autoincrement(),
  name:          varchar("name", { length: 255 }).notNull(),
  slug:          varchar("slug", { length: 100 }).notNull().unique(),
  plan:          varchar("plan", { length: 50 }).notNull().default("free_trial"),
  planStatus:    varchar("plan_status", { length: 50 }).notNull().default("active"),
  expiresAt:     datetime("expires_at").notNull(),
  graceUntil:    datetime("grace_until"),
  contactEmail:  varchar("contact_email", { length: 255 }),
  contactPhone:  varchar("contact_phone", { length: 50 }),
  notes:         text("notes"),
  isActive:      boolean("is_active").notNull().default(true),
  createdAt:     datetime("created_at").notNull().default(new Date()),
  updatedAt:     datetime("updated_at").notNull().default(new Date()),
});

export const insertTenantSchema = createInsertSchema(tenantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenantsTable.$inferSelect;
