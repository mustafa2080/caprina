path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
print('Total lines:', len(lines))
old_found = []
for i, l in enumerate(lines):
    if 'new Date(year, month - 1, 1)' in l or 'new Date(y, m - 1, 1' in l or 'getMonth(), 1, 0,' in l or 'getMonth() + 1, 0,' in l:
        old_found.append(f'{i+1}: {l.rstrip()}')
if old_found:
    print('OLD PATTERNS STILL FOUND:')
    for x in old_found: print(x)
else:
    print('OK - no old date patterns remain')

# Show all getPayPeriod usages
for i, l in enumerate(lines):
    if 'getPayPeriod' in l:
        print(f'{i+1}: {l.rstrip()}')
