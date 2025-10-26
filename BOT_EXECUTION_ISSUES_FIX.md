# 🔧 **Bot Execution Issues - Complete Fix Guide**

## **📋 Issues Found in Logs:**

### **❌ Issue 1: OKX API 401 Error**
```
Error: OKX API error: 401
```
**Cause**: Missing or invalid OKX API credentials  
**Impact**: All OKX bots failing to execute trades

---

### **❌ Issue 2: Insufficient Balance**
```
Bybit: "ab not enough for new order"
Order value: $751.90
```
**Cause**: Trade amount ($750) exceeds available testnet balance  
**Impact**: Bybit orders being rejected

---

### **❌ Issue 3: Spot Trading - Cannot Sell**
```
Cannot sell on spot market without owning the asset
```
**Cause**: Spot bots trying to SELL crypto they don't own  
**Impact**: Spot trading bots failing

---

### **❌ Issue 4: Price = 0 in Market Data**
```
📊 Bot market data: Price=0, RSI=58.40
```
**Cause**: Market data fetching issue or API problem  
**Impact**: Incorrect trade calculations

---

## **✅ Complete Fix - Run These Steps:**

### **STEP 1: Run SQL Fix (Required)**

**Go to Supabase SQL Editor** and run:

```sql
-- Fix all bot configuration issues

-- 1. Convert all bots to FUTURES (safer than spot)
UPDATE trading_bots
SET 
    trading_type = 'futures',
    leverage = CASE 
        WHEN leverage IS NULL OR leverage < 1 THEN 3 
        WHEN leverage > 10 THEN 10
        ELSE leverage 
    END
WHERE trading_type = 'spot' OR trading_type IS NULL;

-- 2. Reduce trade amounts to prevent balance errors
UPDATE trading_bots
SET trade_amount = CASE
    WHEN trade_amount > 100 THEN 20   -- Max $20 per trade
    WHEN trade_amount > 50 THEN 15
    ELSE 10                            -- Minimum $10
END
WHERE trade_amount > 20 OR trade_amount IS NULL;

-- 3. Stop OKX bots until credentials are added
UPDATE trading_bots
SET status = 'stopped'
WHERE exchange = 'okx' AND status = 'running';

-- 4. Add comment for OKX bots
UPDATE trading_bots
SET name = name || ' (Need OKX API)'
WHERE exchange = 'okx' AND name NOT LIKE '%(Need OKX API)%';

-- 5. View updated bots
SELECT 
    name,
    exchange,
    symbol,
    trading_type,
    leverage,
    trade_amount,
    status
FROM trading_bots
ORDER BY status DESC, exchange, symbol;
```

---

### **STEP 2: Add OKX API Keys (If Using OKX)**

**If you want to use OKX bots:**

1. **Go to Settings**: http://localhost:3000/settings
2. **Get OKX API Keys** from: https://www.okx.com/account/my-api
3. **Enter credentials**:
   - API Key
   - Secret Key
   - Passphrase
4. **Enable Testnet** for testing
5. **Test Connection**
6. **Save**

**Then activate OKX bots:**
```sql
-- Restart OKX bots after adding API keys
UPDATE trading_bots
SET status = 'running',
    name = REPLACE(name, ' (Need OKX API)', '')
WHERE exchange = 'okx' AND status = 'stopped';
```

---

### **STEP 3: Alternative - Use Bybit for All Bots**

**If you don't want to use OKX**, convert all to Bybit:

```sql
-- Convert all OKX bots to Bybit
UPDATE trading_bots
SET exchange = 'bybit',
    name = REPLACE(name, ' (Need OKX API)', '')
WHERE exchange = 'okx';
```

---

## **📊 After Applying Fixes:**

### **Expected Bot Configuration:**
- ✅ **Trading Type**: FUTURES (allows both buy and sell)
- ✅ **Leverage**: 3x (balanced risk)
- ✅ **Trade Amount**: $10-$20 per trade
- ✅ **Bybit Bots**: Running normally
- ✅ **OKX Bots**: Stopped (until API keys added) OR converted to Bybit

### **Expected Behavior:**
- ✅ No more "insufficient balance" errors
- ✅ No more "cannot sell on spot" errors
- ✅ Bybit bots executing successfully
- ✅ OKX bots either stopped or working (if keys added)

---

## **🎯 Recommended Configuration:**

### **For Safe Testing:**
```
Exchange: Bybit
Trading Type: Futures
Leverage: 3x
Trade Amount: $10-20
Stop Loss: 2%
Take Profit: 4%
Testnet: Enabled ✅
```

### **For Real Trading:**
```
Exchange: Bybit or OKX (with valid keys)
Trading Type: Futures
Leverage: 2-5x (start conservative)
Trade Amount: 1-2% of your total balance
Stop Loss: 1-2%
Take Profit: 2-4%
Testnet: Disabled
```

---

## **🔍 Verify Fixes:**

### **Check Supabase Logs:**
https://supabase.com/dashboard/project/dkawxgwdqiirgmmjbvhc/logs/edge-functions

**What you should see:**
- ✅ No more 401 errors
- ✅ No more "ab not enough" errors
- ✅ No more "cannot sell on spot" errors
- ✅ Successful order placements

### **Check Your Dashboard:**
1. Go to **Bots Page**: http://localhost:3000/bots
2. Verify:
   - ✅ Bots show correct trading type (futures)
   - ✅ Trade amounts are reasonable ($10-20)
   - ✅ Bybit bots are running
   - ✅ OKX bots are stopped (unless you added keys)

---

## **🆘 Quick Commands:**

### **Stop All Bots:**
```sql
UPDATE trading_bots SET status = 'stopped';
```

### **Restart All Bybit Bots:**
```sql
UPDATE trading_bots 
SET status = 'running' 
WHERE exchange = 'bybit';
```

### **Delete All Test Bots:**
```sql
DELETE FROM trading_bots 
WHERE name LIKE '%TEST%' 
   OR name LIKE '%TES%';
```

---

## **✅ Summary:**

**Run the SQL fix in STEP 1** to resolve all configuration issues. This will:
1. Convert all bots to FUTURES trading
2. Reduce trade amounts to safe levels
3. Stop OKX bots until credentials are added
4. Set proper leverage (3x)

**Your bots will then execute successfully!** 🚀

