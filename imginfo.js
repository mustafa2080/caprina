const fs = require('fs');
const buf = fs.readFileSync('artifacts/caprina/dist/public/first_logo.jpg');
console.log('Size KB:', Math.round(buf.length / 1024));

// Read JPEG dimensions from header
const w = buf.readUInt16BE(buf.indexOf(Buffer.from([0xFF, 0xC0])) + 5 + 2);
const h = buf.readUInt16BE(buf.indexOf(Buffer.from([0xFF, 0xC0])) + 5);
console.log('Dimensions: ' + w + 'x' + h);
