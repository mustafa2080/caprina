-- ─── إضافة tenant_id لجدول audit_logs ────────────────────────────────────────
-- تشغيل مرة واحدة على السيرفر
-- إذا الـ column موجودة أصلاً، الـ IF NOT EXISTS بيمنع الـ error

ALTER TABLE `audit_logs`
  ADD COLUMN IF NOT EXISTS `tenant_id` INT DEFAULT NULL AFTER `id`,
  ADD INDEX IF NOT EXISTS `idx_audit_logs_tenant_id` (`tenant_id`);
