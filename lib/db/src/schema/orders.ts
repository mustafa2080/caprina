import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ORDER_STATUSES = ["pending", "in_shipping", "received", "delayed", "returned", "partial_received"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const AD_SOURCES = ["facebook", "tiktok", "instagram", "organic", "whatsapp", "other"] as const;
export type AdSource = (typeof AD_SOURCES)[number];

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone"),
  address: text("address"),
  product: text("product").notNull(),
  color: text("color"),
  size: text("size"),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
  partialQuantity: integer("partial_quantity"),
  shippingCompanyId: integer("shipping_company_id"),
  productId: integer("product_id"),
  variantId: integer("variant_id"),
  warehouseId: integer("warehouse_id"),
  assignedUserId: integer("assigned_user_id"),
  adSource: text("ad_source"),
  adCampaign: text("ad_campaign"),
  costPrice: real("cost_price"),
  shippingCost: real("shipping_cost").default(0),
  notes: text("notes"),
  returnReason: text("return_reason"),
  returnNote: text("return_note"),
  trackingNumber: text("tracking_number"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
},
(t) => [
  index("idx_orders_status").on(t.status),
  index("idx_orders_deleted_at").on(t.deletedAt),
  index("idx_orders_created_at").on(t.createdAt),
  index("idx_orders_product_id").on(t.productId),
  index("idx_orders_shipping_company_id").on(t.shippingCompanyId),
  index("idx_orders_assigned_user_id").on(t.assignedUserId),
  index("idx_orders_status_deleted").on(t.status, t.deletedAt),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true, totalPrice: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
