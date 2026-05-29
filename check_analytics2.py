import re, sys
sys.stdout.reconfigure(encoding="utf-8")

analytics = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"
with open(analytics, encoding="utf-8") as f:
    c = f.read()

for name, key in [("smart-insights", "/analytics/smart-insights"), ("charts", "/analytics/charts"), ("shipping-followup", "/analytics/shipping-followup")]:
    idx = c.find(key)
    if idx >= 0:
        print(f"=== {name} ===")
        print(c[idx:idx+600])
        print()

print(f"Total findMany: {c.count('findMany')}")
print(f"Total db.select: {c.count('db.select')}")
