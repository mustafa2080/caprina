import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '    delay: "\u0633\u0628\u0628 \u0627\u0644\u062a\u0623\u062e\u064a\u0631",'
new = '    delay: "\u0627\u0644\u062a\u0623\u062e\u064a\u0631 \u0639\u0644\u0649 \u0627\u0644\u0639\u0645\u064a\u0644",'

if old in content:
    content = content.replace(old, new, 1)
    print("Done!")
else:
    print("not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
