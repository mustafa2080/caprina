const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

const oldStr = `              <div className="brand-name-glow flex flex-col items-start gap-0">
                <BrandFull
                  logoSize="md"
                  layout="row"
                  nameClass="text-base font-black tracking-[0.2em] uppercase brand-name-text"
                  taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
                />
                {/* خط ذهبي تحت الاسم */}
                <span className="block h-[2px] w-full rounded-full mt-0.5" style={{
                  background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 30%, #fff 50%, hsl(var(--primary)) 70%, transparent 100%)",
                  boxShadow: "0 0 6px hsl(var(--primary)/0.8), 0 0 12px hsl(var(--primary)/0.4)",
                }} />
                <style>{".brand-name-text{background:linear-gradient(135deg,hsl(var(--primary)) 0%,#fff 50%,hsl(var(--primary)) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 8px hsl(var(--primary)/0.8))}"}</style>
              </div>`;

const newStr = `              <div className="brand-name-glow flex flex-col items-center gap-0">
                <BrandFull
                  logoSize="md"
                  layout="row"
                  nameClass="text-base font-black tracking-[0.2em] uppercase brand-name-text"
                  taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
                />
                {/* خط ذهبي تحت الاسم بنفس عرض الكلمة */}
                <span className="block h-[2px] rounded-full" style={{
                  width: "fit-content",
                  minWidth: "5rem",
                  maxWidth: "100%",
                  alignSelf: "center",
                  marginTop: "2px",
                  marginRight: "2.5rem",
                  background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 20%, #fff 50%, hsl(var(--primary)) 80%, transparent 100%)",
                  boxShadow: "0 0 6px hsl(var(--primary)/0.9), 0 0 14px hsl(var(--primary)/0.5)",
                  display: "block",
                  width: "5.5rem",
                }} />
                <style>{".brand-name-text{background:linear-gradient(135deg,hsl(var(--primary)) 0%,#fff 50%,hsl(var(--primary)) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 8px hsl(var(--primary)/0.8))}"}</style>
              </div>`;

if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync(path, c, 'utf8');
  console.log('Done LF!');
} else {
  const oldCRLF = oldStr.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, newStr);
    fs.writeFileSync(path, c, 'utf8');
    console.log('Done CRLF!');
  } else {
    console.log('NOT FOUND');
  }
}
