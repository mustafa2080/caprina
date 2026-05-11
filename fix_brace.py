import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# line 959 (index 958) should be '  }\n' to close the for loop
# currently line 959 is empty '\n', line 960 starts REASON_LABELS
# insert closing brace at index 958 (before REASON_LABELS)
lines.insert(958, '  }\n')

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('✅ Added missing closing brace')
