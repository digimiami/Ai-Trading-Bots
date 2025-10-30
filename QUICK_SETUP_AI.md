# Quick Setup: AI Auto-Optimization

Quick reference guide to get AI Auto-Optimization working in 5 minutes.

## 🚀 Quick Setup

### 1. Database Setup (2 minutes)

Run this in Supabase SQL Editor:

```sql
-- Run setup_ai_optimization.sql
-- This ensures required columns exist

-- Then run create_ai_learning_tables.sql
-- This creates AI tables (bot_ai_analysis, strategy_optimizations, etc.)
```

Or run both files from the project root.

### 2. Get OpenAI API Key (1 minute)

1. Go to https://platform.openai.com/api-keys
2. Create account / Sign in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### 3. Deploy Function (1 minute)

```bash
# Deploy auto-optimize function
supabase functions deploy auto-optimize

# Set OpenAI API key as secret
supabase secrets set OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 4. Enable AI/ML for Your Bot (30 seconds)

**Option A: SQL**
```sql
UPDATE trading_bots 
SET ai_ml_enabled = true 
WHERE id = 'your-bot-id';
```

**Option B: Frontend**
- Go to bot settings
- Toggle "AI/ML Enabled"
- Save

### 5. Test It (30 seconds)

```bash
# Test manually
curl -X POST https://your-project.supabase.co/functions/v1/auto-optimize \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"minConfidence": 0.7}'
```

## ✅ Done!

Your bot will now be optimized automatically when:
- Bot is `running`
- `ai_ml_enabled = true`
- Has 10+ trades in last 30 days
- AI confidence >= 0.7

## 📅 Optional: Schedule Auto-Optimization

Run daily or weekly:

```bash
# Add to crontab (daily at 2 AM)
0 2 * * * /path/to/scripts/call-auto-optimize.sh
```

Or use the setup script:

```bash
bash scripts/setup-ai-optimization.sh
```

## 🔍 Check Results

```sql
-- View recent optimizations
SELECT 
  b.name,
  so.status,
  so.confidence,
  so.reasoning
FROM strategy_optimizations so
JOIN trading_bots b ON b.id = so.bot_id
ORDER BY so.created_at DESC
LIMIT 5;
```

## 📚 Full Guide

See `AI_AUTO_OPTIMIZATION_SETUP.md` for detailed documentation.

