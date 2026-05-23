
const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "artifacts/caprina/src/pages/product-performance.tsx");
let code = fs.readFileSync(filePath, "utf8");

const OLD = `                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isLosing
                          ? <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                          : <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                        }
                        <span className="font-semibold text-foreground">{p.name}</span>
                      </div>
                    </td>`;

const NEW = `                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {/* \u0635\u0648\u0631\u0629 \u062f\u0627\u0626\u0631\u064a\u0629 */}
                        {p.image ? (
                          <img src={p.image} alt={p.name}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border"
                            style={{ borderColor: isLosing ? "rgba(248,113,113,0.35)" : "rgba(var(--primary),0.35)" }} />
                        ) : (
                          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black"
                            style={{
                              background: isLosing ? "rgba(248,113,113,0.15)" : "rgba(var(--primary),0.12)",
                              border: isLosing ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(var(--primary),0.25)",
                              color: isLosing ? "rgba(248,113,113,0.9)" : "rgba(var(--primary),0.9)",
                            }}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isLosing
                          ? <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                          : <TrendingUp className="w-3 h-3 text-primary shrink-0" />
                        }
                        <span className="font-semibold text-foreground">{p.name}</span>
                      </div>
                    </td>`;

if (code.includes(OLD)) {
  code = code.replace(OLD, NEW);
  fs.writeFileSync(filePath, code, "utf8");
  console.log("SUCCESS");
} else {
  console.log("NOT FOUND - showing context:");
  const idx = code.indexOf('px-4 py-2.5">');
  console.log(code.substring(idx - 50, idx + 300));
}
