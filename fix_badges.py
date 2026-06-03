with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """                  const badges: { icon: string; title: string; desc: string; earned: boolean; color: string }[] = [
                    {
                      icon: "🏆", title: "محقق الكل",
                      desc: "تحقيق جميع المؤشرات في شهر واحد",
                      earned: activeKpis.length > 0 && activeKpis.every(k => evaluatedById.get(k.id)?.achieved === true || (evaluatedById.get(k.id)?.score ?? 0) > 100),
                      color: "border-amber-500/40 bg-amber-500/8 text-amber-500",
                    },
                    {
                      icon: "🚀", title: "فوق الهدف",
                      desc: "تجاوز الهدف في مؤشر واحد على الأقل",
                      earned: activeKpis.some(k => (evaluatedById.get(k.id)?.score ?? 0) > 100),
                      color: "border-blue-500/40 bg-blue-500/8 text-blue-500",
                    },
                    {
                      icon: "⭐", title: "أداء ممتاز",
                      desc: "متوسط أداء فوق 90%",
                      earned: overallScore !== null && overallScore >= 90,
                      color: "border-emerald-500/40 bg-emerald-500/8 text-emerald-500",
                    },
                    {
                      icon: "📈", title: "تحسن مستمر",
                      desc: "أداء فوق 70% — على مسار التحسين",
                      earned: overallScore !== null && overallScore >= 70 && overallScore < 90,
                      color: "border-indigo-500/40 bg-indigo-500/8 text-indigo-500",
                    },
                    {
                      icon: "🎯", title: "نصف الطريق",
                      desc: "تحقيق 50%+ من المؤشرات النشطة",
                      earned: activeKpis.length > 0 && (activeKpis.filter(k => evaluatedById.get(k.id)?.achieved === true || (evaluatedById.get(k.id)?.score ?? 0) > 100).length / activeKpis.length) >= 0.5,
                      color: "border-violet-500/40 bg-violet-500/8 text-violet-500",
                    },
                    {
                      icon: "💰", title: "حامي الراتب",
                      desc: "لا خصومات KPI هذا الشهر",
                      earned: activeKpis.length > 0 && activeKpis.every(k => (evaluatedById.get(k.id)?.achieved !== false) || (k.salaryWeight ?? 0) === 0),
                      color: "border-rose-500/40 bg-rose-500/8 text-rose-500",
                    },
                  ];"""

new = """                  // helper: KPIs that have actual data (score != null)
                  const scoredKpisForBadge = activeKpis.filter(k => evaluatedById.get(k.id)?.score !== null && evaluatedById.get(k.id)?.score !== undefined);
                  const hasData = scoredKpisForBadge.length > 0;

                  const badges: { icon: string; title: string; desc: string; earned: boolean; color: string }[] = [
                    {
                      icon: "🏆", title: "محقق الكل",
                      desc: "تحقيق جميع المؤشرات في شهر واحد",
                      earned: hasData && scoredKpisForBadge.every(k => evaluatedById.get(k.id)?.achieved === true || (evaluatedById.get(k.id)?.score ?? 0) >= 100),
                      color: "border-amber-500/40 bg-amber-500/8 text-amber-500",
                    },
                    {
                      icon: "🚀", title: "فوق الهدف",
                      desc: "تجاوز الهدف في مؤشر واحد على الأقل",
                      earned: hasData && scoredKpisForBadge.some(k => (evaluatedById.get(k.id)?.score ?? 0) > 100),
                      color: "border-blue-500/40 bg-blue-500/8 text-blue-500",
                    },
                    {
                      icon: "⭐", title: "أداء ممتاز",
                      desc: "متوسط أداء فوق 90%",
                      earned: overallScore !== null && overallScore >= 90,
                      color: "border-emerald-500/40 bg-emerald-500/8 text-emerald-500",
                    },
                    {
                      icon: "📈", title: "تحسن مستمر",
                      desc: "أداء فوق 70% — على مسار التحسين",
                      earned: overallScore !== null && overallScore >= 70 && overallScore < 90,
                      color: "border-indigo-500/40 bg-indigo-500/8 text-indigo-500",
                    },
                    {
                      icon: "🎯", title: "نصف الطريق",
                      desc: "تحقيق 50%+ من المؤشرات النشطة",
                      earned: hasData && (scoredKpisForBadge.filter(k => evaluatedById.get(k.id)?.achieved === true || (evaluatedById.get(k.id)?.score ?? 0) >= 100).length / scoredKpisForBadge.length) >= 0.5,
                      color: "border-violet-500/40 bg-violet-500/8 text-violet-500",
                    },
                    {
                      icon: "💰", title: "حامي الراتب",
                      desc: "لا خصومات KPI هذا الشهر",
                      earned: hasData && scoredKpisForBadge.every(k => (evaluatedById.get(k.id)?.achieved !== false) || (k.salaryWeight ?? 0) === 0),
                      color: "border-rose-500/40 bg-rose-500/8 text-rose-500",
                    },
                  ];"""

count = content.count(old)
print(f"Found: {count}")
if count == 1:
    content = content.replace(old, new)
    with open(r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("NOT FOUND")
