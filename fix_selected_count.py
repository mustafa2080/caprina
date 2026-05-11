import os, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\orders.tsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

original = c

# 1. Add selectedInvoiceCount computed value after exitBulkMode
old1 = '  const exitBulkMode = () => { setBulkSelectMode(false); setSelectedIds(new Set()); };'
new1 = '''  const exitBulkMode = () => { setBulkSelectMode(false); setSelectedIds(new Set()); };

  // عدد الفواتير المحددة (مش عدد الـ sub-IDs)
  const selectedInvoiceCount = filtered.filter(o => {
    const ids: number[] = (o as any)._groupIds?.length > 1 ? (o as any)._groupIds : [o.id];
    return ids.every(id => selectedIds.has(id));
  }).length;'''

c = c.replace(old1, new1, 1)

# 2. Replace all display usages of selectedIds.size with selectedInvoiceCount
# Line 288: تغيير الحالة {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
c = c.replace(
    'تغيير الحالة {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}',
    'تغيير الحالة {selectedInvoiceCount > 0 ? `(${selectedInvoiceCount})` : ""}'
)

# Line 317: حذف {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
c = c.replace(
    'حذف {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}',
    'حذف {selectedInvoiceCount > 0 ? `(${selectedInvoiceCount})` : ""}'
)

# Line 740: ` — محدد: ${selectedIds.size}`
c = c.replace(
    '` — محدد: ${selectedIds.size}`',
    '` — محدد: ${selectedInvoiceCount}`'
)

# Line 760: هتحذف {selectedIds.size} طلب
c = c.replace(
    'هتحذف {selectedIds.size} طلب.',
    'هتحذف {selectedInvoiceCount} طلب.'
)

# Line 766: حذف ${selectedIds.size} طلب
c = c.replace(
    '`حذف ${selectedIds.size} طلب`',
    '`حذف ${selectedInvoiceCount} طلب`'
)

# Line 778: هتغير حالة {selectedIds.size} طلب
c = c.replace(
    'هتغير حالة {selectedIds.size} طلب إلى',
    'هتغير حالة {selectedInvoiceCount} طلب إلى'
)

if c != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('DONE')
else:
    print('NO CHANGES')
