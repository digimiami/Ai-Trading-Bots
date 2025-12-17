# How to Check 401 Response Body for Debug Info

Since the Logs tab isn't showing anything, we can get the debug information from the **response body** in the Invocations tab.

## Step-by-Step Instructions

### Method 1: Check Invocation Response Body

1. Go to **Supabase Dashboard** → **Edge Functions** → **position-sync**
2. Click on the **Invocations** tab
3. Find a recent 401 error (click on one of the rows)
4. Look for a **"Response"** or **"Response Body"** section
5. Expand it to see the JSON response

The response should contain a `debug` object with:
- `envSecretPresent`: Whether the environment variable exists
- `headerSecretPresent`: Whether the header was received
- `envFirstChars`: First 10 characters of the secret from env var
- `headerFirstChars`: First 10 characters of the secret from header
- `exactMatch`: Whether they match exactly
- `trimmedMatch`: Whether they match after trimming
- `allHeadersFound`: List of all headers received

### Method 2: Use curl and Check Response

Run this command from your VPS (with correct URL):

```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/position-sync \
  -H "x-cron-secret: XOGLwBqy3lKb4uA5vxPTUhrzemEc20C6" \
  -H "Content-Type: application/json" \
  -v
```

The `-v` flag will show you the full response including headers and body.

### Method 3: Check Invocation Details

1. In the **Invocations** tab, click on a specific 401 invocation
2. Look for tabs like: **Overview**, **Request**, **Response**, **Logs**
3. Click on **Response** tab
4. You should see the JSON response with the `debug` object

## What to Look For

The response body will look like this:

```json
{
  "error": "Unauthorized",
  "message": "POSITION_SYNC_SECRET mismatch or missing",
  "requestId": "abc12345",
  "hint": "Check that POSITION_SYNC_SECRET environment variable matches x-cron-secret header value (check for whitespace)",
  "debug": {
    "envSecretPresent": true/false,
    "envSecretLength": 32,
    "headerSecretPresent": true/false,
    "headerSecretLength": 32,
    "exactMatch": false,
    "trimmedMatch": false,
    "envFirstChars": "XOGLwBqy3l",
    "headerFirstChars": "...",
    "allHeadersFound": ["content-type", "x-cron-secret", ...]
  }
}
```

## Interpreting the Debug Info

### If `envSecretPresent: false`
- The `POSITION_SYNC_SECRET` environment variable is not set or not accessible
- **Solution**: Go to Edge Functions → position-sync → Settings → Add/Edit `POSITION_SYNC_SECRET`
- **Then**: Redeploy the function (Code tab → Deploy)

### If `headerSecretPresent: false`
- The `x-cron-secret` header is not being sent by the cron job
- **Solution**: Check cron job configuration:
  - Header Key: `x-cron-secret` (lowercase, hyphen)
  - Header Value: `XOGLwBqy3lKb4uA5vxPTUhrzemEc20C6`
  - Verify the cron job is using "HTTP Request" type, not "Supabase Edge Function"

### If both are `true` but `exactMatch: false` and `trimmedMatch: false`
- The values don't match
- Compare `envFirstChars` vs `headerFirstChars`
- Check for typos, extra spaces, or encoding issues

### If `trimmedMatch: true` but `exactMatch: false`
- There's whitespace in one of the values
- The function should still work (we handle trimmed matches), but you should fix the whitespace

## Next Steps

1. **Check the response body** from a 401 invocation
2. **Share the `debug` object** from the response
3. Based on that, we can fix the exact issue

The response body contains all the information we need, even if logs aren't showing!
