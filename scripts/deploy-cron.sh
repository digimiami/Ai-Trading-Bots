#!/bin/bash

# Auto-Deploy Cron Setup Script
# This script should be run as part of your git deployment process
# It sets up the cron job after code is deployed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "🚀 Deploying Bot Scheduler Cron Job..."
echo "======================================"
echo ""

# Check if .env.cron exists
if [ ! -f "${PROJECT_ROOT}/.env.cron" ]; then
    echo "⚠️  Warning: .env.cron not found!"
    echo "📝 Creating from example..."
    if [ -f "${SCRIPT_DIR}/env.cron.example" ]; then
        cp "${SCRIPT_DIR}/env.cron.example" "${PROJECT_ROOT}/.env.cron"
        echo "✅ Created .env.cron from example"
        echo "⚠️  IMPORTANT: Edit .env.cron and update SUPABASE_URL and CRON_SECRET!"
    else
        echo "❌ Error: env.cron.example not found!"
        exit 1
    fi
fi

# Make scripts executable
chmod +x "${SCRIPT_DIR}/call-bot-scheduler.sh"
chmod +x "${SCRIPT_DIR}/setup-cron.sh"
echo "✅ Made scripts executable"

# Run setup
echo ""
echo "🔧 Setting up cron job..."
"${SCRIPT_DIR}/setup-cron.sh"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.cron and verify SUPABASE_URL and CRON_SECRET are correct"
echo "2. Test the cron job: ${SCRIPT_DIR}/call-bot-scheduler.sh"
echo "3. Check logs: tail -f /var/log/bot-scheduler/bot-scheduler.log"

