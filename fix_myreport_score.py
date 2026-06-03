with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      let actualValue: number | null;
      if (kpi.metric === "manual") {
        actualValue = manualCumulativeMapMR.get(kpi.id) ?? null;
      } else {
        actualValue = await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId);
      }
      const score = actualValue !== null ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction) : null;
      const achieved = score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved };
    })
  );"""

new = """  // Progressive target for manual KPIs (same logic as employee-report)
  const nowMR = new Date();
  const isCurrentMonthMR =
    dateFrom.getFullYear() === nowMR.getFullYear() &&
    dateFrom.getMonth() === nowMR.getMonth();
  const reportDayNumberMR   = isCurrentMonthMR ? nowMR.getDate() : dateTo.getDate();
  const reportDaysInMonthMR = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0).getDate();

  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      let actualValue: number | null;
      if (kpi.metric === "manual") {
        actualValue = manualCumulativeMapMR.get(kpi.id) ?? null;
      } else {
        actualValue = await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId);
      }
      const effectiveTarget = kpi.metric === "manual" && isCurrentMonthMR
        ? Math.max(1, Math.round((kpi.targetValue / reportDaysInMonthMR) * reportDayNumberMR))
        : kpi.targetValue;
      const score = actualValue !== null ? computeKpiScore(actualValue, effectiveTarget, kpi.direction) : null;
      const achieved = score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
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
