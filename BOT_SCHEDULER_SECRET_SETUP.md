# Bot Scheduler Secret: Create Your Own Name and Key

You don’t need access to `CRON_SECRET`. Use **`BOT_SCHEDULER_SECRET`** and a value you generate yourself.

---

## 1. Generate a new key

Run **one** of these in your terminal and copy the output:

**PowerShell (Windows):**
```powershell
$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

**Bash / WSL / macOS / Linux:**
```bash
openssl rand -base64 32
```

**Node:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Example output: `K7xPm2vN9qR4wY1zA3bC5dE6fG8hJ0kL2mN4oP6qR8sT0uV=`

---

## 2. Set the secret in Supabase

1. Open **Supabase Dashboard** → **Edge Functions**.
2. Open **bot-scheduler** → **Settings** (or **Secrets**).
3. Add a secret:
   - **Name:** `BOT_SCHEDULER_SECRET`
   - **Value:** the string you generated in step 1.
4. Do the same for **bot-executor** (same name and same value):
   - **Edge Functions** → **bot-executor** → **Settings** → add `BOT_SCHEDULER_SECRET` with the **same value**.

---

## 3. Use it in your schedule

- **Dashboard schedule:**  
  **Edge Functions** → **bot-scheduler** → **Schedules** → your schedule → **Headers**  
  - Key: `x-cron-secret`  
  - Value: the **exact same** string you set as `BOT_SCHEDULER_SECRET`.

- **pg_cron / SQL:**  
  If you use `set_cron_app_settings.sql`, set `app.cron_secret` to that same value (see that file).

- **External cron (curl):**  
  Use the same value in the header:  
  `-H "x-cron-secret: YOUR_GENERATED_VALUE"`

---

## Summary

| Where              | Name                  | Value                    |
|--------------------|-----------------------|---------------------------|
| bot-scheduler env  | `BOT_SCHEDULER_SECRET`| Your generated key       |
| bot-executor env   | `BOT_SCHEDULER_SECRET`| Same key                  |
| Schedule header    | `x-cron-secret`       | Same key                  |

The code checks **`BOT_SCHEDULER_SECRET`** first, then **`CRON_SECRET`**. So you only need to set **`BOT_SCHEDULER_SECRET`** (and the `x-cron-secret` header) and never use `CRON_SECRET` if you prefer.

---

## Fix: POST 401 on bot-scheduler

If you see **POST | 401** on `/functions/v1/bot-scheduler` in Edge Function logs, the schedule is calling the function but the secret check is failing.

**Checklist:**

1. **Secret is set on the function**  
   **Edge Functions** → **bot-scheduler** → **Settings** (or **Secrets**).  
   Ensure **BOT_SCHEDULER_SECRET** exists and its value is the key you chose (no extra spaces, copy-paste only).

2. **Schedule sends the header**  
   **Edge Functions** → **bot-scheduler** → **Schedules**.  
   Open the schedule that runs every minute (or the one that triggers these 401s).  
   In **Headers** you must have:
   - **Key:** `x-cron-secret` (lowercase, with hyphen)
   - **Value:** the **exact same** string as BOT_SCHEDULER_SECRET

3. **Typo / mismatch**  
   If the header value and the secret differ by a single character or space, you get 401. Re-copy the value into both places.

4. **Redeploy after changing secrets**  
   After adding or changing **BOT_SCHEDULER_SECRET**, redeploy **bot-scheduler** (and **bot-executor** if you set it there too) so the new secret is used.

**Quick test (curl):**  
Supabase requires an **Authorization** or **apikey** header to reach the function. Use your **anon** or **service_role** key (Dashboard → Settings → API):

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/bot-scheduler" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_OR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_ANON_OR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_BOT_SCHEDULER_SECRET_VALUE"
```

If both headers and the secret are correct, you get 200. Without Authorization/apikey you get `401 Missing authorization header`; without the right x-cron-secret you get 401 from our code.
