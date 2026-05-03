import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = 'C:/Users/musta/Desktop/pro/Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2/Caprina-Orders/artifacts/caprina/src/pages/order-detail.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'const { isAdmin, canViewFinancials } = useAuth();'
line1 = 'const { isAdmin, canViewFinancials, user } = useAuth();'
line2 = '  const canWriteOrders = isAdmin || (user?.permissions?.includes("orders_write") ?? false);'
replacement = line1 + '\n' + line2
content = content.replace(old, replacement, 1)

content = content.replace('{isAdmin && (', '{canWriteOrders && (')
content = content.replace('isAdmin && !', 'canWriteOrders && !')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
