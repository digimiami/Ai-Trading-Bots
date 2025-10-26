# 🔧 **Fix OKX API 401 Error**

## **Problem:**
Your OKX bots are getting **401 Unauthorized** errors because the API credentials are invalid or missing.

---

## **Solution: Update OKX API Keys**

### **Step 1: Go to Settings Page**
1. Navigate to: http://localhost:3000/settings
2. Scroll to **"Exchange API Keys"** section

### **Step 2: Add OKX API Credentials**

You need to get these from OKX:
- **API Key**
- **Secret Key**
- **Passphrase**

**Where to get OKX API Keys:**
1. Go to: https://www.okx.com/account/my-api
2. Click **"Create API Key"**
3. Set permissions:
   - ✅ **Read** - Enabled
   - ✅ **Trade** - Enabled
   - ❌ **Withdraw** - Disabled (for security)
4. Save the credentials securely

### **Step 3: Enter in Settings**

In your app's Settings page:
```
OKX API Key: [Your API Key]
OKX Secret Key: [Your Secret Key]
OKX Passphrase: [Your Passphrase]
Testnet: ☑ (Enable for testing) or ☐ (Disable for live trading)
```

Click **"Save API Keys"**

### **Step 4: Test Connection**

Click **"Test Connection"** button to verify the credentials work.

You should see: ✅ **"OKX connection successful!"**

---

## **Alternative: Use Bybit for All Bots**

If you don't have OKX API keys, you can convert all OKX bots to use Bybit instead:

**Run this SQL in Supabase:**
```sql
-- Convert all OKX bots to Bybit
UPDATE trading_bots
SET exchange = 'bybit'
WHERE exchange = 'okx';
```

---

## **Temporary Fix: Stop OKX Bots**

Until you add OKX API keys, stop the OKX bots to prevent errors:

**Run this SQL:**
```sql
-- Stop all OKX bots temporarily
UPDATE trading_bots
SET status = 'stopped'
WHERE exchange = 'okx';
```

---

## **After Fixing:**

1. ✅ OKX bots will execute successfully
2. ✅ No more 401 errors
3. ✅ Trades will be placed on OKX exchange

**Note**: Always test with **Testnet mode enabled** first before using real funds!

