-- Migration: add low_balance_threshold to cash_registers
ALTER TABLE cash_registers
  ADD COLUMN IF NOT EXISTS low_balance_threshold DECIMAL(14,2) DEFAULT NULL;
