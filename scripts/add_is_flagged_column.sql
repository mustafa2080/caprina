-- إضافة عمود is_flagged لجدول employee_profiles (علامة "عائب" بعد غياب كامل بعد الساعة 12 ظهرًا)
-- شغّلها مرة واحدة على قاعدة بيانات الإنتاج بعد الديبلوي
ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;
