# Find and Update ML Auto-Retrain Cron Job

## Current Issue
You're viewing the `subscription-renewal` cron job, but we need to update the `ml-auto-retrain` cron job.

## Steps to Find and Update

### Step 1: View All Cron Jobs
```bash
crontab -l
```

This will show all your cron jobs. Look for a line that contains:
- `ml-auto-retrain`
- OR `/root/scripts/call-ml-auto-retrain.sh`
- OR `functions/v1/ml-auto-retrain`

### Step 2: Edit Crontab
```bash
crontab -e
```

### Step 3: Find the ML Auto-Retrain Line

Look for a line that looks like one of these:

**If using the script:**
```bash
0 2 * * * /root/scripts/call-ml-auto-retrain.sh
```

**If using direct curl:**
```bash
0 2 * * * curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/ml-auto-retrain ...
```

### Step 4: Update the Schedule

**Change from (daily at 2 AM):**
```bash
0 2 * * * /root/scripts/call-ml-auto-retrain.sh
```

**To (every 6 hours):**
```bash
0 */6 * * * /root/scripts/call-ml-auto-retrain.sh
```

### Step 5: Save and Exit
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

### Step 6: Verify
```bash
crontab -l | grep ml-auto-retrain
```

You should see the updated schedule: `0 */6 * * *`

## If You Don't See the ML Auto-Retrain Job

If `crontab -l` doesn't show an `ml-auto-retrain` entry, you may need to add it:

```bash
crontab -e
```

Add this line at the end:
```bash
0 */6 * * * /root/scripts/call-ml-auto-retrain.sh
```

Make sure the script exists and is executable:
```bash
ls -la /root/scripts/call-ml-auto-retrain.sh
chmod +x /root/scripts/call-ml-auto-retrain.sh
```
