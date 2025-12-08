# ✅ Verify Subscription Renewal Cron Setup

## Step 1: Verify Cron Job is Installed

On your VPS (`srv853835`), run:

```bash
crontab -l | grep subscription-renewal
```

You should see your cron job. If not, add it:

```bash
crontab -e
```

Then add this line:

```
0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}' \
  >> /var/log/subscription-renewal.log 2>&1
```

## Step 2: Add SUBSCRIPTION_RENEWAL_SECRET to Supabase

**CRITICAL**: You must add this secret to Supabase for the endpoint to work!

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Click **"Add new secret"**
3. Add:
   - **Name**: `SUBSCRIPTION_RENEWAL_SECRET`
   - **Value**: `22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc`
4. Click **"Save"**

## Step 3: Test the Endpoint

On your VPS, run the test script:

```bash
# Upload test_subscription_renewal.sh to your VPS, then:
chmod +x test_subscription_renewal.sh
./test_subscription_renewal.sh
```

Or test manually:

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
  -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (if working):
```json
{
  "message": "Subscription renewal check complete",
  "checked": 0,
  "renewed": 0,
  "errors": []
}
```

**If you get 401 Unauthorized**:
- The `SUBSCRIPTION_RENEWAL_SECRET` is not set in Supabase
- Or the secret value doesn't match

**If you get 500 Error**:
- Check Edge Function logs in Supabase Dashboard
- Verify BTCPay Server configuration is set

## Step 4: Check Logs

Monitor the cron job logs:

```bash
# View recent logs
tail -f /var/log/subscription-renewal.log

# Or check last 50 lines
tail -n 50 /var/log/subscription-renewal.log
```

## Step 5: Verify Cron Runs Daily

To test immediately (without waiting for 2 AM), you can:

1. **Run manually**:
   ```bash
   curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/subscription-renewal \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYXd4Z3dkcWlpcmdtbWpidmhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgxOTI2NiwiZXhwIjoyMDc2Mzk1MjY2fQ.bVkrjuQJ4HJ8hzeBMe1AqC8e_Dv7m6gKq5I05ONM07U" \
     -H "x-cron-secret: 22ad6fb976c39c8355a736a1837e5d2775ebd48ec9f0124a9bd7d41b958385fc" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Or temporarily change cron to run every minute** (for testing):
   ```bash
   crontab -e
   # Change: 0 2 * * * → * * * * *
   # Remember to change it back after testing!
   ```

## Summary Checklist

- [ ] Cron job added to crontab (`crontab -l` shows it)
- [ ] `SUBSCRIPTION_RENEWAL_SECRET` added to Supabase Edge Function Secrets
- [ ] Test endpoint returns 200 (not 401 or 500)
- [ ] Log file `/var/log/subscription-renewal.log` exists and is writable
- [ ] BTCPay Server configuration is set in Supabase Secrets

## Troubleshooting

### Cron job not running?
```bash
# Check cron service
systemctl status cron

# Check cron logs
grep CRON /var/log/syslog | tail -20
```

### 401 Unauthorized?
- Verify `SUBSCRIPTION_RENEWAL_SECRET` is set in Supabase
- Check the secret value matches exactly (no extra spaces)

### 500 Server Error?
- Check Supabase Edge Function logs
- Verify BTCPay Server is running and accessible
- Verify all required secrets are set:
  - `BTCPAY_SERVER_URL`
  - `BTCPAY_STORE_ID`
  - `BTCPAY_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
