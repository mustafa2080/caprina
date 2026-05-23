const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

const oldStr = `              <BrandFull
                logoSize="md"
                layout="row"
                nameClass="text-base font-extrabold text-sidebar-foreground tracking-wide"
                taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
              />`;

const newStr = `              <BrandFull
                logoSize="md"
                layout="row"
                nameClass="text-base font-black tracking-[0.2em] uppercase"
                nameStyle={{
                  background: "linear-gradient(135deg, hsl(var(--primary)) 0%, #fff 50%, hsl(var(--primary)) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 8px hsl(var(--primary)/0.8))",
                }}
                taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
              />`;

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
    console.log('NOT FOUND - checking BrandFull props...');
    // show surrounding lines
    const idx = c.indexOf('BrandFull');
    if (idx > -1) console.log(c.substring(idx-50, idx+300));
  }
}
