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

console.log('=== git status ===');
run('git status --short');

console.log('\n=== git add ===');
run('git add -A');

console.log('\n=== git status after add ===');
run('git status --short');

console.log('\n=== git commit ===');
run('git commit -m "fix: isDefault DB schema, purchasesTable import, auto-migration, P&L returnLoss, shipping invoices cache keys"');

console.log('\n=== git push ===');
run('git push');

console.log('\n=== git log last 3 ===');
run('git log --oneline -3');
