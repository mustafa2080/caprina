import { readFileSync } from 'fs';

const mapFile = './dist/public/assets/dashboard-COMKYYkM.js.map';
const raw = readFileSync(mapFile, 'utf8');
const map = JSON.parse(raw);

// VLQ decoder
function decodeVLQ(str) {
  const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const results = [];
  let i = 0;
  while (i < str.length) {
    let value = 0, shift = 0, digit;
    do {
      digit = BASE64.indexOf(str[i++]);
      value |= (digit & 0x1f) << shift;
      shift += 5;
    } while (digit & 0x32);
    const negate = value & 1;
    value >>= 1;
    results.push(negate ? -value : value);
  }
  return results;
}

// Parse mappings to find column 40430 in line 1
const groups = map.mappings.split(';');
const line0 = groups[0]; // line 1 (0-indexed)
const segments = line0.split(',');

let genCol = 0, srcIdx = 0, srcLine = 0, srcCol = 0;
let closest = null, closestDist = Infinity;

for (const seg of segments) {
  if (!seg) continue;
  try {
    const fields = decodeVLQ(seg);
    genCol += fields[0] || 0;
    if (fields.length >= 4) {
      srcIdx += fields[1] || 0;
      srcLine += fields[2] || 0;
      srcCol += fields[3] || 0;
    }
    const dist = Math.abs(genCol - 40430);
    if (dist < closestDist) {
      closestDist = dist;
      closest = { genCol, srcFile: map.sources[srcIdx], srcLine: srcLine + 1, srcCol: srcCol + 1 };
    }
    if (genCol > 40500) break;
  } catch(e) {}
}

console.log('Closest mapping to col 40430:');
console.log(closest);
