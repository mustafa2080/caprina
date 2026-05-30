#!/bin/bash
set -e

echo "[1/5] Pulling latest from GitHub..."
cd /root/caprina
git reset --hard HEAD
git clean -fd artifacts/caprina/dist/public/assets/
git pull

echo "[2/5] Building API Server..."
cd /root/caprina/artifacts/api-server
node build.mjs

echo "[3/5] Building Frontend..."
cd /root/caprina/artifacts/caprina
pnpm run build

echo "[4/5] Setting permissions..."
chmod -R 755 /root/caprina/artifacts/caprina/dist/public

echo "[5/5] Restarting API Server..."
pm2 restart caprina-api

echo "Done! Deploy successful."
pm2 status
