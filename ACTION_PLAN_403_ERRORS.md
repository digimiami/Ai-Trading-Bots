# 🎯 Action Plan: Fix HTTP 403 Errors

## 📊 Current Status

**BTC TRADINGVIEW ALERT TEST:**
- 135 total errors (101 HTTP 403, 45 price fetch)
- Status: **STOPPED** ✅

**ETH TRADINGVIEW ALERT TEST:**
- 107 total errors (73 HTTP 403, 45 price fetch)
- Status: **STOPPED** ✅

## ✅ Fixes Already Applied

1. ✅ **CoinGecko Fallback** - Automatically triggers on 403 errors
2. ✅ **Enhanced Error Handling** - Better logging and retry logic
3. ✅ **Expanded Coin Mapping** - Supports BTC, ETH, and more
4. ✅ **Deployed to Production** - `bot-executor` function updated

---

## 🚀 Immediate Actions (5 minutes)

### **Step 1: Restart the Bots**

1. Go to your bot management page
2. Start both bots:
   - `BTC TRADINGVIEW ALERT TEST`
   - `ETH TRADINGVIEW ALERT TEST`

### **Step 2: Monitor Logs**

Watch for these messages in the logs:

**✅ Success Indicators:**
- `✅ CoinGecko fallback price for BTCUSDT: $XX,XXX`
- `✅ CoinGecko fallback price for ETHUSDT: $X,XXX`
- `🔄 Trying CoinGecko public API as fallback (Bybit returned 403)`

**❌ If Still Failing:**
- `⚠️ CoinGecko fallback failed`
- `❌ Price fetch failed`

### **Step 3: Verify Trades Execute**

After restarting, check if:
- ✅ Prices are fetched successfully
- ✅ Trades can execute
- ✅ No new 403 errors appear

---

## 🧹 Optional: Clear Old Errors (After Fix Verified)

Once you confirm the fix is working, you can clear old error logs:

```sql
-- Clear old 403 errors (run AFTER confirming fix works)
DELETE FROM bot_activity_logs
WHERE bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714', -- BTC
    'f941a8bb-6414-435e-a043-3a1be7ca1218'  -- ETH
)
AND level = 'error'
AND (
    message LIKE '%403%' 
    OR message LIKE '%Forbidden%'
    OR message LIKE '%price fetch%'
)
AND timestamp < NOW() - INTERVAL '1 hour'; -- Only delete old errors
```

---

## 📈 Monitoring Queries

### **Check if Fix is Working:**

```sql
-- Monitor recent errors (should be 0 after fix)
SELECT 
    tb.name as bot_name,
    COUNT(*) FILTER (WHERE bal.message LIKE '%403%') as recent_403_errors,
    COUNT(*) FILTER (WHERE bal.message LIKE '%CoinGecko%') as coingecko_fallbacks,
    COUNT(*) as total_recent_errors
FROM bot_activity_logs bal
JOIN trading_bots tb ON bal.bot_id = tb.id
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND bal.timestamp > NOW() - INTERVAL '1 hour'
AND bal.level = 'error'
GROUP BY tb.name;
```

### **Check CoinGecko Fallback Usage:**

```sql
-- See if CoinGecko fallback is being used
SELECT 
    bal.timestamp,
    bal.message,
    bal.details
FROM bot_activity_logs bal
WHERE bal.bot_id IN (
    '81692bd2-43fe-4618-99ed-0422e9eb7714',
    'f941a8bb-6414-435e-a043-3a1be7ca1218'
)
AND (
    bal.message LIKE '%CoinGecko%'
    OR bal.message LIKE '%fallback%'
)
ORDER BY bal.timestamp DESC
LIMIT 20;
```

---

## 🔧 Long-Term Fix: Bybit API Configuration

### **Option 1: Disable IP Whitelist (Easiest)**

1. Go to Bybit → API Management
2. Select your API key
3. **Disable IP Whitelist** (if enabled)
4. Save changes

### **Option 2: Whitelist Supabase IPs (More Secure)**

1. Get Supabase Edge Function IPs (contact Supabase support)
2. Add IPs to Bybit API whitelist
3. Save changes

### **Option 3: Use Testnet (For Testing)**

1. Switch bots to testnet mode
2. Use Bybit testnet API keys
3. Testnet has fewer restrictions

---

## ✅ Success Criteria

After implementing fixes, you should see:

- ✅ **0 new HTTP 403 errors**
- ✅ **CoinGecko fallback messages in logs**
- ✅ **Successful price fetches**
- ✅ **Trades executing normally**
- ✅ **Error count not increasing**

---

## 📞 If Issues Persist

1. **Check Bybit API Status:**
   - Visit Bybit status page
   - Check for API outages

2. **Review Logs:**
   - Look for specific error messages
   - Check if CoinGecko is also failing

3. **Contact Support:**
   - Bybit support for API issues
   - Supabase support for Edge Function issues

---

## 📝 Notes

- **CoinGecko fallback is FREE** - No API key needed
- **CoinGecko has rate limits** - But much higher than Bybit
- **Prices may differ slightly** - CoinGecko uses aggregated data
- **Fallback only works for major coins** - BTC, ETH, etc.

---

## 🎯 Quick Start Checklist

- [ ] Restart BTC bot
- [ ] Restart ETH bot
- [ ] Monitor logs for CoinGecko fallback messages
- [ ] Verify trades can execute
- [ ] Check error count (should stop increasing)
- [ ] (Optional) Clear old errors after 1 hour
- [ ] (Optional) Fix Bybit API settings for long-term

