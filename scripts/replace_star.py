import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'

with open(path, encoding='utf-8') as f:
    content = f.read()

# The new StarEmployeesSection (display only) + StarEmployeesManageTab
new_section = """
// ─── Star Employees Section (عرض للجميع في لوحتي) ──────────────────────────
function StarEmployeesSection({ currentMonth: _cm }: { currentMonth: string }) {
  const { data: stars = [], isLoading } = useQuery({
    queryKey: ["star-employees"],
    queryFn: () => employeeApi.getStarEmployees(),
  });

  const rankIcons = [
    <Crown key="1" className="w-5 h-5 text-yellow-400" />,
    <Medal key="2" className="w-5 h-5 text-slate-300" />,
    <Award key="3" className="w-5 h-5 text-amber-600" />,
  ];
  const rankColors = [
    "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
    "from-slate-400/20 to-slate-500/5 border-slate-400/30",
    "from-amber-600/20 to-amber-700/5 border-amber-600/30",
  ];
  const rankLabels = ["🥇 الأول", "🥈 الثاني", "🥉 الثالث"];

  if (isLoading || stars.length === 0) return null;

  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-yellow-300">موظفو الشهر المتميزون</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stars.slice(0, 3).map((emp: any, i: number) => (
          <div key={emp.id}
            className={`relative rounded-xl border bg-gradient-to-br ${rankColors[i]} p-3 flex flex-col items-center gap-1.5 text-center`}>
            <div className="absolute -top-2 -right-1">{rankIcons[i]}</div>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 bg-muted shrink-0">
              {emp.avatar
                ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.displayName} />
                : <div className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.7),hsl(var(--primary)/0.3))" }}>
                    {emp.displayName?.charAt(0)?.toUpperCase()}
                  </div>}
            </div>
            <p className="text-xs font-bold leading-tight">{emp.displayName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{emp.jobTitle ?? emp.department ?? ""}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: i === 0 ? "rgba(234,179,8,0.2)" : i === 1 ? "rgba(148,163,184,0.2)" : "rgba(180,83,9,0.2)",
                       color: i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : "#d97706" }}>
              {rankLabels[i]}
            </span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        🌟 هؤلاء الموظفون حققوا أعلى الأهداف هذا الشهر — استمر في التميز!
      </p>
    </div>
  );
}

// ─── Star Employees Manage Tab (للسوبر أدمن فقط) ─────────────────────────────
function StarEmployeesManageTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [rankMonth, setRankMonth] = useState(currentMonth);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saved, setSaved] = useState(false);

  const { data: stars = [], isLoading: starsLoading } = useQuery({
    queryKey: ["star-employees"],
    queryFn: () => employeeApi.getStarEmployees(),
  });

  const { data: ranking = [], isLoading: rankLoading } = useQuery({
    queryKey: ["team-ranking", rankMonth],
    queryFn: () => employeeApi.getTeamRanking(rankMonth),
  });

  const saveMutation = useMutation({
    mutationFn: (ids: number[]) => employeeApi.setStarEmployees(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["star-employees"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "✅ تم حفظ موظفي الشهر المتميزين" });
    },
  });

  useEffect(() => {
    if (stars.length > 0) setSelectedIds(stars.map((s: any) => s.id));
  }, [stars]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const rankIcons = [
    <Crown key="1" className="w-5 h-5 text-yellow-400" />,
    <Medal key="2" className="w-5 h-5 text-slate-300" />,
    <Award key="3" className="w-5 h-5 text-amber-600" />,
  ];
  const rankColors = [
    "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",
    "from-slate-400/20 to-slate-500/5 border-slate-400/30",
    "from-amber-600/20 to-amber-700/5 border-amber-600/30",
  ];
  const rankLabels = ["🥇 الأول", "🥈 الثاني", "🥉 الثالث"];

  const monthLabel = new Date(parseInt(rankMonth.split("-")[0]), parseInt(rankMonth.split("-")[1]) - 1, 1)
    .toLocaleDateString("ar-EG", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/8 to-transparent p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-sm font-bold">اختيار موظفي الشهر المتميزين</p>
              <p className="text-[11px] text-muted-foreground">اختر حتى 3 موظفين — ستظهر بطاقاتهم لجميع الموظفين تلقائياً</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">الشهر:</Label>
            <Input type="month" value={rankMonth} onChange={e => setRankMonth(e.target.value)}
              className="h-8 text-xs bg-background border-border w-36" />
          </div>
        </div>
      </div>

      {/* ── النجوم المختارون حالياً ── */}
      {stars.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            النجوم المحفوظون حالياً
          </p>
          <div className="grid grid-cols-3 gap-2">
            {stars.slice(0, 3).map((emp: any, i: number) => (
              <div key={emp.id}
                className={`relative rounded-xl border bg-gradient-to-br ${rankColors[i]} p-2.5 flex flex-col items-center gap-1 text-center`}>
                <div className="absolute -top-1.5 -right-1">{rankIcons[i]}</div>
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 bg-muted shrink-0">
                  {emp.avatar
                    ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.displayName} />
                    : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                        style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.7),hsl(var(--primary)/0.3))" }}>
                        {emp.displayName?.charAt(0)?.toUpperCase()}
                      </div>}
                </div>
                <p className="text-[11px] font-bold leading-tight">{emp.displayName}</p>
                <p className="text-[9px] text-muted-foreground">{emp.jobTitle ?? emp.department ?? ""}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: i === 0 ? "rgba(234,179,8,0.2)" : i === 1 ? "rgba(148,163,184,0.2)" : "rgba(180,83,9,0.2)",
                           color: i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : "#d97706" }}>
                  {rankLabels[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ranking ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            ترتيب الموظفين — {monthLabel}
          </p>
          <span className="text-[10px] text-muted-foreground">{selectedIds.length}/3 مختارين</span>
        </div>

        {rankLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            جاري تحميل الترتيب...
          </div>
        ) : ranking.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <BarChart2 className="w-8 h-8 opacity-30" />
            <p className="text-sm">لا توجد بيانات لهذا الشهر</p>
            <p className="text-xs opacity-70">تأكد من وجود مؤشرات أداء مُعيّنة للموظفين</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {ranking.map((emp: any, i: number) => {
              const isSelected = selectedIds.includes(emp.id);
              const rank = i + 1;
              const score = emp.overallScore;
              const scoreColor = score === null ? "text-muted-foreground" : score >= 90 ? "text-emerald-400" : score >= 70 ? "text-blue-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
              const barColor = score === null ? "bg-muted" : score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-blue-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

              return (
                <div key={emp.id}
                  onClick={() => toggleSelect(emp.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-muted/30 ${
                    isSelected ? "bg-primary/5 border-r-2 border-r-primary" : ""
                  }`}>
                  {/* rank badge */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    rank === 1 ? "bg-yellow-500/20 text-yellow-400" :
                    rank === 2 ? "bg-slate-400/20 text-slate-300" :
                    rank === 3 ? "bg-amber-600/20 text-amber-500" : "bg-muted text-muted-foreground"
                  }`}>
                    {rank <= 3 ? rankIcons[rank - 1] : rank}
                  </div>
                  {/* avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
                    {emp.avatar
                      ? <img src={emp.avatar} className="w-full h-full object-cover" alt={emp.displayName} />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-bold"
                          style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.7),hsl(var(--primary)/0.3))" }}>
                          {emp.displayName?.charAt(0)?.toUpperCase()}
                        </div>}
                  </div>
                  {/* info + progress */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{emp.displayName}</p>
                      <span className={`text-sm font-black shrink-0 ${scoreColor}`}>
                        {score !== null ? `${score}%` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, score ?? 0)}%` }} />
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                        {emp.achievedCount}/{emp.totalKpis} مؤشر
                      </span>
                    </div>
                    {emp.jobTitle && <p className="text-[10px] text-muted-foreground truncate">{emp.jobTitle}</p>}
                  </div>
                  {/* checkbox */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2">
        <Button className={`flex-1 h-10 text-sm font-bold transition-all ${saved ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
          onClick={() => saveMutation.mutate(selectedIds)}
          disabled={saveMutation.isPending || selectedIds.length === 0}>
          {saveMutation.isPending ? (
            <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الحفظ...</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 ml-2" />تم الحفظ!</>
          ) : (
            <><Trophy className="w-4 h-4 ml-2" />حفظ النجوم ({selectedIds.length}/3)</>
          )}
        </Button>
        {(selectedIds.length > 0 || stars.length > 0) && (
          <Button variant="outline" size="sm" className="h-10 px-4 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => { setSelectedIds([]); saveMutation.mutate([]); }}>
            مسح الكل
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && !saved && (
        <p className="text-center text-[11px] text-muted-foreground">
          💡 بعد الحفظ ستظهر بطاقات النجوم تلقائياً في لوحة كل موظف
        </p>
      )}
    </div>
  );
}
"""

print(new_section[:100])
print("Writing...")

# append the actual file replacement logic
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

before = lines[:1642]   # lines 1-1642 (0-indexed 0-1641)
after  = lines[1840:]   # lines 1841+ (0-indexed 1840+)

replacement_lines = [l + '\n' if not l.endswith('\n') else l for l in new_section.split('\n')]

new_content = before + replacement_lines + after

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print(f"Done! Old: {len(lines)} lines, New: {len(new_content)} lines")
print(f"Replaced {1840-1642} lines with {len(replacement_lines)} lines")
