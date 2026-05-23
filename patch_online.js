const fs = require('fs');
const path = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/layout.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `                <div className="flex items-center gap-2 px-1 py-1">
                  {(user as any)?.avatar ? (
                    <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-primary/30" alt={user?.displayName} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {user?.displayName?.charAt(0) ?? "?"}
                    </div>
                  )}`;

const newStr = `                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="relative shrink-0">
                    {(user as any)?.avatar ? (
                      <img src={(user as any).avatar} className="w-8 h-8 rounded-full object-cover border-2 border-primary/30" alt={user?.displayName} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                        {user?.displayName?.charAt(0) ?? "?"}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sidebar">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    </span>
                  </div>`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done!');
} else {
  console.log('NOT FOUND - trying normalize...');
  // try with \r\n
  const oldCRLF = oldStr.replace(/\n/g, '\r\n');
  if (content.includes(oldCRLF)) {
    content = content.replace(oldCRLF, newStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done with CRLF!');
  } else {
    console.log('STILL NOT FOUND');
    // show what's around line 600
    const lines = content.split('\n');
    lines.slice(595, 615).forEach((l,i) => console.log(595+i+':', JSON.stringify(l)));
  }
}
