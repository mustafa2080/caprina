import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const MOVEMENT_TYPES = ["IN", "OUT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_REASONS = [
  "sale",
  "partial_sale",
  "return",
  "manual_in",
  "manual_out",
  "adjustment",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const inventoryMovementsTable = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id"),
  variantId: integer("variant_id"),
  product: text("product").notNull(),
  color: text("color"),
  size: text("size"),
  quantity: integer("quantity").notNull(),
  type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
  reason: text("reason", { enum: MOVEMENT_REASONS }).notNull(),
  orderId: integer("order_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
