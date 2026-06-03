import re

with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      const actualValue = userId
        ? await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId)
        : kpi.metric === "manual" ? null : 0;
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved };
    })
  );"""

new = """  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      let actualValue: number | null;
      if (kpi.metric === "manual") {
        // use cumulative monthly sum from daily logs
        actualValue = manualCumulativeMap.get(kpi.id) ?? null;
      } else {
        actualValue = userId
          ? await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId)
          : 0;
      }
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved };
    })
  );"""

count = content.count(old)
print(f"Found: {count}")
if count == 1:
    content = content.replace(old, new)
    with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("NOT FOUND")
