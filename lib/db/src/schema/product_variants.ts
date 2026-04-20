import { mysqlTable, text, int, real, datetime, varchar } from "drizzle-orm/mysql-core";
import { productsTable } from "./products";

export const productVariantsTable = mysqlTable("product_variants", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  color: varchar("color", { length: 100 }).notNull(),
  size: varchar("size", { length: 100 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  totalQuantity: int("total_quantity").notNull().default(0),
  reservedQuantity: int("reserved_quantity").notNull().default(0),
  soldQuantity: int("sold_quantity").notNull().default(0),
  lowStockThreshold: int("low_stock_threshold").notNull().default(5),
  unitPrice: real("unit_price").notNull().default(0),
  costPrice: real("cost_price").default(0),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type ProductVariant = typeof productVariantsTable.$inferSelect;
