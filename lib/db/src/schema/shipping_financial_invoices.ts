import { mysqlTable, text, int, datetime, varchar, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shippingCompaniesTable } from "./shipping_companies";
import { shippingManifestsTable } from "./shipping_manifests";

export const SHIPPING_INVOICE_STATUSES = ["pending", "verified", "paid", "disputed"] as const;
export type ShippingInvoiceStatus = (typeof SHIPPING_INVOICE_STATUSES)[number];

// ─── فواتير شركات الشحن المالية ─────────────────────────────────────────────
// (مختلف عن manifest — ده الحساب المالي الفعلي مع شركة الشحن)
export const shippingFinancialInvoicesTable = mysqlTable("shipping_financial_invoices", {
  id: int("id").primaryKey().autoincrement(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  shippingCompanyId: int("shipping_company_id").notNull().references(() => shippingCompaniesTable.id),
  manifestId: int("manifest_id").references(() => shippingManifestsTable.id),
  periodFrom: datetime("period_from"),
  periodTo: datetime("period_to"),
  totalOrders: int("total_orders").notNull().default(0),
  deliveredOrders: int("delivered_orders").notNull().default(0),
  returnedOrders: int("returned_orders").notNull().default(0),
  grossRevenue: decimal("gross_revenue", { precision: 14, scale: 2 }).notNull().default("0"),
  shippingFees: decimal("shipping_fees", { precision: 14, scale: 2 }).notNull().default("0"),
  returnFees: decimal("return_fees", { precision: 14, scale: 2 }).notNull().default("0"),
  netDue: decimal("net_due", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  notes: text("notes"),
  invoiceDate: datetime("invoice_date").notNull(),
  dueDate: datetime("due_date"),
  paidAt: datetime("paid_at"),
  createdByUserId: int("created_by_user_id"),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});

export const insertShippingFinancialInvoiceSchema = createInsertSchema(shippingFinancialInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShippingFinancialInvoice = z.infer<typeof insertShippingFinancialInvoiceSchema>;
export type ShippingFinancialInvoice = typeof shippingFinancialInvoicesTable.$inferSelect;
