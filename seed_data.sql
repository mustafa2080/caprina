-- ============================================================
-- Caprina Orders - Seed Data (Arabic / Realistic)
-- Run: psql -U postgres -d caprina -f seed_data.sql
-- ============================================================

-- ─── 1. Shipping Companies ───────────────────────────────────
INSERT INTO shipping_companies (name, phone, website, notes, is_active) VALUES
  ('بريد مصر', '19191', 'https://www.egyptpost.org', 'التوصيل خلال 3-5 أيام عمل', true),
  ('ارامكس', '16226', 'https://www.aramex.com/eg', 'توصيل سريع للمحافظات', true),
  ('DHL مصر', '19345', 'https://www.dhl.com/eg', 'توصيل دولي وداخلي', true),
  ('J&T Express', '15810', 'https://www.jtexpress.eg', 'أسعار تنافسية', true),
  ('MylerZ', '16505', 'https://www.mylerz.com', 'متخصص في التجارة الإلكترونية', true)
ON CONFLICT DO NOTHING;

-- ─── 2. Warehouses ───────────────────────────────────────────
INSERT INTO warehouses (name, address, notes, is_default) VALUES
  ('المخزن الرئيسي - القاهرة', 'المنطقة الصناعية، العبور، القاهرة', 'المخزن الأساسي للبضاعة', true),
  ('فرع الإسكندرية', 'المنطقة الصناعية الثانية، برج العرب، الإسكندرية', 'تغطية محافظات الدلتا والساحل الشمالي', false),
  ('نقطة توزيع الجيزة', 'شارع الهرم، الجيزة', 'للطلبات السريعة في الجيزة والقاهرة', false)
ON CONFLICT DO NOTHING;


-- ─── 3. Users (employees) ────────────────────────────────────
-- password hash = bcrypt of "123456"
INSERT INTO users (username, password_hash, display_name, role, permissions, is_active) VALUES
  ('sara.hassan', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LzTFONlAWnm', 'سارة حسن', 'employee', '["orders","dashboard"]', true),
  ('ahmed.ali', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LzTFONlAWnm', 'أحمد علي', 'employee', '["orders","dashboard"]', true),
  ('mona.fathy', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LzTFONlAWnm', 'منى فتحي', 'employee', '["orders","dashboard"]', true),
  ('youssef.kamal', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LzTFONlAWnm', 'يوسف كمال', 'warehouse', '["inventory","movements","dashboard"]', true),
  ('hana.ibrahim', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LzTFONlAWnm', 'هناء إبراهيم', 'employee', '["orders","dashboard"]', true)
ON CONFLICT (username) DO NOTHING;

-- ─── 4. Employee Profiles ────────────────────────────────────
INSERT INTO employee_profiles (user_id, display_name, job_title, department, monthly_salary, hire_date, notes)
SELECT id, display_name,
  CASE username
    WHEN 'sara.hassan'    THEN 'مسؤولة خدمة العملاء'
    WHEN 'ahmed.ali'      THEN 'مسؤول المبيعات'
    WHEN 'mona.fathy'     THEN 'متابعة الطلبات'
    WHEN 'youssef.kamal'  THEN 'أمين المخزن'
    WHEN 'hana.ibrahim'   THEN 'مسؤولة التسويق'
  END,
  CASE username
    WHEN 'sara.hassan'    THEN 'خدمة العملاء'
    WHEN 'ahmed.ali'      THEN 'المبيعات'
    WHEN 'mona.fathy'     THEN 'العمليات'
    WHEN 'youssef.kamal'  THEN 'المخازن'
    WHEN 'hana.ibrahim'   THEN 'التسويق'
  END,
  CASE username
    WHEN 'sara.hassan'    THEN 4500
    WHEN 'ahmed.ali'      THEN 5000
    WHEN 'mona.fathy'     THEN 4000
    WHEN 'youssef.kamal'  THEN 3800
    WHEN 'hana.ibrahim'   THEN 4200
  END,
  CASE username
    WHEN 'sara.hassan'    THEN '2023-03-01'
    WHEN 'ahmed.ali'      THEN '2022-11-15'
    WHEN 'mona.fathy'     THEN '2023-06-01'
    WHEN 'youssef.kamal'  THEN '2022-08-10'
    WHEN 'hana.ibrahim'   THEN '2024-01-05'
  END,
  NULL
FROM users WHERE username IN ('sara.hassan','ahmed.ali','mona.fathy','youssef.kamal','hana.ibrahim')
ON CONFLICT (user_id) DO NOTHING;


-- ─── 5. Products ─────────────────────────────────────────────
INSERT INTO products (name, sku, total_quantity, reserved_quantity, sold_quantity, low_stock_threshold, unit_price, cost_price) VALUES
  ('كريم كابرينا المرطب',        'CAP-CRM-001', 350, 20, 180, 30, 85,  40),
  ('غسول الوجه كابرينا',         'CAP-WAS-002', 280, 15, 220, 25, 75,  32),
  ('سيروم كابرينا للتفتيح',      'CAP-SER-003', 150, 10,  90, 20, 195, 85),
  ('مجموعة العناية الكاملة',     'CAP-SET-004',  80,  5,  60, 10, 350, 160),
  ('واقي الشمس كابرينا SPF50',   'CAP-SUN-005', 200, 12, 140, 25, 130, 55),
  ('زيت الأرجان للشعر',          'CAP-OIL-006', 120,  8,  75, 15, 160, 70),
  ('ماسك الوجه بالطين',          'CAP-MSK-007', 180, 10, 100, 20, 95,  42),
  ('كريم العين المضاد للهالات',  'CAP-EYE-008', 100,  6,  55, 15, 145, 62),
  ('تونر البشرة المنقي',         'CAP-TON-009', 160,  9,  88, 20, 88,  38),
  ('لوشن الجسم المرطب بالشيا',   'CAP-LOT-010', 220, 14, 130, 25, 72,  30)
ON CONFLICT DO NOTHING;

-- ─── 6. Product Variants ─────────────────────────────────────
INSERT INTO product_variants (product_id, color, size, sku, total_quantity, reserved_quantity, sold_quantity, unit_price, cost_price)
SELECT p.id, v.color, v.size, p.sku || '-' || v.suffix, v.qty, v.res, v.sold, p.unit_price, p.cost_price
FROM products p
JOIN (VALUES
  ('كريم كابرينا المرطب',   'أبيض فاتح',    '50ml',  'WH-50',  80, 5, 40),
  ('كريم كابرينا المرطب',   'بيج',          '100ml', 'BG-100', 120, 8, 70),
  ('كريم كابرينا المرطب',   'وردي',         '200ml', 'PK-200', 150, 7, 70),
  ('غسول الوجه كابرينا',    'شفاف',         '150ml', 'TR-150', 140, 8, 110),
  ('غسول الوجه كابرينا',    'أبيض',         '300ml', 'WH-300', 140, 7, 110),
  ('سيروم كابرينا للتفتيح', 'ذهبي',         '30ml',  'GD-30',   75, 5,  45),
  ('سيروم كابرينا للتفتيح', 'شفاف',         '50ml',  'TR-50',   75, 5,  45),
  ('واقي الشمس كابرينا SPF50','أبيض',        '75ml',  'WH-75',  100, 6,  70),
  ('واقي الشمس كابرينا SPF50','بيج',         '150ml', 'BG-150', 100, 6,  70),
  ('زيت الأرجان للشعر',     'ذهبي',         '100ml', 'GD-100',  60, 4,  38),
  ('زيت الأرجان للشعر',     'عنبري',        '200ml', 'AM-200',  60, 4,  37)
) AS v(prod_name, color, size, suffix, qty, res, sold)
ON p.name = v.prod_name
ON CONFLICT DO NOTHING;


-- ─── 7. Warehouse Stock ──────────────────────────────────────
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
SELECT w.id, p.id,
  CASE w.name
    WHEN 'المخزن الرئيسي - القاهرة' THEN floor(p.total_quantity * 0.6)::int
    WHEN 'فرع الإسكندرية'            THEN floor(p.total_quantity * 0.25)::int
    ELSE                                   floor(p.total_quantity * 0.15)::int
  END
FROM warehouses w CROSS JOIN products p
ON CONFLICT DO NOTHING;

-- ─── 8. Orders ───────────────────────────────────────────────
-- helpers
DO $$
DECLARE
  sc_aramex  int; sc_jt int; sc_mylerz int; sc_ems int;
  wh_main    int;
  u_sara     int; u_ahmed int; u_mona int;
  p_cream    int; p_wash int; p_serum int; p_set int; p_sun int;
  p_oil      int; p_mask int; p_eye int; p_toner int; p_lotion int;
BEGIN
  SELECT id INTO sc_aramex  FROM shipping_companies WHERE name = 'ارامكس';
  SELECT id INTO sc_jt      FROM shipping_companies WHERE name = 'J&T Express';
  SELECT id INTO sc_mylerz  FROM shipping_companies WHERE name = 'MylerZ';
  SELECT id INTO sc_ems     FROM shipping_companies WHERE name = 'بريد مصر';
  SELECT id INTO wh_main    FROM warehouses WHERE name = 'المخزن الرئيسي - القاهرة';
  SELECT id INTO u_sara     FROM users WHERE username = 'sara.hassan';
  SELECT id INTO u_ahmed    FROM users WHERE username = 'ahmed.ali';
  SELECT id INTO u_mona     FROM users WHERE username = 'mona.fathy';
  SELECT id INTO p_cream    FROM products WHERE sku = 'CAP-CRM-001';
  SELECT id INTO p_wash     FROM products WHERE sku = 'CAP-WAS-002';
  SELECT id INTO p_serum    FROM products WHERE sku = 'CAP-SER-003';
  SELECT id INTO p_set      FROM products WHERE sku = 'CAP-SET-004';
  SELECT id INTO p_sun      FROM products WHERE sku = 'CAP-SUN-005';
  SELECT id INTO p_oil      FROM products WHERE sku = 'CAP-OIL-006';
  SELECT id INTO p_mask     FROM products WHERE sku = 'CAP-MSK-007';
  SELECT id INTO p_eye      FROM products WHERE sku = 'CAP-EYE-008';
  SELECT id INTO p_toner    FROM products WHERE sku = 'CAP-TON-009';
  SELECT id INTO p_lotion   FROM products WHERE sku = 'CAP-LOT-010';

  INSERT INTO orders (customer_name, phone, address, product, color, size, quantity, unit_price, total_price, status, shipping_company_id, product_id, warehouse_id, assigned_user_id, ad_source, ad_campaign, cost_price, shipping_cost, notes, created_at) VALUES
-- Delivered orders (received)
('فاطمة محمد علي',      '01012345678', 'شارع التحرير، الدقي، الجيزة',              'كريم كابرينا المرطب',       'بيج',       '100ml', 2, 85, 170,  'received',        sc_aramex, p_cream,  wh_main, u_sara,  'facebook',  'حملة رمضان 2024',   40, 25, NULL,       NOW() - INTERVAL '45 days'),
('نورهان أحمد سعيد',   '01123456789', 'مدينة نصر، القاهرة',                        'غسول الوجه كابرينا',        'شفاف',     '150ml', 1, 75,  75,  'received',        sc_jt,     p_wash,   wh_main, u_ahmed, 'instagram', 'ستوري مارس',        32, 20, NULL,       NOW() - INTERVAL '40 days'),
('ريم خالد إبراهيم',   '01234567890', 'المعادي، القاهرة',                          'سيروم كابرينا للتفتيح',    'ذهبي',     '30ml',  1, 195, 195, 'received',        sc_mylerz, p_serum,  wh_main, u_mona,  'tiktok',    'تيك توك أبريل',     85, 30, NULL,       NOW() - INTERVAL '35 days'),
('هدى محمود حسن',      '01098765432', 'العجوزة، الجيزة',                           'مجموعة العناية الكاملة',   NULL,       NULL,    1, 350, 350, 'received',        sc_aramex, p_set,    wh_main, u_sara,  'facebook',  'حملة رمضان 2024',   160, 35, NULL,      NOW() - INTERVAL '32 days'),
('سمر علي حسين',       '01187654321', 'الزمالك، القاهرة',                          'واقي الشمس كابرينا SPF50', 'أبيض',     '75ml',  2, 130, 260, 'received',        sc_jt,     p_sun,    wh_main, u_ahmed, 'instagram', 'إعلان صيف 2024',    55, 20, NULL,       NOW() - INTERVAL '28 days'),
('دينا عبدالله رضا',   '01276543210', 'المنصورة، الدقهلية',                        'زيت الأرجان للشعر',        'ذهبي',     '100ml', 1, 160, 160, 'received',        sc_ems,    p_oil,    wh_main, u_mona,  'whatsapp',  NULL,                70, 30, NULL,       NOW() - INTERVAL '25 days'),
('أسماء طارق محمد',    '01365432109', 'الإسكندرية، سموحة',                         'كريم العين المضاد للهالات','وردي',     '30ml',  1, 145, 145, 'received',        sc_aramex, p_eye,    wh_main, u_sara,  'facebook',  'إعلانات ماي',       62, 25, NULL,       NOW() - INTERVAL '20 days'),
('منة الله يوسف',      '01454321098', 'طنطا، الغربية',                             'تونر البشرة المنقي',        'شفاف',     '200ml', 2, 88, 176, 'received',        sc_mylerz, p_toner,  wh_main, u_ahmed, 'tiktok',    'تيك توك مايو',      38, 20, NULL,       NOW() - INTERVAL '18 days'),
('إيمان صلاح الدين',   '01543210987', 'الشيخ زايد، الجيزة',                        'لوشن الجسم المرطب بالشيا', 'أبيض',     '300ml', 3, 72, 216, 'received',        sc_jt,     p_lotion, wh_main, u_mona,  'instagram', 'إعلانات يونيو',     30, 20, NULL,       NOW() - INTERVAL '15 days'),
('رانيا محمد فتحي',    '01632109876', 'بنها، القليوبية',                           'ماسك الوجه بالطين',         'طبيعي',    '100g',  2, 95, 190, 'received',        sc_ems,    p_mask,   wh_main, u_sara,  'facebook',  'حملة الصيف الكبرى', 42, 25, NULL,       NOW() - INTERVAL '12 days'),

-- In shipping
('ولاء أحمد محمود',    '01721098765', 'الإسماعيلية',                               'كريم كابرينا المرطب',       'وردي',     '200ml', 1, 85,  85,  'in_shipping',     sc_aramex, p_cream,  wh_main, u_ahmed, 'facebook',  'حملة الصيف الكبرى', 40, 25, NULL,       NOW() - INTERVAL '8 days'),
('مروة حسن عبده',      '01810987654', 'السويس',                                    'غسول الوجه كابرينا',        'أبيض',     '300ml', 2, 75, 150, 'in_shipping',     sc_jt,     p_wash,   wh_main, u_mona,  'tiktok',    'تيك توك يوليو',     32, 20, NULL,       NOW() - INTERVAL '6 days'),
('شيماء علي إبراهيم',  '01909876543', 'الغردقة، البحر الأحمر',                     'واقي الشمس كابرينا SPF50', 'بيج',      '150ml', 3, 130, 390,'in_shipping',     sc_mylerz, p_sun,    wh_main, u_sara,  'instagram', 'إعلانات الصيف',     55, 35, NULL,       NOW() - INTERVAL '5 days'),
('نادية كمال يوسف',    '01008765432', 'أسيوط',                                     'سيروم كابرينا للتفتيح',    'شفاف',     '50ml',  1, 195, 195,'in_shipping',     sc_ems,    p_serum,  wh_main, u_ahmed, 'facebook',  'حملة الصيف الكبرى', 85, 30, NULL,       NOW() - INTERVAL '4 days'),
('أميرة سامي حسين',    '01107654321', 'الأقصر',                                    'مجموعة العناية الكاملة',   NULL,       NULL,    1, 350, 350,'in_shipping',     sc_aramex, p_set,    wh_main, u_mona,  'whatsapp',  NULL,                160, 35, 'العميلة طلبت التعجيل', NOW() - INTERVAL '3 days'),

-- Pending
('لمياء عبدالرحمن',    '01206543210', 'الدقهلية، المنصورة',                        'زيت الأرجان للشعر',        'عنبري',    '200ml', 1, 160, 160,'pending',         NULL,      p_oil,    wh_main, u_sara,  'instagram', 'إعلانات يوليو',     70, 0,  NULL,       NOW() - INTERVAL '2 days'),
('شروق محمد ناصر',     '01305432109', 'كفر الشيخ',                                 'تونر البشرة المنقي',        'شفاف',     '200ml', 2, 88, 176,'pending',         NULL,      p_toner,  wh_main, u_ahmed, 'tiktok',    'تيك توك أغسطس',    38, 0,  NULL,       NOW() - INTERVAL '1 day'),
('دعاء إبراهيم سعيد',  '01404321098', 'المنيا',                                    'كريم العين المضاد للهالات',NULL,       NULL,    1, 145, 145,'pending',         NULL,      p_eye,    wh_main, u_mona,  'facebook',  'حملة الصيف الكبرى', 62, 0,  NULL,       NOW() - INTERVAL '12 hours'),
('إسراء حسين علي',     '01503210987', 'سوهاج',                                     'لوشن الجسم المرطب بالشيا', 'أبيض',     '300ml', 2, 72, 144,'pending',         NULL,      p_lotion, wh_main, u_sara,  'whatsapp',  NULL,                30, 0,  NULL,       NOW() - INTERVAL '6 hours'),
('نهى طارق سليمان',    '01602109876', 'أسوان',                                     'ماسك الوجه بالطين',         'طبيعي',    '100g',  1, 95,  95, 'pending',         NULL,      p_mask,   wh_main, u_ahmed, 'instagram', 'إعلانات أغسطس',    42, 0,  NULL,       NOW() - INTERVAL '2 hours'),

-- Returned
('غادة محمود علي',     '01701098765', 'الإسكندرية، العجمي',                        'كريم كابرينا المرطب',       'أبيض فاتح','50ml',  1, 85,  85, 'returned',        sc_aramex, p_cream,  wh_main, u_mona,  'facebook',  'حملة رمضان 2024',   40, 25, NULL,       NOW() - INTERVAL '22 days'),
('تهاني سعيد محمد',    '01800987654', 'بورسعيد',                                   'سيروم كابرينا للتفتيح',    'ذهبي',     '30ml',  1, 195, 195,'returned',        sc_jt,     p_serum,  wh_main, u_sara,  'tiktok',    'تيك توك أبريل',     85, 30, 'المنتج لم يصل بالحالة المطلوبة', NOW() - INTERVAL '30 days'),

-- Delayed
('هبة الله صادق',      '01900876543', 'الفيوم',                                    'واقي الشمس كابرينا SPF50', 'أبيض',     '75ml',  2, 130, 260,'delayed',         sc_ems,    p_sun,    wh_main, u_ahmed, 'facebook',  'إعلان صيف 2024',    55, 20, 'تأخر في التوصيل بسبب العنوان', NOW() - INTERVAL '14 days'),

-- Partial received
('سناء عبدالعزيز',     '01000765432', 'قنا',                                       'مجموعة العناية الكاملة',   NULL,       NULL,    3, 350, 1050,'partial_received', sc_mylerz, p_set,    wh_main, u_mona,  'instagram', 'إعلانات مايو',     160, 35, NULL,       NOW() - INTERVAL '10 days');

END $$;


-- ─── 9. Shipping Manifests ───────────────────────────────────
INSERT INTO shipping_manifests (manifest_number, shipping_company_id, status, notes, invoice_price, created_at)
SELECT 'MNF-2024-' || LPAD(n::text, 3, '0'), sc.id, st, nt, ip, ts
FROM (VALUES
  (1, 'ارامكس',    'closed', 'بوليصة رمضان الأولى',     1200.00, NOW() - INTERVAL '43 days'),
  (2, 'J&T Express','closed', 'بوليصة أبريل الأولى',      850.00, NOW() - INTERVAL '38 days'),
  (3, 'MylerZ',    'closed', 'بوليصة أبريل الثانية',     960.00, NOW() - INTERVAL '33 days'),
  (4, 'ارامكس',    'closed', 'بوليصة مايو',             1450.00, NOW() - INTERVAL '26 days'),
  (5, 'بريد مصر',  'closed', 'بوليصة محافظات',           620.00, NOW() - INTERVAL '23 days'),
  (6, 'ارامكس',    'open',   'بوليصة يوليو جارية',          NULL, NOW() - INTERVAL '7 days'),
  (7, 'J&T Express','open',  'بوليصة جديدة',                NULL, NOW() - INTERVAL '5 days')
) AS v(n, comp, st, nt, ip, ts)
JOIN shipping_companies sc ON sc.name = v.comp
ON CONFLICT DO NOTHING;

-- ─── 10. Link orders to manifests ────────────────────────────
INSERT INTO shipping_manifest_orders (manifest_id, order_id, delivery_status, delivered_at)
SELECT m.id, o.id,
  CASE o.status
    WHEN 'received' THEN 'delivered'
    WHEN 'returned' THEN 'returned'
    WHEN 'delayed'  THEN 'pending'
    ELSE 'pending'
  END,
  CASE o.status WHEN 'received' THEN o.updated_at ELSE NULL END
FROM shipping_manifests m
JOIN orders o ON o.shipping_company_id = m.shipping_company_id
  AND o.created_at BETWEEN m.created_at - INTERVAL '1 day' AND m.created_at + INTERVAL '7 days'
  AND o.status IN ('received','returned','delayed','in_shipping')
ON CONFLICT DO NOTHING;

-- ─── Done ─────────────────────────────────────────────────────
SELECT 'تم إدراج البيانات بنجاح ✅' AS result;
SELECT 'شركات الشحن: ' || COUNT(*) FROM shipping_companies;
SELECT 'المخازن: '      || COUNT(*) FROM warehouses;
SELECT 'المستخدمون: '   || COUNT(*) FROM users;
SELECT 'المنتجات: '     || COUNT(*) FROM products;
SELECT 'المتغيرات: '    || COUNT(*) FROM product_variants;
SELECT 'الطلبات: '      || COUNT(*) FROM orders;
SELECT 'البوليصات: '    || COUNT(*) FROM shipping_manifests;

