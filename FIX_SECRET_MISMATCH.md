# 🔐 Fix Secret Mismatch - SUBSCRIPTION_RENEWAL_SECRET

## Problem
You're getting `{"error":"Unauthorized"}` because the `SUBSCRIPTION_RENEWAL_SECRET` value in Supabase doesn't match the value in your cron job.

**Current Situation:**
- **Supabase Secret Value**: Starts with `66dc4bcfee03509dd6423b82c8e98d09234f293a3819...`
- **Cron Job Value**: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`

## Solution: Update Supabase Secret

### Option 1: Update Supabase Secret to Match Cron Job (Recommended)

1. Go to: **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Find: `SUBSCRIPTION_RENEWAL_SECRET`
3. Click: **Edit** (or delete and recreate)
4. Update the value to: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
5. Click: **Save**
6. Wait 1-2 minutes for propagation

### Option 2: Update Cron Job to Match Supabase Secret

If you prefer to keep the existing Supabase secret:

1. Get the full secret value from Supabase (click "Show" to reveal it)
2. Update your cron job with the correct value:

```bash
# Remove old cron job
crontab -e
# Delete the subscription-renewal line(s)

# Add new cron job with correct secret
(crontab -l 2>/dev/null; echo "0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U\" -H \"x-cron-secret: YOUR_FULL_SECRET_FROM_SUPABASE\" -H \"Content-Type: application/json\" -d '{}' >> /var/log/subscription-renewal.log 2>&1") | crontab -
```

## Fix Duplicate Cron Job

You have the cron job added twice. Clean it up:

```bash
# Edit crontab
crontab -e

# Remove one of the duplicate lines, keep only one
# Save and exit
```

Or use this command to remove duplicates:

```bash
crontab -l | grep -v subscription-renewal | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U\" -H \"x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc\" -H \"Content-Type: application/json\" -d '{}' >> /var/log/subscription-renewal.log 2>&1") | crontab -
```

## Test After Fixing

After updating the secret in Supabase (Option 1), wait 1-2 minutes, then test:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (after fixing):
```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

## Quick Fix Commands

Run these on your VPS:

```bash
# 1. Remove duplicate cron jobs
crontab -l | grep -v subscription-renewal | crontab -

# 2. Add single cron job with correct secret
(crontab -l 2>/dev/null; echo "0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U\" -H \"x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc\" -H \"Content-Type: application/json\" -d '{}' >> /var/log/subscription-renewal.log 2>&1") | crontab -

# 3. Verify
crontab -l | grep subscription-renewal
```

Then update Supabase secret to match (see Option 1 above).

