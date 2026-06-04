path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'

with open(path, 'rb') as f:
    raw = f.read()

old1 = b"  const currentMonth = today.slice(0, 7);\r\n  const prevMonthDate = new Date();"
new1 = b"""  const currentMonth = today.slice(0, 7);\r\n\r\n  // daily KPIs for today\r\n  const { data: dailyData } = useQuery({\r\n    queryKey: ["employee-daily-logs", profileId, today],\r\n    queryFn: () => employeeApi.getDailyLogs(profileId, today),\r\n    staleTime: 60_000,\r\n  });\r\n  const dailyKpis = ((dailyData as any)?.kpis ?? []) as any[];\r\n\r\n  const prevMonthDate = new Date();"""

if old1 in raw:
    raw = raw.replace(old1, new1, 1)
    print('Step 1: DONE')
    with open(path, 'wb') as f:
        f.write(raw)
    print('Saved')
else:
    print('NOT FOUND')
    print(repr(raw[raw.find(b'currentMonth = today'):raw.find(b'currentMonth = today')+90]))
