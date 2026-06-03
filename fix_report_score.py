with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const evaluatedKpis = await Promise.all(
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

new = """  // For manual KPIs: if the month is still in progress, compare against
  // the progressive target (monthlyTarget * daysPassed / daysInMonth)
  // so the score reflects current-day pace, not the full monthly target.
  const now = new Date();
  const isCurrentMonth =
    dateFrom.getFullYear() === now.getFullYear() &&
    dateFrom.getMonth() === now.getMonth();
  const reportDayNumber  = isCurrentMonth ? now.getDate() : dateTo.getDate();
  const reportDaysInMonth = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0).getDate();

  const evaluatedKpis = await Promise.all(
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
      // For manual KPIs: use progressive target based on day number in month
      // For past months (completed): use full monthly target
      const effectiveTarget = kpi.metric === "manual" && isCurrentMonth
        ? Math.max(1, Math.round((kpi.targetValue / reportDaysInMonth) * reportDayNumber))
        : kpi.targetValue;
      const score =
        actualValue !== null
          ? computeKpiScore(actualValue, effectiveTarget, kpi.direction)
          : null;
      const achieved =
        score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved, effectiveTarget };
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
