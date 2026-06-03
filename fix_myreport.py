with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix my-report endpoint: add cumulative map + fix evaluatedKpis
old_kpis_block = """  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(
      or(
        eq(ordersTable.assignedUserId, userId),
        eq(ordersTable.createdByUserId, userId)
      ),
      gte(ordersTable.createdAt, dateFrom),
      lte(ordersTable.createdAt, dateTo),
      isNull(ordersTable.deletedAt),
      profile.tenantId != null ? eq(ordersTable.tenantId, profile.tenantId) : undefined
    ));"""

new_kpis_block = """  const kpis = await db
    .select()
    .from(employeeKpisTable)
    .where(and(eq(employeeKpisTable.profileId, profileId), eq(employeeKpisTable.isActive, true)));

  // Cumulative sum for manual KPIs from daily logs in this month
  const monthStartMR = dateFrom.toISOString().slice(0, 10);
  const monthEndMR   = dateTo.toISOString().slice(0, 10);
  const manualLogsMR = await db
    .select({ kpiId: employeeDailyLogsTable.kpiId, total: sum(employeeDailyLogsTable.value) })
    .from(employeeDailyLogsTable)
    .where(and(
      eq(employeeDailyLogsTable.profileId, profileId),
      gte(employeeDailyLogsTable.date, monthStartMR),
      lte(employeeDailyLogsTable.date, monthEndMR)
    ))
    .groupBy(employeeDailyLogsTable.kpiId);
  const manualCumulativeMapMR = new Map(
    manualLogsMR.map(r => [r.kpiId, parseFloat(String(r.total ?? "0"))])
  );

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(
      or(
        eq(ordersTable.assignedUserId, userId),
        eq(ordersTable.createdByUserId, userId)
      ),
      gte(ordersTable.createdAt, dateFrom),
      lte(ordersTable.createdAt, dateTo),
      isNull(ordersTable.deletedAt),
      profile.tenantId != null ? eq(ordersTable.tenantId, profile.tenantId) : undefined
    ));"""

count = content.count(old_kpis_block)
print(f"kpis block found: {count}")
if count == 1:
    content = content.replace(old_kpis_block, new_kpis_block)
    print("kpis block replaced")

# Fix evaluatedKpis in my-report to use cumulative map
old_eval = """  const evaluatedKpis = await Promise.all(
    kpis.map(async (kpi) => {
      const actualValue = await computeActualValue(kpi.metric, userId, dateFrom, dateTo, profile.tenantId);
      const score = actualValue !== null ? computeKpiScore(actualValue, kpi.targetValue, kpi.direction) : null;
      const achieved = score !== null ? (kpi.direction === "lower_is_better" ? score >= 70 : score >= 80) : null;
      return { ...kpi, actualValue, score, achieved };
    })
  );"""

new_eval = """  const evaluatedKpis = await Promise.all(
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

count2 = content.count(old_eval)
print(f"eval block found: {count2}")
if count2 == 1:
    content = content.replace(old_eval, new_eval)
    print("eval block replaced")

with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("File saved")
