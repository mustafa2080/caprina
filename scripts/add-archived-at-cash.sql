-- Migration: إضافة عمود archived_at لجدول cash_registers
ALTER TABLE cash_registers
  ADD COLUMN archived_at DATETIME NULL DEFAULT NULL
  AFTER created_by_name;
