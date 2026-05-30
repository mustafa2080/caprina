#!/bin/bash
# â”€â”€â”€ Caprina Deploy Script â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
set -e

echo "ًںڑ€ [1/5] ط¬ظ„ط¨ ط¢ط®ط± طھط­ط¯ظٹط«ط§طھ ظ…ظ† GitHub..."
cd /root/caprina
git reset --hard HEAD
git clean -fd artifacts/caprina/dist/public/assets/
git pull

echo "ًں”§ [2/5] ط¨ظ†ط§ط، ط§ظ„ظ€ API Server..."
cd /root/caprina/artifacts/api-server
node build.mjs

echo "ًںژ¨ [3/5] ط¨ظ†ط§ط، ط§ظ„ظ€ Frontend..."
cd /root/caprina/artifacts/caprina
pnpm run build

echo "ًں“‚ [4/5] ط§ظ„طھط£ظƒط¯ ظ…ظ† طµظ„ط§ط­ظٹط§طھ ط§ظ„ظ€ build directory..."
chmod -R 755 /root/caprina/artifacts/caprina/dist/public

echo "ًں”„ [5/5] restart ط§ظ„ظ€ API Server..."
pm2 restart caprina-api --update-env

echo "âœ… طھظ… ط§ظ„ظ†ط´ط± ط¨ظ†ط¬ط§ط­!"
pm2 status
