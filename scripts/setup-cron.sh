#!/bin/bash

# Setup Cron Job Script
# This script installs the bot-scheduler cron job on the server
# Run this once after deploying to set up automatic execution

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_SCRIPT="${SCRIPT_DIR}/call-bot-scheduler.sh"
CRON_SCHEDULE="* * * * *"  # Every 1 minute

# Check if script exists
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "❌ Error: $CRON_SCRIPT not found!"
    exit 1
fi

# Make script executable
chmod +x "$CRON_SCRIPT"
echo "✅ Made $CRON_SCRIPT executable"

# Check if cron job already exists
CRON_ENTRY="$CRON_SCHEDULE $CRON_SCRIPT"
if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
    echo "⚠️  Cron job already exists. Updating..."
    # Remove existing entry
    crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job installed successfully!"
echo ""
echo "Schedule: $CRON_SCHEDULE (every 1 minute)"
echo "Script: $CRON_SCRIPT"
echo ""
echo "Current crontab:"
crontab -l
echo ""
echo "📝 To view logs: tail -f /var/log/bot-scheduler/bot-scheduler.log"
echo "📝 To remove cron job: crontab -e (then delete the line)"
echo "⚡ Bots will now execute every 1 minute for maximum responsiveness!"

