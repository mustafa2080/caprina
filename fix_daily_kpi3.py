path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'

with open(path, 'rb') as f:
    raw = f.read()

# Step 1: add dailyKpis query after currentMonth line
old1 = b"  const currentMonth = today.slice(0, 7);\n  const prevMonthDate = new Date();"
new1 = b"""  const currentMonth = today.slice(0, 7);

  // daily KPIs for today
  const { data: dailyData } = useQuery({
    queryKey: ["employee-daily-logs", profileId, today],
    queryFn: () => employeeApi.getDailyLogs(profileId, today),
    staleTime: 60_000,
  });
  const dailyKpis = ((dailyData as any)?.kpis ?? []) as any[];

  const prevMonthDate = new Date();"""

if old1 in raw:
    raw = raw.replace(old1, new1, 1)
    print('Step 1: DONE')
else:
    print('Step 1: NOT FOUND')
    print(repr(raw[raw.find(b'currentMonth = today'):raw.find(b'currentMonth = today')+80]))

# Step 2: inject daily KPI section before quick cards comment
ANCHOR = "KPI \u0645\u062d\u0642\u0642\u0629".encode('utf-8')
idx = raw.find(ANCHOR)
print('Anchor idx:', idx)
if idx >= 0:
    comment_start = raw.rfind(b'{/*', 0, idx)
    daily_ui = b"""      {/* daily KPI section */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            \xd8\xa3\xd8\xaf\xd8\xa7\xd8\xa1 \xd8\xa7\xd9\x84\xd9\x8a\xd9\x88\xd9\x85 \xe2\x80\x94 {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {dailyKpis.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {dailyKpis.filter((k:any) => k.achieved === true).length}/{dailyKpis.length} \xd9\x85\xd8\xad\xd9\x82\xd9\x82
            </span>
          )}
        </div>
        {dailyKpis.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-2">\xd9\x84\xd9\x85 \xd9\x8a\xd8\xaa\xd9\x85 \xd8\xaa\xd8\xb3\xd8\xac\xd9\x8a\xd9\x84 \xd8\xa8\xd9\x8a\xd8\xa7\xd9\x86\xd8\xa7\xd8\xaa \xd8\xa7\xd9\x84\xd9\x8a\xd9\x88\xd9\x85 \xd8\xa8\xd8\xb9\xd8\xaf</p>
        ) : (
          <div className="space-y-2">
            {dailyKpis.map((kpi:any) => {
              const sc = Math.min(kpi.score ?? 0, 100);
              const isOT = (kpi.score ?? 0) > 100;
              const fillColor = isOT ? "#3B82F6" : kpi.achieved === true ? "#10B981" : kpi.achieved === false ? "#EF4444" : "#F59E0B";
              const statusIcon = isOT ? "\xf0\x9f\x8f\x86" : kpi.achieved === true ? "\xe2\x9c\x85" : kpi.achieved === false ? "\xe2\x9d\x8c" : "\xe2\x8f\xb3";
              return (
                <div key={kpi.id} className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold truncate max-w-[55%]">{kpi.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {kpi.actualValue ?? 0} / {kpi.dailyTarget} {kpi.unit}
                      </span>
                      <span className={`text-[10px] font-black ${isOT ? "text-blue-500" : kpi.achieved === true ? "text-emerald-500" : kpi.achieved === false ? "text-red-500" : "text-amber-500"}`}>
                        {statusIcon} {kpi.score !== null ? `${Math.round(kpi.score)}%` : "\xe2\x80\x94"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted/40">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${sc}%`, background: fillColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

"""
    raw = raw[:comment_start] + daily_ui + raw[comment_start:]
    print('Step 2: DONE')

with open(path, 'wb') as f:
    f.write(raw)

print('File written OK, size:', len(raw))
