const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let c = fs.readFileSync(path, 'utf8');

// نشيل nameStyle اللي أضفناه (مش مدعوم) ونرجع nameClass فقط بس بستايل CSS
const oldStr = `              <BrandFull
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

// نستخدم CSS class مخصصة + نضيف style tag في نفس الجزء
const newStr = `              <div className="brand-name-glow">
                <BrandFull
                  logoSize="md"
                  layout="row"
                  nameClass="text-base font-black tracking-[0.2em] uppercase brand-name-text"
                  taglineClass="text-[0px] opacity-0 h-0 overflow-hidden"
                />
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
