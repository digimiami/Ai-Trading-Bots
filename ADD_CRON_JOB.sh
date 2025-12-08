#!/bin/bash
# Script to add subscription renewal cron job
# Run this on your VPS: bash ADD_CRON_JOB.sh

echo "📅 Adding Subscription Renewal Cron Job..."
echo ""

# Create log file if it doesn't exist
touch /var/log/subscription-renewal.log
chmod 644 /var/log/subscription-renewal.log

# Add cron job
(crontab -l 2>/dev/null; echo "0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U\" -H \"x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc\" -H \"Content-Type: application/json\" -d '{}' >> /var/log/subscription-renewal.log 2>&1") | crontab -

echo "✅ Cron job added!"
echo ""
echo "Verify with: crontab -l | grep subscription-renewal"
echo ""

