
$file = 'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\profile.tsx'
$lines = [System.IO.File]::ReadAllLines($file, [System.Text.Encoding]::UTF8)
$newLines = [System.Collections.Generic.List[string]]::new($lines)

# Find the line: "      {/* Financial + Speed */"
$insertLine = -1
for ($i = 0; $i -lt $newLines.Count; $i++) {
    if ($newLines[$i] -match '^\s+\{/\* Financial \+ Speed \*/\}') {
        $insertLine = $i
        break
    }
}
Write-Host "Insert before line: $insertLine"
if ($insertLine -lt 0) { Write-Host "NOT FOUND"; exit }

$code = @'
      {/* ══ 1️⃣ التقدم نحو الأهداف ══ */}
      {currReport?.kpis && currReport.kpis.length > 0 && (() => {
        const kpis = currReport.kpis;
        const kpiAchieved = kpis.filter((k:any) => k.achieved === true).length;
        const kpiFailed   = kpis.filter((k:any) => k.achieved === false).length;
        const kpiOT       = kpis.filter((k:any) => (k.score ?? 0) > 100).length;
        const daysInM2    = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const mPct        = Math.round((new Date().getDate() / daysInM2) * 100);
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">التقدم نحو الأهداف</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-emerald-500 font-bold">{kpiAchieved} محقق</span>
                {kpiFailed > 0 && <span className="text-red-500 font-bold">{kpiFailed} متأخر</span>}
                {kpiOT > 0 && <span className="text-blue-500 font-bold">🏆 {kpiOT} OT</span>}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>تقدم الشهر</span><span>{mPct}%</span></div>
                <div className="w-full h-1.5 rounded-full bg-muted/30"><div className="h-1.5 rounded-full bg-primary/60 transition-all" style={{ width: `${mPct}%` }} /></div>
              </div>
              {kpis.map((kpi:any) => {
                const sc2 = Math.min(kpi.score ?? 0, 100);
                const isOT2 = (kpi.score ?? 0) > 100;
                const fill2 = isOT2 ? "#3B82F6" : kpi.achieved === true ? "#10B981" : kpi.achieved === false ? "#EF4444" : "#F59E0B";
                const badge2 = isOT2 ? "🏆 OT" : kpi.achieved === true ? "✅" : kpi.achieved === false ? "❌" : "⏳";
                return (
                  <div key={kpi.id}>
                    <div className="flex justify-between items-center text-[11px] mb-1.5">
                      <span className="text-muted-foreground truncate max-w-[55%]">{kpi.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground/60">{kpi.actualValue ?? 0}/{kpi.effectiveTarget ?? kpi.targetValue}{kpi.unit ? ` ${kpi.unit}` : ""}</span>
                        <span className={`font-black text-xs ${isOT2 ? "text-blue-500" : kpi.achieved === true ? "text-emerald-500" : kpi.achieved === false ? "text-red-500" : "text-amber-500"}`}>{badge2} {kpi.score !== null ? `${Math.round(Math.min(kpi.score,100))}%` : "—"}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/30"><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${sc2}%`, background: fill2 }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══ 2️⃣ تقييم الأداء الربعي ══ */}
      {(() => {
        const months3Labels = [-2,-1,0].map(o => {
          const d = new Date(); d.setMonth(d.getMonth() + o);
          return d.toLocaleDateString("ar-EG", { month: "short" });
        });
        const prev2Sc = (prevReport as any)?.overallScore ?? null;
        const currSc  = score ?? null;
        const trend3  = currSc !== null && prev2Sc !== null ? currSc - prev2Sc : null;
        const stars3  = currSc === null ? 0 : currSc >= 90 ? 5 : currSc >= 75 ? 4 : currSc >= 60 ? 3 : currSc >= 40 ? 2 : 1;
        const scores3 = [null, prev2Sc, currSc];
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">تقييم الأداء الربعي</span>
              </div>
              <span className="text-[10px] text-muted-foreground">آخر 3 أشهر</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-5 h-5 ${s <= stars3 ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />)}</div>
                <span className="text-sm font-bold text-muted-foreground">{rating ?? "لا يوجد"}</span>
                {trend3 !== null && <span className={`text-xs font-bold flex items-center gap-0.5 mr-auto ${trend3 >= 0 ? "text-emerald-500" : "text-red-500"}`}>{trend3 >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{trend3 >= 0 ? "+" : ""}{trend3}%</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0,1,2].map(i => {
                  const sc3 = scores3[i];
                  const isNow3 = i === 2;
                  const bc3 = sc3 === null ? "#6B7280" : sc3 >= 80 ? "#10B981" : sc3 >= 60 ? "#F59E0B" : "#EF4444";
                  return (
                    <div key={i} className={`rounded-xl p-3 text-center border ${isNow3 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10"}`}>
                      <p className="text-[9px] text-muted-foreground mb-1">{months3Labels[i]}</p>
                      {sc3 !== null ? (<><p className="text-lg font-black" style={{ color: bc3 }}>{sc3}%</p><div className="w-full h-1.5 rounded-full bg-muted/30 mt-1.5"><div className="h-1.5 rounded-full" style={{ width: `${sc3}%`, background: bc3 }} /></div></>) : <p className="text-lg font-black text-muted-foreground/30">—</p>}
                      {isNow3 && <p className="text-[8px] text-primary font-bold mt-1">الحالي</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ 3️⃣ مؤشرات الأداء التشغيلي ══ */}
      {currReport?.kpis && currReport.kpis.length > 0 && (() => {
        const kpis3 = currReport.kpis;
        const kpiFinancials3 = (currReport as any)?.kpiFinancials;
        const baseSal3 = (profile as any)?.monthlySalary ?? 0;
        const deduction3 = kpiFinancials3?.totalDeduction ?? kpis3.filter((k:any) => k.achieved === false && (k.salaryWeight ?? 0) > 0).reduce((s:number, k:any) => s + Math.round(((k.salaryWeight ?? 0) / 100) * baseSal3), 0);
        const bonus3     = kpiFinancials3?.totalBonus     ?? kpis3.filter((k:any) => (k.score ?? 0) > 100 && (k.overtargetBonus ?? 0) > 0).reduce((s:number, k:any) => s + Math.round(((k.overtargetBonus ?? 0) / 100) * baseSal3), 0);
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm">مؤشرات الأداء التشغيلي</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${score !== null && score >= 60 ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"}`}>{score !== null ? `${score}%` : "—"}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1"><span className="text-muted-foreground">كفاءة التشغيل</span><span className="font-bold">{score !== null ? `${score}%` : "—"}</span></div>
                <div className="w-full h-2 rounded-full bg-muted/30"><div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score ?? 0}%`, background: (score ?? 0) >= 80 ? "#10B981" : (score ?? 0) >= 60 ? "#F59E0B" : "#EF4444" }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-muted/20 border border-border/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5">التسليمات والمرتجعات</p>
                  {[{label:"مسلّمة",val:stats?.delivered??0,color:"text-emerald-500"},{label:"مرتجعة",val:stats?.returned??0,color:"text-red-500"},{label:"معلقة",val:(stats?.total??0)-(stats?.delivered??0)-(stats?.returned??0),color:"text-amber-500"}].map(r => (
                    <div key={r.label} className="flex justify-between text-[11px] py-0.5"><span className="text-muted-foreground">{r.label}</span><span className={`font-bold ${r.color}`}>{r.val}</span></div>
                  ))}
                </div>
                <div className="rounded-xl bg-muted/20 border border-border/50 p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5">يحتاج مراجعة</p>
                  {deduction3 > 0 ? (<div><p className="text-xs font-black text-red-500">خصم: -{new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(deduction3)}</p><p className="text-[10px] text-muted-foreground mt-1">بحسب مؤشرات الراتب</p></div>)
                  : bonus3 > 0 ? (<div><p className="text-xs font-black text-emerald-500">مكافأة: +{new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(bonus3)}</p><p className="text-[10px] text-muted-foreground mt-1">Over Target 🏆</p></div>)
                  : <p className="text-xs text-muted-foreground">لا توجد خصومات 💪</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ 4️⃣ الملخص المالي للمؤشرات ══ */}
      {currReport?.kpis && currReport.kpis.length > 0 && (() => {
        const kpis4 = currReport.kpis;
        const kpiFinancials4 = (currReport as any)?.kpiFinancials;
        const baseSal4 = (profile as any)?.monthlySalary ?? 0;
        const totalWt4  = kpiFinancials4?.totalSalaryWeight ?? kpis4.reduce((s:number,k:any) => s + (k.salaryWeight ?? 0), 0);
        const deduction4 = kpiFinancials4?.totalDeduction ?? 0;
        const bonus4     = kpiFinancials4?.totalBonus ?? 0;
        const achieved4  = kpiFinancials4?.achievedCount ?? kpis4.filter((k:any) => k.achieved === true).length;
        const failed4    = kpiFinancials4?.failedCount ?? kpis4.filter((k:any) => k.achieved === false).length;
        const overT4     = kpiFinancials4?.overTargetCount ?? kpis4.filter((k:any) => (k.score ?? 0) > 100).length;
        const fmt4 = (n:number) => new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(n);
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">الملخص المالي للمؤشرات</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border/40"><span className="text-sm text-muted-foreground">الراتب الأساسي</span><span className="text-sm font-black">{baseSal4 > 0 ? fmt4(baseSal4) : "غير محدد"}</span></div>
              {totalWt4 > 0 && <div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">من الراتب KPI مرتبط</span><span className="font-bold text-amber-500">{totalWt4}%</span></div><div className="w-full h-1.5 rounded-full bg-muted/30"><div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(totalWt4,100)}%` }} /></div></div>}
              {deduction4 > 0 && <div className="rounded-xl bg-red-500/8 border border-red-500/20 px-3 py-2.5 flex justify-between items-center"><span className="text-xs text-red-500">خصم عند عدم التحقق</span><span className="text-sm font-black text-red-500">-{fmt4(deduction4)}</span></div>}
              {bonus4 > 0 && <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5 flex justify-between items-center"><span className="text-xs text-emerald-500">مكافأة Over Target 🏆</span><span className="text-sm font-black text-emerald-500">+{fmt4(bonus4)}</span></div>}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[{label:"محقق",val:achieved4,color:"text-emerald-500",bg:"bg-emerald-500/8 border-emerald-500/20"},{label:"لم يتحقق",val:failed4,color:"text-red-500",bg:"bg-red-500/8 border-red-500/20"},{label:"Over Target",val:overT4,color:"text-blue-500",bg:"bg-blue-500/8 border-blue-500/20"}].map(c => (
                  <div key={c.label} className={`rounded-xl border ${c.bg} p-2 text-center`}><p className={`text-lg font-black ${c.color}`}>{c.val}</p><p className="text-[9px] text-muted-foreground">{c.label}</p></div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ 5️⃣ مصفوفة مخاطر المؤشرات ══ */}
      {currReport?.kpis && currReport.kpis.filter((k:any) => k.score !== null).length > 0 && (() => {
        const riskKpis5 = currReport.kpis
          .filter((k:any) => k.score !== null)
          .map((k:any) => {
            const sc5 = k.score ?? 0;
            const risk5 = sc5 < 40 ? "عالي" : sc5 < 70 ? "متوسط" : "منخفض";
            return { ...k, sc5, risk5, riskColor5: sc5 < 40 ? "text-red-500" : sc5 < 70 ? "text-amber-500" : "text-emerald-500", riskBg5: sc5 < 40 ? "bg-red-500/8 border-red-500/20" : sc5 < 70 ? "bg-amber-500/8 border-amber-500/20" : "bg-emerald-500/8 border-emerald-500/20" };
          })
          .sort((a:any, b:any) => a.sc5 - b.sc5);
        const highRisk5 = riskKpis5.filter((k:any) => k.risk5 === "عالي").length;
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">مصفوفة مخاطر المؤشرات</span>
              </div>
              {highRisk5 > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/25">{highRisk5} خطر عالٍ</span>}
            </div>
            <div className="p-4 space-y-2">
              {riskKpis5.map((k:any) => (
                <div key={k.id} className={`rounded-xl border ${k.riskBg5} px-3 py-2.5 flex items-center justify-between gap-3`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-black shrink-0 ${k.riskColor5}`}>{k.sc5 < 40 ? "🔴" : k.sc5 < 70 ? "🟡" : "🟢"} {k.risk5}</span>
                    <span className="text-xs text-muted-foreground truncate">{k.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-black/10 dark:bg-white/10"><div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(k.sc5,100)}%`, background: k.sc5 < 40 ? "#EF4444" : k.sc5 < 70 ? "#F59E0B" : "#10B981" }} /></div>
                    <span className={`text-xs font-black w-10 text-right ${k.riskColor5}`}>{Math.round(k.sc5)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ══ 6️⃣ جدار الإنجازات الشهرية ══ */}
      {(() => {
        const kpis6    = currReport?.kpis ?? [];
        const achieved6 = kpis6.filter((k:any) => k.achieved === true).length;
        const overT6    = kpis6.filter((k:any) => (k.score ?? 0) > 100).length;
        const daysInM6  = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const mPct6     = Math.round((new Date().getDate() / daysInM6) * 100);
        const delivR6   = stats?.deliveryRate ?? 0;
        const retR6     = stats?.returnRate ?? 0;
        const totOrd6   = stats?.total ?? 0;
        const badges6 = [
          { icon: "🎯", label: "محقق الهدف",         desc: `حقق ${achieved6} مؤشر`,              unlocked: achieved6 >= 1,                      color: "emerald" },
          { icon: "🏆", label: "فوق المستهدف",        desc: `${overT6} مؤشر Over Target`,         unlocked: overT6 >= 1,                         color: "blue" },
          { icon: "🚀", label: "معدل تسليم عالٍ",     desc: `${delivR6}% معدل تسليم`,             unlocked: delivR6 >= 80,                       color: "indigo" },
          { icon: "💎", label: "صفر مرتجعات",         desc: `${retR6}% معدل إرجاع`,               unlocked: retR6 === 0 && totOrd6 > 0,          color: "violet" },
          { icon: "⚡", label: "نشاط مبكر",           desc: `${mPct6}% من الشهر منجز`,            unlocked: mPct6 >= 13,                         color: "amber" },
          { icon: "👑", label: "كل المؤشرات محققة",   desc: `${kpis6.length} مؤشر`,               unlocked: kpis6.length > 0 && achieved6 === kpis6.length, color: "amber" },
        ];
        const unlockedN = badges6.filter(b => b.unlocked).length;
        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">جدار الإنجازات الشهرية</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-bold">{unlockedN}/{badges6.length} مفتوحة</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2">
              {badges6.map((b, i) => (
                <div key={i} className={`rounded-xl border p-3 text-center transition-all duration-300 ${b.unlocked
                  ? b.color === "emerald" ? "bg-emerald-500/10 border-emerald-500/25"
                  : b.color === "blue"    ? "bg-blue-500/10 border-blue-500/25"
                  : b.color === "indigo"  ? "bg-indigo-500/10 border-indigo-500/25"
                  : b.color === "violet"  ? "bg-violet-500/10 border-violet-500/25"
                  : "bg-amber-500/10 border-amber-500/25"
                  : "bg-muted/10 border-border/30 opacity-40"}`}>
                  <div className={`text-2xl mb-1 ${b.unlocked ? "" : "grayscale opacity-50"}`}>{b.icon}</div>
                  <p className={`text-[10px] font-bold leading-tight mb-0.5 ${b.unlocked ? "" : "text-muted-foreground"}`}>{b.label}</p>
                  <p className="text-[9px] text-muted-foreground/70 leading-tight">{b.desc}</p>
                  {b.unlocked && <div className="mt-1.5 text-[8px] font-bold text-emerald-500">✓ مفتوح</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

'@

$codeLines = $code -split "`n"
$idx6 = $insertLine
foreach ($l in $codeLines) {
    $newLines.Insert($idx6, $l)
    $idx6++
}

Write-Host "Inserted $($codeLines.Length) lines before line $insertLine"
[System.IO.File]::WriteAllLines($file, $newLines.ToArray(), [System.Text.Encoding]::UTF8)
Write-Host "Done. Total lines: $($newLines.Count)"
