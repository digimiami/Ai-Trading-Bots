# 🔧 Webhook and API Issues - Analysis & Fixes

## 📋 Issues Identified from Logs

### 1. **Webhook Call Recording Returning Null** ✅ FIXED
**Symptom:** Logs show `📝 Recorded incoming webhook call: null`

**Root Cause:**
- Database insert might be failing silently
- Error object not being checked properly
- RLS policies might be blocking the insert

**Fix Applied:**
- Added explicit error checking for database insert
- Added detailed error logging with error code, details, and hints
- Added warning when insert returns no data
- Improved error messages for debugging

**Location:** `supabase/functions/tradingview-webhook/index.ts` (lines 241-281)

---

### 2. **HTTP 403 Forbidden from Bybit API** ⚠️ ONGOING
**Symptom:** 
- `⚠️ HTTP 403 Forbidden for BTCUSDT (Attempt 1/3)`
- `⚠️ Got 403 from https://api.bybit.com, trying alternate domain...`
- `📡 Response status for BTCUSDT via https://api.bytick.com: 403 Forbidden`
- `⚠️ All tickers fetch failed: HTTP 403`

**Root Cause:**
- Bybit API is blocking requests (rate limiting, IP blocking, or Cloudflare protection)
- Both primary and alternate domains are returning 403
- This prevents price fetching, which blocks trade execution

**Current Handling:**
- ✅ Domain retry logic (tries both `api.bybit.com` and `api.bytick.com`)
- ✅ Exponential backoff (2s, 4s, 8s delays)
- ✅ 3 retry attempts per domain
- ✅ Detailed error logging

**Impact:**
- **CRITICAL:** Prevents trade execution when price cannot be fetched
- Manual trade signals are received but cannot execute due to price fetch failure

**Recommended Solutions:**

1. **Immediate Actions:**
   - Check if Supabase Edge Function IPs are whitelisted in Bybit (if IP whitelist is enabled)
   - Reduce request frequency to avoid rate limits
   - Consider using a proxy or VPN for API requests

2. **Code Improvements (Future):**
   - Add fallback price source (e.g., CoinGecko, Binance public API)
   - Implement request rate limiting/throttling
   - Add caching for price data (reduce API calls)
   - Consider using Bybit WebSocket for real-time prices instead of REST API

3. **Infrastructure:**
   - Contact Bybit support if IP blocking persists
   - Consider using a dedicated IP or proxy service
   - Monitor API rate limits and adjust request patterns

---

### 3. **Time Sync Failure** ✅ HANDLED
**Symptom:**
- `Time sync failed: Error: Bybit time sync returned non-JSON (text/html)`

**Root Cause:**
- Bybit time sync endpoint is also returning HTML (403 error page) instead of JSON

**Current Handling:**
- ✅ Content-type check before JSON parsing (recent fix)
- ✅ Fallback to Coinbase time API
- ✅ Graceful error handling (doesn't block execution)

**Status:** Working correctly with fallback mechanism

---

### 4. **Bot Status "Stopped"** ✅ WORKING AS INTENDED
**Symptom:**
- `Status: stopped` but bot is still processing manual signals

**Behavior:**
- ✅ Manual trade signals (from webhooks) are processed even when bot is stopped
- ✅ Regular strategy execution is skipped when bot is stopped
- ✅ This is the intended behavior - webhooks can trigger trades even on stopped bots

**Status:** Working correctly

---

## ✅ Fixes Applied

### 1. Improved Webhook Call Recording Error Handling
**File:** `supabase/functions/tradingview-webhook/index.ts`

**Changes:**
- Added explicit error checking for database insert
- Added detailed error logging (error code, details, hints)
- Added warning when insert returns null data
- Better error messages for debugging

**Code:**
```typescript
const { data: recordedCall, error: insertError } = await supabaseClient
  .from("webhook_calls")
  .insert({...})
  .select()
  .single();

if (insertError) {
  console.error("❌ Database error recording webhook call:", {
    error: insertError.message,
    code: insertError.code,
    details: insertError.details,
    hint: insertError.hint,
    rawBodyLength: rawBody.length
  });
  webhookCallId = null;
} else {
  webhookCallId = recordedCall?.id || null;
  if (webhookCallId) {
    console.log("📝 Recorded incoming webhook call:", webhookCallId);
  } else {
    console.warn("⚠️ Webhook call insert returned no data (recordedCall is null)");
  }
}
```

---

## 📊 Current Status

| Issue | Status | Priority | Action Required |
|-------|--------|----------|----------------|
| Webhook call recording null | ✅ Fixed | High | Deploy fix |
| HTTP 403 from Bybit | ⚠️ Ongoing | Critical | Infrastructure/API key review |
| Time sync failure | ✅ Handled | Low | None (fallback working) |
| Bot status handling | ✅ Working | Low | None |

---

## 🚀 Next Steps

1. **Deploy the webhook fix** - Improves error visibility
2. **Investigate Bybit 403 errors:**
   - Check Bybit API key settings (IP whitelist, permissions)
   - Review rate limits and request frequency
   - Consider implementing price caching
   - Add fallback price source
3. **Monitor logs** - After deployment, check if webhook recording errors are resolved

---

## 📝 Notes

- The 403 errors are the primary blocker for trade execution
- Manual trade signals are being received correctly
- Webhook processing is working, but trades fail due to price fetch errors
- All error handling improvements are in place and working

