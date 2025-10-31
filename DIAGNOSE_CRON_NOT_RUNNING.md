# 🔧 Diagnose Why Cron Job Isn't Running

## **Problem**
Bots show `logs_last_10min: 0` and last execution was 20+ minutes ago, meaning the cron job isn't executing bots.

---

## **Step 1: Check Cron Job Status**

### **On Your Server:**
```bash
# SSH into your server
ssh root@your-server

# Check if cron is installed and running
systemctl status cron
# Or on some systems:
systemctl status crond

# Check if cron job is scheduled
crontab -l
```

**Expected output:**
```
*/5 * * * * /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
```

---

## **Step 2: Check Cron Job Logs**

```bash
# View recent cron execution logs
tail -n 50 /var/log/bot-scheduler/bot-scheduler.log

# Or watch in real-time
tail -f /var/log/bot-scheduler/bot-scheduler.log
```

**What to look for:**
- ✅ `✅ Bot scheduler called successfully` → Working
- ❌ `❌ Bot scheduler failed` → Error (check error message)
- ⚠️ No recent logs → Cron job not running

---

## **Step 3: Check System Cron Logs**

```bash
# Check system cron logs (varies by OS)
# Ubuntu/Debian:
grep CRON /var/log/syslog | tail -20

# CentOS/RHEL:
grep CRON /var/log/cron | tail -20

# Check for errors
grep "call-bot-scheduler" /var/log/syslog | tail -20
```

---

## **Step 4: Test Manual Execution**

Test if the script works when run manually:

```bash
# Navigate to project directory
cd /var/www/Ai-Trading-Bots

# Run the script manually
bash scripts/call-bot-scheduler.sh
```

**Expected output:**
```
✅ Bot scheduler called successfully
📊 Response: {"success":true,"message":"Executed X bots successfully...",...}
⏱️ Time: X.XXXs
📝 Full logs: /var/log/bot-scheduler/bot-scheduler.log
```

**If you see errors:**
- `401 Unauthorized` → Check `.env.cron` has correct `SUPABASE_ANON_KEY`
- `403 Forbidden` → Check API keys
- `404 Not Found` → Check `SUPABASE_URL` in `.env.cron`
- `500 Internal Server Error` → Check Edge Function logs

---

## **Step 5: Verify .env.cron File**

```bash
# Check if .env.cron exists
cat /var/www/Ai-Trading-Bots/.env.cron

# Verify format (should have no comments with # on separate lines)
# Should look like:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
CRON_SECRET=xxx
```

**Common issues:**
- Missing file → Run `bash scripts/deploy-cron.sh`
- Wrong format → Check line endings (should be Unix LF, not Windows CRLF)
- Missing variables → Add required variables

---

## **Step 6: Fix Cron Job**

If cron job is missing or broken:

```bash
cd /var/www/Ai-Trading-Bots

# Reinstall cron job
bash scripts/deploy-cron.sh
```

Or manually add:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path if needed):
*/5 * * * * /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh >> /var/log/bot-scheduler/bot-scheduler.log 2>&1

# Save and exit (Ctrl+X, then Y, then Enter)
```

---

## **Step 7: Check Script Permissions**

```bash
# Check if script is executable
ls -l /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh

# Should show: -rwxr-xr-x (executable)
# If not, make it executable:
chmod +x /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
```

---

## **Step 8: Check Log Directory**

```bash
# Check if log directory exists
ls -la /var/log/bot-scheduler/

# If missing, create it:
mkdir -p /var/log/bot-scheduler
chmod 755 /var/log/bot-scheduler
```

---

## **Step 9: Verify Cron Service is Running**

```bash
# Check cron service status
systemctl status cron

# If stopped, start it:
systemctl start cron

# Enable on boot:
systemctl enable cron
```

---

## **Quick Fix: Reinstall Cron Job**

If nothing works, reinstall everything:

```bash
cd /var/www/Ai-Trading-Bots

# Pull latest code
git pull

# Redeploy cron job
bash scripts/deploy-cron.sh

# Test manually
bash scripts/call-bot-scheduler.sh

# Check cron job is installed
crontab -l
```

---

## **Common Issues & Solutions**

### **Issue 1: Cron Job Not Running**
**Solution:**
```bash
# Check cron service
systemctl status cron

# Restart cron
systemctl restart cron

# Verify job is scheduled
crontab -l
```

### **Issue 2: Script Fails with Permission Error**
**Solution:**
```bash
chmod +x /var/www/Ai-Trading-Bots/scripts/call-bot-scheduler.sh
chmod +x /var/www/Ai-Trading-Bots/scripts/*.sh
```

### **Issue 3: Environment Variables Not Loading**
**Solution:**
```bash
# Check .env.cron format (should be KEY=VALUE, no spaces)
cat .env.cron

# Fix if needed (remove comments, ensure LF line endings)
nano .env.cron
```

### **Issue 4: Log File Permission Error**
**Solution:**
```bash
# Create log directory
mkdir -p /var/log/bot-scheduler
chmod 755 /var/log/bot-scheduler
touch /var/log/bot-scheduler/bot-scheduler.log
chmod 644 /var/log/bot-scheduler/bot-scheduler.log
```

### **Issue 5: API Errors (401, 403)**
**Solution:**
```bash
# Verify .env.cron has correct keys
cat .env.cron | grep -E "SUPABASE_URL|SUPABASE_ANON_KEY|CRON_SECRET"

# Test manually
bash scripts/call-bot-scheduler.sh
```

---

## **Verification Checklist**

After fixing, verify:

- [ ] `crontab -l` shows the cron job
- [ ] `systemctl status cron` shows "active (running)"
- [ ] `bash scripts/call-bot-scheduler.sh` runs successfully
- [ ] `/var/log/bot-scheduler/bot-scheduler.log` has recent entries
- [ ] `.env.cron` exists and has correct values
- [ ] Script has execute permission (`ls -l` shows `-rwxr-xr-x`)

---

## **Manual Test**

Run this to test immediately:

```bash
cd /var/www/Ai-Trading-Bots
bash scripts/call-bot-scheduler.sh
```

**Then check logs:**
```sql
-- Run in Supabase SQL Editor
SELECT 
    b.name,
    b.symbol,
    (SELECT COUNT(*) FROM bot_activity_logs 
     WHERE bot_id = b.id 
     AND created_at >= NOW() - INTERVAL '1 minute') as logs_last_minute
FROM trading_bots b
WHERE b.status = 'running';
```

Should show `logs_last_minute > 0` after running the script.

---

## **If Still Not Working**

1. **Check Supabase Edge Function logs** for errors
2. **Check server system logs** for cron errors
3. **Verify network connectivity** from server to Supabase
4. **Test with curl directly:**
   ```bash
   source /var/www/Ai-Trading-Bots/.env.cron
   curl -X POST "${SUPABASE_URL}/functions/v1/bot-scheduler" \
     -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
     -H "x-cron-secret: ${CRON_SECRET}" \
     -H "Content-Type: application/json"
   ```

---

**After fixing, wait 5 minutes and check logs again!** ⏰

