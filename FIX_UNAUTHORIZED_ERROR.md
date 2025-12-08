# 🔐 Fix "Unauthorized" Error for Subscription Renewal

## Problem
You're getting `{"error":"Unauthorized"}` when calling the subscription-renewal endpoint.

## Root Cause
The `SUBSCRIPTION_RENEWAL_SECRET` is **NOT SET** in Supabase Edge Function Secrets.

## Solution

### Step 1: Add Secret to Supabase

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `dkawxgwdqiirgmmjbvhc`
3. **Navigate to**: **Project Settings** → **Edge Functions** → **Secrets**
4. **Click**: **"Add new secret"** button
5. **Enter**:
   - **Name**: `SUBSCRIPTION_RENEWAL_SECRET`
   - **Value**: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
6. **Click**: **"Save"**

### Step 2: Verify Secret is Set

After adding, you should see `SUBSCRIPTION_RENEWAL_SECRET` in your secrets list.

### Step 3: Test Again

Run the test command:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (after adding secret):
```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

**If still getting 401**:
- Double-check the secret name is exactly: `SUBSCRIPTION_RENEWAL_SECRET` (case-sensitive)
- Verify the value matches exactly (no extra spaces)
- Wait 1-2 minutes after saving (secrets may take a moment to propagate)

## Add Cron Job

The cron job wasn't added. Use one of these methods:

### Method 1: Use the Script (Easiest)

```bash
# Upload ADD_CRON_JOB.sh to your VPS, then:
chmod +x ADD_CRON_JOB.sh
bash ADD_CRON_JOB.sh
```

### Method 2: Manual Edit

```bash
crontab -e
```

Then add this line at the end:
```
0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" -H "Content-Type: application/json" -d '{}' >> /var/log/subscription-renewal.log 2>&1
```

Save and exit (in nano: `Ctrl+X`, then `Y`, then `Enter`)

### Method 3: One-Line Command

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U\" -H \"x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc\" -H \"Content-Type: application/json\" -d '{}' >> /var/log/subscription-renewal.log 2>&1") | crontab -
```

### Verify Cron Job Added

```bash
crontab -l | grep subscription-renewal
```

You should see the cron job line.

## Summary Checklist

- [ ] **CRITICAL**: Add `SUBSCRIPTION_RENEWAL_SECRET` to Supabase Edge Function Secrets
- [ ] Test endpoint returns 200 (not 401)
- [ ] Add cron job to crontab
- [ ] Verify cron job with `crontab -l | grep subscription-renewal`
- [ ] Create log file: `touch /var/log/subscription-renewal.log`

## Troubleshooting

### Still Getting 401 After Adding Secret?

1. **Check secret name**: Must be exactly `SUBSCRIPTION_RENEWAL_SECRET` (case-sensitive, no spaces)
2. **Check secret value**: Must match exactly: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
3. **Wait 1-2 minutes**: Secrets may take a moment to propagate
4. **Check Edge Function logs**: Supabase Dashboard → Edge Functions → subscription-renewal → Logs

### Cron Job Not Running?

1. **Check cron service**: `systemctl status cron`
2. **Check cron logs**: `grep CRON /var/log/syslog | tail -20`
3. **Test manually**: Run the curl command manually to verify it works
4. **Check log file**: `tail -f /var/log/subscription-renewal.log`

