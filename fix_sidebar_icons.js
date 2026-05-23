const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. تكبير أيقونة NavGroup header
content = content.replace(/width: "38px",/g, 'width: "42px",');
content = content.replace(/height: "38px",/g, 'height: "42px",');
content = content.replace(/borderRadius: "11px",/g, 'borderRadius: "13px",');

// 2. تكبير الأيقونة الداخلية في NavGroup
content = content.replace(/width: isActive \? "19px" : "17px"/g, 'width: isActive ? "22px" : "20px"');
content = content.replace(/height: isActive \? "19px" : "17px"/g, 'height: isActive ? "22px" : "20px"');

// 3. تكبير الاسم في NavGroup
content = content.replace(/fontSize: "12px", letterSpacing: "0.01em"/g, 'fontSize: "13.5px", letterSpacing: "0.01em"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done! Icons and labels resized.');
