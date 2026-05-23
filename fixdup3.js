const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Remove lines 130 and 131 (0-indexed: 130, 131) = the duplicate openGroup + handleGroupToggle
// Line 130 (index 130): "  const [openGroup, setOpenGroup] = useState<string | null>(null);"
// Line 131 (index 131): "  const handleGroupToggle = ..."
const l130 = lines[130] || '';
const l131 = lines[131] || '';
console.log('Line 130:', JSON.stringify(l130));
console.log('Line 131:', JSON.stringify(l131));

if (l130.includes('openGroup') && l130.includes('useState') && l131.includes('handleGroupToggle')) {
  lines.splice(130, 2);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('SUCCESS - removed 2 duplicate lines');
} else {
  console.log('Lines not as expected');
}
