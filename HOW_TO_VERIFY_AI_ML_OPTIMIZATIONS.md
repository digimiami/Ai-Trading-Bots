# 🔍 How to Verify if AI/ML Optimizations Are Working

## Quick Checklist

### ✅ Step 1: Check if AI/ML is Enabled for Your Bot

1. **Go to Bots Page** (`/bots`)
2. **Find your bot** and click on it
3. **Look for "AI/ML System" toggle** in bot settings
4. **Make sure it's turned ON** (green/enabled)

**OR** Check via SQL in Supabase SQL Editor:
```sql
SELECT id, name, ai_ml_enabled, status 
FROM trading_bots 
WHERE user_id = auth.uid();
```

### ✅ Step 2: Verify Bot Has Enough Trades

AI/ML optimization requires **at least 10 trades in the last 30 days** to analyze:

```sql
SELECT 
  bot_id,
  COUNT(*) as trade_count,
  MIN(created_at) as first_trade,
  MAX(created_at) as last_trade
FROM trades
WHERE bot_id = 'your-bot-id-here'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY bot_id;
```

### ✅ Step 3: Check if AI API Key is Configured

1. **Go to Supabase Dashboard**
2. **Project Settings → Edge Functions → Secrets**
3. **Check for either:**
   - `DEEPSEEK_API_KEY` (preferred)
   - `OPENAI_API_KEY` (fallback)

### ✅ Step 4: Test the Auto-Optimize Function Manually

**Via Supabase Dashboard:**
1. Go to **Edge Functions → auto-optimize**
2. Click **"Invoke"** tab
3. Set Request Body:
   ```json
   {
     "botId": "your-bot-id-here",
     "minConfidence": 0.7
   }
   ```
4. Click **"Invoke"**

**Via cURL:**
```bash
curl -X POST https://dkawxgwdqiirgmmjbvhc.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"botId": "your-bot-id-here", "minConfidence": 0.7}'
```

### ✅ Step 5: Check Optimization Logs

**In the App:**
1. Go to **Bot Details Page**
2. Scroll to **"AI/ML Optimization History"** section
3. **Look for entries** like:
   - "AI/ML Optimization Applied (Confidence: XX%)"
   - Parameter changes listed

**In Database (SQL):**
```sql
SELECT 
  id,
  timestamp,
  message,
  details->>'type' as optimization_type,
  details->>'confidence' as confidence,
  details->>'changes' as changes
FROM bot_activity_logs
WHERE bot_id = 'your-bot-id-here'
  AND category = 'strategy'
  AND (details->>'type' = 'ai_ml_optimization' OR message LIKE '%AI/ML%')
ORDER BY timestamp DESC
LIMIT 10;
```

### ✅ Step 6: Check Bot Activity Logs Table

Make sure the table exists and has data:
```sql
SELECT COUNT(*) 
FROM bot_activity_logs 
WHERE bot_id = 'your-bot-id-here';
```

## 🔧 Common Issues & Solutions

### Issue: "No AI/ML optimizations yet"

**Possible Causes:**
1. ❌ AI/ML not enabled for bot
2. ❌ Bot status not 'running'
3. ❌ Less than 10 trades in last 30 days
4. ❌ AI API key not configured
5. ❌ Auto-optimize function not called
6. ❌ Optimization confidence too low (< minConfidence)

**Solutions:**

1. **Enable AI/ML:**
   ```sql
   UPDATE trading_bots 
   SET ai_ml_enabled = true 
   WHERE id = 'your-bot-id-here';
   ```

2. **Make sure bot is running:**
   ```sql
   UPDATE trading_bots 
   SET status = 'running' 
   WHERE id = 'your-bot-id-here';
   ```

3. **Wait for more trades** or reduce requirement in code

4. **Set API key** in Supabase Dashboard → Edge Functions → Secrets

5. **Call auto-optimize function manually** (see Step 4 above)

### Issue: Function Returns "No active bots with AI/ML enabled"

**Fix:**
```sql
-- Check which bots have AI/ML enabled
SELECT id, name, ai_ml_enabled, status 
FROM trading_bots 
WHERE ai_ml_enabled = true AND status = 'running';
```

If empty, enable AI/ML:
```sql
UPDATE trading_bots 
SET ai_ml_enabled = true 
WHERE status = 'running';
```

### Issue: "Insufficient trades"

**Check trade count:**
```sql
SELECT COUNT(*) 
FROM trades 
WHERE bot_id = 'your-bot-id-here' 
  AND created_at >= NOW() - INTERVAL '30 days';
```

**If less than 10:** Wait for more trades or modify the requirement in `auto-optimize/index.ts` line ~106

## 🎯 Expected Behavior When Working

When AI/ML optimizations are working correctly, you should see:

1. **In Bot Activity Logs:**
   ```
   🤖 AI/ML Optimized | 85.0% Confidence | Oct 29, 2025 6:48 AM
   AI/ML Optimization Applied (Confidence: 85.0%)
   ```

2. **In Console (Function Logs):**
   ```
   🤖 Using DeepSeek API for optimization
   ✅ Bot optimized: My Bot (Confidence: 0.85)
   📝 Strategy updated with 3 parameter changes
   ```

3. **In Database:**
   - New entries in `bot_activity_logs` with `category='strategy'`
   - `details.type='ai_ml_optimization'`
   - Confidence score (0-1)
   - Parameter changes listed

## 📊 Verification Query (All-in-One)

Run this to see everything at once:
```sql
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.ai_ml_enabled,
  b.status as bot_status,
  COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '30 days') as recent_trades,
  COUNT(DISTINCT l.id) FILTER (WHERE l.details->>'type' = 'ai_ml_optimization') as optimizations_count,
  MAX(l.timestamp) FILTER (WHERE l.details->>'type' = 'ai_ml_optimization') as last_optimization
FROM trading_bots b
LEFT JOIN trades t ON t.bot_id = b.id
LEFT JOIN bot_activity_logs l ON l.bot_id = b.id AND l.category = 'strategy'
WHERE b.user_id = auth.uid()
GROUP BY b.id, b.name, b.ai_ml_enabled, b.status
ORDER BY last_optimization DESC NULLS LAST;
```

This shows:
- ✅ If AI/ML is enabled
- ✅ If bot is running
- ✅ How many recent trades
- ✅ How many optimizations applied
- ✅ When last optimization ran

## 🚀 Next Steps

1. ✅ Enable AI/ML for your bots
2. ✅ Ensure bots have enough trades (10+ in 30 days)
3. ✅ Set AI API key in Supabase Secrets
4. ✅ Call auto-optimize function manually to test
5. ✅ Check logs to verify optimizations are being applied
6. ✅ Set up cron job to auto-run (optional)

---

**Once optimizations appear**, you'll see them in:
- Bot Details Page → "AI/ML Optimization History" section
- Bot Activity Logs with full details of what changed

