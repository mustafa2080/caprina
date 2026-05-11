import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\movements.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: remove showColFilters from wrong position (inside useState object)
old_bad = '    qty: new Set(), reason: new Set(), order: new Set(), location: new Set(), notes: new Set(),\n  const [showColFilters, setShowColFilters] = useState(false);\n  });'
new_good = '    qty: new Set(), reason: new Set(), order: new Set(), location: new Set(), notes: new Set(),\n  });\n  const [showColFilters, setShowColFilters] = useState(false);'

assert old_bad in content, 'Bad pattern not found!'
content = content.replace(old_bad, new_good, 1)
print('Fixed: moved showColFilters after });')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Saved.')
