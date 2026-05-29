import re, os

analytics = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"
with open(analytics, encoding="utf-8") as f:
    c = f.read()

endpoints = re.findall(r"router\.(get|post)\([\"'](\/[^\"']+)", c)
print("Analytics endpoints:")
for method, path in endpoints:
    print(f"  {method.upper()} {path}")

# Check for heavy operations: no pagination, large selects
if "findMany" in c:
    finds = [(m.start(), c[m.start():m.start()+200]) for m in re.finditer(r"findMany", c)]
    print(f"\nfindMany calls: {len(finds)}")
    for pos, snippet in finds[:3]:
        line = c[:pos].count("\n") + 1
        print(f"  Line {line}: {snippet[:100].strip()}")
