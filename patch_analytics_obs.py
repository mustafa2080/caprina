import re, sys

path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"

with open(path, encoding="utf-8") as f:
    src = f.read()

OLD = """  // نفس منطق charts endpoint بالظبط
  const invoiceMap = new Map<string, { invoiceKey: string; status: string; rows: typeof allOrders }>();
  for (const o of allOrders) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, { invoiceKey: key, status: o.status, rows: [] });
    }
    const grp = invoiceMap.get(key)!;
    grp.status = o.status; // آخر status يكتب فوق السابق
    grp.rows.push(o);
  }

  // فلتر بالـ status المطلوب
  const matchedGroups = Array.from(invoiceMap.values()).filter(g => g.status === status);"""

if OLD not in src:
    print("FAIL: OLD block not found")
    idx = src.find("grp.status = o.status")
    print(repr(src[max(0,idx-300):idx+200]))
    sys.exit(1)

NEW = """  // نفس منطق charts بالظبط: أولوية الحالات للـ invoices المختلطة
  const STATUS_PRIO: Record<string, number> = {
    pending: 1, in_shipping: 2, warehouse_ready: 3, delayed: 4,
    partial_received: 5, received: 6, returned: 7,
  };
  const invoiceMap = new Map<string, { invoiceKey: string; statuses: Set<string>; rows: typeof allOrders }>();
  for (const o of allOrders) {
    const key = o.invoiceNumber ?? `solo-${o.id}`;
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, { invoiceKey: key, statuses: new Set(), rows: [] });
    }
    const grp = invoiceMap.get(key)!;
    grp.statuses.add(o.status);
    grp.rows.push(o);
  }
  const resolveInvStatus = (statuses: Set<string>): string => {
    if (statuses.size === 1) return Array.from(statuses)[0];
    return Array.from(statuses).sort(
      (a, b) => (STATUS_PRIO[a] ?? 99) - (STATUS_PRIO[b] ?? 99)
    )[0];
  };

  // فلتر بالـ status المطلوب بعد تطبيق الأولوية
  const matchedGroups = Array.from(invoiceMap.values()).filter(g => resolveInvStatus(g.statuses) === status);"""

src = src.replace(OLD, NEW, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("OK: analytics.ts orders-by-status patched")
