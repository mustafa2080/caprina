import { mysqlTable, text, int, datetime, varchar, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const EXPENSE_CATEGORIES = [
  "shipping_fees",      // مصاريف شحن
  "warehouse_rent",     // إيجار مخزن
  "salary",             // مرتبات
  "marketing",          // تسويق وإعلانات
  "packaging",          // تغليف
  "utilities",          // كهرباء / مياه / إنترنت
  "maintenance",        // صيانة
  "returns_loss",       // خسائر مرتجعات
  "other",              // أخرى
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ─── جدول المصروفات التشغيلية ────────────────────────────────────────────────
export const expensesTable = mysqlTable("expenses", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("other"),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  referenceId: varchar("reference_id", { length: 100 }), // رقم الفاتورة / أمر الشراء ...
  supplierId: int("supplier_id"),                          // مورد مرتبط (اختياري)
  shippingCompanyId: int("shipping_company_id"),           // شركة شحن (اختياري)
  notes: text("notes"),
  expenseDate: datetime("expense_date").notNull(),
  createdByUserId: int("created_by_user_id"),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdAt: datetime("created_at").notNull(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
