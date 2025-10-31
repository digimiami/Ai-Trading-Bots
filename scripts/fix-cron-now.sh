#!/bin/bash

# Fix Cron Job Script
# Run this to fix the corrupted cron schedule

echo "🔧 Fixing cron job..."

# Remove corrupted cron job
crontab -l 2>/dev/null | grep -v "log/bot" > /tmp/crontab_fixed.txt

# Add correct cron job if it doesn't exist
if ! grep -q "call-bot-scheduler.sh" /tmp/crontab_fixed.txt; then
    echo "*/5 * * * * /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh" >> /tmp/crontab_fixed.txt
fi

# Install the fixed crontab
crontab /tmp/crontab_fixed.txt

# Clean up
rm -f /tmp/crontab_fixed.txt

# Verify
echo ""
echo "✅ Cron job fixed! Current crontab:"
echo "======================================"
crontab -l

echo ""
echo "✅ Done! The cron job will run every 5 minutes."
echo "Check logs in 5 minutes: tail -f /var/log/bot-scheduler/bot-scheduler.log"

