const fs = require('fs');
const path = require('path');
const c = fs.readFileSync(path.join(__dirname, 'artifacts', 'caprina', 'src', 'components', 'layout.tsx'), 'utf8');
const lines = c.split('\n');
// Show all NavGroup occurrences
lines.forEach((l, i) => {
  if (l.includes('NavGroup')) console.log(i + 1, JSON.stringify(l.trim().substring(0, 120)));
});
