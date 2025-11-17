# 🚨 URGENT: Fix API Key Issues for diazites1@gmail.com

## 📊 Current Situation

**User:** `diazites1@gmail.com`  
**API Key Last Updated:** Nov 16, 2025 (Recent ✅)  
**Bots with Errors:** 3 bots  
**Error Type:** "API key is invalid (Code: 10003)"

### Affected Bots:
1. **Hybrid Trend + Mean Reversion Strategy - HMARUSDT**
2. **Trend Following Strategy-Find Trading Pairs - DOGEUSDT**
3. **Trendline Breakout Strategy - SOLUSDT**

---

## 🔍 Possible Causes

Even though the API key was updated recently, the errors suggest:

1. **API Key Revoked on Bybit** - Key was deleted or revoked after being added to app
2. **Missing Trading Permissions** - API key doesn't have trading permissions enabled
3. **Testnet Flag Mismatch** - Using mainnet key with testnet flag or vice versa
4. **IP Whitelist Issue** - API key has IP whitelist but Supabase IP not whitelisted
5. **API Key Format Issue** - Key or secret was copied incorrectly

---

## ✅ IMMEDIATE FIX STEPS

### Step 1: Verify API Key on Bybit

1. Go to **Bybit** → **Account & Security** → **API Management**
2. Find your API key (the one you added on Nov 16)
3. Check:
   - ✅ Is the API key **Active**? (Not deleted/revoked)
   - ✅ Does it have **Trading** permission enabled?
   - ✅ Does it have **Read** permission enabled?
   - ✅ Is **IP whitelist** configured? (If yes, Supabase IPs need to be whitelisted)
   - ✅ Is it for **Mainnet** or **Testnet**? (Note this!)

### Step 2: Check Testnet Flag in App

**CRITICAL:** The testnet flag in your app MUST match your Bybit account type.

1. Log in to your Pablo AI Trading account
2. Go to **Account Settings** → **API Keys**
3. Check the **Bybit** API key settings:
   - If your Bybit account is **Mainnet** → `is_testnet` should be **FALSE**
   - If your Bybit account is **Testnet** → `is_testnet` should be **TRUE**

**How to check your Bybit account type:**
- Mainnet: URL is `https://www.bybit.com`
- Testnet: URL is `https://testnet.bybit.com`

### Step 3: Re-enter API Key (Even if it looks correct)

Sometimes the key gets corrupted or there's a formatting issue:

1. Go to **Bybit** → **API Management**
2. **Copy the API Key** (double-check for spaces/extra characters)
3. **Copy the API Secret** (double-check for spaces/extra characters)
4. Go to your app → **Account Settings** → **API Keys**
5. **Delete** the existing Bybit API key
6. **Add new** Bybit API key:
   - Paste API Key
   - Paste API Secret
   - Select correct **Testnet/Mainnet** flag
   - Click **Save**

### Step 4: Create New API Key (If Step 3 doesn't work)

If re-entering doesn't work, create a fresh API key:

1. Go to **Bybit** → **API Management**
2. Click **Create New API Key**
3. **Permissions:**
   - ✅ **Read** (required)
   - ✅ **Trade** (required for trading)
   - ❌ **Withdraw** (NOT recommended - security risk)
4. **IP Whitelist:**
   - If you use IP whitelist, you need to whitelist Supabase Edge Function IPs
   - **OR** temporarily disable IP whitelist to test
5. **Copy** the new API Key and Secret
6. **Update in app** (delete old, add new)

---

## 🔍 Diagnostic Queries

Run `FIX_DIAZITES_API_KEY_ISSUES.sql` in Supabase SQL Editor to:
- Check which bots have API key errors
- Verify API key linkage to bots
- Check for duplicate or inactive keys
- See recent error details

---

## ⚠️ Common Issues & Solutions

### Issue 1: "API key is invalid" but key was just updated

**Possible causes:**
- API key was revoked on Bybit after being added
- API key doesn't have trading permissions
- Testnet flag mismatch

**Solution:**
- Verify key is active on Bybit
- Check permissions (must have Trade enabled)
- Verify testnet flag matches account type

### Issue 2: IP Whitelist Blocking

**Symptom:** API key works in Bybit but fails in app

**Solution:**
- Disable IP whitelist on Bybit API key (for testing)
- OR whitelist Supabase Edge Function IPs (contact support for IPs)

### Issue 3: Testnet Flag Mismatch

**Symptom:** Key works in Bybit but fails in app

**Solution:**
- Check if your Bybit account is Mainnet or Testnet
- Update testnet flag in app to match

---

## 📋 Verification Checklist

After fixing:

- [ ] Verified API key is active on Bybit
- [ ] Verified API key has trading permissions
- [ ] Verified testnet flag matches Bybit account type
- [ ] Re-entered API key in app (even if it looked correct)
- [ ] Checked IP whitelist settings
- [ ] Ran diagnostic query to verify linkage
- [ ] Checked bot activity logs for new errors
- [ ] Waited for next bot execution cycle
- [ ] Verified trades are executing

---

## 🚀 Quick Test

After updating API key:

1. Wait 5-10 minutes for next bot execution
2. Check bot activity logs for the 3 affected bots
3. Look for:
   - ✅ "Order placed successfully" messages
   - ❌ "API key is invalid" errors (should be gone)

---

## 📞 If Issues Persist

If errors continue after following all steps:

1. **Create a completely new API key** on Bybit
2. **Delete old API key** from app
3. **Add new API key** to app
4. **Verify testnet flag** matches account type
5. **Check bot activity logs** for detailed error messages

---

## 🔒 Security Note

If you create a new API key:
- **Never** enable withdraw permission
- Use **IP whitelist** if possible (but may need to whitelist Supabase IPs)
- **Rotate keys** every 30-60 days for security

