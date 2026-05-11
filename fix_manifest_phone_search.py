path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# 1- عدل filter logic عشان يبحث في phone كمان
old_filter = '      if (pLow && !group.some(o => (o.product ?? "").toLowerCase().includes(pLow))) return false;'
new_filter = '      if (pLow && !group.some(o => (o.product ?? "").toLowerCase().includes(pLow) || (o.phone ?? "").toLowerCase().includes(pLow))) return false;'

# 2- عدل placeholder
old_placeholder = 'placeholder="\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0645\u0646\u062a\u062c..."'
new_placeholder = 'placeholder="\u0627\u0628\u062d\u062b \u0628\u0627\u0644\u0645\u0646\u062a\u062c \u0623\u0648 \u0627\u0644\u0647\u0627\u062a\u0641..."'

results = []

if old_filter in content:
    content = content.replace(old_filter, new_filter)
    results.append('Filter logic OK')
else:
    results.append('Filter logic NOT FOUND')

if old_placeholder in content:
    content = content.replace(old_placeholder, new_placeholder)
    results.append('Placeholder OK')
else:
    results.append('Placeholder NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

for r in results:
    print(r)
