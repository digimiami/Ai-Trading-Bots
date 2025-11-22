#!/bin/bash

# Quick fix for vite permission denied error

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"

echo "🔧 Quick fix for vite permission issues..."
echo "=========================================="
echo ""

cd "$PROJECT_ROOT" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ node_modules exists"
fi

# Fix permissions for vite binary
if [ -f "node_modules/.bin/vite" ]; then
    chmod +x node_modules/.bin/vite
    echo "✅ Fixed vite permissions"
else
    echo "⚠️  vite binary not found. Reinstalling..."
    npm install vite --save-dev
    chmod +x node_modules/.bin/vite
    echo "✅ vite reinstalled and permissions fixed"
fi

# Fix all node_modules/.bin permissions
if [ -d "node_modules/.bin" ]; then
    chmod +x node_modules/.bin/*
    echo "✅ Fixed all node_modules/.bin permissions"
fi

# Verify vite works
echo ""
echo "🧪 Testing vite..."
if node_modules/.bin/vite --version; then
    echo "✅ vite is working!"
else
    echo "❌ vite still not working. Try: npm install"
    exit 1
fi

echo ""
echo "✅ Quick fix complete!"
echo ""
echo "🚀 Now restart PM2:"
echo "   pm2 restart all --update-env"

