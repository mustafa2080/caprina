import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''  // \u2500\u2500 3. Return Insights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const returnedOrders = allOrders.filter(o => o.status === "returned");
  const reasonCount: Record<string, number> = {};
  const otherNoteCount: Record<string, number> = {};
  let noReasonCount = 0;

  for (const o of returnedOrders) {
    const reason = (o as any).returnReason ?? "__none__";
    if (reason === "__none__") { noReasonCount++; continue; }
    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
    if (reason === "other") {
      const note = ((o as any).returnNote as string | null)?.trim();
      if (note) otherNoteCount[note] = (otherNoteCount[note] ?? 0) + 1;
    }
  }'''

new = '''  // \u2500\u2500 3. Return Insights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const returnedOrders = allOrders.filter(o => o.status === "returned");

  // \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0631\u062a\u062c\u0639\u0627\u062a \u0628\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 (\u0645\u0634 \u0628\u0627\u0644\u0637\u0644\u0628) \u2014 invoice \u0641\u064a\u0647\u0627 10 \u0645\u0646\u062a\u062c\u0627\u062a \u062a\u062a\u062d\u0633\u0628 \u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629
  const seenInvoices = new Set<string>();
  const uniqueReturnedUnits: typeof returnedOrders = [];
  for (const o of returnedOrders) {
    const inv = (o as any).invoiceNumber as string | null;
    if (inv) {
      if (seenInvoices.has(inv)) continue; // \u062a\u062c\u0627\u0647\u0644 \u0628\u0627\u0642\u064a orders \u0646\u0641\u0633 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629
      seenInvoices.add(inv);
    }
    uniqueReturnedUnits.push(o);
  }

  const reasonCount: Record<string, number> = {};
  const otherNoteCount: Record<string, number> = {};
  let noReasonCount = 0;

  for (const o of uniqueReturnedUnits) {
    const reason = (o as any).returnReason ?? "__none__";
    if (reason === "__none__") { noReasonCount++; continue; }
    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
    if (reason === "other") {
      const note = ((o as any).returnNote as string | null)?.trim();
      if (note) otherNoteCount[note] = (otherNoteCount[note] ?? 0) + 1;
    }
  }'''

if old in content:
    content = content.replace(old, new, 1)
    print("\u2705 Fixed: group by invoice")
else:
    print("\u274c not found")

# also fix totalReturns to use uniqueReturnedUnits
old_total = '  const totalReturns = returnedOrders.length;'
new_total = '  const totalReturns = uniqueReturnedUnits.length;'
if old_total in content:
    content = content.replace(old_total, new_total, 1)
    print("\u2705 Fixed totalReturns")
else:
    print("\u274c totalReturns not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
