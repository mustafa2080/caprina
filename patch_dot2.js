const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

const dot = `
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 8px rgba(52,211,153,0.9)"}}>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.75}} />
                    </span>`;

// ── مكان 1: desktop sidebar كبير (السطر ~272) ──
const old1 = `              {/* Avatar */}
              {(user as any)?.avatar ? (
                <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-primary/30" alt={user?.displayName} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                  {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}`;

const new1 = `              {/* Avatar */}
              <div className="relative shrink-0">
                {(user as any)?.avatar ? (
                  <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)/0.8),hsl(var(--primary)/0.4))", color: "hsl(var(--primary-foreground))", border: "2px solid hsl(var(--primary)/0.3)" }}>
                    {user?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                )}${dot}
              </div>`;

// ── مكان 2: desktop sidebar صغير/collapsed (السطر ~396) ──
const old2 = `              {(user as any)?.avatar ? (
                <img src={(user as any).avatar} className="w-7 h-7 rounded-full object-cover shrink-0 border-2 border-primary/30" alt={user?.displayName} />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {user?.displayName?.charAt(0) ?? "?"}
                </div>
              )}`;

const new2 = `              <div className="relative shrink-0">
                {(user as any)?.avatar ? (
                  <img src={(user as any).avatar} className="w-7 h-7 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    {user?.displayName?.charAt(0) ?? "?"}
                  </div>
                )}${dot}
              </div>`;

let count = 0;

[old1, old2].forEach((old, i) => {
  const oldCRLF = old.replace(/\n/g, '\r\n');
  const newVal = i === 0 ? new1 : new2;
  if (c.includes(old)) { c = c.replace(old, newVal); count++; console.log(`Place ${i+1}: replaced LF`); }
  else if (c.includes(oldCRLF)) { c = c.replace(oldCRLF, newVal); count++; console.log(`Place ${i+1}: replaced CRLF`); }
  else console.log(`Place ${i+1}: NOT FOUND`);
});

fs.writeFileSync(path, c, 'utf8');
console.log(`Done. ${count} replacements.`);
