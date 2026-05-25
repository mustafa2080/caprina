-- Add avatar column to clients table (or modify if exists as TEXT)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avatar LONGTEXT NULL;

-- لو الـ column موجودة بالفعل كـ TEXT، عدّلها لـ LONGTEXT
ALTER TABLE clients MODIFY COLUMN avatar LONGTEXT NULL;
