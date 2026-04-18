import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  color: text("color").notNull(),
  size: text("size").notNull(),
  sku: text("sku"),
  totalQuantity: integer("total_quantity").notNull().default(0),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  unitPrice: real("unit_price").notNull().default(0),
  costPrice: real("cost_price").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ProductVariant = typeof productVariantsTable.$inferSelect;
