import os

base = r'C:\Users\musta\Desktop\pro'
dirs = os.listdir(base)
target = [d for d in dirs if 'Caprina' in d and '2' in d and '.zip' not in d][0]
fp = os.path.join(base, target, 'Caprina-Orders', 'artifacts', 'caprina', 'src', 'pages', 'invoices.tsx')

with open(fp, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the filter Card block start and the toolbar Card end
# The filter card starts with: <Card className="border-border overflow-hidden">
# The toolbar section ends before the invoice list section
filter_card_start = None
toolbar_card_end = None

for i, l in enumerate(lines):
    if filter_card_start is None and '<Card className="border-border overflow-hidden">' in l:
        filter_card_start = i
    if filter_card_start is not None and '      </Card>' in l and i > filter_card_start + 5:
        toolbar_card_end = i
        break

print(f'filter_card_start={filter_card_start}, toolbar_card_end={toolbar_card_end}')
if filter_card_start and toolbar_card_end:
    print('Line at start:', repr(lines[filter_card_start]))
    print('Line at end:', repr(lines[toolbar_card_end]))
