import sys
sys.stdout.reconfigure(encoding="utf-8")

analytics = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\analytics.ts"
with open(analytics, encoding="utf-8") as f:
    content = f.read()

# Find the smart-insights handler and check if it uses cache
si_idx = content.find('"/analytics/smart-insights"')
si_chunk = content[si_idx:si_idx+300]
print("smart-insights start:")
print(si_chunk)
print()

# Find the charts handler
charts_idx = content.find('"/analytics/charts"')
charts_chunk = content[charts_idx:charts_idx+300]
print("charts start:")
print(charts_chunk)
