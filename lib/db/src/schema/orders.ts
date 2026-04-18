import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ORDER_STATUSES = ["pending", "in_shipping", "received", "delayed", "returned", "partial_received"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
  notes: text("notes"),
  returnReason: text("return_reason"),
  returnNote: text("return_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true, totalPrice: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
