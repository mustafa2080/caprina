-- Migration: Add is_default column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;
