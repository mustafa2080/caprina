with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """      // manual KPIs: use cumulative monthly sum for progress/achieved
      // todayValue: what was entered today (shown in input field)
      const todayValue   = kpi.metric === "manual" ? (log?.value ?? null) : null;
      const cumulativeValue = kpi.metric === "manual" ? (cumulativeMap.get(kpi.id) ?? null) : null;
      const actualValue  = kpi.metric === "manual" ? cumulativeValue : autoValue;

      // manual: compare cumulative vs full monthly target (not /30)
      // auto:   compare daily value vs dailyTarget (target/30)
      const dailyTarget  = kpi.metric === "manual" ? kpi.targetValue : kpi.targetValue / 30;

      const score = actualValue !== null
        ? computeKpiScore(actualValue, dailyTarget, kpi.direction)
        : null;
      const achieved = actualValue !== null
        ? (kpi.direction === "lower_is_better" ? actualValue <= dailyTarget : actualValue >= dailyTarget)
        : null;"""

new = """      // manual KPIs: use cumulative monthly sum for progress/achieved
      // todayValue: what was entered today (shown in input field)
      const todayValue      = kpi.metric === "manual" ? (log?.value ?? null) : null;
      const cumulativeValue = kpi.metric === "manual" ? (cumulativeMap.get(kpi.id) ?? null) : null;
      const actualValue     = kpi.metric === "manual" ? cumulativeValue : autoValue;

      // manual: progressive daily target = (monthlyTarget / daysInMonth) * dayNumber
      // e.g. target=1000, day 15 of 30 → expected so far = 500
      // auto:  compare today's value vs dailyTarget (target/30)
      let dailyTarget: number;
      if (kpi.metric === "manual") {
        const [yr, mo] = date.split("-").map(Number);
        const daysInMonth = new Date(yr, mo, 0).getDate();
        const dayNumber   = parseInt(date.split("-")[2], 10);
        dailyTarget = Math.round((kpi.targetValue / daysInMonth) * dayNumber);
      } else {
        dailyTarget = kpi.targetValue / 30;
      }

      const score = actualValue !== null
        ? computeKpiScore(actualValue, dailyTarget, kpi.direction)
        : null;
      const achieved = actualValue !== null
        ? (kpi.direction === "lower_is_better" ? actualValue <= dailyTarget : actualValue >= dailyTarget)
        : null;"""

count = content.count(old)
print(f"Found: {count}")
if count == 1:
    content = content.replace(old, new)
    with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("NOT FOUND")
