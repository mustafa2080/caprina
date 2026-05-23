const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";

let content = fs.readFileSync(filePath, 'utf8');

const oldVal = 'width: "85%"';
const newVal = 'width: "100%"';

if (content.includes(oldVal)) {
  content = content.replace(oldVal, newVal);
  // also remove padding to let it fill edge to edge
  content = content.replace('padding: "10px 8px"', 'padding: "0px"');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS');
} else {
  console.log('NOT FOUND');
}
