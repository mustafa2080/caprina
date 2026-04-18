import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  notes: text("notes"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Warehouse = typeof warehousesTable.$inferSelect;
