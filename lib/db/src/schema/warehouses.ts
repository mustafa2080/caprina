import { mysqlTable, int, boolean, datetime, text, varchar } from "drizzle-orm/mysql-core";

export const warehousesTable = mysqlTable("warehouses", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  notes: text("notes"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: datetime("created_at").notNull().default(new Date()),
  updatedAt: datetime("updated_at").notNull().default(new Date()),
});

export type Warehouse = typeof warehousesTable.$inferSelect;
