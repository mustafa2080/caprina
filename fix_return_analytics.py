import os

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'api-server', 'src', 'routes', 'analytics.ts')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_marker = "  // \u2500\u2500 3. Return Insights"
new_end_marker = "  ].sort((a, b) => b.count - a.count);"

start = content.find(old_marker)
# find the FIRST occurrence of the end marker after start
end = content.find(new_end_marker, start) + len(new_end_marker)

if start == -1 or end == -1:
    print("ERROR: markers not found")
    exit(1)

print("Old section found, length:", end - start)

new_section = (
    '  // \u2500\u2500 3. Return Insights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  const returnedOrders = allOrders.filter(o => o.status === "returned");\n'
    '  const reasonCount: Record<string, number> = {};\n'
    '  const otherNoteCount: Record<string, number> = {};\n'
    '  let noReasonCount = 0;\n\n'
    '  for (const o of returnedOrders) {\n'
    '    const reason = (o as any).returnReason ?? "__none__";\n'
    '    if (reason === "__none__") { noReasonCount++; continue; }\n'
    '    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;\n'
    '    if (reason === "other") {\n'
    '      const note = ((o as any).returnNote as string | null)?.trim();\n'
    '      if (note) otherNoteCount[note] = (otherNoteCount[note] ?? 0) + 1;\n'
    '    }\n'
    '  }\n\n'
    '  const REASON_LABELS: Record<string, string> = {\n'
    '    size_mismatch: "\u0645\u0642\u0627\u0633 \u063a\u064a\u0631 \u0645\u0646\u0627\u0633\u0628",\n'
    '    quality: "\u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u0646\u062a\u062c",\n'
    '    customer_refused: "\u0631\u0641\u0636 \u0627\u0644\u0639\u0645\u064a\u0644",\n'
    '    delay: "\u0633\u0628\u0628 \u0627\u0644\u062a\u0623\u062e\u064a\u0631",\n'
    '    other: "\u0633\u0628\u0628 \u0622\u062e\u0631",\n'
    '  };\n\n'
    '  const totalReturns = returnedOrders.length;\n\n'
    '  const otherTotal = reasonCount["other"] ?? 0;\n'
    '  const otherNotesEntries = Object.entries(otherNoteCount).sort((a: any, b: any) => b[1] - a[1]);\n'
    '  const otherWithoutNote = otherTotal - otherNotesEntries.reduce((s: number, [, c]: any) => s + c, 0);\n\n'
    '  const expandedReasons: Array<{ reason: string; label: string; count: number; pct: number }> = [];\n'
    '  for (const [reason, count] of Object.entries(reasonCount)) {\n'
    '    if (reason === "other") {\n'
    '      for (const [note, cnt] of otherNotesEntries as any) {\n'
    '        expandedReasons.push({ reason: "other_note", label: note as string, count: cnt, pct: totalReturns > 0 ? Math.round((cnt / totalReturns) * 100) : 0 });\n'
    '      }\n'
    '      if (otherWithoutNote > 0) {\n'
    '        expandedReasons.push({ reason: "other", label: "\u0633\u0628\u0628 \u0622\u062e\u0631 (\u063a\u064a\u0631 \u0645\u0641\u0635\u0651\u0644)", count: otherWithoutNote, pct: totalReturns > 0 ? Math.round((otherWithoutNote / totalReturns) * 100) : 0 });\n'
    '      }\n'
    '    } else {\n'
    '      expandedReasons.push({ reason, label: REASON_LABELS[reason] ?? reason, count, pct: totalReturns > 0 ? Math.round((count / totalReturns) * 100) : 0 });\n'
    '    }\n'
    '  }\n\n'
    '  const byReason = [\n'
    '    ...expandedReasons,\n'
    '    ...(noReasonCount > 0 ? [{ reason: "__none__", label: "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f", count: noReasonCount, pct: Math.round((noReasonCount / totalReturns) * 100) }] : []),\n'
    '  ].sort((a, b) => b.count - a.count);'
)

new_content = content[:start] + new_section + content[end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done!")
