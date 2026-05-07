import { mysqlTable, text, int, real, datetime, varchar, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { warehousesTable } from "./warehouses";

export const PURCHASE_STATUSES = ["draft", "ordered", "received", "partial_received", "cancelled"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];

// ─── جدول أوامر الشراء (Purchase Orders) ──────────────────────────────────
export const purchaseOrdersTable = mysqlTable("purchase_orders", {
  id: int("id").primaryKey().autoincrement(),
  poNumber: varchar("po_number", { length: 100 }).notNull(), // رقم أمر الشراء
  supplierId: int("supplier_id").references(() => suppliersTable.id),
  supplierName: varchar("supplier_name", { length: 255 }), // اسم المورد (fallback)
  warehouseId: int("warehouse_id").references(() => warehousesTable.id),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("unpaid"),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: decimal("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  shippingCost: decimal("shipping_cost", { precision: 14, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 14, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 14, scale: 2 }).default("0"),
  notes: text("notes"),
  expectedDate: datetime("expected_date"),
  receivedAt: datetime("received_at"),
  createdByUserId: int("created_by_user_id"),
  createdByName: varchar("created_by_name", { length: 255 }),
  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});

// ─── جدول بنود أوامر الشراء ─────────────────────────────────────────────────
export const purchaseOrderItemsTable = mysqlTable("purchase_order_items", {
  id: int("id").primaryKey().autoincrement(),
  purchaseOrderId: int("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  productId: int("product_id"),
  variantId: int("variant_id"),
  productName: varchar("product_name", { length: 255 }).notNull(),
  color: varchar("color", { length: 100 }),
  size: varchar("size", { length: 100 }),
  sku: varchar("sku", { length: 100 }),
  quantity: int("quantity").notNull(),
  receivedQuantity: int("received_quantity").notNull().default(0),
  unitCost: decimal("unit_cost", { precision: 14, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItemsTable.$inferSelect;
