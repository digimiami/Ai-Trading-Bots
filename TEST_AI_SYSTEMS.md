# 🧪 AI/ML System & Auto-Optimization Test Guide

This guide helps you verify that both the **AI/ML System** and **AI Auto-Optimization** are working correctly.

## 📋 Quick Test Checklist

### ✅ **1. Database Tables Check**

Run this SQL in Supabase SQL Editor:

```sql
-- Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'ai_ml_trades',
  'ai_ml_models', 
  'ai_ml_predictions',
  'strategy_optimizations',
  'trading_bots'
);
```

**Expected:** All 5 tables should exist.

---

### ✅ **2. Environment Variables Check**

Check your `.env` file or Supabase Edge Function secrets:

**Required:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

**For Auto-Optimization:**
- `VITE_OPENAI_API_KEY` OR `VITE_DEEPSEEK_API_KEY` (at least one)
- `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` in Supabase Edge Function Secrets

**For AI/ML System:**
- `VITE_FEATURE_AI_ML=1` (optional, enables AI/ML features)

---

### ✅ **3. AI/ML System Tests**

#### Test 3.1: Check Training Data

```sql
-- Check if you have enough training data
SELECT 
  COUNT(*) as total_trades,
  COUNT(*) FILTER (WHERE label = true) as profitable_trades,
  COUNT(*) FILTER (WHERE label = false) as unprofitable_trades
FROM ai_ml_trades;
```

**Expected:** At least 50 trades for training (minimum recommended).

#### Test 3.2: Check Trained Models

```sql
-- Check if models exist
SELECT 
  id,
  version,
  created_at,
  metrics->>'accuracy' as accuracy,
  metrics->>'precision' as precision,
  metrics->>'recall' as recall
FROM ai_ml_models
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** At least one model with accuracy > 0.6 (60%).

#### Test 3.3: Check Predictions

```sql
-- Check recent predictions
SELECT 
  COUNT(*) as total_predictions,
  AVG(confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE signal = 'BUY') as buy_signals,
  COUNT(*) FILTER (WHERE signal = 'SELL') as sell_signals
FROM ai_ml_predictions
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Expected:** Recent predictions exist with reasonable confidence scores.

---

### ✅ **4. AI Auto-Optimization Tests**

#### Test 4.1: Check Bot Configuration

```sql
-- Check if bots have AI/ML enabled
SELECT 
  id,
  name,
  ai_ml_enabled,
  status,
  strategy->>'useMLPrediction' as use_ml_prediction
FROM trading_bots
WHERE status = 'running'
LIMIT 10;
```

**Expected:** At least one bot with `ai_ml_enabled = true`.

#### Test 4.2: Check Optimization History

```sql
-- Check optimization history
SELECT 
  id,
  bot_id,
  status,
  performance_before->>'confidence' as confidence,
  applied_at
FROM strategy_optimizations
ORDER BY applied_at DESC
LIMIT 10;
```

**Expected:** Recent optimizations with confidence scores.

#### Test 4.3: Test Manual Optimization

1. Go to a bot edit page (`/edit-bot/:id`)
2. Scroll to **"AI Auto-Optimization"** section
3. Click **"Analyze & Optimize"**
4. Wait for results (should show confidence, changes, reasoning)

**Expected:** 
- Optimization completes successfully
- Shows confidence score (0-1)
- Shows suggested changes
- Shows reasoning

#### Test 4.4: Test Auto-Apply

1. After optimization, click **"Apply Optimization"**
2. Check if bot strategy is updated

**Expected:**
- Bot strategy parameters are updated
- Optimization is logged in `strategy_optimizations` table
- Bot activity log shows optimization applied

---

### ✅ **5. Edge Function Tests**

#### Test 5.1: Check Auto-Optimize Function Deployment

```bash
# Check if function is deployed
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auto-optimize \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Expected:** Response with status 200 or 400 (not 404).

#### Test 5.2: Deploy Function (if not deployed)

```bash
cd supabase/functions/auto-optimize
supabase functions deploy auto-optimize
```

---

### ✅ **6. Integration Tests**

#### Test 6.1: Check Bot Executor Integration

Check if bot executor can use AI/ML predictions:

```sql
-- Check if any bots are using ML predictions
SELECT 
  id,
  name,
  strategy->>'useMLPrediction' as use_ml
FROM trading_bots
WHERE strategy->>'useMLPrediction' = 'true';
```

**Expected:** Bots with `useMLPrediction: true` exist.

#### Test 6.2: Test AI/ML Dashboard

1. Navigate to `/ai-ml/dashboard`
2. Check if dashboard loads
3. Verify metrics are displayed

**Expected:**
- Dashboard loads without errors
- Shows model metrics (accuracy, precision, recall)
- Shows recent predictions

---

## 🔧 Manual Testing Steps

### **Test AI/ML System End-to-End:**

1. **Train a Model:**
   ```typescript
   // In browser console or Node.js
   import { trainModel } from './ai-ml-system/sdk';
   const result = await trainModel();
   console.log(result);
   ```

2. **Make a Prediction:**
   ```typescript
   import { getAiDecision } from './ai-ml-system/sdk';
   const prediction = await getAiDecision({
     symbol: 'BTCUSDT',
     timestamp: new Date(),
     price: 50000,
     volume: 1000000,
     high: 51000,
     low: 49000
   });
   console.log(prediction);
   ```

3. **Check Retraining Status:**
   ```typescript
   import { checkRetrainStatus } from './ai-ml-system/sdk';
   const status = await checkRetrainStatus();
   console.log(status);
   ```

### **Test Auto-Optimization End-to-End:**

1. **Analyze Bot Performance:**
   ```typescript
   import { autoOptimizer } from './src/services/autoOptimizer';
   const performance = await autoOptimizer.analyzeBotPerformance('BOT_ID');
   console.log(performance);
   ```

2. **Optimize Strategy:**
   ```typescript
   const optimization = await autoOptimizer.optimizeStrategy('BOT_ID');
   console.log(optimization);
   ```

3. **Auto-Apply Optimization:**
   ```typescript
   const applied = await autoOptimizer.autoApplyOptimization('BOT_ID', 0.75);
   console.log(applied);
   ```

---

## 🐛 Common Issues & Fixes

### **Issue: "No trained models found"**

**Fix:**
1. Ensure you have at least 50 trades in `ai_ml_trades` table
2. Train a model using `trainModel()` from SDK
3. Check model storage bucket exists

### **Issue: "AI API key not configured"**

**Fix:**
1. Add `VITE_OPENAI_API_KEY` or `VITE_DEEPSEEK_API_KEY` to `.env`
2. Add `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` to Supabase Edge Function Secrets
3. Redeploy edge function: `supabase functions deploy auto-optimize`

### **Issue: "No bots have AI/ML enabled"**

**Fix:**
1. Go to bot settings
2. Toggle **"AI/ML Enabled"** to ON
3. Save bot

### **Issue: "Optimization returns null"**

**Fix:**
1. Ensure bot has at least 10 trades
2. Check bot performance analysis succeeds
3. Verify OpenAI/DeepSeek API key is valid
4. Check API rate limits

### **Issue: "Edge function returns 404"**

**Fix:**
1. Deploy function: `supabase functions deploy auto-optimize`
2. Check function name matches exactly
3. Verify Supabase project URL is correct

---

## 📊 Success Criteria

Your systems are working correctly if:

✅ **AI/ML System:**
- [ ] Database tables exist
- [ ] At least 50 training samples available
- [ ] At least one trained model exists
- [ ] Model accuracy > 60%
- [ ] Predictions are being generated
- [ ] Dashboard loads and shows metrics

✅ **AI Auto-Optimization:**
- [ ] API keys configured (OpenAI or DeepSeek)
- [ ] At least one bot has AI/ML enabled
- [ ] Manual optimization works
- [ ] Auto-apply works
- [ ] Optimizations are logged
- [ ] Edge function is deployed

---

## 🚀 Next Steps

Once all tests pass:

1. **Enable AI/ML on your bots:**
   - Go to bot settings
   - Toggle "AI/ML Enabled" ON
   - Enable "Use ML Prediction" in strategy

2. **Set up Auto-Pilot Mode:**
   - Go to bot edit page
   - Enable "Auto-Pilot Mode" in AI Auto-Optimization section
   - Bot will optimize automatically every hour

3. **Monitor Performance:**
   - Check `/ai-ml/dashboard` for model metrics
   - Review optimization logs in bot activity
   - Track performance improvements

---

## 📝 Notes

- **AI/ML System** requires TensorFlow.js and Node.js environment for training
- **Auto-Optimization** works in browser and edge functions
- Both systems are independent and can work separately
- AI/ML predictions are optional - bots can work without them
- Auto-optimization requires at least 10 trades to analyze

---

## 🔗 Related Documentation

- `ai-ml-system/README.md` - AI/ML System documentation
- `AI_AUTO_OPTIMIZATION_SETUP.md` - Auto-optimization setup guide
- `HOW_OPTIMIZATION_WORKS.md` - How optimization works
- `AUTO_PILOT_MODE_GUIDE.md` - Auto-pilot mode guide

