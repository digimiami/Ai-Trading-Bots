#!/bin/bash

# Setup PM2 Cron Job for Bot Scheduler
# This replaces the system cron job with PM2 management

set -e

PROJECT_ROOT="/var/www/Ai-Trading-Bots"
SCRIPT_DIR="$PROJECT_ROOT/scripts"

echo "🚀 Setting up PM2 Cron Job for Bot Scheduler..."
echo "=============================================="

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it first:"
    echo "   npm install -g pm2"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_ROOT" || exit 1

# Make the Node.js cron script executable
chmod +x "$SCRIPT_DIR/bot-scheduler-cron.cjs"

# Check if ecosystem.config.cjs exists
if [ ! -f "$PROJECT_ROOT/ecosystem.config.cjs" ]; then
    echo "⚠️  Warning: ecosystem.config.cjs not found. Creating..."
fi

# Remove old system cron job if it exists
echo ""
echo "🧹 Removing old system cron job..."
crontab -l 2>/dev/null | grep -v "call-bot-scheduler.sh" | crontab - 2>/dev/null || true
echo "✅ Old cron job removed"

# Stop existing PM2 bot-scheduler-cron if running
echo ""
echo "🛑 Stopping existing PM2 bot-scheduler-cron (if running)..."
pm2 stop bot-scheduler-cron 2>/dev/null || true
pm2 delete bot-scheduler-cron 2>/dev/null || true

# Start the PM2 cron job
echo ""
echo "🚀 Starting PM2 cron job..."
pm2 start ecosystem.config.cjs --only bot-scheduler-cron

# Save PM2 configuration
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Show PM2 status
echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "✅ PM2 Cron Job Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Monitor logs: pm2 logs bot-scheduler-cron"
echo "   2. Check status: pm2 status"
echo "   3. View logs in real-time: pm2 logs bot-scheduler-cron --lines 50"
echo ""
echo "🔄 The bot scheduler will now run every 5 minutes via PM2"
echo "   It will automatically restart on system reboot (if PM2 startup is configured)"

