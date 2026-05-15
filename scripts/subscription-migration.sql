-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: نظام الاشتراكات (Subscription System)
-- شغّل ده على السيرفر مرة واحدة
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. جدول الـ tenants
CREATE TABLE IF NOT EXISTS tenants (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  plan            VARCHAR(50)  NOT NULL DEFAULT 'free_trial',
  plan_status     VARCHAR(50)  NOT NULL DEFAULT 'active',
  expires_at      DATETIME     NOT NULL,
  grace_until     DATETIME     NULL,
  contact_email   VARCHAR(255) NULL,
  contact_phone   VARCHAR(50)  NULL,
  notes           TEXT         NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. إضافة tenant_id لجدول users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id INT NULL AFTER role;

-- 3. إضافة super_admin كـ role مسموح (تحديث CHECK لو موجود — MariaDB بتتجاهله تلقائياً)

-- 4. إنشاء tenant الافتراضي (للبيانات الحالية) مع اشتراك سنة كاملة
INSERT IGNORE INTO tenants (id, name, slug, plan, plan_status, expires_at)
VALUES (1, 'Caprina', 'caprina', 'enterprise', 'active', DATE_ADD(NOW(), INTERVAL 365 DAY));

-- 5. ربط كل الـ users الحاليين بالـ tenant الافتراضي (ماعدا super_admin)
UPDATE users SET tenant_id = 1 WHERE role != 'super_admin' AND tenant_id IS NULL;

-- 6. إنشاء حساب super_admin (غيّر الباسورد فوراً!)
-- الباسورد: SuperAdmin@2025 — هتتغير من لوحة التحكم
INSERT IGNORE INTO users (username, password_hash, display_name, role, permissions, is_active, tenant_id)
VALUES (
  'superadmin',
  '$2b$10$placeholder_change_me_immediately',
  'المدير الرئيسي',
  'super_admin',
  '["*"]',
  1,
  NULL
);

-- تحقق من النتيجة
SELECT 'tenants' AS tbl, COUNT(*) AS cnt FROM tenants
UNION ALL SELECT 'users with tenant_id', COUNT(*) FROM users WHERE tenant_id IS NOT NULL
UNION ALL SELECT 'super_admin users', COUNT(*) FROM users WHERE role = 'super_admin';
