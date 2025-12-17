# 🔐 Setting Up CRON_SECRET for Position Sync

Since Supabase masks secret values after saving, you need to set a new CRON_SECRET value and use it in the cron schedule.

## Step 1: Generate a Secure CRON_SECRET

Generate a random secret value. You can use one of these methods:

**Option A: Use an online generator**
- Go to: https://www.random.org/strings/
- Generate a random string (32+ characters)
- Copy it

**Option B: Use PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Option C: Use a simple value (less secure but works)**
```
pablo-trading-cron-secret-2025
```

## Step 2: Set CRON_SECRET in Edge Function

1. Go to **Supabase Dashboard** → **Edge Functions** → **position-sync**
2. Click **Settings** (or **Secrets** tab)
3. Find **CRON_SECRET** in the environment variables list
4. Click **Edit** or **Add Secret**
5. **Paste your generated secret value**
6. Click **Save**

⚠️ **Important**: Copy the value BEFORE saving, as it will be masked after saving!

## Step 3: Use Same Value in Cron Schedule

1. Still in **position-sync** function, go to **Schedules** tab
2. Click **Create Schedule** (or edit existing)
3. In the **Headers** section, add:
   - **Key**: `x-cron-secret`
   - **Value**: `[Paste the EXACT same value you used in Step 2]`
4. Fill in other fields:
   - Schedule Name: `position-sync-schedule`
   - Cron Expression: `*/5 * * * *`
   - HTTP Method: `POST`
   - Enabled: Yes
5. Click **Save**

## Step 4: Verify It Works

1. Wait 5-10 minutes
2. Go to **position-sync** → **Logs** tab
3. Look for:
   - ✅ `Position Sync Cron Job STARTED` (success)
   - ❌ `Unauthorized` or `Authentication failed` (secret mismatch)

## Troubleshooting

### If you see "Unauthorized" errors:

The CRON_SECRET in the schedule header doesn't match the one in function secrets.

**Solution:**
1. Generate a NEW secret value
2. Update BOTH places:
   - Edge Function Secrets → CRON_SECRET
   - Schedule Headers → x-cron-secret
3. Make sure they match EXACTLY (copy-paste to avoid typos)

### If you can't see the secret value:

This is normal - Supabase masks secrets for security. You have two options:

**Option 1: Set a new value** (Recommended)
- Generate a new secret
- Update both the function secret AND the schedule header
- Use the same value in both places

**Option 2: Check other functions**
- Check if `bot-scheduler` has CRON_SECRET set
- You can use the SAME secret value for all cron jobs
- Just make sure it matches in both the function secrets and schedule headers

## Quick Setup Script

If you want to use the same secret for all cron jobs, here's a recommended value:

```
pablo-ai-trading-cron-2025-secure-key-xyz123
```

Replace `xyz123` with random characters if you want more security.

## Important Notes

- ✅ The CRON_SECRET value can be any string (no special requirements)
- ✅ You can use the same CRON_SECRET for multiple functions
- ✅ The value in function secrets MUST match the value in schedule headers
- ⚠️ If they don't match, cron jobs will fail with "Unauthorized"
- ⚠️ Once saved, you can't see the value again (it's masked)
