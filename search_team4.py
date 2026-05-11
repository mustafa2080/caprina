import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes'
for fname in os.listdir(base):
    fpath = os.path.join(base, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'team-performance' in content:
        print(f'FOUND in: {fname}')
        lines = content.splitlines()
        for i, l in enumerate(lines, 1):
            if 'team-performance' in l or 'createdBy' in l or 'created_by' in l or 'userId' in l or 'user_id' in l:
                print(f'  {i}: {l.rstrip()}')
