import { mysqlTable, text, int, real, boolean, datetime, varchar, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── جدول الموردين ──────────────────────────────────────────────────────────
export const suppliersTable = mysqlTable("suppliers", {
  id: int("id").primaryKey().autoincrement(),
  tenantId: int("tenant_id"),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  country: varchar("country", { length: 100 }),
  category: varchar("category", { length: 100 }), // نوع المورد: خامات / منتجات / تغليف ...
  taxNumber: varchar("tax_number", { length: 100 }),
  paymentTerms: varchar("payment_terms", { length: 255 }), // شروط الدفع: 30 يوم / نقداً ...
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  balance: decimal("balance", { precision: 14, scale: 2 }).notNull().default("0"), // رصيد الحساب
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
