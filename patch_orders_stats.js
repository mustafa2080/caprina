const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "artifacts/caprina/src/components/layout.tsx");
// مش orders — دي layout. الصح هو orders
const ordersPath = path.join(__dirname, "artifacts/caprina/src/pages/orders.tsx");
let code = fs.readFileSync(ordersPath, "utf8");

// ── الـ marker اللي هنحط بعده سيكشن الإحصائيات ────────────────
const MARKER = `      <Card className="border-border overflow-hidden">`;

const STATS_SECTION = `      {/* ── إحصائيات الطلبات ── */}
      {!isLoading && orders && (() => {
        const total = orders.length;
        const statusData = [
          { key: "warehouse_ready",  label: "قيد الشحن في المخزن", rgb: "45,212,191"  },
          { key: "received",         label: "فسلّم",                rgb: "52,211,153"  },
          { key: "pending",          label: "قيد الانتظار",         rgb: "251,191,36"  },
          { key: "returned",         label: "مرتجع",                rgb: "248,113,113" },
          { key: "in_shipping",      label: "قيد الشحن",            rgb: "56,189,248"  },
          { key: "partial_received", label: "استلم جزئي",           rgb: "34,211,238"  },
        ];
        const counts = statusData.map(s => ({
          ...s,
          count: orders.filter(o => o.status === s.key).length,
          pct: total > 0 ? Math.round(orders.filter(o => o.status === s.key).length / total * 100) : 0,
        })).filter(s => s.count > 0);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* كارد إجمالي الطلبات — تدرج ذهبي */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between"
              style={{
                background: "linear-gradient(145deg, rgba(251,191,36,0.22) 0%, rgba(251,146,60,0.14) 50%, rgba(251,191,36,0.06) 100%)",
                border: "1px solid rgba(251,191,36,0.35)",
                boxShadow: "0 8px 32px rgba(251,191,36,0.15), 0 2px 8px rgba(251,146,60,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
                minHeight: "140px",
              }}
            >
              {/* دوائر زخرفية خلفية */}
              <span className="absolute -top-6 -left-6 w-28 h-28 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, rgba(251,191,36,1) 0%, transparent 70%)" }} />
              <span className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10"
                style={{ background: "radial-gradient(circle, rgba(251,146,60,1) 0%, transparent 70%)" }} />

              <p className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: "rgba(251,191,36,0.75)", letterSpacing: "0.12em" }}>
                طلبيات الأسبوع
              </p>
              <div className="mt-2">
                <span className="text-5xl font-black" style={{ color: "rgba(251,191,36,1)", lineHeight: 1 }}>
                  {total}
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: "rgba(251,191,36,0.5)" }}>إجمالي الطلبات</p>
            </div>

            {/* قائمة حالات الطلبات */}
            <div
              className="lg:col-span-2 rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              <p className="text-xs font-bold mb-3 tracking-wide" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>
                توزيع الحالات
              </p>
              <div className="space-y-2">
                {counts.map(s => (
                  <div key={s.key} className="flex items-center gap-3">
                    {/* نقطة ملونة */}
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: \`rgba(\${s.rgb},0.9)\`, boxShadow: \`0 0 6px rgba(\${s.rgb},0.6)\` }} />

                    {/* اسم الحالة */}
                    <span className="flex-1 text-xs font-medium text-right" style={{ color: "rgba(255,255,255,0.75)" }}>
                      {s.label}
                    </span>

                    {/* شريط التقدم */}
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

                    {/* نسبة */}
                    <span className="text-xs font-bold w-9 text-left" style={{ color: \`rgba(\${s.rgb},0.9)\` }}>
                      {s.pct}%
                    </span>

                    {/* عدد */}
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

if (!code.includes("توزيع الحالات")) {
  code = code.replace(MARKER, STATS_SECTION + MARKER);
  fs.writeFileSync(ordersPath, code, "utf8");
  console.log("SUCCESS - Stats section added to orders page");
} else {
  console.log("Already patched");
}
