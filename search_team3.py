import os, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.splitlines()

print(f'Total lines: {len(lines)}')

# Search for relevant keywords
keywords = ['team-performance', 'team_performance', 'createdBy', 'created_by', 'userId', 'user_id']
for i, l in enumerate(lines, 1):
    for kw in keywords:
        if kw.lower() in l.lower():
            print(f'{i}: {l.rstrip()}')
            break
