import os

base = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages'

# ── Fix 1: orders.tsx ─────────────────────────────────────────────────────────
path1 = os.path.join(base, 'orders.tsx')
with open(path1, 'r', encoding='utf-8') as f:
    c = f.read()

marker = 'queryClient.refetchQueries({ queryKey: ["orders-list"] });\n      const skippedMsg'
replacement = 'queryClient.refetchQueries({ queryKey: ["orders-list"] });\n      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });\n      const skippedMsg'

if marker in c:
    c = c.replace(marker, replacement, 1)
    with open(path1, 'w', encoding='utf-8') as f:
        f.write(c)
    print('orders.tsx: FIXED')
else:
    print('orders.tsx: marker NOT FOUND')

# ── Fix 2: order-detail.tsx ───────────────────────────────────────────────────
path2 = os.path.join(base, 'order-detail.tsx')
with open(path2, 'r', encoding='utf-8') as f:
    c2 = f.read()

marker2 = 'queryClient.invalidateQueries({ queryKey: ["products"] });\n\n      const msg = idsToDelete.length'
replacement2 = 'queryClient.invalidateQueries({ queryKey: ["products"] });\n      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });\n\n      const msg = idsToDelete.length'

if marker2 in c2:
    c2 = c2.replace(marker2, replacement2, 1)
    with open(path2, 'w', encoding='utf-8') as f:
        f.write(c2)
    print('order-detail.tsx: FIXED')
else:
    # try alternative
    marker2b = 'queryClient.invalidateQueries({ queryKey: ["products"] });'
    idx = c2.find(marker2b)
    print(f'order-detail.tsx: marker NOT FOUND, fallback idx={idx}')
    if idx != -1:
        snippet = c2[idx:idx+200]
        print('SNIPPET:', repr(snippet))
