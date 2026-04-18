import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { shippingCompaniesTable } from "./shipping_companies";
import { ordersTable } from "./orders";

export const shippingManifestsTable = pgTable("shipping_manifests", {
  id: serial("id").primaryKey(),
  manifestNumber: text("manifest_number").notNull(),
  shippingCompanyId: integer("shipping_company_id").notNull().references(() => shippingCompaniesTable.id),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const shippingManifestOrdersTable = pgTable("shipping_manifest_orders", {
  id: serial("id").primaryKey(),
  manifestId: integer("manifest_id").notNull().references(() => shippingManifestsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShippingManifest = typeof shippingManifestsTable.$inferSelect;
export type ShippingManifestOrder = typeof shippingManifestOrdersTable.$inferSelect;
