path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

old = '      {/* \u2500\u2500 \u0628\u0637\u0627\u0642\u0627\u062a \u0633\u0631\u064a\u0639\u0629 \u2500\u2500 */}'
print('FOUND:', old in content)

# print surrounding context
idx = content.find(old)
if idx >= 0:
    print(repr(content[idx:idx+40]))
