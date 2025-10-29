# Quick Start: OpenAI Auto-Optimization

## What Was Added

✅ **Auto-Optimization Service** (`src/services/autoOptimizer.ts`)
- Analyzes bot performance from trade history
- Uses OpenAI to optimize strategy parameters
- Automatically applies optimizations when confidence is high

✅ **OpenAI Integration** (Enhanced `src/services/openai.ts`)
- Supports optimization of both basic and advanced strategy configs
- Uses GPT-4o with JSON mode for better responses
- Provides detailed reasoning and confidence scores

✅ **React Hook** (`src/hooks/useAutoOptimizer.ts`)
- Easy integration in React components
- Manual and automatic optimization modes

✅ **UI Component** (`src/components/bot/AutoOptimizer.tsx`)
- Added to bot edit page
- Shows optimization suggestions
- Allows manual application

✅ **Edge Function** (`supabase/functions/auto-optimize/index.ts`)
- Scheduled optimization runs
- Batch optimization for all active bots

## Setup (3 Steps)

### 1. Add OpenAI API Key

**Local (.env file):**
```env
VITE_OPENAI_API_KEY=sk-your-key-here
```

**Supabase (for scheduled runs):**
- Dashboard → Project Settings → Edge Functions
- Add secret: `OPENAI_API_KEY`

### 2. Enable AI/ML on Bot

In bot settings, toggle "AI/ML Enabled" ON

### 3. Create Database Tables

Run `create_ai_learning_tables.sql` in Supabase SQL Editor

## Usage

### Manual Optimization
1. Go to bot edit page
2. Scroll to "AI Auto-Optimization" section
3. Click "Analyze & Optimize"
4. Review suggestions
5. Click "Apply Optimization"

### Automatic Optimization

**Option A: Via Edge Function**
```bash
# Deploy function
npx supabase functions deploy auto-optimize

# Call manually
curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Option B: Via Code**
```typescript
import { autoOptimizer } from '@/services/autoOptimizer';

// Optimize single bot
await autoOptimizer.autoApplyOptimization(botId, 0.75);

// Optimize all active bots
await autoOptimizer.optimizeAllActiveBots();
```

## How It Works

1. **Collects Data**: Last 30 days of trades (min 10 trades)
2. **Calculates Metrics**: Win rate, PnL, Sharpe ratio, profit factor
3. **AI Analysis**: GPT-4 analyzes performance and suggests improvements
4. **Auto-Apply**: If confidence ≥ 0.75, automatically updates strategy

## Confidence Thresholds

- **≥ 0.75**: Auto-applied
- **0.6 - 0.75**: Manual review recommended  
- **< 0.6**: Not applied (too uncertain)

## Files Changed/Created

### Created
- `src/services/autoOptimizer.ts`
- `src/hooks/useAutoOptimizer.ts`
- `src/components/bot/AutoOptimizer.tsx`
- `supabase/functions/auto-optimize/index.ts`
- `OPENAI_AUTO_OPTIMIZATION_SETUP.md`

### Modified
- `src/services/openai.ts` - Enhanced with advanced config support
- `src/pages/edit-bot/page.tsx` - Added AutoOptimizer component

## Important Notes

⚠️ **Minimum Trades**: Need at least 10 closed trades before optimization runs

⚠️ **API Costs**: Each optimization uses ~1000-2000 tokens (~$0.01-0.02)

⚠️ **Rate Limits**: OpenAI has rate limits - don't optimize too frequently

✅ **Safe**: All optimizations are recorded in database before applying

✅ **Reversible**: Can revert to previous strategy if needed

## Next Steps

1. ✅ Add OpenAI API key
2. ✅ Enable AI/ML on bots
3. ✅ Run first optimization manually
4. ✅ Set up scheduled optimizations (optional)
5. ✅ Monitor performance improvements

The system is ready to continuously learn and optimize! 🚀

