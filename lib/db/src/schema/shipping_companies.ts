import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shippingCompaniesTable = pgTable("shipping_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  website: text("website"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShippingCompanySchema = createInsertSchema(shippingCompaniesTable).omit({ id: true, createdAt: true });
export type InsertShippingCompany = z.infer<typeof insertShippingCompanySchema>;
export type ShippingCompany = typeof shippingCompaniesTable.$inferSelect;
