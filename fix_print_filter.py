path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# السطر 3067 - تعريف groupedManifestOrders المستخدم في الطباعة
# نضيف تعريف جديد للطباعة يستخدم displayGroups
# بس مشكلة ان displayGroups متعرفش في نفس scope
# الحل الأبسط: نبدل groupedManifestOrders بـ displayGroups في قسم الطباعة

# 1- في stats الطباعة (عدد الطلبيات)
old_stat = '<div className="manifest-print-stat-value">{groupedManifestOrders.length}</div>'
new_stat = '<div className="manifest-print-stat-value">{displayGroups.length}</div>'

# 2- في الجدول (الـ map)
old_map = '{groupedManifestOrders.map((group, idx) => {'
new_map = '{displayGroups.map((group, idx) => {'

results = []

if old_stat in content:
    content = content.replace(old_stat, new_stat)
    results.append('Stats count OK')
else:
    results.append('Stats count NOT FOUND')

if old_map in content:
    content = content.replace(old_map, new_map)
    results.append('Table map OK')
else:
    results.append('Table map NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

for r in results:
    print(r)
