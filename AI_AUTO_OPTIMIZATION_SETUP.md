# AI Auto-Optimization Setup Guide

This guide will help you set up the AI Auto-Optimization feature for your trading bots.

## 🎯 What It Does

The AI Auto-Optimization system:
- Analyzes bot performance metrics (win rate, PnL, profit factor)
- Uses OpenAI GPT-4o to suggest strategy optimizations
- Automatically applies optimizations with high confidence
- Tracks optimization history and results
- Learns from every trade to improve recommendations

## 📋 Prerequisites

1. **OpenAI API Key** - Required for AI optimization
2. **Database Tables** - Must be created (see below)
3. **Supabase Edge Functions** - Deployed and configured

## 🚀 Setup Steps

### Step 1: Create Database Tables

Run the SQL script in your Supabase SQL Editor:

```sql
-- See create_ai_learning_tables.sql
-- This creates:
-- - bot_ai_analysis (stores AI analysis)
-- - ai_learning_data (learns from trades)
-- - strategy_optimizations (tracks optimizations)
```

Also ensure the `trading_bots` table has these columns:
- `ai_ml_enabled` (BOOLEAN) - Enable AI/ML for each bot
- `strategy` (JSONB) - Basic strategy parameters
- `strategy_config` (JSONB) - Advanced strategy configuration

Run these SQL commands if needed:

```sql
-- Add ai_ml_enabled column
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS ai_ml_enabled BOOLEAN DEFAULT false;

-- Add strategy_config column
ALTER TABLE trading_bots 
ADD COLUMN IF NOT EXISTS strategy_config JSONB DEFAULT '{}'::jsonb;
```

### Step 2: Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### Step 3: Deploy Auto-Optimize Function

```bash
# Deploy the function
supabase functions deploy auto-optimize

# Set the OpenAI API key as a secret
supabase secrets set OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 4: Enable AI/ML for Your Bots

Enable AI/ML for bots you want to optimize:

**Option A: Via SQL**
```sql
UPDATE trading_bots 
SET ai_ml_enabled = true 
WHERE id = 'your-bot-id';
```

**Option B: Via Frontend**
- Go to bot settings
- Toggle "AI/ML Enabled" switch
- Save changes

### Step 5: Run Optimization (Manual Test)

Test the function manually:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'
```

Expected response:
```json
{
  "message": "Optimization complete for X bots",
  "optimized": 2,
  "results": [
    {
      "botId": "...",
      "botName": "...",
      "status": "optimized",
      "confidence": 0.85,
      "changes": 3
    }
  ]
}
```

### Step 6: Set Up Scheduled Optimization (Optional)

Add to your cron job or scheduler to run daily/weekly:

**Option A: Using the provided script**
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /path/to/scripts/call-auto-optimize.sh
```

**Option B: Direct cron job**
```bash
# Add to crontab
0 2 * * * curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'
```

**Option C: Integrate with bot-scheduler**
The auto-optimize can be called after bot execution:
```bash
# In your cron script, after bot-scheduler
bash scripts/call-bot-scheduler.sh
sleep 60
bash scripts/call-auto-optimize.sh
```

## 🔧 Configuration Options

### Request Parameters

When calling `auto-optimize`, you can pass:

```json
{
  "botId": "specific-bot-id",      // Optional: optimize specific bot only
  "userId": "user-id",              // Optional: optimize user's bots only
  "minConfidence": 0.7              // Minimum confidence (0-1) to apply changes
}
```

### Bot Requirements for Optimization

A bot will be optimized if:
- Status is `'running'`
- `ai_ml_enabled` is `true`
- Has at least 10 trades in the last 30 days
- OpenAI returns recommendations with confidence >= `minConfidence`

## 📊 How It Works

1. **Fetches Active Bots**: Gets all running bots with `ai_ml_enabled = true`

2. **Analyzes Performance**: 
   - Win rate
   - Total PnL
   - Profit factor (avg win / avg loss)
   - Recent trade patterns

3. **AI Optimization**: 
   - Sends strategy and performance data to OpenAI GPT-4o
   - Gets optimized parameters with confidence score

4. **Applies Changes**: 
   - If confidence >= threshold, updates bot strategy
   - Records optimization in `strategy_optimizations` table
   - Logs to `bot_activity_logs`

5. **Tracks Results**: 
   - Stores before/after performance
   - Monitors improvement over time

## 🎨 Example Optimization

**Before:**
```json
{
  "rsiThreshold": 70,
  "stopLoss": 2.0,
  "takeProfit": 4.0
}
```

**After (AI Suggested):**
```json
{
  "rsiThreshold": 65,  // Lower threshold for more trades
  "stopLoss": 1.5,     // Tighter stop loss
  "takeProfit": 3.5    // Adjusted take profit
}
```

**Reasoning**: "Current strategy has high win rate but low trade frequency. Lowering RSI threshold and tightening stops will increase trading opportunities while maintaining profitability."

## 📈 Monitoring

Check optimization results:

```sql
-- View recent optimizations
SELECT 
  b.name as bot_name,
  so.status,
  so.confidence,
  so.reasoning,
  so.expected_improvement,
  so.created_at
FROM strategy_optimizations so
JOIN trading_bots b ON b.id = so.bot_id
ORDER BY so.created_at DESC
LIMIT 10;

-- View optimization history
SELECT 
  bot_id,
  COUNT(*) as total_optimizations,
  AVG(confidence) as avg_confidence,
  MAX(expected_improvement) as best_expected
FROM strategy_optimizations
WHERE status = 'applied'
GROUP BY bot_id;
```

## 🔍 Troubleshooting

### Error: "OpenAI API key not configured"
```bash
# Set the secret
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Verify it's set
supabase secrets list
```

### Error: "No active bots with AI/ML enabled"
- Check that bots have `ai_ml_enabled = true`
- Verify bot status is `'running'`

### Error: "Insufficient trades"
- Bots need at least 10 trades in the last 30 days
- Wait for more trades or lower the requirement in code

### Low Confidence Scores
- AI may be uncertain if performance data is limited
- Increase trade history before optimizing
- Lower `minConfidence` threshold (not recommended)

## 📚 Related Documentation

- `AI_SELF_LEARNING_GUIDE.md` - Full AI learning system guide
- `QUICK_START_AI.md` - Quick reference
- `create_ai_learning_tables.sql` - Database schema

## ✅ Verification Checklist

- [ ] Database tables created (`bot_ai_analysis`, `strategy_optimizations`, etc.)
- [ ] `ai_ml_enabled` column exists in `trading_bots`
- [ ] `strategy_config` column exists in `trading_bots`
- [ ] OpenAI API key obtained
- [ ] `auto-optimize` function deployed
- [ ] `OPENAI_API_KEY` secret set in Supabase
- [ ] At least one bot has `ai_ml_enabled = true`
- [ ] Manual test successful
- [ ] Scheduled optimization configured (optional)

## 🎉 You're Done!

Your AI Auto-Optimization system is now ready. Bots with `ai_ml_enabled = true` will be optimized automatically based on their performance.

Monitor the logs and optimization history to track improvements over time!

