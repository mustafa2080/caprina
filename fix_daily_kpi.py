path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """  profileId: number; monthlySalary: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const prevMonthDate = new Date();"""

new = """  profileId: number; monthlySalary: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  // daily KPIs for today
  const { data: dailyData } = useQuery({
    queryKey: ["employee-daily-logs", profileId, today],
    queryFn: () => employeeApi.getDailyLogs(profileId, today),
    staleTime: 60_000,
  });
  const dailyKpis: import("@/lib/api").DailyKpiEntry[] = (dailyData as any)?.kpis ?? [];

  const prevMonthDate = new Date();"""

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('DONE')
else:
    print('NOT FOUND')
