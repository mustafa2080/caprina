import { mysqlTable, text, int, datetime, varchar, decimal } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { warehousesTable } from "./warehouses";

export const SALE_ORDER_STATUSES = ["draft", "confirmed", "processing", "delivered", "closed", "cancelled"] as const;
export type SaleOrderStatus = (typeof SALE_ORDER_STATUSES)[number];

export const SALE_ORDER_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type SaleOrderPaymentStatus = (typeof SALE_ORDER_PAYMENT_STATUSES)[number];

// ─── جدول أوامر البيع (Sale Orders) ─────────────────────────────────────────
export const saleOrdersTable = mysqlTable("sale_orders", {
  id:              int("id").primaryKey().autoincrement(),
  tenantId:        int("tenant_id"),
  soNumber:        varchar("so_number", { length: 100 }).notNull(),      // رقم أمر البيع SO-2026-001
  // ── بيانات العميل ──────────────────────────────────────────────────────
  clientName:      varchar("client_name",    { length: 255 }).notNull(), // اسم العميل / الشركة
  clientPhone:     varchar("client_phone",   { length: 100 }),
  clientAddress:   text("client_address"),
  // ── المخزن المرتبط ─────────────────────────────────────────────────────
  warehouseId:     int("warehouse_id").references(() => warehousesTable.id),
  // ── الحالة والدفع ──────────────────────────────────────────────────────
  status:          varchar("status",          { length: 50 }).notNull().default("draft"),
  paymentStatus:   varchar("payment_status",  { length: 50 }).notNull().default("unpaid"),
  totalAmount:     decimal("total_amount",    { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount:      decimal("paid_amount",     { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount:  decimal("discount_amount", { precision: 14, scale: 2 }).default("0"),
  shippingCost:    decimal("shipping_cost",   { precision: 14, scale: 2 }).default("0"),
  taxAmount:       decimal("tax_amount",      { precision: 14, scale: 2 }).default("0"),
  // ── الفاتورة المرتبطة ──────────────────────────────────────────────────
  invoiceRef:      varchar("invoice_ref", { length: 100 }),              // رقم الفاتورة المولودة
  // ── تواريخ ─────────────────────────────────────────────────────────────
  expectedDate:    datetime("expected_date"),
  deliveredAt:     datetime("delivered_at"),
  // ── ميتا ───────────────────────────────────────────────────────────────
  notes:           text("notes"),
  createdByUserId: int("created_by_user_id"),
  createdByName:   varchar("created_by_name", { length: 255 }),
  createdAt:       datetime("created_at").notNull(),
  updatedAt:       datetime("updated_at").notNull(),
});

// ─── جدول بنود أوامر البيع ──────────────────────────────────────────────────
export const saleOrderItemsTable = mysqlTable("sale_order_items", {
  id:            int("id").primaryKey().autoincrement(),
  saleOrderId:   int("sale_order_id").notNull().references(() => saleOrdersTable.id, { onDelete: "cascade" }),
  productId:     int("product_id"),
  variantId:     int("variant_id"),
  productName:   varchar("product_name", { length: 255 }).notNull(),
  color:         varchar("color",   { length: 100 }),
  size:          varchar("size",    { length: 100 }),
  sku:           varchar("sku",     { length: 100 }),
  quantity:      int("quantity").notNull(),
  deliveredQty:  int("delivered_qty").notNull().default(0),  // الكمية المُسلَّمة فعلاً
  unitPrice:     decimal("unit_price",  { precision: 14, scale: 2 }).notNull(),  // سعر البيع للجملة
  totalPrice:    decimal("total_price", { precision: 14, scale: 2 }).notNull(),
  notes:         text("notes"),
});

export const insertSaleOrderSchema = createInsertSchema(saleOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSaleOrder = z.infer<typeof insertSaleOrderSchema>;
export type SaleOrder      = typeof saleOrdersTable.$inferSelect;
export type SaleOrderItem  = typeof saleOrderItemsTable.$inferSelect;
