path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the anchor: the quick cards section
old = '      {/* \u2500\u2500 \u0628\u0637\u0627\u0642\u0627\u062a \u0633\u0631\u064a\u0639\u0629 \u2500\u2500 */}'

new = '''      {/* \u2500\u2500 \u0623\u062f\u0627\u0621 \u0627\u0644\u064a\u0648\u0645 \u2500\u2500 */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            \u0623\u062f\u0627\u0621 \u0627\u0644\u064a\u0648\u0645 \u2014 {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {dailyKpis.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {dailyKpis.filter(k => k.achieved === true).length}/{dailyKpis.length} \u0645\u062d\u0642\u0642
            </span>
          )}
        </div>
        {dailyKpis.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-2">\u0644\u0645 \u064a\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u064a\u0648\u0645 \u0628\u0639\u062f</p>
        ) : (
          <div className="space-y-2">
            {dailyKpis.map(kpi => {
              const sc = Math.min(kpi.score ?? 0, 100);
              const isOT = (kpi.score ?? 0) > 100;
              const fillColor = isOT ? "#3B82F6" : kpi.achieved === true ? "#10B981" : kpi.achieved === false ? "#EF4444" : "#F59E0B";
              const statusIcon = isOT ? "\ud83c\udfc6" : kpi.achieved === true ? "\u2705" : kpi.achieved === false ? "\u274c" : "\u23f3";
              return (
                <div key={kpi.id} className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold truncate max-w-[55%]">{kpi.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {kpi.actualValue ?? 0} / {kpi.dailyTarget} {kpi.unit}
                      </span>
                      <span className={`text-[10px] font-black ${isOT ? "text-blue-500" : kpi.achieved === true ? "text-emerald-500" : kpi.achieved === false ? "text-red-500" : "text-amber-500"}`}>
                        {statusIcon} {kpi.score !== null ? `${Math.round(kpi.score)}%` : "\u2014"}
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

      {/* \u2500\u2500 \u0628\u0637\u0627\u0642\u0627\u062a \u0633\u0631\u064a\u0639\u0629 \u2500\u2500 */}'''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('DONE')
else:
    print('NOT FOUND - trying fallback')
    # try without BOM
    idx = content.find('\u0628\u0637\u0627\u0642\u0627\u062a \u0633\u0631\u064a\u0639\u0629')
    print(f'Found at index: {idx}')
    print(repr(content[idx-30:idx+30]))
