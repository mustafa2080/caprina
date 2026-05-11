path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\components\charts-section.tsx'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()
for i in range(222, 242):
    print(i+1, repr(lines[i]))
