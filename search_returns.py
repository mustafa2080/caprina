import sys

path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

keywords = ["returnReason", "return_reason", "ReturnReason", "smartInsights", "smart-insights", "returned"]
for i, line in enumerate(lines, 1):
    if any(k.lower() in line.lower() for k in keywords):
        print(f"{i}: {line.rstrip()}")
