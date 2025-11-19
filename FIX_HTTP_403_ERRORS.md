# 🔧 Fix HTTP 403 Errors - Bybit API Blocking

## 📊 Error Analysis Results

**BTC TRADINGVIEW ALERT TEST:**
- Total Errors: **135**
- HTTP 403 Errors: **101** (75%)
- Price Fetch Errors: **45** (33%)
- HTTP 403 in Details: **0** (errors logged in message, not details)

**ETH TRADINGVIEW ALERT TEST:**
- Total Errors: **107**
- HTTP 403 Errors: **73** (68%)
- Price Fetch Errors: **45** (42%)
- HTTP 403 in Details: **0** (errors logged in message, not details)

## 🔴 Root Cause

**Bybit API is blocking requests with HTTP 403 Forbidden:**
- Rate limiting (too many requests)
- IP blocking (Supabase Edge Function IPs not whitelisted)
- Cloudflare protection
- API key restrictions

## ✅ Solutions

### **Solution 1: Check Bybit API Key Settings (IMMEDIATE)**

1. **Go to Bybit → API Management**
2. **Check IP Whitelist:**
   - If enabled, you need to whitelist Supabase Edge Function IPs
   - **OR** disable IP whitelist (less secure but easier)
3. **Verify API Key Permissions:**
   - Must have "Read" permission for market data
   - Must have "Trade" permission for order execution
4. **Check Rate Limits:**
   - Bybit has rate limits (e.g., 120 requests/minute)
   - Too many bots requesting prices simultaneously can trigger 403

### **Solution 2: Implement Price Caching (RECOMMENDED)**

**Problem:** Each bot execution fetches price independently, causing rate limit issues.

**Solution:** Cache prices for 5-10 seconds to reduce API calls.

**Implementation:**
- Add Redis or in-memory cache for prices
- Cache key: `price:{symbol}:{exchange}`
- TTL: 5-10 seconds
- All bots share cached prices

### **Solution 3: Add Fallback Price Source (RECOMMENDED)**

**Problem:** If Bybit fails, trades cannot execute.

**Solution:** Use alternative price sources as fallback:
- CoinGecko (free, no API key needed)
- Binance public API
- CryptoCompare

**Implementation:**
- Try Bybit first
- If 403 error, fallback to CoinGecko
- Log which source was used

### **Solution 4: Reduce Request Frequency (IMMEDIATE)**

**Problem:** Too many simultaneous requests trigger rate limits.

**Solution:**
- Add request throttling/queuing
- Batch price requests
- Add delays between requests from same bot

### **Solution 5: Use Bybit WebSocket (FUTURE)**

**Problem:** REST API has rate limits.

**Solution:** Use Bybit WebSocket for real-time prices:
- No rate limits
- Real-time updates
- More efficient

---

## 🚀 Immediate Action Plan

### **Step 1: Check Bybit API Settings (5 minutes)**

1. Login to Bybit
2. Go to API Management
3. Check your API key:
   - **IP Whitelist:** Disable or add Supabase IPs
   - **Permissions:** Ensure "Read" is enabled
   - **Rate Limits:** Check current usage

### **Step 2: Clear Error Logs (Optional)**

Once API is fixed, you can clear old errors:

```sql
-- Clear error logs for these bots (optional)
DELETE FROM bot_activity_logs
WHERE bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH
)
AND level = 'error'
AND message LIKE '%403%';
```

### **Step 3: Restart Bots**

After fixing API settings:
1. Start the bots again
2. Monitor for new errors
3. Should see successful price fetches

### **Step 4: Monitor**

Watch for:
- ✅ Successful price fetches
- ✅ No more 403 errors
- ✅ Trades executing normally

---

## 📝 Code Improvements (Future)

### **1. Better Error Handling**

Add retry logic with exponential backoff:
- Retry 3 times with increasing delays
- Log which attempt succeeded
- Use fallback source if all retries fail

### **2. Price Caching**

Implement caching to reduce API calls:
```typescript
// Pseudo-code
const cachedPrice = priceCache.get(`${symbol}:${exchange}`);
if (cachedPrice && Date.now() - cachedPrice.timestamp < 5000) {
  return cachedPrice.price;
}
// Fetch from API and cache
```

### **3. Fallback Price Sources**

Add CoinGecko as fallback:
```typescript
// Try Bybit first
try {
  price = await fetchBybitPrice(symbol);
} catch (error) {
  if (error.status === 403) {
    // Fallback to CoinGecko
    price = await fetchCoinGeckoPrice(symbol);
  }
}
```

---

## 🔍 Diagnostic Queries

### **Check Recent 403 Errors:**

```sql
SELECT 
    bal.timestamp,
    bal.message,
    bal.details,
    tb.name as bot_name
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND bal.level = 'error'
AND (bal.message LIKE '%403%' OR bal.message LIKE '%Forbidden%')
ORDER BY bal.timestamp DESC
LIMIT 10;
```

### **Check Error Rate Over Time:**

```sql
SELECT 
    DATE_TRUNC('hour', bal.timestamp) as hour,
    COUNT(*) as error_count
FROM bot_activity_logs bal
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND bal.level = 'error'
AND bal.message LIKE '%403%'
GROUP BY hour
ORDER BY hour DESC;
```

---

## ✅ Success Criteria

After implementing fixes, you should see:
- ✅ 0 HTTP 403 errors
- ✅ Successful price fetches
- ✅ Trades executing normally
- ✅ No rate limit warnings

---

## 📞 Support

If issues persist:
1. Contact Bybit support about IP whitelist
2. Check Bybit status page for API issues
3. Consider using testnet for testing
4. Review Bybit API documentation for rate limits

