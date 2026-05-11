import os, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\team-analytics.ts'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

original = c

# Replace assignedUserId with createdByUserId in this file only
c = c.replace('o.assignedUserId', 'o.createdByUserId')
c = c.replace('assigned_user_id', 'created_by_user_id')

if c != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    count = original.count('o.assignedUserId')
    print(f'DONE - replaced {count} occurrences of o.assignedUserId with o.createdByUserId')
else:
    print('NO CHANGES - nothing found to replace')
