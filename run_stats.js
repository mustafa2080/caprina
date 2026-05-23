
const fs = require("fs");
const path = require("path");

const BASE = __dirname;
const ordersPath = path.join(BASE, "artifacts\\caprina\\src\\pages\\orders.tsx");
let code = fs.readFileSync(ordersPath, "utf8");

const MARKER = `      <Card className="border-border overflow-hidden">`;

const STATS_SECTION = `      {/* \u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0627\u0644\u0637\u0644\u0628\u0627\u062a */}
      {!isLoading && orders && (() => {
        const total = orders.length;
        const statusData = [
          { key: "warehouse_ready",  label: "\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646", rgb: "45,212,191"  },
          { key: "received",         label: "\u0641\u0633\u0644\u0651\u0645",                rgb: "52,211,153"  },
          { key: "pending",          label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631",         rgb: "251,191,36"  },
          { key: "returned",         label: "\u0645\u0631\u062a\u062c\u0639",                rgb: "248,113,113" },
          { key: "in_shipping",      label: "\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646",            rgb: "56,189,248"  },
          { key: "partial_received", label: "\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a",           rgb: "34,211,238"  },
        ];
        const counts = statusData.map(s => ({
          ...s,
          count: orders.filter(o => o.status === s.key).length,
          pct: total > 0 ? Math.round(orders.filter(o => o.status === s.key).length / total * 100) : 0,
        })).filter(s => s.count > 0);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div
              className="relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between"
              style={{
                background: "linear-gradient(145deg, rgba(251,191,36,0.22) 0%, rgba(251,146,60,0.14) 50%, rgba(251,191,36,0.06) 100%)",
                border: "1px solid rgba(251,191,36,0.35)",
                boxShadow: "0 8px 32px rgba(251,191,36,0.15), 0 2px 8px rgba(251,146,60,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
                minHeight: "140px",
              }}
            >
              <span className="absolute -top-6 -left-6 w-28 h-28 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, rgba(251,191,36,1) 0%, transparent 70%)" }} />
              <span className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, rgba(251,146,60,1) 0%, transparent 70%)" }} />
              <p className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: "rgba(251,191,36,0.75)", letterSpacing: "0.12em" }}>
                \u0637\u0644\u0628\u064a\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639
              </p>
              <div className="mt-2">
                <span className="text-5xl font-black" style={{ color: "rgba(251,191,36,1)", lineHeight: 1 }}>
                  {total}
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: "rgba(251,191,36,0.5)" }}>\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0637\u0644\u0628\u0627\u062a</p>
            </div>

            <div
              className="lg:col-span-2 rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              <p className="text-xs font-bold mb-3 tracking-wide" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>
                \u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u062d\u0627\u0644\u0627\u062a
              </p>
              <div className="space-y-2">
                {counts.map(s => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: \`rgba(\${s.rgb},0.9)\`, boxShadow: \`0 0 6px rgba(\${s.rgb},0.6)\` }} />
                    <span className="flex-1 text-xs font-medium text-right" style={{ color: "rgba(255,255,255,0.75)" }}>
                      {s.label}
                    </span>
                    <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: \`\${s.pct}%\`,
                          background: \`linear-gradient(90deg, rgba(\${s.rgb},0.9), rgba(\${s.rgb},0.5))\`,
                          boxShadow: \`0 0 6px rgba(\${s.rgb},0.4)\`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold w-9 text-left" style={{ color: \`rgba(\${s.rgb},0.9)\` }}>
                      {s.pct}%
                    </span>
                    <span
                      className="text-xs font-black w-7 text-center rounded-md py-0.5"
                      style={{
                        color: \`rgba(\${s.rgb},1)\`,
                        background: \`rgba(\${s.rgb},0.12)\`,
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      `;

if (!code.includes("\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u062d\u0627\u0644\u0627\u062a")) {
  if (!code.includes(MARKER)) {
    console.log("MARKER NOT FOUND");
    const idx = code.indexOf("return (");
    if (idx !== -1) {
      console.log("return found at:", idx);
      console.log(code.substring(idx, idx + 400));
    }
  } else {
    code = code.replace(MARKER, STATS_SECTION + MARKER);
    fs.writeFileSync(ordersPath, code, "utf8");
    console.log("SUCCESS");
  }
} else {
  console.log("Already patched");
}
