-- ============================================================
-- Tenant Isolation Migration
-- يضيف عمود tenant_id لكل الجداول الأساسية
-- شغّله مرة واحدة على السيرفر
-- ============================================================

-- 1. orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_tenant_id (tenant_id);

-- 2. products
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;
ALTER TABLE products ADD INDEX IF NOT EXISTS idx_products_tenant_id (tenant_id);

-- 3. warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;
ALTER TABLE warehouses ADD INDEX IF NOT EXISTS idx_warehouses_tenant_id (tenant_id);

-- 4. expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;
ALTER TABLE expenses ADD INDEX IF NOT EXISTS idx_expenses_tenant_id (tenant_id);

-- 5. cash_registers
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;
ALTER TABLE cash_registers ADD INDEX IF NOT EXISTS idx_cash_registers_tenant_id (tenant_id);

-- 6. suppliers (لو موجود)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT NULL;

-- ============================================================
-- بعد التنفيذ: بيانات الشركة الأصلية (tenantId=1) تتحدث هكذا:
-- UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE warehouses SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE expenses SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE cash_registers SET tenant_id = 1 WHERE tenant_id IS NULL;
-- ============================================================
