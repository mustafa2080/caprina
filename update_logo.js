const fs = require('fs');
const imgPath = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/public/first_logo.jpg';
const outPath = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/lib/first-logo.ts';
const data = fs.readFileSync(imgPath);
const b64 = data.toString('base64');
const out = `export const firstLogoBase64 = "data:image/jpeg;base64,${b64}";`;
fs.writeFileSync(outPath, out);
console.log('Done! size:', out.length, 'chars');
