import sys

path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\orders.ts"

with open(path, encoding="utf-8") as f:
    src = f.read()

OLD = """  await db.update(ordersTable)
    .set({ ...data, totalPrice: newTotalPrice, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id));

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!updated) { res.status(500).json({ error: "Update failed" }); return; }"""

if OLD not in src:
    print("FAIL: block not found")
    sys.exit(1)

NEW = """  await db.update(ordersTable)
    .set({ ...data, totalPrice: newTotalPrice, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id));

  // لو الحالة اتغيرت وفيه invoiceNumber → غير كل منتجات الـ invoice بنفس الحالة
  if (data.status && data.status !== oldStatus && existing.invoiceNumber) {
    await db.update(ordersTable)
      .set({ status: data.status, updatedAt: new Date() })
      .where(and(
        eq(ordersTable.invoiceNumber, existing.invoiceNumber),
        isNull(ordersTable.deletedAt),
        // مش الـ order الحالي عشان اتعمله update فوق
      ));
  }

  const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!updated) { res.status(500).json({ error: "Update failed" }); return; }"""

src = src.replace(OLD, NEW, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("OK")
