import { mysqlTable, text, int, datetime, decimal, varchar } from "drizzle-orm/mysql-core";
import { shippingCompaniesTable } from "./shipping_companies";
import { ordersTable } from "./orders";

export const shippingManifestsTable = mysqlTable("shipping_manifests", {
  id: int("id").primaryKey().autoincrement(),
  manifestNumber: varchar("manifest_number", { length: 100 }).notNull(),
  shippingCompanyId: int("shipping_company_id").notNull().references(() => shippingCompaniesTable.id),
  status: varchar("status", { length: 50 }).notNull().default("open"),
  notes: text("notes"),
  invoicePrice: decimal("invoice_price", { precision: 10, scale: 2 }),
  invoiceNotes: text("invoice_notes"),
  createdAt: datetime("created_at").notNull(),
  closedAt: datetime("closed_at"),
});

export const shippingManifestOrdersTable = mysqlTable("shipping_manifest_orders", {
  id: int("id").primaryKey().autoincrement(),
  manifestId: int("manifest_id").notNull().references(() => shippingManifestsTable.id, { onDelete: "cascade" }),
  orderId: int("order_id").notNull().references(() => ordersTable.id),
  deliveryStatus: varchar("delivery_status", { length: 50 }).notNull().default("pending"),
  deliveryNote: text("delivery_note"),
  deliveredAt: datetime("delivered_at"),
  addedAt: datetime("added_at").notNull(),
});

export type ShippingManifest = typeof shippingManifestsTable.$inferSelect;
export type ShippingManifestOrder = typeof shippingManifestOrdersTable.$inferSelect;
