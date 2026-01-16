# 🔍 How to Check ML Auto-Retrain Logs

## What You're Seeing

The logs you showed only have:
- `booted` - Function starting
- `Listening on http://localhost:9999/` - Function ready
- `shutdown` - Function stopping

**Missing logs:**
- `📥 ML Auto-Retrain function called` - Should appear when request is received
- `🔐 Checking ML auto-retrain secret` - Should show authentication check
- `🔄 Starting ML auto-retrain check...` - Should show processing started

## This Means

The function is booting but **not processing requests**. This usually means:
1. **401 Unauthorized** - Request is rejected before processing
2. **Request not reaching the function** - Network/configuration issue
3. **Logs filtered** - You're only seeing boot/shutdown logs

## How to See Full Logs

### Option 1: Check Recent Logs with Errors

In Supabase Dashboard:
1. Go to: **Edge Functions** → **ml-auto-retrain** → **Logs**
2. **Filter by Level**: Select **"error"** or **"All"**
3. **Time Range**: Select **"Last 1 hour"** or **"Last 24 hours"**
4. Look for logs with:
   - `📥 ML Auto-Retrain function called`
   - `❌ Unauthorized`
   - `🔐 Checking ML auto-retrain secret`

### Option 2: Check Logs Right After Testing

1. **On your server**, run the test:
   ```bash
   /root/scripts/call-ml-auto-retrain.sh
   ```

2. **Immediately** go to Supabase Dashboard → **ml-auto-retrain** → **Logs**

3. Look for the **most recent** logs (should be from just now)

4. You should see:
   ```
   📥 ML Auto-Retrain function called: {
     method: "POST",
     url: "...",
     timestamp: "..."
   }
   🔐 Checking ML auto-retrain secret: {
     hasSecret: true/false,
     hasExpectedSecret: true/false,
     matches: true/false,
     usingMLSecret: true/false
   }
   ```

### Option 3: Check for Error Logs

Look specifically for:
- `❌ Unauthorized: ML auto-retrain secret mismatch`
- `❌ ML auto-retrain error:`
- Any logs with `level: "error"`

## What to Look For

### If You See This:
```
📥 ML Auto-Retrain function called
🔐 Checking ML auto-retrain secret:
   hasSecret: true
   hasExpectedSecret: false  <-- PROBLEM!
   matches: false
```

**Problem**: `ML_AUTO_RETRAIN_SECRET` is not set in Supabase Edge Function Settings.

**Fix**: Go to Edge Functions → ml-auto-retrain → Settings → Environment Variables → Add `ML_AUTO_RETRAIN_SECRET`

### If You See This:
```
📥 ML Auto-Retrain function called
🔐 Checking ML auto-retrain secret:
   hasSecret: true
   hasExpectedSecret: true
   matches: false  <-- PROBLEM!
```

**Problem**: The secret in Supabase doesn't match the secret in your `.env.cron` file.

**Fix**: 
1. Check both values match exactly
2. No extra spaces
3. Same value in both places

### If You See This:
```
📥 ML Auto-Retrain function called
🔐 Checking ML auto-retrain secret:
   hasSecret: false  <-- PROBLEM!
   hasExpectedSecret: true
```

**Problem**: The script is not sending the `x-cron-secret` header.

**Fix**: Check your script is using `ML_AUTO_RETRAIN_SECRET` correctly.

## Debug Steps

### Step 1: Verify Script is Sending Secret

On your server:
```bash
# Check what secret the script will use
source /root/.env.cron
echo "Secret length: ${#ML_AUTO_RETRAIN_SECRET}"
echo "Secret first 10 chars: ${ML_AUTO_RETRAIN_SECRET:0:10}..."
```

### Step 2: Test Manually with curl

```bash
# Get your secret
SECRET=$(grep ML_AUTO_RETRAIN_SECRET /root/.env.cron | cut -d= -f2)

# Get your service role key
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /root/.env.cron | cut -d= -f2)

# Test manually
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "x-cron-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v
```

The `-v` flag will show you the full request/response.

### Step 3: Check Supabase Logs Immediately After curl

Right after running the curl command above, check Supabase logs. You should see:
- The function being called
- The authentication check
- Either success or error

## Expected Success Logs

When working correctly, you should see:

```
📥 ML Auto-Retrain function called: {
  method: "POST",
  url: "...",
  timestamp: "2026-01-16T..."
}
🔐 Checking ML auto-retrain secret: {
  hasSecret: true,
  hasExpectedSecret: true,
  matches: true,  ✅
  usingMLSecret: true
}
🔄 Starting ML auto-retrain check...
✅ ML auto-retrain check complete: X bots checked, Y need retraining
```

## Quick Checklist

- [ ] Checked logs with "error" filter
- [ ] Checked logs immediately after testing
- [ ] Looked for `📥 ML Auto-Retrain function called` log
- [ ] Looked for `🔐 Checking ML auto-retrain secret` log
- [ ] Verified `ML_AUTO_RETRAIN_SECRET` is set in Supabase
- [ ] Verified `ML_AUTO_RETRAIN_SECRET` is set in `.env.cron`
- [ ] Both secrets match exactly
- [ ] Tested with curl manually
- [ ] Checked logs right after curl test
