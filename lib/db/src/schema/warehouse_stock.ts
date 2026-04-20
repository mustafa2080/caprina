import { mysqlTable, int, datetime } from "drizzle-orm/mysql-core";
import { warehousesTable } from "./warehouses";
import { productsTable } from "./products";
import { productVariantsTable } from "./product_variants";

export const warehouseStockTable = mysqlTable("warehouse_stock", {
  id: int("id").primaryKey().autoincrement(),
  warehouseId: int("warehouse_id").notNull().references(() => warehousesTable.id, { onDelete: "cascade" }),
  productId: int("product_id").references(() => productsTable.id, { onDelete: "cascade" }),
  variantId: int("variant_id").references(() => productVariantsTable.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(0),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type WarehouseStock = typeof warehouseStockTable.$inferSelect;
