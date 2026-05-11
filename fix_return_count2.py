import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# lines 932-946 (0-indexed: 931-945) = the block to replace
# Replace lines 932-946 (1-indexed) = indices 931-945
old_block = ''.join(lines[931:946])
print('Old block:')
print(repr(old_block))

new_block = (
    '  // \u2500\u2500 3. Return Insights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  const returnedOrders = allOrders.filter(o => o.status === "returned");\n'
    '\n'
    '  // \u062d\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u2014 orders \u0646\u0641\u0633 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u062a\u062a\u062d\u0633\u0628 \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0641\u0642\u0637\n'
    '  const seenInvoices = new Set<string>();\n'
    '  const uniqueReturnedUnits: typeof returnedOrders = [];\n'
    '  for (const o of returnedOrders) {\n'
    '    const inv = (o as any).invoiceNumber as string | null;\n'
    '    if (inv) {\n'
    '      if (seenInvoices.has(inv)) continue;\n'
    '      seenInvoices.add(inv);\n'
    '    }\n'
    '    uniqueReturnedUnits.push(o);\n'
    '  }\n'
    '\n'
    '  const reasonCount: Record<string, number> = {};\n'
    '  const otherNoteCount: Record<string, number> = {};\n'
    '  let noReasonCount = 0;\n'
    '\n'
    '  for (const o of uniqueReturnedUnits) {\n'
    '    const reason = (o as any).returnReason ?? "__none__";\n'
    '    if (reason === "__none__") { noReasonCount++; continue; }\n'
    '    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;\n'
    '    if (reason === "other") {\n'
    '      const note = ((o as any).returnNote as string | null)?.trim();\n'
    '      if (note) otherNoteCount[note] = (otherNoteCount[note] ?? 0) + 1;\n'
    '    }\n'
)

new_lines = lines[:931] + [new_block] + lines[946:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('\u2705 Done!')
