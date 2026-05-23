const fs = require('fs');
const base = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders';
const uiPath = base + '/artifacts/caprina/src/pages/smart-analytics.tsx';
let ui = fs.readFileSync(uiPath, 'utf8');

// Dead Stock: استبدل div الأيقونة بـ regex يتجاهل \r\n
ui = ui.replace(
  /<div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900\/30">\r?\n\s*<Archive className="w-3\.5 h-3\.5 text-amber-600 dark:text-amber-400" \/>\r?\n\s*<\/div>/,
  `<div className="relative shrink-0">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/60" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                    <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                )}
              </div>`
);

fs.writeFileSync(uiPath, ui, 'utf8');
const after = fs.readFileSync(uiPath, 'utf8');
const deadOk = after.includes('border-amber-500/60');
console.log('Dead stock section:', deadOk ? '✅' : '❌');
