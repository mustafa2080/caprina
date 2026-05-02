path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: min={1} -> min={0}
content = content.replace('min={1}\n                    max={order.quantity}', 'min={0}\n                    max={order.quantity}')

# Fix 2: validation className condition
content = content.replace(
    '${!partialQty || parseInt(partialQty) < 1 ? "border-destructive" : ""}',
    '${partialQty === "" ? "border-destructive" : ""}'
)

# Fix 3: validation message condition
content = content.replace(
    '{(!partialQty || parseInt(partialQty) < 1) && (',
    '{(partialQty === "") && ('
)

# Fix 4: mutation validation - !partialQty || parseInt(partialQty) < 1
content = content.replace(
    'if (!partialQty || parseInt(partialQty) < 1)',
    'if (partialQty === "" || partialQty === null || partialQty === undefined)'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('DONE')
