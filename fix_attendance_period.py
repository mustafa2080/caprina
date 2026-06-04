path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\attendance.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
import re
remaining = re.findall(r'startsWith\(prefix\)', content)
print(f'startsWith(prefix) remaining: {len(remaining)}')
remaining2 = re.findall(r'const prefix =', content)
print(f'const prefix = remaining: {len(remaining2)}')
# Show getPayPeriodDates usage count
usages = re.findall(r'getPayPeriodDates', content)
print(f'getPayPeriodDates usages: {len(usages)}')
