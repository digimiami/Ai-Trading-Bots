# Fix ML Auto-Retrain Secret Mismatch

## Problem
The logs show:
- `hasSecret: true` ✅ (Header is being sent)
- `hasExpectedSecret: true` ✅ (Edge Function has secret configured)
- `matches: false` ❌ (But they don't match!)

## Solution: Verify Secret Values Match

### Step 1: Get the Secret from Edge Function

1. Go to **Supabase Dashboard** → **Edge Functions** → **ml-auto-retrain**
2. Click **Secrets** tab
3. Find `ML_AUTO_RETRAIN_SECRET`
4. **Copy the exact value** (be careful with spaces/line breaks)

### Step 2: Check Your SQL Function

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query to see what secret value is in your function:

```sql
SELECT 
  prosrc 
FROM pg_proc 
WHERE proname = 'trigger_ml_auto_retrain';
```

Look for the line with `ml_secret := '...'` and check the value.

### Step 3: Update the Secret

You have two options:

#### Option A: Update Database Settings (Recommended)

Run this in SQL Editor (replace with your actual secret):

```sql
ALTER DATABASE postgres SET app.ml_auto_retrain_secret = 'YOUR_ACTUAL_SECRET_VALUE_HERE';
```

Make sure to:
- Use single quotes around the value
- Copy the exact value from Edge Function secrets
- No extra spaces or line breaks

#### Option B: Update Function Directly

1. Find the function in SQL Editor:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'trigger_ml_auto_retrain';
```

2. Update the function with the correct secret:

```sql
CREATE OR REPLACE FUNCTION trigger_ml_auto_retrain()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  ml_secret TEXT;
  response_id BIGINT;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);
  ml_secret := current_setting('app.ml_auto_retrain_secret', true);
  
  IF supabase_url IS NULL THEN
    supabase_url := 'https://dkawxgwdqiirgmmjbvhc.supabase.co';
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := 'YOUR_SERVICE_ROLE_KEY';
  END IF;
  
  IF ml_secret IS NULL THEN
    -- ⚠️ REPLACE THIS WITH YOUR ACTUAL SECRET FROM EDGE FUNCTION SECRETS
    ml_secret := 'YOUR_ACTUAL_ML_AUTO_RETRAIN_SECRET_VALUE';
  END IF;
  
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/ml-auto-retrain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key,
      'x-cron-secret', ml_secret
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'ML auto-retrain triggered: Request ID %', response_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger ML auto-retrain: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Replace `YOUR_ACTUAL_ML_AUTO_RETRAIN_SECRET_VALUE` with the exact value from Edge Function secrets.

### Step 4: Test Again

After updating, test manually:

```sql
SELECT trigger_ml_auto_retrain();
```

Then check the Edge Function logs. You should see:
- `matches: true` ✅

## Common Issues

### 1. Extra Spaces
Make sure there are no leading/trailing spaces in the secret value.

### 2. Line Breaks
If you copied the secret with line breaks, remove them.

### 3. Quotes
Make sure you're using single quotes `'...'` not double quotes `"..."` in SQL.

### 4. Special Characters
If your secret has special characters, they should be fine, but make sure they're copied exactly.

## Quick Debug Query

Run this to see what values are being used:

```sql
SELECT 
  current_setting('app.ml_auto_retrain_secret', true) as db_secret,
  current_setting('app.service_role_key', true) as service_key,
  current_setting('app.supabase_url', true) as supabase_url;
```

If `db_secret` is NULL, the function will use the hardcoded fallback value.

## Verify Secret Match

To double-check, you can temporarily add logging:

```sql
CREATE OR REPLACE FUNCTION trigger_ml_auto_retrain()
RETURNS void AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  ml_secret TEXT;
  response_id BIGINT;
BEGIN
  -- ... (get values) ...
  
  -- Log the secret (first 10 chars only for security)
  RAISE NOTICE 'Using secret: %...', LEFT(ml_secret, 10);
  
  -- ... (rest of function) ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then compare the first 10 characters with your Edge Function secret to verify they match.
