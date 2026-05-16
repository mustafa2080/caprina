const { execSync } = require('child_process');
const dir = __dirname;
function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
    if (out.trim()) console.log(out.trim());
  } catch(e) {
    const msg = (e.stdout || '') + (e.stderr || '') + e.message;
    console.error('ERR:', msg.trim());
  }
}
console.log('=== status ==='); run('git status --short');
run('git add artifacts/caprina/src/pages/finance-purchases.tsx');
run('git commit -m "feat: column filters in purchase orders table header"');
run('git push');
console.log('=== done ==='); run('git log --oneline -2');
