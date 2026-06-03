import re

with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));\n\n  // Order stats (only for system users)"

new = """    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));

  // Cumulative sum for manual KPIs from daily logs in this month
  const monthStart = dateFrom.toISOString().slice(0, 10);
  const monthEnd   = dateTo.toISOString().slice(0, 10);
  const manualLogs = await db
    .select({ kpiId: employeeDailyLogsTable.kpiId, total: sum(employeeDailyLogsTable.value) })
    .from(employeeDailyLogsTable)
    .where(
      and(
        eq(employeeDailyLogsTable.profileId, profileId),
        gte(employeeDailyLogsTable.date, monthStart),
        lte(employeeDailyLogsTable.date, monthEnd)
      )
    )
    .groupBy(employeeDailyLogsTable.kpiId);
  const manualCumulativeMap = new Map(
    manualLogs.map(r => [r.kpiId, parseFloat(String(r.total ?? "0"))])
  );

  // Order stats (only for system users)"""

# count occurrences before the target block - we want the FIRST occurrence
occurrences = content.count(old)
print(f"Occurrences found: {occurrences}")

if occurrences >= 1:
    content = content.replace(old, new, 1)
    print("Replacement done (first occurrence)")
else:
    print("NOT FOUND - checking nearby text...")
    idx = content.find(".where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));")
    print(f"Target line found at index: {idx}")
    print(repr(content[idx:idx+200]))

with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("File saved successfully")
