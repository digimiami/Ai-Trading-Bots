#!/bin/bash

# Deployment script for Ai-Trading-Bots server
# Fixes permission issues and rebuilds the app

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"

echo "🚀 Starting server deployment..."
echo "=================================="
echo ""

# Navigate to project directory
echo "📂 Navigating to project directory..."
cd "$PROJECT_ROOT" || {
    echo "❌ Failed to navigate to $PROJECT_ROOT"
    exit 1
}
echo "✅ Current directory: $(pwd)"
echo ""

# Pull latest changes
echo "📥 Pulling latest changes from git..."
if git pull origin master; then
    echo "✅ Git pull successful"
else
    echo "⚠️  Git pull failed, but continuing..."
fi
echo ""

# Stop PM2 apps
echo "🛑 Stopping PM2 apps..."
pm2 stop all || true
echo "✅ PM2 apps stopped"
echo ""

# Remove old node_modules and dist (optional - uncomment if needed)
# echo "🧹 Cleaning old build files..."
# rm -rf node_modules dist
# echo "✅ Cleaned old files"
# echo ""

# Install dependencies
echo "📦 Installing dependencies..."
if npm install --production=false; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo ""

# Fix permissions for node_modules/.bin
echo "🔧 Fixing permissions..."
if [ -d "node_modules/.bin" ]; then
    chmod +x node_modules/.bin/*
    echo "✅ Fixed permissions for node_modules/.bin"
    
    # Specifically ensure vite has execute permissions
    if [ -f "node_modules/.bin/vite" ]; then
        chmod +x node_modules/.bin/vite
        echo "✅ Fixed vite permissions"
    fi
else
    echo "⚠️  node_modules/.bin not found"
fi
echo ""

# Build the project
echo "🔨 Building the project..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

# Verify dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ dist folder not found after build!"
    exit 1
fi

# Verify key files exist
if [ ! -f "dist/index.html" ]; then
    echo "❌ dist/index.html not found!"
    exit 1
fi

echo "✅ Build files verified"
echo ""

# Restart PM2 apps
echo "🔄 Restarting PM2 apps..."
pm2 restart all --update-env
echo "✅ PM2 apps restarted"
echo ""

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save
echo "✅ PM2 configuration saved"
echo ""

# Show PM2 status
echo "📊 PM2 Status:"
pm2 list
echo ""

# Show logs
echo "📋 Recent PM2 logs (last 10 lines):"
pm2 logs --lines 10 --nostream
echo ""

# Update nginx configuration if script exists
if [ -f "scripts/setup-nginx.sh" ]; then
    echo "🔧 Updating nginx configuration..."
    if sudo bash scripts/setup-nginx.sh; then
        echo "✅ Nginx configuration updated"
    else
        echo "⚠️  Nginx configuration update failed, but continuing..."
        echo "   You may need to run: sudo bash scripts/setup-nginx.sh"
    fi
    echo ""
fi

echo "✅ Deployment complete!"
echo ""
echo "🔍 Check logs with:"
echo "   pm2 logs pablobots"
echo "   pm2 logs bot-scheduler-cron"
echo ""

