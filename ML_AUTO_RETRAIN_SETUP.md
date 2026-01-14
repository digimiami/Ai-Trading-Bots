# 🤖 ML Auto-Retrain & Monitoring Setup Guide

## Overview

This guide explains how to set up automatic retraining and monitoring for the ML system.

## Components

### 1. ML Auto-Retrain Scheduler
**File**: `supabase/functions/ml-auto-retrain/index.ts`

**Purpose**: Periodically checks all active bots with ML enabled and identifies which ones need retraining.

**Features**:
- Checks all running bots with `useMLPrediction: true`
- Evaluates recent accuracy (last 7 days)
- Logs retrain recommendations to bot activity logs
- Returns summary of bots needing retraining

### 2. ML Monitoring Service
**File**: `supabase/functions/ml-monitoring/index.ts`

**Purpose**: Real-time monitoring and alerts for ML performance.

**Features**:
- Dashboard with overall ML performance stats
- Alerts for bots with low accuracy (< 55%)
- Performance tracking by bot/symbol
- Alert notifications

## Setup Instructions

### Step 1: Deploy Edge Functions

Deploy the new edge functions to Supabase:

```bash
# Deploy auto-retrain scheduler
supabase functions deploy ml-auto-retrain

# Deploy monitoring service
supabase functions deploy ml-monitoring
```

### Step 2: Set Up Cron Job for Auto-Retrain

**RECOMMENDED: Run the migration file**

Execute the migration file in Supabase SQL Editor:
```sql
-- Run: supabase/migrations/20250127_setup_ml_auto_retrain_cron.sql
```

This will set up the cron job automatically. Then choose one of the options below:

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to Supabase Dashboard → Edge Functions → ml-auto-retrain
2. Click "Schedules" tab
3. Create new schedule:
   - **Schedule Name**: `ml-auto-retrain-check`
   - **Cron Expression**: `0 2 * * *` (Daily at 2 AM UTC)
   - **HTTP Method**: `POST`
   - **Headers**:
     - Key: `x-cron-secret`
     - Value: `[SAME VALUE as CRON_SECRET environment variable]`
   - **Enabled**: ✅ Yes
4. Click "Save"

**Option B: Using SQL Migration (If pg_cron available)**

Run the migration file `supabase/migrations/20250127_setup_ml_auto_retrain_cron.sql` in Supabase SQL Editor.

**Option C: Using External Cron Service**

Set up a cron job on your server or use a service like:
- GitHub Actions (scheduled workflows)
- Vercel Cron
- AWS EventBridge
- Google Cloud Scheduler
- EasyCron.com

Example cron command:
```bash
# Daily at 2 AM UTC
0 2 * * * curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ml-auto-retrain \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 3: Configure Environment Variables

Set the following environment variables in Supabase:

```bash
# In Supabase Dashboard → Settings → Edge Functions → Secrets
CRON_SECRET=your-secret-key-here
```

### Step 4: Test the Functions

**Test Auto-Retrain:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ml-auto-retrain \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Test Monitoring Dashboard:**
```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/ml-monitoring?action=dashboard" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Test Alerts:**
```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/ml-monitoring?action=alerts" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Usage

### Auto-Retrain Check

The auto-retrain scheduler will:
1. Run daily (or as scheduled)
2. Check all active bots with ML enabled
3. Evaluate recent accuracy (last 7 days)
4. Log recommendations for bots needing retraining
5. Return summary report

**Response Example:**
```json
{
  "success": true,
  "checked": 15,
  "retrained": 3,
  "results": [
    {
      "bot_id": "uuid",
      "bot_name": "BTCUSDT Bot",
      "symbol": "BTCUSDT",
      "should_retrain": true,
      "reason": "Recent accuracy (48.5%) is below threshold (55%)",
      "recent_accuracy": 0.485
    }
  ]
}
```

### Monitoring Dashboard

Access the dashboard to view:
- Overall ML accuracy
- Performance by bot/symbol
- Recent predictions
- Active alerts

**Endpoint**: `GET /ml-monitoring?action=dashboard`

### Alerts

Get active alerts for bots with low performance:

**Endpoint**: `GET /ml-monitoring?action=alerts`

**Response**:
```json
{
  "success": true,
  "alerts": [
    {
      "bot_id": "uuid",
      "symbol": "BTCUSDT",
      "accuracy": 48.5,
      "severity": "warning",
      "message": "ML accuracy is 48.5% (below 55% threshold)",
      "recommendation": "Consider retraining the model or adjusting strategy parameters"
    }
  ]
}
```

## Integration with Frontend

### Example: Display ML Dashboard

```typescript
// Fetch ML dashboard data
const response = await fetch('/functions/v1/ml-monitoring?action=dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { dashboard } = await response.json();

// Display:
// - Overall accuracy: dashboard.overall_accuracy
// - Performance by bot: dashboard.performance_by_bot
// - Active alerts: dashboard.alerts
```

### Example: Check for Alerts

```typescript
// Check for new alerts
const response = await fetch('/functions/v1/ml-monitoring?action=alerts', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { alerts } = await response.json();

// Show notifications for critical alerts
alerts.forEach(alert => {
  if (alert.severity === 'critical') {
    showNotification(`⚠️ ${alert.message}`, 'error');
  }
});
```

## Advanced Features

### Feature Importance Analysis

The `check_retrain` action now includes feature importance analysis:

```json
{
  "feature_importance": {
    "rsi": 0.85,
    "adx": 0.72,
    "macd": 0.45,
    "bollinger_position": 0.38,
    "volume_trend": 0.31,
    "price_momentum": 0.28,
    "ema_diff": 0.22
  }
}
```

Higher values indicate more important features for accurate predictions.

### Confidence Calibration

Analyzes if high confidence predictions are actually more accurate:

```json
{
  "confidence_calibration": {
    "high_confidence_accuracy": 0.78,
    "medium_confidence_accuracy": 0.62,
    "low_confidence_accuracy": 0.45,
    "calibration_score": 1.0
  }
}
```

Calibration score of 1.0 means confidence perfectly predicts accuracy.

### Market Regime Detection

Detects if market is trending or ranging:

```json
{
  "market_regime": {
    "regime": "trending",
    "confidence": 0.75,
    "adx_avg": 28.5
  }
}
```

## Troubleshooting

### Auto-Retrain Not Running

1. Check cron job is scheduled correctly
2. Verify `CRON_SECRET` matches in cron job and function
3. Check Supabase function logs for errors
4. Verify bots have `useMLPrediction: true` in strategy

### No Alerts Showing

1. Ensure bots have at least 20 predictions with outcomes
2. Check accuracy threshold (default: 55%)
3. Verify `ml_performance_summary` view exists
4. Check RLS policies allow user to read predictions

### Feature Calculations Failing

1. Verify bot has valid symbol and exchange
2. Check if klines data is available
3. Ensure timeframe is valid
4. Check bot-executor logs for calculation errors

## Next Steps

1. **Set up cron job** for daily auto-retrain checks
2. **Create dashboard UI** to display ML performance
3. **Add email/telegram notifications** for critical alerts
4. **Implement actual retraining** when recommended
5. **Add symbol-specific model tuning** based on performance

---

**Status**: ✅ Auto-retrain and monitoring system ready for deployment!
