# Multiple Pairs Backtesting Feature

## Overview
Added a comprehensive backtesting system that allows users to test trading strategies across multiple trading pairs simultaneously.

## What's New

### Database Schema (`create_backtest_tables.sql`)

Two new tables:

1. **`backtests`** - Main backtest configuration and results
   - Stores backtest configuration (strategy, pairs, date range, etc.)
   - Tracks overall results (win rate, PnL, Sharpe ratio, etc.)
   - Contains per-pair detailed results in JSONB format
   - Status tracking (pending, running, completed, failed)

2. **`backtest_trades`** - Individual trades from backtesting
   - Detailed trade records for analysis
   - Entry/exit prices, PnL, duration
   - Technical indicators at entry
   - Trade status and metrics

### Frontend Components

1. **Backtest Page** (`src/pages/backtest/page.tsx`)
   - Create new backtests
   - Select multiple trading pairs
   - Choose date range
   - Configure strategy parameters
   - View backtest progress

2. **Route Added** (`src/router/config.tsx`)
   - New route: `/backtest`

## Features

### Multiple Pairs Selection
- **Popular Pairs Mode**: Click to select from popular trading pairs
- **Custom Pairs Mode**: Enter custom pairs manually
- **Visual Selection**: Selected pairs highlighted in blue
- **Counter Display**: Shows number of pairs selected

### Date Range Selection
- Choose start and end dates for the backtest
- Default: Last 30 days
- Full historical testing capability

### Comprehensive Results
- **Per-Pair Performance**: See how each pair performs
- **Overall Metrics**: 
  - Total trades
  - Win rate
  - Total PnL and PnL%
  - Max drawdown
  - Sharpe ratio
  - Profit factor
- **Detailed Trade Log**: Every individual trade recorded

## How to Use

### 1. Create Database Tables

Run this SQL in Supabase SQL Editor:

```sql
-- File: create_backtest_tables.sql
-- See the complete SQL file for full schema
```

### 2. Navigate to Backtest Page

```
/backtest
```

### 3. Configure Backtest

- **Name**: Give your backtest a name
- **Trading Pairs**: 
  - Click popular pairs to select them
  - OR enter custom pairs in the textarea
- **Date Range**: Choose start and end dates
- **Exchange & Trading Type**: Select your exchange
- **Strategy Parameters**: Configure as needed

### 4. Start Backtest

Click "Start Backtest" to begin

### 5. View Results

- See progress in real-time
- Check results per pair
- View detailed trade logs
- Compare performance across pairs

## Database Schema Details

### backtests Table Columns

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users)
- name: TEXT
- symbols: JSONB (Array of trading pairs)
- custom_pairs: TEXT
- exchange: TEXT
- trading_type: TEXT
- strategy: JSONB
- strategy_config: JSONB
- start_date: TIMESTAMP
- end_date: TIMESTAMP
- status: TEXT (pending, running, completed, failed)
- progress: INTEGER (0-100)
- total_trades: INTEGER
- win_rate: DECIMAL
- total_pnl: DECIMAL
- sharpe_ratio: DECIMAL
- results_per_pair: JSONB
```

### backtest_trades Table Columns

```sql
- id: UUID
- backtest_id: UUID (Foreign Key)
- symbol: TEXT
- side: TEXT (buy/sell/long/short)
- entry_price: DECIMAL
- exit_price: DECIMAL
- size: DECIMAL
- pnl: DECIMAL
- entry_time: TIMESTAMP
- exit_time: TIMESTAMP
- duration_seconds: INTEGER
```

## API Integration (TODO)

Next steps to complete the feature:

1. **Backtest API Endpoint**
   - Create Supabase Edge Function: `backtest-engine`
   - Handle backtest execution
   - Real-time progress updates

2. **Results Visualization**
   - Chart performance per pair
   - Compare strategies
   - Export results

3. **Historical Data Fetch**
   - Pull historical OHLCV data
   - Calculate indicators
   - Simulate trades

## Benefits

1. **Strategy Validation**: Test strategies before live trading
2. **Pair Comparison**: See which pairs work best
3. **Risk Assessment**: Understand strategy risks
4. **Optimization**: Tune parameters before deployment
5. **Multi-Pair Testing**: Test strategy on multiple pairs at once

## Technical Implementation

- Uses PostgreSQL JSONB for flexible data storage
- Row Level Security (RLS) for user data isolation
- Indexes for performance optimization
- Automatic timestamp updates via triggers
- Comprehensive error handling

## Status

✅ Database schema created  
✅ Frontend UI built  
✅ Route configured  
⏳ API integration (next step)  
⏳ Results visualization (next step)  

## Files Created

1. `create_backtest_tables.sql` - Database schema
2. `src/pages/backtest/page.tsx` - Backtest UI
3. Routes updated in `src/router/config.tsx`

