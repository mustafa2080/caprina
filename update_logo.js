const fs = require('fs');
const path = require('path');

// Read new logo and convert to base64
const logoPath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\dist\\public\\first_logo.jpg";
const libPath = "C:\\Users\\musta\\Desktop\\pro\\Caprina-Orders \u0627\u0644\u0627\u0635\u062f\u0627\u0624 \u0627\u0644\u0627\u062e\u064a\u0631_2\\Caprina-Orders\\artifacts\\caprina\\src\\lib\\first-logo.ts";

// Try jpg first, then png
let imgPath = logoPath;
let mimeType = 'image/jpeg';

if (!fs.existsSync(logoPath)) {
  const pngPath = logoPath.replace('.jpg', '.png');
  if (fs.existsSync(pngPath)) {
    imgPath = pngPath;
    mimeType = 'image/png';
  } else {
    // list what's in the folder
    const dir = path.dirname(logoPath);
    console.log('Files in dir:', fs.readdirSync(dir).filter(f => f.includes('logo') || f.includes('first')));
    process.exit(1);
  }
}

const imgBuffer = fs.readFileSync(imgPath);
const base64 = imgBuffer.toString('base64');
const dataUrl = `data:${mimeType};base64,${base64}`;

const tsContent = `// Auto-generated — do not edit manually\nexport const firstLogoBase64 = "${dataUrl}";\n`;
fs.writeFileSync(libPath, tsContent, 'utf8');

console.log('SUCCESS');
console.log('Image size:', Math.round(imgBuffer.length / 1024) + ' KB');
console.log('Mime:', mimeType);
