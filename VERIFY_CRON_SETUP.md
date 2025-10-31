# 🔍 Verify Cron Setup - Quick Guide

## **Current Status Check**

Based on your output:

### ✅ **Working:**
- Cron job is installed: `*/5 * * * * /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh`
- Script exists and is executable
- Logs show one successful call: `[2025-10-30 22:32:20] ✅ Bot scheduler called successfully (HTTP 200, 3.302825s)`

### ⚠️ **Issues Found:**
- Old 401 errors in logs (from before ANON_KEY was added)
- Manual script run shows no output (script is working but not showing output)

---

## **Quick Verification Steps**

### **1. Check .env.cron File**

```bash
cat /var/www/Ai-Trading-Bots/.env.cron
```

**Should contain:**
```
SUPABASE_URL=https://dkawxgwdqiirgmmjbvhc.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
CRON_SECRET=your-cron-secret-here
```

**If missing or incorrect:**
```bash
cd /var/www/Ai-Trading-Bots
nano .env.cron
# Add the three variables above
```

---

### **2. Test Script Manually (Improved Output)**

After pulling latest code, test again:

```bash
cd /var/www/Ai-Trading-Bots
git pull  # Get latest fixes
bash scripts/call-bot-scheduler.sh
```

**Should now show:**
```
✅ Bot scheduler called successfully
📊 Response: {"success":true,"botsExecuted":2}
⏱️  Time: 3.30s
📝 Full logs: /var/log/bot-scheduler/bot-scheduler.log
```

---

### **3. Check Recent Cron Execution**

```bash
# Check last 20 log entries
tail -20 /var/log/bot-scheduler/bot-scheduler.log

# Watch live (wait 5 minutes)
tail -f /var/log/bot-scheduler/bot-scheduler.log
```

**Should see:**
- ✅ Success messages every ~5 minutes
- 📊 `botsExecuted` count
- ⏱️ Execution time

---

### **4. Verify Cron is Running**

```bash
# Check cron service
systemctl status cron

# Or on some systems:
service cron status

# Should show: "active (running)"
```

---

### **5. Check Supabase Logs**

1. Go to **Supabase Dashboard**
2. **Edge Functions** → **`bot-executor`** → **Logs**
3. Should see logs every ~5 minutes
4. Check timestamps - should continue even when browser is closed

---

## **Troubleshooting**

### **Issue: No Output When Running Manually**

**Cause**: Script logs to file, not stdout (old behavior)

**Fix**: Pull latest code - script now shows output when run manually:
```bash
cd /var/www/Ai-Trading-Bots
git pull
bash scripts/call-bot-scheduler.sh
```

---

### **Issue: Still Seeing 401 Errors**

**Cause**: `.env.cron` missing or incorrect `SUPABASE_ANON_KEY`

**Fix**:
```bash
cd /var/www/Ai-Trading-Bots
nano .env.cron
# Make sure SUPABASE_ANON_KEY is set correctly
```

---

### **Issue: Cron Not Executing**

**Check cron service:**
```bash
systemctl status cron
service cron status
```

**Restart cron if needed:**
```bash
sudo systemctl restart cron
# Or
sudo service cron restart
```

**Check cron permissions:**
```bash
# Make sure script is executable
chmod +x /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
```

---

### **Issue: Cron Executing But Failing**

**Check cron email/logs:**
```bash
# Check system mail (cron often sends email on errors)
mail

# Or check syslog
grep CRON /var/log/syslog | tail -20
```

---

## **Expected Behavior**

### **Working Setup:**
- ✅ Cron runs every 5 minutes
- ✅ Script calls `bot-scheduler` Edge Function
- ✅ Edge Function executes all running bots
- ✅ Logs show successful executions
- ✅ Bots trade even when browser is closed

### **Check Intervals:**
- **Every 5 minutes**: Cron executes script
- **Every 5 minutes**: Script calls bot-scheduler
- **Every 5 minutes**: Bot-executor runs all running bots

---

## **Quick Test Commands**

```bash
# 1. Test script manually
bash /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh

# 2. Check recent logs
tail -20 /var/log/bot-scheduler/bot-scheduler.log

# 3. Check cron is scheduled
crontab -l

# 4. Watch for next execution (wait up to 5 minutes)
tail -f /var/log/bot-scheduler/bot-scheduler.log
```

---

## **Summary**

Based on your output:
- ✅ **Cron is installed correctly**
- ✅ **Script exists and is executable**
- ✅ **One successful call logged** (22:32:20)
- ⚠️ **Old 401 errors** (from before ANON_KEY was configured)
- ⚠️ **Manual run needs better output** (fixed in latest code)

**Next Steps:**
1. Pull latest code: `git pull`
2. Verify `.env.cron` has all three variables
3. Test manually: `bash scripts/call-bot-scheduler.sh`
4. Wait 5 minutes and check logs: `tail -f /var/log/bot-scheduler/bot-scheduler.log`

**Your setup looks mostly correct! Just need to verify `.env.cron` and test with improved output.** ✅

