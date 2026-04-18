import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { warehousesTable } from "./warehouses";
import { productsTable } from "./products";
import { productVariantsTable } from "./product_variants";

export const warehouseStockTable = pgTable("warehouse_stock", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehousesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type WarehouseStock = typeof warehouseStockTable.$inferSelect;
