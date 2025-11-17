# 🔑 API Key Update Instructions

Based on the diagnostic results, here's what needs to be done:

## 📊 Current Status

### Users with API Keys:
1. **diazites1@gmail.com**
   - Bybit keys: ✅ 1 active
   - Real trading bots: 2
   - Last updated: Nov 16, 2025 (Recent ✅)

2. **digimiami@gmail.com**
   - Bybit keys: ✅ 1 active
   - Real trading bots: 2
   - Last updated: Nov 6, 2025 (⚠️ 10 days old - may need update)

3. **digimiami+2@gmail.com**
   - Bybit keys: ✅ 1 active
   - Real trading bots: 0
   - Last updated: Oct 29, 2025 (⚠️ 18 days old)

---

## 🚨 Action Required

### For Users with API Key Errors (Code: 10003):

The following bots are experiencing "API key is invalid" errors:

1. **Trendline Breakout Strategy - SOLUSDT**
2. **Trend Following Strategy - DOGEUSDT**
3. **Hybrid Trend + Mean Reversion Strategy - HMARUSDT**
4. **ETH TRADINGVIEW**
5. **BTC TRADIGVEW**

---

## ✅ Step-by-Step Fix Instructions

### Step 1: Verify API Key on Bybit

1. Go to **Bybit** → **Account & Security** → **API Management**
2. Find your API key
3. Check:
   - ✅ API key is **Active**
   - ✅ Has **Trading** permissions enabled
   - ✅ Has **Read** permissions enabled
   - ✅ **IP whitelist** is configured (if required)
   - ✅ API key has **not expired**

### Step 2: Update API Keys in Your App

1. Log in to your Pablo AI Trading account
2. Go to **Account Settings** → **API Keys**
3. For **Bybit**:
   - Click **Edit** or **Update**
   - Enter your **API Key**
   - Enter your **API Secret**
   - Select **Testnet** or **Mainnet** (match your Bybit account)
   - Click **Save**

### Step 3: Verify Testnet Flag

**IMPORTANT:** Ensure the testnet flag matches your Bybit account:
- If your Bybit account is **Mainnet** → Set `is_testnet = false`
- If your Bybit account is **Testnet** → Set `is_testnet = true`

**Check your Bybit account type:**
- Mainnet: `https://www.bybit.com`
- Testnet: `https://testnet.bybit.com`

### Step 4: Create New API Key (If Needed)

If your API key is expired or invalid:

1. Go to **Bybit** → **API Management**
2. Click **Create New API Key**
3. Set permissions:
   - ✅ **Read** (required)
   - ✅ **Trade** (required for trading)
   - ❌ **Withdraw** (NOT recommended for security)
4. Set **IP whitelist** (recommended for security)
5. Copy **API Key** and **API Secret**
6. Update in your app (Step 2)

---

## 🔍 Verify Fix

After updating API keys:

1. Run `CHECK_API_KEYS_FOR_ERROR_BOTS.sql` to verify status
2. Check bot activity logs for errors
3. Wait for next bot execution cycle
4. Verify trades are executing successfully

---

## 📋 Quick Checklist

- [ ] Verified API key is active on Bybit
- [ ] Verified API key has trading permissions
- [ ] Updated API key in app settings
- [ ] Verified testnet flag matches Bybit account
- [ ] Checked bot activity logs for errors
- [ ] Verified trades are executing

---

## ⚠️ Common Issues

### Issue: "API key is invalid (Code: 10003)"

**Causes:**
- API key expired or revoked
- API key doesn't have trading permissions
- Testnet flag mismatch (mainnet key used with testnet flag or vice versa)
- API key was deleted on Bybit

**Solution:**
- Create new API key on Bybit
- Update in app settings
- Verify testnet flag matches

### Issue: "No API keys found"

**Causes:**
- API keys not configured
- API keys marked as inactive

**Solution:**
- Add API keys in account settings
- Activate API keys if inactive

---

## 📞 Support

If issues persist after updating API keys:
1. Check bot activity logs for detailed error messages
2. Verify API key permissions on Bybit
3. Ensure testnet flag matches your account type
4. Try creating a new API key

---

## 🔒 Security Best Practices

1. **IP Whitelist**: Always use IP whitelist on Bybit API keys
2. **No Withdraw Permission**: Never enable withdraw permission on API keys
3. **Regular Updates**: Update API keys every 30-60 days
4. **Separate Keys**: Use different API keys for different bots (if possible)

