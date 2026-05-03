path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check all remaining min={1} occurrences
lines = content.split('\n')
for i, line in enumerate(lines, 1):
    if 'min={1}' in line:
        print(f'Line {i}: {line.strip()}')
