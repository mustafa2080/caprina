-- ─── Migration: Sale Orders Module ──────────────────────────────────────────
-- أوامر البيع (B2B) مرتبطة بالمخازن والفواتير

-- جدول أوامر البيع الرئيسي
CREATE TABLE IF NOT EXISTS sale_orders (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id        INT,
  so_number        VARCHAR(100) NOT NULL,
  -- بيانات العميل
  client_name      VARCHAR(255) NOT NULL,
  client_phone     VARCHAR(100),
  client_address   TEXT,
  -- المخزن المرتبط
  warehouse_id     INT,
  -- الحالة
  status           VARCHAR(50) NOT NULL DEFAULT 'draft',
  payment_status   VARCHAR(50) NOT NULL DEFAULT 'unpaid',
  -- المبالغ
  total_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(14,2) DEFAULT 0,
  shipping_cost    DECIMAL(14,2) DEFAULT 0,
  tax_amount       DECIMAL(14,2) DEFAULT 0,
  -- الفاتورة المرتبطة
  invoice_ref      VARCHAR(100),
  -- تواريخ
  expected_date    DATETIME,
  delivered_at     DATETIME,
  -- ميتا
  notes            TEXT,
  created_by_user_id INT,
  created_by_name  VARCHAR(255),
  created_at       DATETIME NOT NULL,
  updated_at       DATETIME NOT NULL,
  -- FK
  CONSTRAINT fk_so_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);

-- جدول بنود أوامر البيع
CREATE TABLE IF NOT EXISTS sale_order_items (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  sale_order_id  INT NOT NULL,
  product_id     INT,
  variant_id     INT,
  product_name   VARCHAR(255) NOT NULL,
  color          VARCHAR(100),
  size           VARCHAR(100),
  sku            VARCHAR(100),
  quantity       INT NOT NULL,
  delivered_qty  INT NOT NULL DEFAULT 0,
  unit_price     DECIMAL(14,2) NOT NULL,
  total_price    DECIMAL(14,2) NOT NULL,
  notes          TEXT,
  CONSTRAINT fk_soi_sale_order FOREIGN KEY (sale_order_id) REFERENCES sale_orders(id) ON DELETE CASCADE
);
