# 🔧 Fix: Position Sync HTTP 401 Errors

## Problem

All 13 bots are getting **HTTP 401 Unauthorized** errors when trying to fetch positions from Bybit:

```
Failed to fetch positions: HTTP 401
```

This indicates an **authentication failure** with Bybit's API.

## Root Causes

HTTP 401 errors from Bybit typically mean:

1. **Invalid API Key or Secret**: The API key/secret combination is incorrect
2. **Missing Permissions**: API key doesn't have "Position" read permission
3. **Expired/Revoked Keys**: API keys have been revoked or expired
4. **Testnet/Mainnet Mismatch**: Using testnet keys for mainnet (or vice versa)
5. **Incorrect Signature**: Signature generation might be incorrect (less likely)

## Enhanced Error Logging

The function now logs:
- ✅ API key preview (first 8 chars for security)
- ✅ Testnet/mainnet status
- ✅ Full Bybit error response (retCode, retMsg)
- ✅ Request details (category, symbol, timestamp)
- ✅ Signature info (payload length, signature length)
- ✅ Helpful hints based on error codes

## How to Fix

### Step 1: Check API Keys in Database

Run this SQL query to check your API keys:

```sql
SELECT 
  id,
  user_id,
  exchange,
  is_testnet,
  is_active,
  LEFT(api_key, 8) as api_key_preview,
  created_at,
  updated_at
FROM api_keys
WHERE exchange = 'bybit'
  AND is_testnet = false
  AND is_active = true
ORDER BY created_at DESC;
```

### Step 2: Verify API Key Permissions

Your Bybit API keys **MUST** have:
- ✅ **Read** permission for "Position"
- ✅ **Read** permission for "Account" (optional but recommended)
- ✅ **No IP restrictions** (or include Supabase Edge Function IPs)

### Step 3: Regenerate API Keys (if needed)

1. Go to Bybit → API Management
2. Create new API key with:
   - **Read** permission for "Position"
   - **Read** permission for "Account"
   - **No IP restrictions** (or whitelist Supabase IPs)
3. Update keys in your account settings

### Step 4: Check Testnet vs Mainnet

Make sure:
- ✅ Real trading bots use **mainnet** API keys (`is_testnet = false`)
- ✅ Paper trading bots can use testnet keys
- ✅ The `position-sync` function only uses mainnet keys

### Step 5: Verify API Key Format

Bybit API keys should be:
- **API Key**: Usually starts with a specific prefix (varies by account)
- **API Secret**: Long random string (keep secret!)

## Common Bybit Error Codes

- **10003**: Invalid API key
- **10004**: Invalid signature
- **10005**: Request expired (timestamp issue)
- **10006**: IP not whitelisted
- **33004**: Insufficient permissions

## Testing After Fix

After updating API keys, check logs for:
- ✅ `🔑 Using API key: [preview]... (testnet: false)`
- ✅ `📊 Exchange positions found: X for [symbol]`
- ✅ No more `HTTP 401` errors

## Related Files

- `supabase/functions/position-sync/index.ts` (enhanced error logging)
- Bybit API Documentation: https://bybit-exchange.github.io/docs/v5/

## Next Steps

1. **Check logs** for detailed error messages (now includes Bybit retCode/retMsg)
2. **Verify API keys** have correct permissions
3. **Update API keys** if needed
4. **Re-run position-sync** and check logs again
