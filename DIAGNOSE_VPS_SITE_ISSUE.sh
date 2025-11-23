#!/bin/bash

# Quick diagnostic script for VPS site issues
# Run this on your VPS server

echo "🔍 Diagnosing VPS Site Issue..."
echo "================================"
echo ""

echo "1️⃣ PM2 Status:"
pm2 list
echo ""

echo "2️⃣ PM2 Logs (last 30 lines):"
pm2 logs pablobots --lines 30 --nostream
echo ""

echo "3️⃣ PM2 Error Logs:"
pm2 logs pablobots --err --lines 20 --nostream
echo ""

echo "4️⃣ Check if port 4173 is listening:"
netstat -tlnp | grep 4173 || ss -tlnp | grep 4173 || echo "❌ Port 4173 is NOT listening"
echo ""

echo "5️⃣ Check if process is actually running:"
ps aux | grep -E "(vite|node|pablobots)" | grep -v grep
echo ""

echo "6️⃣ Test local connection:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:4173 || echo "❌ Local connection failed"
echo ""

echo "7️⃣ Check firewall:"
ufw status | grep 4173 || echo "⚠️ Port 4173 not in firewall rules"
echo ""

echo "8️⃣ Check disk space:"
df -h | head -2
echo ""

echo "9️⃣ Check memory:"
free -h
echo ""

echo "✅ Diagnostic complete!"

