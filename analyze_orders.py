import os, sys, re
sys.stdout.reconfigure(encoding='utf-8')

folders = os.listdir(r'C:\Users\musta\Desktop\pro')
folder = [f for f in folders if 'Caprina' in f and '.zip' not in f][0]
pages_dir = os.path.join(r'C:\Users\musta\Desktop\pro', folder, 'Caprina-Orders', 'artifacts', 'caprina', 'src', 'pages')

files = ['orders.tsx','order-detail.tsx','order-form.tsx','archive.tsx','invoices.tsx','invoice-group.tsx','shipping-manifest.tsx','shipping-manifest-orig.tsx']

contents = {}
for f in files:
    p = os.path.join(pages_dir, f)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as fh:
            contents[f] = fh.read()

print("=" * 60)
print("1. حجم كل ملف:")
print("=" * 60)
for f, c in contents.items():
    print(f"  {f}: {len(c.splitlines())} سطر")

print()
print("=" * 60)
print("2. Functions/Components المكررة:")
print("=" * 60)
func_map = {}
for f, c in contents.items():
    funcs = re.findall(r'(?:^|\n)(?:function|const)\s+([A-Z][A-Za-z0-9]+)\s*[=(]', c)
    for fn in funcs:
        if fn not in func_map:
            func_map[fn] = []
        if f not in func_map[fn]:
            func_map[fn].append(f)

for fn, flist in sorted(func_map.items()):
    if len(flist) > 1:
        print(f"  DUPLICATE  {fn}  ->  {', '.join(flist)}")

print()
print("=" * 60)
print("3. Code Patterns متكررة:")
print("=" * 60)
patterns = {
    'ProductSearchCombobox component': r'function ProductSearchCombobox',
    'variant rows UI (color/size selects)': r'اختر لون\.\.\.',
    'formatCurrency function': r'const formatCurrency',
    'ordersApi.batchCreate call': r'ordersApi\.batchCreate',
    'variantsApi.listAll query': r'variantsApi\.listAll',
    'productsApi.list query': r'productsApi\.list',
    'AddProductDialog component': r'function AddProductDialog',
    'emptyItem function': r'const emptyItem',
    'AD_SOURCES array': r'const AD_SOURCES',
    'AdSourceIcon component': r'const AdSourceIcon',
    'invoice-orders query': r'invoice-orders',
    'shippingApi.list query': r'shippingApi\.list',
    'warehousesApi.list query': r'warehousesApi\.list',
    'usersApi.list query': r'usersApi\.list',
    'STATUS_LABELS usage': r'STATUS_LABELS',
    'WhatsAppDialog': r'WhatsAppDialog',
}
for label, pattern in patterns.items():
    found_in = [f for f, c in contents.items() if re.search(pattern, c)]
    if len(found_in) > 1:
        print(f"  REPEAT  {label}")
        for fi in found_in:
            print(f"    - {fi}")

print()
print("=" * 60)
print("4. shipping-manifest.tsx vs shipping-manifest-orig.tsx:")
print("=" * 60)
if 'shipping-manifest.tsx' in contents and 'shipping-manifest-orig.tsx' in contents:
    c1 = contents['shipping-manifest.tsx']
    c2 = contents['shipping-manifest-orig.tsx']
    lines1 = set(c1.splitlines())
    lines2 = set(c2.splitlines())
    common = lines1 & lines2
    similarity = len(common) / max(len(lines1), len(lines2)) * 100
    print(f"  shipping-manifest.tsx:      {len(c1.splitlines())} lines")
    print(f"  shipping-manifest-orig.tsx: {len(c2.splitlines())} lines")
    print(f"  similarity: {similarity:.1f}%")

print()
print("=" * 60)
print("5. invoices.tsx vs invoice-group.tsx:")
print("=" * 60)
if 'invoices.tsx' in contents and 'invoice-group.tsx' in contents:
    c1 = contents['invoices.tsx']
    c2 = contents['invoice-group.tsx']
    lines1 = set(c1.splitlines())
    lines2 = set(c2.splitlines())
    common = lines1 & lines2
    similarity = len(common) / max(len(lines1), len(lines2)) * 100
    print(f"  invoices.tsx:      {len(c1.splitlines())} lines")
    print(f"  invoice-group.tsx: {len(c2.splitlines())} lines")
    print(f"  similarity: {similarity:.1f}%")

print()
print("Done!")
