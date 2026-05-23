const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";

let content = fs.readFileSync(filePath, 'utf8');

// find and show what's actually there
const idx = content.indexOf('First Logo');
if (idx === -1) {
  console.log('ERROR: First Logo not found');
  process.exit(1);
}

const snippet = content.substring(idx - 20, idx + 600);
console.log('=== CURRENT BLOCK ===');
console.log(JSON.stringify(snippet));
