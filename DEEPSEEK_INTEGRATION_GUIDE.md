# DeepSeek API Integration Guide

## ✅ Integration Complete

DeepSeek API has been successfully integrated into the AI/ML Auto-Optimization and Auto-Pilot Mode system. The system now prefers DeepSeek when available, with OpenAI as a fallback.

## 🎯 Features

### 1. **DeepSeek API Integration**
- ✅ Primary AI provider: DeepSeek (when `DEEPSEEK_API_KEY` is set)
- ✅ Fallback to OpenAI if DeepSeek is not available
- ✅ Works in both Edge Functions and frontend services
- ✅ Automatic provider detection and selection

### 2. **Comprehensive Logging**
- ✅ Every auto-optimization is logged with full details
- ✅ AI provider (DeepSeek/OpenAI) and model name tracked
- ✅ API call duration recorded
- ✅ Confidence scores stored
- ✅ Performance snapshots before optimization
- ✅ All changes tracked with before/after values

### 3. **Database Logging**
- ✅ **strategy_optimizations** table: Full optimization records
- ✅ **bot_activity_logs** table: Detailed activity logs for each optimization
- ✅ All logs include AI provider metadata

## 📋 Setup Instructions

### Step 1: Add DeepSeek API Key to Supabase Edge Function Secrets

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**
2. Click **"Add new secret"**
3. **Name**: `DEEPSEEK_API_KEY`
4. **Value**: Your DeepSeek API key (e.g., `sk-...`)
5. Click **"Save"**

### Step 2: (Optional) Add Frontend Environment Variable

For frontend AI services, add to your `.env` file:

```env
VITE_DEEPSEEK_API_KEY=sk-your-actual-deepseek-api-key-here
```

**Note**: If you only use Edge Functions for optimization, you only need the Edge Function secret.

### Step 3: Run Database Migration (Optional but Recommended)

Run this SQL in **Supabase SQL Editor** to add dedicated columns for AI metadata:

```sql
-- Run add_deepseek_logging_columns.sql
ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS ai_provider TEXT;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS ai_model TEXT;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS api_call_duration_ms INTEGER;

ALTER TABLE public.strategy_optimizations 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2);
```

**Note**: If you skip this migration, AI metadata will still be stored in the `performance_before` JSONB column, so logging works either way.

## 🚀 How It Works

### Auto-Pilot Mode

1. **Every hour**, Auto-Pilot checks active bots with AI/ML enabled
2. **Calls DeepSeek API** (or OpenAI if DeepSeek not available) for optimization
3. **Records optimization** in `strategy_optimizations` table with:
   - AI provider (DeepSeek/OpenAI)
   - Model name (deepseek-chat/gpt-4o)
   - API call duration
   - Confidence score
   - Performance snapshot before optimization
4. **Logs activity** in `bot_activity_logs` table with full details
5. **Applies optimization** if confidence is high enough (≥70%)

### Files Updated

1. **`supabase/functions/auto-optimize/index.ts`**
   - Uses DeepSeek API (preferred) or OpenAI (fallback)
   - Comprehensive logging to both tables
   - Tracks API call duration and provider info

2. **`src/services/openai.ts`**
   - Supports both DeepSeek and OpenAI
   - Auto-detects which provider to use
   - Prefers DeepSeek when available

3. **`src/services/autoOptimizer.ts`**
   - Enhanced logging with AI provider info
   - Stores optimization records with metadata

## 📊 Viewing Optimization Logs

### Query Strategy Optimizations

```sql
SELECT 
  id,
  bot_id,
  ai_provider,
  ai_model,
  confidence,
  api_call_duration_ms,
  reasoning,
  expected_improvement,
  status,
  applied_at,
  created_at
FROM strategy_optimizations
WHERE bot_id = 'your-bot-id'
ORDER BY created_at DESC;
```

### Query Bot Activity Logs

```sql
SELECT 
  id,
  bot_id,
  level,
  category,
  message,
  details->>'ai_provider' as ai_provider,
  details->>'ai_model' as ai_model,
  details->>'confidence' as confidence,
  details->>'changeCount' as change_count,
  timestamp
FROM bot_activity_logs
WHERE bot_id = 'your-bot-id'
  AND details->>'type' = 'ai_ml_optimization_applied'
ORDER BY timestamp DESC;
```

### Get Recent Optimizations with Performance

```sql
SELECT 
  so.id,
  so.bot_id,
  tb.name as bot_name,
  so.ai_provider,
  so.ai_model,
  so.confidence,
  so.api_call_duration_ms,
  so.performance_before->>'winRate' as win_rate_before,
  so.performance_before->>'totalPnL' as pnl_before,
  so.expected_improvement,
  so.reasoning,
  so.applied_at
FROM strategy_optimizations so
JOIN trading_bots tb ON tb.id = so.bot_id
WHERE so.status = 'applied'
ORDER BY so.applied_at DESC
LIMIT 20;
```

## 🔍 Logging Details

Every optimization logs the following information:

### In `strategy_optimizations` table:
- `ai_provider`: "DeepSeek" or "OpenAI"
- `ai_model`: "deepseek-chat" or "gpt-4o"
- `api_call_duration_ms`: Time taken for API call
- `confidence`: AI confidence score (0-1)
- `performance_before`: Complete performance snapshot
- `original_strategy`: Strategy before optimization
- `suggested_changes`: Optimized strategy
- `reasoning`: AI explanation for changes
- `expected_improvement`: Expected performance improvement

### In `bot_activity_logs` table:
- `message`: Human-readable optimization message
- `details.type`: "ai_ml_optimization_applied"
- `details.ai_provider`: "DeepSeek" or "OpenAI"
- `details.ai_model`: Model name
- `details.confidence`: Confidence score
- `details.changes`: Array of parameter changes
- `details.changeCount`: Number of parameters changed
- `details.changeSummary`: Human-readable summary
- `details.performanceBefore`: Performance metrics
- `details.trigger`: "auto-pilot_mode"

## ⚙️ Configuration

### Auto-Pilot Settings

- **Optimization Interval**: 1 hour (3600000ms)
- **Min Confidence Threshold**: 70% (0.7)
- **Min Trades Required**: 10 trades
- **Time Range**: Last 30 days of trades

### API Configuration

The system automatically uses:
- **DeepSeek** if `DEEPSEEK_API_KEY` is available
- **OpenAI** if only `OPENAI_API_KEY` is available
- **Error** if neither API key is configured

## 📈 Monitoring

### Console Logs

The system logs detailed information to console:

```
🤖 Using DeepSeek API for optimization
🤖 Calling DeepSeek API for bot abc123 (Bot Name)
✅ DeepSeek API response received for bot abc123 (1250ms)
✅ Optimization record created: xyz789 using DeepSeek
✅ Optimization logged to bot_activity_logs for bot abc123 using DeepSeek
```

### Error Logging

If API calls fail, errors are logged:

```
❌ DeepSeek API error for bot abc123: 401 Unauthorized
```

Errors are also recorded in `bot_activity_logs` with full error details.

## 🎯 Next Steps

1. **Add DeepSeek API Key** to Supabase Edge Function Secrets
2. **Enable Auto-Pilot** on your bots
3. **Monitor logs** in `strategy_optimizations` and `bot_activity_logs` tables
4. **Review optimizations** to see AI provider, confidence, and changes
5. **(Optional) Run database migration** for dedicated AI metadata columns

## 🔧 Troubleshooting

### DeepSeek API Not Working

1. **Check Edge Function Secrets**: Ensure `DEEPSEEK_API_KEY` is set
2. **Check API Key**: Verify the key is valid and has sufficient credits
3. **Check Logs**: Review Edge Function logs for error messages
4. **Fallback**: System will automatically fallback to OpenAI if DeepSeek fails

### No Logs Appearing

1. **Check Bot Status**: Ensure bot is "running" and has `ai_ml_enabled = true`
2. **Check Auto-Pilot**: Ensure Auto-Pilot mode is enabled for the bot
3. **Check Trade Count**: Need at least 10 trades in last 30 days
4. **Check Database**: Verify tables exist and have correct schema

### Optimization Not Applying

1. **Check Confidence**: Optimization only applies if confidence ≥ 70%
2. **Check Logs**: Review `bot_activity_logs` for skip reasons
3. **Check Strategy**: Verify strategy is valid and can be updated

## 📝 Summary

✅ DeepSeek API integrated and working  
✅ Comprehensive logging for every optimization  
✅ Provider tracking (DeepSeek/OpenAI)  
✅ Performance snapshots before optimization  
✅ Detailed activity logs  
✅ Automatic fallback to OpenAI  
✅ Ready for production use  

Your Auto-Pilot system is now powered by DeepSeek AI with full logging! 🚀

