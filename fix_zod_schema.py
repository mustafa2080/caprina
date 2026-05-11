import os, sys

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'lib', 'api-zod', 'src', 'generated', 'api.ts')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '  returnNote: zod.string().nullish(),\n});'
new = (
    '  returnNote: zod.string().nullish(),\n'
    '  returnReceived: zod.union([zod.boolean(), zod.number()]).nullish(),\n'
    '  isDamaged: zod.boolean().nullish(),\n'
    '});'
)

if old not in content:
    print('ERROR: old string not found')
else:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done! Added returnReceived and isDamaged to UpdateOrderBody schema')
