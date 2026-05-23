const fs = require('fs');
const path = require('path');

// Use relative path from script location
const filePath = path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the duplicate two lines
const dupCRLF = "  const [openGroup, setOpenGroup] = useState<string | null>(null);\r\n  const handleGroupToggle = (key: string) => setOpenGroup(key || null);\r\n";
const dupLF   = "  const [openGroup, setOpenGroup] = useState<string | null>(null);\n  const handleGroupToggle = (key: string) => setOpenGroup(key || null);\n";

if (content.includes(dupCRLF)) {
  content = content.replace(dupCRLF, '');
  console.log('Removed CRLF duplicate');
} else if (content.includes(dupLF)) {
  content = content.replace(dupLF, '');
  console.log('Removed LF duplicate');
} else {
  // try without trailing newline
  const dup2 = "  const [openGroup, setOpenGroup] = useState<string | null>(null);\r\n  const handleGroupToggle = (key: string) => setOpenGroup(key || null);";
  if (content.includes(dup2)) {
    content = content.replace(dup2, '');
    console.log('Removed no-trailing-newline duplicate');
  } else {
    console.log('Not found - showing lines');
    content.split('\n').slice(126,136).forEach((l,i)=>console.log(i+127,JSON.stringify(l)));
    process.exit(1);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('DONE');
