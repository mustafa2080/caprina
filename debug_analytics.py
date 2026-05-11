import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# find exact marker and replace block
start_marker = '  // \u2500\u2500 3. Return Insights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n  const returnedOrders = allOrders.filter(o => o.status === "returned");\n  const reasonCount: Record<string, number> = {};\n  const otherNoteCount: Record<string, number> = {};\n  let noReasonCount = 0;\n\n  for (const o of returnedOrders) {'
end_marker = '  }\n\n  const REASON_LABELS'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx) + len('  }\n\n')

print('start found:', start_idx != -1)
print('end found:', end_idx > 0)

if start_idx != -1 and end_idx > 0:
    old_block = content[start_idx:end_idx]
    print('Block length:', len(old_block))
    print('Preview:', repr(old_block[:100]))
