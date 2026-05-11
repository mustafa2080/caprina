import os, sys

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]

for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git']]
    for f in files:
        if f == 'order-detail.tsx':
            path = os.path.join(root, f)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'disabled={updateOrder.isPending || returnReceived === null}'
new = 'disabled={updateOrder.isPending || (!!manifestStatus && returnReceived === null)}'

if old not in content:
    print('ERROR: string not found')
    # show context
    idx = content.find('handleReturnConfirm')
    print(content[idx:idx+200])
else:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done! Fixed disabled condition')
