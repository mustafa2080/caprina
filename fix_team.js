const fs = require('fs');
const p = 'C:/Users/musta/Desktop/pro/Caprina-Orders/Caprina-Orders/artifacts/caprina/src/pages/team.tsx';
let c = fs.readFileSync(p, 'utf8');
const lines = c.split('\n');

// Fix line 2842 (index 2841)
lines[2841] = '                      <div className={`absolute top-0 h-3 rounded-full ${isOT ? "bg-blue-500" : willReach ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(sc, 100)}%` }} />';

// Fix line 2847 (index 2846)
lines[2846] = '                      <span className={`font-bold ${velocity >= 0 ? "text-emerald-500" : "text-red-500"}`}>{velocity >= 0 ? "+" : ""}{velocity}%</span>';

fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('Fixed!');
