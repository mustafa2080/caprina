const fs = require('fs');

const filePath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\components\\layout.tsx";
let content = fs.readFileSync(filePath, 'utf8');

// Remove the duplicate lines added by previous accordion.js script
const dup1 = `\r\n  const [openGroup, setOpenGroup] = useState<string | null>(null);\r\n  const handleGroupToggle = (key: string) => setOpenGroup(key || null);`;
if (content.includes(dup1)) {
  content = content.replace(dup1, '');
  console.log('Removed duplicate');
} else {
  console.log('Duplicate not found with CRLF, trying LF');
  const dup2 = `\n  const [openGroup, setOpenGroup] = useState<string | null>(null);\n  const handleGroupToggle = (key: string) => setOpenGroup(key || null);`;
  if (content.includes(dup2)) {
    content = content.replace(dup2, '');
    console.log('Removed duplicate (LF)');
  } else {
    // show lines 127-135
    const lines = content.split('\n');
    console.log('Lines 127-135:');
    lines.slice(126, 135).forEach((l, i) => console.log(i+127, JSON.stringify(l)));
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('DONE');
