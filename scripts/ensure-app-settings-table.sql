-- app_settings موجود بالفعل غالبًا (تم إنشاؤه تلقائيًا في app.ts عند تشغيل السيرفر)
-- الكويري دي للتأكد فقط، مش هتعمل تعديل لو الجدول موجود
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` LONGTEXT,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
