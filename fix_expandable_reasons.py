import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'caprina', 'src', 'pages', 'smart-analytics.tsx')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useState to imports if not there
old_import = 'import { format } from "date-fns";'
if 'useState' not in content[:500]:
    # find react import
    idx = content.find("from \"react\"")
    if idx != -1:
        line_start = content.rfind('\n', 0, idx) + 1
        line_end = content.find('\n', idx)
        old_react = content[line_start:line_end]
        if 'useState' not in old_react:
            new_react = old_react.replace('from "react"', ', useState } from "react"').replace('import {', 'import { useState,').replace('import React', 'import React')
            # simpler approach
            content = content.replace(old_react, old_react.replace('} from "react"', ', useState } from "react"'), 1)
            print("✅ Added useState to react import")
        else:
            print("✅ useState already imported")
    else:
        print("❌ react import not found")
else:
    print("✅ useState already imported")

# 2. Replace the topReasons section with expandable "other" support
old_section = '''  const topReasons = byReason.slice(0, 4);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Reasons chart */}
      <div>
        <SectionHeader icon={RotateCcw} title="أسباب المرتجعات" subtitle={`${fn(totalReturns)} مرتجع • نسبة ${totalReturnRate}% من الطلبات`} color="text-red-600 dark:text-red-400" />
        <div className="space-y-3">
          {topReasons.map((r, i) => {
            const colors = [
              "bg-red-500 dark:bg-red-400",
              "bg-orange-500 dark:bg-orange-400",
              "bg-amber-500 dark:bg-amber-400",
              "bg-zinc-500 dark:bg-zinc-400",
            ];
            return (
              <div key={r.reason}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{r.label}</span>
                  <span className="text-xs font-black">{r.count} ({r.pct}%)</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors[i] ?? colors[3]}`}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {topReasons.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <RotateCcw className="w-6 h-6 mx-auto mb-2 opacity-30" />
              لا توجد مرتجعات مسجلة
            </div>
          )}
        </div>
      </div>'''

new_section = '''  const [showOtherNotes, setShowOtherNotes] = useState(false);

  // split: named reasons vs other_note items
  const namedReasons = byReason.filter(r => r.reason !== "other_note" && r.reason !== "other");
  const otherItem    = byReason.find(r => r.reason === "other");
  const otherNotes   = byReason.filter(r => r.reason === "other_note");
  // build display list: named + collapsed "سبب آخر" row
  const topReasons = namedReasons.slice(0, 4);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Reasons chart */}
      <div>
        <SectionHeader icon={RotateCcw} title="أسباب المرتجعات" subtitle={`${fn(totalReturns)} مرتجع • نسبة ${totalReturnRate}% من الطلبات`} color="text-red-600 dark:text-red-400" />
        <div className="space-y-3">
          {topReasons.map((r, i) => {
            const colors = [
              "bg-red-500 dark:bg-red-400",
              "bg-orange-500 dark:bg-orange-400",
              "bg-amber-500 dark:bg-amber-400",
              "bg-zinc-500 dark:bg-zinc-400",
            ];
            return (
              <div key={r.reason}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{r.label}</span>
                  <span className="text-xs font-black">{r.count} ({r.pct}%)</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors[i] ?? colors[3]}`}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* سبب آخر — قابل للتوسيع */}
          {(otherNotes.length > 0 || otherItem) && (
            <div>
              <button
                onClick={() => setShowOtherNotes(v => !v)}
                className="w-full flex items-center justify-between mb-1 group"
              >
                <span className="text-xs font-semibold text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
                  <span>{showOtherNotes ? "▾" : "▸"}</span>
                  سبب آخر
                </span>
                <span className="text-xs font-black text-amber-400">
                  {(otherNotes.reduce((s, r) => s + r.count, 0) + (otherItem?.count ?? 0))} (
                  {Math.round(((otherNotes.reduce((s, r) => s + r.count, 0) + (otherItem?.count ?? 0)) / totalReturns) * 100)}%)
                </span>
              </button>
              {/* progress bar للإجمالي */}
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-amber-500 dark:bg-amber-400"
                  style={{ width: `${Math.round(((otherNotes.reduce((s, r) => s + r.count, 0) + (otherItem?.count ?? 0)) / totalReturns) * 100)}%` }}
                />
              </div>
              {/* التفاصيل عند الضغط */}
              {showOtherNotes && (
                <div className="mt-2 space-y-2 pr-3 border-r-2 border-amber-500/30">
                  {otherNotes.map((note, ni) => (
                    <div key={ni}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={note.label}>{note.label}</span>
                        <span className="text-xs font-bold text-amber-300">{note.count} ({note.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${note.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {otherItem && (
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-muted-foreground">غير مفصّل</span>
                        <span className="text-xs font-bold text-amber-300">{otherItem.count} ({otherItem.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/40" style={{ width: `${otherItem.pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {byReason.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <RotateCcw className="w-6 h-6 mx-auto mb-2 opacity-30" />
              لا توجد مرتجعات مسجلة
            </div>
          )}
        </div>
      </div>'''

if old_section in content:
    content = content.replace(old_section, new_section, 1)
    print("✅ Replaced reasons section with expandable version")
else:
    print("❌ section not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
