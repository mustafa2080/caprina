import { readFileSync } from 'fs';
import { SourceMapConsumer } from 'source-map';

// dashboard-COMKYYkM.js:1:40430
const mapFile = './dist/public/assets/dashboard-COMKYYkM.js.map';
const map = JSON.parse(readFileSync(mapFile, 'utf8'));

const consumer = await new SourceMapConsumer(map);
const pos = consumer.originalPositionFor({ line: 1, column: 40430 });
console.log('=== Position 40430 ===');
console.log(pos);

// Also try nearby columns
for (let col of [40416, 40420, 40425, 40430, 40435, 40440]) {
  const p = consumer.originalPositionFor({ line: 1, column: col });
  if (p.source) console.log(`col ${col}:`, p);
}

consumer.destroy();
