# Update ML Auto-Retrain Cron Schedule

## Current Status
The ML auto-retrain cron job is currently set to run **once daily at 2 AM UTC**. For trading ML models that need to adapt to changing market conditions, running more frequently is recommended.

## Recommended Schedule: Every 6 Hours

This provides a good balance between:
- ✅ Responsive model updates (4 times per day)
- ✅ Reasonable resource usage
- ✅ Catching market condition changes quickly

## Update Your Cron Job

### Step 1: Edit Crontab
```bash
crontab -e
```

### Step 2: Update the Schedule

**Find this line:**
```bash
0 2 * * * /root/scripts/call-ml-auto-retrain.sh
```

**Replace with (Every 6 hours):**
```bash
0 */6 * * * /root/scripts/call-ml-auto-retrain.sh
```

This will run at:
- 00:00 UTC (midnight)
- 06:00 UTC (6 AM)
- 12:00 UTC (noon)
- 18:00 UTC (6 PM)

### Step 3: Save and Exit
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

### Step 4: Verify
```bash
# View your current crontab
crontab -l

# You should see:
# 0 */6 * * * /root/scripts/call-ml-auto-retrain.sh
```

## Alternative Schedules

### Every 4 Hours (More Responsive)
```bash
0 */4 * * * /root/scripts/call-ml-auto-retrain.sh
```
Runs 6 times per day: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC

### Twice Daily (2 AM and 2 PM UTC)
```bash
0 2,14 * * * /root/scripts/call-ml-auto-retrain.sh
```

### Every 12 Hours
```bash
0 */12 * * * /root/scripts/call-ml-auto-retrain.sh
```
Runs at 00:00 and 12:00 UTC

## Monitor the New Schedule

After updating, monitor the logs to ensure it's running correctly:

```bash
# Watch logs in real-time
tail -f /var/log/bot-scheduler/ml-auto-retrain.log

# Check recent runs
tail -20 /var/log/bot-scheduler/ml-auto-retrain.log
```

You should see runs every 6 hours (or whatever schedule you chose).

## Why More Frequent?

1. **Market Conditions Change Rapidly**: Crypto markets are volatile and can shift quickly
2. **Better Model Performance**: More frequent retraining keeps models aligned with current market patterns
3. **Faster Adaptation**: Models can adapt to new trends within hours instead of waiting 24 hours
4. **Resource Efficient**: The function only retrains when needed (checks accuracy first), so more frequent checks don't necessarily mean more retraining

## Notes

- The function is smart: it **checks** if retraining is needed before actually retraining
- If accuracy is good, it won't retrain (saves resources)
- More frequent checks = faster detection of when retraining is actually needed
- The function execution is fast (~1-20 seconds), so running every 6 hours is very reasonable
