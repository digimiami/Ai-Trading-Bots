# Bot Scheduler – Full Server Cron Setup

Run the bot-scheduler every minute from your server (e.g. `srv853835`) using cron.

---

## Exact terminal input (copy-paste in order)

**Step 1 – Create env file**  
Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your real Supabase service_role key (Dashboard → Settings → API), then paste and run:

```bash
cat > /root/.supabase-bot-scheduler << 'EOF'
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
BOT_SCHEDULER_SECRET=UYavThDT4p/wAvhNgS3h/6NtCd+QeBmL1syaTjLz8nk=
EOF
chmod 600 /root/.supabase-bot-scheduler
```

**Step 2 – Create log file and add cron**  
Paste and run:

```bash
touch /var/log/bot-scheduler.log
chmod 644 /var/log/bot-scheduler.log
(crontab -l 2>/dev/null; echo '* * * * * . /root/.supabase-bot-scheduler && curl -s -X POST "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler" -H "Content-Type: application/json" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "x-cron-secret: $BOT_SCHEDULER_SECRET" -d '\''{}'\'' >> /var/log/bot-scheduler.log 2>&1') | crontab -
```

**Step 3 – Test once**  
Paste and run:

```bash
. /root/.supabase-bot-scheduler && curl -s -X POST "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler" -H "Content-Type: application/json" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "x-cron-secret: $BOT_SCHEDULER_SECRET" -d '{}'
```

You should see JSON with `"success":true`. Cron will run every minute and append to `/var/log/bot-scheduler.log`.

---

## 1. Create the env file (secrets) – alternative

On the server:

```bash
sudo nano /root/.supabase-bot-scheduler
```

Paste this (then replace the two placeholders with your real values):

```
# Bot scheduler cron – keep this file secret (chmod 600)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY_HERE
BOT_SCHEDULER_SECRET=UYavThDT4p/wAvhNgS3h/6NtCd+QeBmL1syaTjLz8nk=
```

Save (Ctrl+O, Enter) and exit (Ctrl+X). Restrict permissions:

```bash
chmod 600 /root/.supabase-bot-scheduler
```

---

## 2. Add the cron job

```bash
crontab -e
```

Append this line (runs every minute, logs to `/var/log/bot-scheduler.log`):

```
* * * * * . /root/.supabase-bot-scheduler && curl -s -X POST "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler" -H "Content-Type: application/json" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "x-cron-secret: $BOT_SCHEDULER_SECRET" -d '{}' >> /var/log/bot-scheduler.log 2>&1
```

Save and exit. Ensure the log file exists and is writable:

```bash
touch /var/log/bot-scheduler.log
chmod 644 /var/log/bot-scheduler.log
```

---

## 3. One-off test

```bash
. /root/.supabase-bot-scheduler && curl -s -X POST "https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler" -H "Content-Type: application/json" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "x-cron-secret: $BOT_SCHEDULER_SECRET" -d '{}'
```

You should see JSON with `"success":true` and `botsExecuted`, etc.

---

## 4. Check cron and logs

```bash
# List cron jobs
crontab -l

# Last lines of scheduler log
tail -20 /var/log/bot-scheduler.log
```

---

## Summary

| Item | Value |
|------|--------|
| Env file | `/root/.supabase-bot-scheduler` (chmod 600) |
| Schedule | Every minute (`* * * * *`) |
| Log | `/var/log/bot-scheduler.log` |
| URL | `https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/bot-scheduler` |

Replace `SUPABASE_SERVICE_ROLE_KEY` and `BOT_SCHEDULER_SECRET` in the env file with your real values; the cron line uses those variables and does not contain secrets.
