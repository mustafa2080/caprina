const { execSync } = require('child_process');

const dir = __dirname;

try {
  const status = execSync('git status --short', { cwd: dir, encoding: 'utf8' });
  console.log('=== Changed Files ===');
  console.log(status || '(nothing changed)');
} catch(e) {
  console.error(e.message);
}
