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
console.log('=== Building ===');
run('pnpm --filter caprina build');
console.log('=== Git push ===');
run('git add -A artifacts/caprina/dist/');
run('git add artifacts/caprina/src/pages/orders.tsx');
run('git commit -m "feat: orders stats card with golden gradient and status breakdown"');
run('git push');
console.log('=== done ===');
run('git log --oneline -3');
