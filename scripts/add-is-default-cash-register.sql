-- Migration: add is_default to cash_registers
ALTER TABLE cash_registers
  ADD COLUMN IF NOT EXISTS is_default TINYINT(1) NOT NULL DEFAULT 0;

UPDATE cash_registers
  SET is_default = 1
  WHERE type = 'main'
  ORDER BY id
  LIMIT 1;
