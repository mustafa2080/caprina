-- إصلاح قيم الشحن السالبة في جدول الطلبات
UPDATE orders SET shipping_cost = ABS(shipping_cost) WHERE shipping_cost < 0;
SELECT id, shipping_cost FROM orders WHERE id = 1048;
