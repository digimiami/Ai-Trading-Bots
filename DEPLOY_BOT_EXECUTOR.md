# 🚀 Deploy bot-executor Function (Manual Method)

## **Quick Deployment Steps**

### **Step 1: Go to Supabase Dashboard**

1. Visit: https://supabase.com/dashboard
2. Select your **Pablo AI Trading** project

### **Step 2: Navigate to Edge Functions**

1. Click **"Edge Functions"** in the left sidebar
2. Find the **`bot-executor`** function in the list
3. Click on it to open the function editor

### **Step 3: Update the Function Code**

1. **Copy the entire contents** of `supabase/functions/bot-executor/index.ts`
2. **Paste it** into the Supabase function editor (replacing existing code)
3. Click **"Deploy"** or **"Save & Deploy"**

### **Step 4: Verify Deployment**

After deployment, you should see:
- ✅ Function status: **Active**
- ✅ Deployment successful message
- ✅ Function logs showing the balance check feature

---

## **What's New in This Deployment**

### **✅ Balance Check Feature**

The bot now:
- **Checks available balance BEFORE placing orders**
- **Logs available vs required balance** for visibility
- **Skips order attempt** if balance is insufficient (prevents errors)
- **Adds 5% buffer** for fees and price fluctuations
- **Supports both futures (UNIFIED) and spot (SPOT)** accounts

### **Benefits**

- ✅ **No wasted API calls** - doesn't attempt orders with insufficient balance
- ✅ **Clearer logs** - shows exactly why orders aren't being placed
- ✅ **Better error handling** - skips gracefully instead of throwing errors
- ✅ **More visibility** - see available balance vs required amount

---

## **Alternative: Using Supabase CLI**

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link project (if not linked)
supabase link --project-ref your-project-ref

# Deploy bot-executor
supabase functions deploy bot-executor
```

---

## **Testing After Deployment**

### **Check Function Logs**

1. Go to **Edge Functions** → **bot-executor** → **Logs**
2. Look for balance check messages like:
   ```
   💰 Balance check for SOLUSDT Buy: Available=$500.00, Required=$745.48
   ⚠️ Insufficient balance: $500.00 < $782.75 (required + 5% buffer)
   ```

### **Test Bot Execution**

1. Go to your bot dashboard
2. The bot should automatically execute (via cron job)
3. Check logs for balance check messages

---

## **Troubleshooting**

### **If deployment fails:**
- Check for syntax errors in the code
- Verify all imports are correct
- Ensure Supabase project is active

### **If balance check doesn't work:**
- Verify API keys are correct
- Check Bybit account has balance
- Review function logs for errors

### **If you see "Function not found":**
- Make sure function name is exactly `bot-executor`
- Check function exists in Edge Functions list

---

## **What Changed**

### **Added:**
- `checkBybitBalance()` method - checks balance before orders
- Balance validation for both futures and spot trading
- 5% buffer calculation for fees
- Detailed logging of balance checks

### **Updated:**
- `placeOrder()` - now calls balance check first
- Better error messages for insufficient balance

---

## **Next Steps**

After deployment:
1. ✅ Monitor function logs for balance checks
2. ✅ Verify orders are skipped when balance is insufficient
3. ✅ Check logs show available vs required balance
4. ✅ Confirm bot continues to work normally when balance is sufficient

---

**Deployment Status:** Ready to deploy ✅

