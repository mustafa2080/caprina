path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\dashboard.tsx"

with open(path, encoding='utf-8') as f:
    content = f.read()

# Replace title in ChartCard
old = '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629'
new = '\u0627\u0644\u0637\u0644\u0628\u064a\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629'

count = content.count(old)
print(f"Found '{old}' {count} time(s)")
content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("DONE")
