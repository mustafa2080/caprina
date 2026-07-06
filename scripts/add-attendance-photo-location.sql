-- إضافة أعمدة صورة ولوكيشن الحضور/الانصراف
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS check_in_photo TEXT NULL,
  ADD COLUMN IF NOT EXISTS check_in_lat DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS check_in_lng DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS check_in_address VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS check_out_photo TEXT NULL,
  ADD COLUMN IF NOT EXISTS check_out_lat DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS check_out_lng DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS check_out_address VARCHAR(500) NULL;
