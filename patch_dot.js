const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    </span>`;

const newStr = `                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#111] z-10" style={{boxShadow:"0 0 6px rgba(52,211,153,0.8)"}}>
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" style={{opacity:0.7}} />
                    </span>`;

const oldCRLF = oldStr.replace(/\n/g, '\r\n');

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done LF!');
} else if (content.includes(oldCRLF)) {
  content = content.replace(oldCRLF, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done CRLF!');
} else {
  console.log('NOT FOUND');
}
