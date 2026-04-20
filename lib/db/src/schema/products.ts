import { mysqlTable, text, int, real, datetime, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
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

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
