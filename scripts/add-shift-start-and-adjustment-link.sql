-- إضافة وقت بداية الشيفت لكل موظف، وربط الاستثناءات بيوم حضور محدد
ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS shift_start VARCHAR(5) NULL DEFAULT '09:00';

ALTER TABLE payroll_adjustments
  ADD COLUMN IF NOT EXISTS attendance_id INT NULL;
