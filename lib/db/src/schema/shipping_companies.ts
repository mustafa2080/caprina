import { mysqlTable, text, int, boolean, datetime, varchar } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shippingCompaniesTable = mysqlTable("shipping_companies", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: datetime("created_at").notNull().default(new Date()),
});

export const insertShippingCompanySchema = createInsertSchema(shippingCompaniesTable).omit({ id: true, createdAt: true });
export type InsertShippingCompany = z.infer<typeof insertShippingCompanySchema>;
export type ShippingCompany = typeof shippingCompaniesTable.$inferSelect;
