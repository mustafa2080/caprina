-- Migration: add cash_register_id to expenses (Phase 3 - auto-deduct from treasury)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS cash_register_id INT DEFAULT NULL;
