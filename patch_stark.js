const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

const oldStr = `            {/* ── Theme Toggle — في النص محاذي مع اللوجو ── */}`;

const newStr = `            {/* ── Company Name — في النص ── */}
            <div className="relative z-10 flex flex-col items-center justify-center select-none">
              <span
                className="text-sm font-black tracking-[0.25em] uppercase"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, #fff 50%, hsl(var(--primary)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.8))",
                  letterSpacing: "0.25em",
                }}
              >
                STARK
              </span>
              <span className="block h-px w-full mt-0.5" style={{background:"linear-gradient(90deg,transparent,hsl(var(--primary)/0.8),transparent)"}} />
            </div>

            {/* ── Theme Toggle — في النص محاذي مع اللوجو ── */}`;

const oldCRLF = oldStr.replace(/\n/g, '\r\n');
if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync(path, c, 'utf8');
  console.log('Done LF!');
} else if (c.includes(oldCRLF)) {
  c = c.replace(oldCRLF, newStr);
  fs.writeFileSync(path, c, 'utf8');
  console.log('Done CRLF!');
} else {
  console.log('NOT FOUND');
}
