#!/bin/bash
# ─── Caprina Deploy Script ───────────────────────────────────────────────────
set -e

echo "🚀 [1/4] جلب آخر تحديثات من GitHub..."
cd /root/caprina
git reset --hard HEAD
git clean -fd artifacts/caprina/dist/public/assets/
git pull

echo "🔧 [2/4] بناء الـ API Server..."
cd /root/caprina/artifacts/api-server
node build.mjs

echo "📂 [3/4] التأكد من صلاحيات الـ build directory..."
chmod -R 755 /root/caprina/artifacts/caprina/dist/public

echo "🔄 [4/4] restart الـ API Server..."
pm2 restart caprina-api --update-env

echo "✅ تم النشر بنجاح!"
pm2 status
