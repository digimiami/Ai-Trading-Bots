#!/bin/bash

# Verify deployment status

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"

echo "🔍 Verifying deployment status..."
echo "=================================="
echo ""

cd "$PROJECT_ROOT" || exit 1

# Check if dist folder exists
echo "📂 Checking dist folder..."
if [ -d "dist" ]; then
    echo "✅ dist folder exists"
    echo "   Files: $(ls -1 dist/ | wc -l) files/directories"
else
    echo "❌ dist folder not found!"
    exit 1
fi
echo ""

# Check if index.html exists
echo "📄 Checking index.html..."
if [ -f "dist/index.html" ]; then
    echo "✅ dist/index.html exists"
    # Check which JS file it references
    JS_FILE=$(grep -oP 'src="/assets/\K[^"]*\.js' dist/index.html | head -1)
    echo "   References: $JS_FILE"
    if [ -f "dist/assets/$JS_FILE" ]; then
        echo "   ✅ Referenced JS file exists"
    else
        echo "   ❌ Referenced JS file NOT found: dist/assets/$JS_FILE"
        echo "   Available JS files:"
        ls -1 dist/assets/*.js | head -5
    fi
else
    echo "❌ dist/index.html not found!"
    exit 1
fi
echo ""

# Check if assets folder exists
echo "📦 Checking assets folder..."
if [ -d "dist/assets" ]; then
    ASSET_COUNT=$(ls -1 dist/assets/ | wc -l)
    echo "✅ dist/assets folder exists ($ASSET_COUNT files)"
    echo "   Sample files:"
    ls -1 dist/assets/ | head -5 | sed 's/^/   - /'
else
    echo "❌ dist/assets folder not found!"
    exit 1
fi
echo ""

# Check PM2 status
echo "📊 Checking PM2 status..."
pm2 list | grep -A 2 "pablobots" || true
echo ""

# Check if vite is accessible
echo "🧪 Testing vite binary..."
if [ -f "node_modules/.bin/vite" ]; then
    if [ -x "node_modules/.bin/vite" ]; then
        echo "✅ vite binary exists and is executable"
        VITE_VERSION=$(./node_modules/.bin/vite --version 2>/dev/null || echo "unknown")
        echo "   Version: $VITE_VERSION"
    else
        echo "❌ vite binary exists but is NOT executable"
        echo "   Fixing permissions..."
        chmod +x node_modules/.bin/vite
        echo "   ✅ Fixed"
    fi
else
    echo "❌ vite binary not found!"
    exit 1
fi
echo ""

# Check recent PM2 logs
echo "📋 Recent PM2 logs (last 5 lines)..."
pm2 logs pablobots --lines 5 --nostream 2>/dev/null | tail -5 || true
echo ""

echo "✅ Verification complete!"
echo ""
echo "🌐 Your site should be accessible at:"
echo "   http://168.231.114.76:4173/"
echo ""
echo "💡 If you still see 404 errors in the browser:"
echo "   1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)"
echo "   2. Clear browser cache"
echo "   3. Try incognito/private mode"
echo ""

