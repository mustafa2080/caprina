import os, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\orders.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines, 1):
    if 'selectedInvoiceCount' in l or 'selectedIds.size' in l:
        print(f'{i}: {l.rstrip()}')
