#!/bin/bash
# ─── Caprina Deploy Script ───────────────────────────────────────────────────
# الاستخدام: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e  # وقّف لو في error

echo "🚀 [1/4] جلب آخر تحديثات من GitHub..."
cd /root/caprina
git pull

echo "📦 [2/4] بناء الـ Frontend..."
cd /root/caprina/artifacts/caprina
PORT=3000 BASE_PATH="/" pnpm run build
# الـ build بيتخزن مباشرة في dist/public اللي هو الـ DocumentRoot في caprina.conf

echo "📂 [3/4] التأكد من صلاحيات الـ build directory..."
chmod -R 755 /root/caprina/artifacts/caprina/dist/public

echo "🔄 [4/4] restart الـ API Server..."
pm2 restart caprina-api --update-env

echo "✅ تم النشر بنجاح!"
pm2 status
