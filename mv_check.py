import re, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\movements.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the TableHeader with the first ColFilterBtn (date)
idx = content.find('<ColFilterBtn col="date" colFilters={colFilters}')
print(f'First ColFilterBtn at: {idx}')
# Show 800 chars before it to find the table wrapper
print(content[idx-800:idx+50])
