const { execSync } = require('child_process');
const base = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders';

function run(cmd, cwd) {
  try { return execSync(cmd, { cwd: cwd || base, encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch(e) { return (e.stdout || '') + (e.stderr || ''); }
}

console.log('Building...');
const build = run('node ./build.mjs 2>&1', base + '/artifacts/api-server');
const last = build.split('\n').slice(-4).join('\n');
console.log(last);
if (!build.includes('Done')) { console.log('BUILD FAILED'); process.exit(1); }

console.log('\nCommit & push...');
console.log(run('git add artifacts/api-server/src/routes/analytics.ts', base));
console.log(run('git commit -m "fix: correctly place productImageMap inside smart-insights route"', base));
console.log(run('git push', base));
console.log('\n✅ Done!');
