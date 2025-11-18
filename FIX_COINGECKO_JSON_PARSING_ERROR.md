# 🔧 Fix: CoinGecko JSON Parsing Error

## Problem Identified

From the logs, two critical issues were blocking all trades:

1. **HTTP 403 Errors from Bybit** - All price fetch attempts returning `403 Forbidden`
2. **CoinGecko Fallback Error** - `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

The second error occurred when the CoinGecko fallback tried to parse an HTML error page as JSON, likely due to:
- Rate limiting from CoinGecko
- CoinGecko returning an error page instead of JSON
- Content-type mismatch (HTML instead of JSON)

## Root Cause

When CoinGecko API is rate-limited or returns an error, it sends an HTML error page instead of JSON. The code was trying to parse this HTML as JSON, causing:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## Fix Applied

**File**: `supabase/functions/bot-executor/index.ts` (lines 1242-1281)

### Changes:

1. **Content-Type Validation**: Check `content-type` header before parsing JSON
   ```typescript
   const contentType = cgResp.headers.get('content-type') || '';
   if (!contentType.includes('application/json')) {
     // Handle HTML response gracefully
   }
   ```

2. **Better Error Handling**: 
   - Detect HTML responses and log appropriately
   - Don't try to parse HTML as JSON
   - Provide clearer error messages

3. **Rate Limit Protection**: Added 500ms delay before CoinGecko requests to reduce rate limit issues

4. **Improved Logging**: 
   - Log content-type when non-JSON is received
   - Log HTTP status codes from CoinGecko
   - Better error messages for debugging

## Remaining Issues

### Issue 1: Bybit HTTP 403 Blocking All Requests
**Status**: ❌ Still blocking all price fetches

**Evidence**:
- All Bybit API requests return `HTTP 403 Forbidden`
- Both `api.bybit.com` and `api.bytick.com` are blocked
- All symbol variants (BTCUSDT, 1000BTCUSDT, 10000BTCUSDT) fail

**Possible Causes**:
1. IP blocking from Supabase Edge Functions
2. Rate limiting (too many requests)
3. Bybit API changes or restrictions
4. Regional blocking

**Solutions to Consider**:
1. Contact Bybit support about the 403 errors
2. Use authenticated endpoints (which might not be blocked)
3. Implement request throttling/rate limiting
4. Use a proxy or different IP range

### Issue 2: CoinGecko Fallback May Also Be Rate Limited
**Status**: ⚠️ May be rate limited (now handled gracefully)

**Evidence**:
- CoinGecko returning HTML error pages
- Free tier has rate limits (10-50 calls/minute)

**Solutions**:
1. ✅ **FIXED**: Better error handling (no more JSON parsing errors)
2. ✅ **FIXED**: Content-type validation
3. Consider: Add CoinGecko API key for higher rate limits
4. Consider: Cache prices to reduce API calls

## Next Steps

1. **Wait for deployment** (code is pushed)
2. **Test with new TradingView alert** - Should see better error messages
3. **Check logs** for:
   - `⚠️ CoinGecko returned non-JSON response` - If CoinGecko is blocked
   - `⚠️ CoinGecko API error (429)` - If rate limited
   - `✅ CoinGecko fallback price` - If it works

4. **Address Bybit 403 errors**:
   - Check Bybit API status page
   - Contact Bybit support
   - Consider using authenticated endpoints for price data
   - Implement request throttling

## Expected Behavior After Fix

- ✅ No more `Unexpected token '<'` errors from CoinGecko
- ✅ Clear error messages when CoinGecko is rate limited
- ✅ Better logging for debugging
- ⚠️ Still need to resolve Bybit HTTP 403 errors for primary price source

## Testing

After deployment, send a TradingView alert and check:
1. Logs should show CoinGecko fallback attempts
2. If CoinGecko works: `✅ CoinGecko fallback price for BTCUSDT: $XXXXX`
3. If CoinGecko fails: `⚠️ CoinGecko fallback failed: Received HTML instead of JSON (likely rate limited or blocked)`
4. No more `Unexpected token '<'` errors

