#!/bin/bash

# Fix port conflict and restart PM2 properly
# Run this on your VPS

echo "🔧 Fixing Port Conflict and Restarting PM2..."
echo "=============================================="
echo ""

cd /var/www/Ai-Trading-Bots

# 1. Stop PM2 process
echo "1️⃣ Stopping PM2 process..."
pm2 stop pablobots
pm2 delete pablobots

# 2. Check what's using port 4173
echo ""
echo "2️⃣ Checking what's using port 4173..."
lsof -i :4173 || netstat -tlnp | grep 4173 || ss -tlnp | grep 4173 || echo "No process found on port 4173"

# 3. Kill any process on port 4173
echo ""
echo "3️⃣ Killing any process on port 4173..."
fuser -k 4173/tcp 2>/dev/null || pkill -f "vite preview.*4173" || echo "No process to kill"

# 4. Wait a moment
sleep 2

# 5. Fix vite permissions (just in case)
echo ""
echo "4️⃣ Fixing vite permissions..."
chmod +x node_modules/.bin/vite
chmod +x node_modules/.bin/*

# 6. Restart PM2 with ecosystem config
echo ""
echo "5️⃣ Starting PM2 with ecosystem config..."
pm2 start ecosystem.config.cjs --only pablobots
pm2 save

# 7. Wait a moment for it to start
sleep 3

# 8. Check status
echo ""
echo "6️⃣ Checking PM2 status..."
pm2 list

# 9. Check logs
echo ""
echo "7️⃣ Checking PM2 logs..."
pm2 logs pablobots --lines 10 --nostream

# 10. Check if port is listening
echo ""
echo "8️⃣ Checking if port 4173 is listening..."
netstat -tlnp | grep 4173 || ss -tlnp | grep 4173 || echo "⚠️ Port 4173 is NOT listening"

# 11. Test local connection
echo ""
echo "9️⃣ Testing local connection..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:4173 || echo "❌ Local connection failed"

echo ""
echo "✅ Done! Check the output above."

