-- Migration: add return_reason to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS return_reason VARCHAR(255) DEFAULT NULL;
