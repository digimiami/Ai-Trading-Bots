#!/bin/bash

# Fix Vite Permissions and PM2 Configuration
# This script fixes permission issues with vite and ensures PM2 can run it properly

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"

echo "🔧 Fixing Vite Permissions and PM2 Configuration..."
echo "=================================================="
echo ""

# Navigate to project directory
cd "$PROJECT_ROOT" || {
    echo "❌ Failed to navigate to $PROJECT_ROOT"
    exit 1
}

echo "📂 Current directory: $(pwd)"
echo ""

# Fix permissions for node_modules/.bin
echo "🔧 Fixing permissions for node_modules/.bin..."
if [ -d "node_modules/.bin" ]; then
    chmod +x node_modules/.bin/*
    echo "✅ Fixed permissions for node_modules/.bin"
else
    echo "⚠️  node_modules/.bin not found"
fi
echo ""

# Specifically fix vite permissions
echo "🔧 Fixing vite permissions..."
if [ -f "node_modules/.bin/vite" ]; then
    chmod +x node_modules/.bin/vite
    echo "✅ Fixed vite permissions"
    ls -la node_modules/.bin/vite
else
    echo "⚠️  vite binary not found in node_modules/.bin"
    echo "   Reinstalling dependencies..."
    npm install
    chmod +x node_modules/.bin/vite
    echo "✅ Reinstalled and fixed vite permissions"
fi
echo ""

# Test if vite works
echo "🧪 Testing vite command..."
if npx vite --version > /dev/null 2>&1; then
    echo "✅ vite command works via npx"
else
    echo "❌ vite command failed"
    exit 1
fi
echo ""

# Restart PM2 apps
echo "🔄 Restarting PM2 apps..."
pm2 restart all --update-env
echo "✅ PM2 apps restarted"
echo ""

# Show PM2 status
echo "📊 PM2 Status:"
pm2 list
echo ""

# Show recent logs
echo "📋 Recent pablobots logs (last 5 lines):"
pm2 logs pablobots --lines 5 --nostream
echo ""

echo "✅ Fix complete!"
echo ""
echo "🔍 If issues persist, check:"
echo "   pm2 logs pablobots"
echo "   pm2 logs pablobots --err"
echo ""

