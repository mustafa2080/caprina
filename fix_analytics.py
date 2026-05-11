path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\orders.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# الـ block القديم في summary
old = (
    '  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt)).orderBy(desc(ordersTable.createdAt));\n'
    '  type InvoiceGroup = { status: string; totalPrice: number };\n'
    '  const invoiceMap = new Map<string, InvoiceGroup>();\n'
    '  for (const o of rows) {\n'
    '    const key = o.invoiceNumber ?? `solo-${o.id}`;\n'
    '    if (!invoiceMap.has(key)) {\n'
    '      // \xd8\xa3\xd9\x88\xd9\x84 \xd9\x85\xd8\xb1\xd8\xa9 \xd9\x86\xd8\xb4\xd9\x88\xd9\x81 \xd8\xa7\xd9\x84\xd9\x80 key \xd8\xaf\xd9\x87: \xd9\x86\xd8\xb3\xd8\xac\xd9\x84\xd9\x87 (\xd8\xa7\xd9\x84\xd9\x80 rows \xd9\x85\xd8\xb1\xd8\xaa\xd8\xa8\xd8\xa9 desc \xd9\x81\xd8\xa8\xd8\xa7\xd9\x84\xd8\xaa\xd8\xa7\xd9\x84\xd9\x8a \xd8\xa3\xd9\x88\xd9\x84 row \xd9\x87\xd9\x88 \xd8\xa7\xd9\x84\xd8\xa3\xd8\xad\xd8\xaf\xd8\xab)\n'
    '      invoiceMap.set(key, { status: o.status, totalPrice: 0 });\n'
    '    }\n'
    '    invoiceMap.get(key)!.totalPrice += o.totalPrice;\n'
    '    // \xd9\x84\xd8\xa7 \xd9\x86\xd8\xb9\xd8\xaf\xd9\x91\xd9\x84 status \xd8\xaa\xd8\xa7\xd9\x86\xd9\x8a \xe2\x80\x94 \xd8\xa3\xd9\x88\xd9\x84 row (\xd8\xa7\xd9\x84\xd8\xa3\xd8\xad\xd8\xaf\xd8\xab) \xd9\x87\xd9\x88 \xd8\xa7\xd9\x84\xd9\x85\xd8\xb9\xd8\xaa\xd9\x85\xd8\xaf \xd9\x83\xd9\x85\xd8\xa7 \xd9\x81\xd9\x8a analytics/charts\n'
    '  }\n'
)

print('old summary block found:', old in content)

new = (
    '  // نفس منطق صفحة الطلبات: invoice تتحسب بحالة X بس لو كل rows فيها بحالة X\n'
    '  const rows = await db.select().from(ordersTable).where(isNull(ordersTable.deletedAt));\n'
    '  type InvoiceGroup = { status: string; totalPrice: number };\n'
    '  // نجمع كل الحالات لكل invoice\n'
    '  const invoiceStatuses = new Map<string, Set<string>>();\n'
    '  const invoicePrices = new Map<string, number>();\n'
    '  for (const o of rows) {\n'
    '    const key = o.invoiceNumber ?? `solo-${o.id}`;\n'
    '    if (!invoiceStatuses.has(key)) invoiceStatuses.set(key, new Set());\n'
    '    invoiceStatuses.get(key)!.add(o.status);\n'
    '    invoicePrices.set(key, (invoicePrices.get(key) ?? 0) + o.totalPrice);\n'
    '  }\n'
    '  // invoice بحالة واحدة بس = كل rows فيها بنفس الحالة (نفس منطق صفحة الطلبات)\n'
    '  const invoices: Array<{ status: string; totalPrice: number }> = [];\n'
    '  for (const [key, statuses] of invoiceStatuses.entries()) {\n'
    '    if (statuses.size === 1) {\n'
    '      invoices.push({ status: Array.from(statuses)[0], totalPrice: invoicePrices.get(key) ?? 0 });\n'
    '    }\n'
    '    // invoice فيها حالات متعددة: مش بتتحسب (نفس سلوك صفحة الطلبات)\n'
    '  }\n'
)

if old in content:
    new_content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('DONE! orders.ts summary fixed.')
else:
    # fallback: ابحث يدوياً
    import re
    idx = content.find('router.get("/orders/summary"')
    print('summary endpoint at:', idx)
    print('content there:', repr(content[idx:idx+800]))
