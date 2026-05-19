import { mysqlTable, text, int, datetime, varchar, decimal, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── جدول العملاء التجاريين ─────────────────────────────────────────────────
export const clientsTable = mysqlTable("clients", {
  id:             int("id").primaryKey().autoincrement(),
  tenantId:       int("tenant_id"),

  // ── بيانات أساسية ─────────────────────────────────────────────────────
  name:           varchar("name",    { length: 255 }).notNull(),       // اسم العميل / الشركة
  phone:          varchar("phone",   { length: 100 }),
  phone2:         varchar("phone2",  { length: 100 }),
  email:          varchar("email",   { length: 255 }),
  address:        text("address"),
  city:           varchar("city",    { length: 100 }),
  region:         varchar("region",  { length: 100 }),

  // ── تجاري ─────────────────────────────────────────────────────────────
  taxNumber:      varchar("tax_number",    { length: 100 }),           // الرقم الضريبي
  commercialReg:  varchar("commercial_reg", { length: 100 }),          // السجل التجاري
  paymentTerms:   varchar("payment_terms", { length: 100 }),           // شروط الدفع (مثلاً: آجل 30 يوم)
  creditLimit:    decimal("credit_limit", { precision: 14, scale: 2 }).default("0"), // حد الائتمان

  // ── إحصائيات محسوبة (تُحدَّث عند كل أمر بيع) ─────────────────────────
  totalOrders:    int("total_orders").default(0),
  totalSales:     decimal("total_sales", { precision: 14, scale: 2 }).default("0"),
  totalPaid:      decimal("total_paid",  { precision: 14, scale: 2 }).default("0"),

  // ── ميتا ──────────────────────────────────────────────────────────────
  notes:          text("notes"),
  isActive:       boolean("is_active").default(true),
  createdAt:      datetime("created_at").notNull(),
  updatedAt:      datetime("updated_at").notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client       = typeof clientsTable.$inferSelect;
