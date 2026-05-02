path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mutation validation: allow 0
old = 'if (!partialQty || isNaN(qty) || qty < 1) {'
new = 'if (partialQty === "" || partialQty === null || partialQty === undefined || isNaN(qty) || qty < 0) {'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('DONE')
else:
    print('NOT FOUND')
