-- Add tenant_id to shipping_companies table
ALTER TABLE shipping_companies ADD COLUMN IF NOT EXISTS tenant_id INT NULL AFTER id;
