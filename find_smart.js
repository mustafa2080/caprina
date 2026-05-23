import fs from 'fs';
import path from 'path';

const base = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders';

// Read openapi.yaml and find SmartProduct schema
const yaml = fs.readFileSync(path.join(base, 'lib/api-spec/openapi.yaml'), 'utf8');
const lines = yaml.split('\n');
lines.forEach((l, i) => {
  if (l.includes('SmartProduct') || l.includes('DeadStock') || l.includes('smart') && l.includes('image')) {
    console.log(i+1, l);
  }
});
