# OpenAI Auto-Optimization Setup Guide

## Overview

This system enables your trading bots to continuously learn from their trading results and automatically optimize their strategies using OpenAI's GPT-4. The bot analyzes performance metrics, recent trades, and market conditions to suggest and apply improved trading parameters.

## Features

✅ **Automatic Strategy Optimization**
- Analyzes bot performance metrics (win rate, PnL, Sharpe ratio, etc.)
- Reviews recent trades to identify patterns
- Suggests optimized parameters for both basic and advanced strategies
- Automatically applies optimizations when confidence is high

✅ **Continuous Learning**
- Learns from every completed trade
- Tracks market conditions at trade entry/exit
- Builds knowledge base over time
- Adapts to changing market conditions

✅ **Safe Optimization**
- Confidence threshold prevents low-quality optimizations
- Records all optimization attempts in database
- Compares performance before/after optimizations
- Allows manual review and approval

## Setup Instructions

### 1. Configure OpenAI API Key

Add your OpenAI API key to your environment variables:

**Local Development (.env file):**
```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

**Supabase Edge Function (for scheduled optimizations):**
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add secret: `OPENAI_API_KEY` with your OpenAI API key value

### 2. Enable AI/ML on Your Bot

1. Go to bot settings
2. Enable "AI/ML Enabled" toggle
3. Save the bot

### 3. Create Database Tables

Run the AI learning tables SQL in Supabase SQL Editor:

```sql
-- See: create_ai_learning_tables.sql
```

This creates:
- `bot_ai_analysis` - Stores AI analysis and recommendations
- `ai_learning_data` - Stores learning data from each trade
- `strategy_optimizations` - Tracks all optimization attempts

### 4. Deploy Auto-Optimize Edge Function

The edge function will run scheduled optimizations for all active bots.

**Deploy command:**
```bash
npx supabase functions deploy auto-optimize
```

**Set up cron job** (optional, for automatic hourly optimization):
- Use Supabase Cron Jobs or external scheduler
- Call: `https://your-project.supabase.co/functions/v1/auto-optimize`
- Method: POST
- Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

## How It Works

### 1. Trade Analysis
Every time a trade is completed:
- Trade data is stored in `ai_learning_data`
- Market conditions at entry/exit are recorded
- Win/loss outcomes are tracked

### 2. Performance Analysis
When optimization is triggered:
- Fetches last 30 days of trades (minimum 10 trades required)
- Calculates performance metrics:
  - Win rate
  - Total PnL
  - Average win/loss
  - Profit factor
  - Sharpe ratio
  - Max drawdown

### 3. AI Optimization
OpenAI GPT-4 analyzes:
- Current strategy parameters
- Performance metrics
- Recent trade outcomes
- Market conditions

Then suggests optimized parameters with:
- Detailed reasoning
- Expected improvement
- Confidence score (0-1)

### 4. Auto-Application
If confidence ≥ 0.75 (configurable):
- Records optimization in database
- Updates bot strategy parameters
- Tracks performance before/after

## Usage

### Manual Optimization

1. Go to bot page
2. Find "AI Auto-Optimization" section
3. Click "Analyze & Optimize"
4. Review suggested changes
5. Click "Apply Optimization" if satisfied

### Automatic Optimization

The system can automatically optimize:
- **Via Edge Function**: Call `/functions/v1/auto-optimize` endpoint
- **Via Hook**: Enable `autoOptimizeEnabled` in `useAutoOptimizer` hook
- **Via Scheduled Job**: Set up cron to call edge function hourly

### Confidence Thresholds

- **High (0.75+)**: Automatically applied
- **Medium (0.6-0.75)**: Manual review recommended
- **Low (<0.6)**: Not applied automatically

## API Integration

### Optimize Single Bot

```typescript
import { autoOptimizer } from '@/services/autoOptimizer';

// Get optimization recommendation
const result = await autoOptimizer.optimizeStrategy(botId);

// Auto-apply if confidence high
await autoOptimizer.autoApplyOptimization(botId, 0.75);
```

### Optimize All Active Bots

```typescript
// Optimize all bots with AI/ML enabled
await autoOptimizer.optimizeAllActiveBots();

// Or for specific user
await autoOptimizer.optimizeAllActiveBots(userId);
```

### Learn from Trade

```typescript
// Automatically called when trade closes
await autoOptimizer.learnFromTrade(tradeId, botId);
```

## Components

### AutoOptimizer Component

Add to bot detail page:
```tsx
import AutoOptimizer from '@/components/bot/AutoOptimizer';

<AutoOptimizer bot={bot} />
```

### useAutoOptimizer Hook

```tsx
const {
  isOptimizing,
  optimizationResult,
  optimizeBot,
  autoApplyOptimization
} = useAutoOptimizer(botId);
```

## Monitoring

### Check Optimization History

Query `strategy_optimizations` table:
```sql
SELECT * FROM strategy_optimizations 
WHERE bot_id = 'your-bot-id'
ORDER BY created_at DESC;
```

### View Learning Data

Query `ai_learning_data` table:
```sql
SELECT * FROM ai_learning_data 
WHERE bot_id = 'your-bot-id'
ORDER BY created_at DESC;
```

## Best Practices

1. **Minimum Trades**: Wait for at least 10-20 closed trades before optimizing
2. **Confidence Threshold**: Use 0.7-0.75 for automatic application
3. **Review Changes**: Always review suggested changes before auto-applying
4. **Track Results**: Monitor performance after optimization to validate improvements
5. **Gradual Changes**: Avoid optimizing too frequently (max once per day)

## Troubleshooting

### "OpenAI API key not configured"
- Check `.env` file has `VITE_OPENAI_API_KEY`
- For Edge Functions, set `OPENAI_API_KEY` in Supabase secrets

### "Insufficient trades for optimization"
- Need at least 10 closed trades in last 30 days
- Wait for more trades or adjust `minTradesForOptimization`

### "Low confidence - optimization not applied"
- Normal behavior for uncertain optimizations
- Review manually and apply if you agree

### Optimization not running
- Check bot has `ai_ml_enabled = true`
- Verify bot status is 'running'
- Check Edge Function logs in Supabase Dashboard

## Files Created

1. `src/services/autoOptimizer.ts` - Main optimization service
2. `src/hooks/useAutoOptimizer.ts` - React hook for optimization
3. `src/components/bot/AutoOptimizer.tsx` - UI component
4. `supabase/functions/auto-optimize/index.ts` - Scheduled optimization function
5. Updated `src/services/openai.ts` - Enhanced OpenAI integration

## Next Steps

1. Add OpenAI API key to environment
2. Enable AI/ML on your trading bots
3. Run optimizations manually or set up scheduled runs
4. Monitor optimization results and performance improvements

The system is now ready to continuously learn and optimize your trading strategies! 🚀

