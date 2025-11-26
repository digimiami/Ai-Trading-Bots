# G-Channel EMA ATR Strategy Bot Setup

## Overview
This guide will help you create a bot using the G-Channel EMA ATR Strategy from your Pine Script.

## Strategy Parameters (from Pine Script)
- **EMA Length**: 50
- **ATR Length**: 14
- **TP Multiplier**: 4.0 ATR
- **SL Multiplier**: 2.0 ATR
- **RSI Length**: 14
- **RSI Overbought**: 70
- **RSI Oversold**: 30
- **Trade Mode**: Both (Long and Short)

## Setup Options

### Option 1: Add to Pablo Ready Bots (Recommended)
This makes the bot available in the Admin "Ready Bot" section for easy creation.

1. **Run the SQL script:**
   ```sql
   -- Run this in Supabase SQL Editor
   -- File: ADD_G_CHANNEL_BOT_TO_PABLO_READY.sql
   ```

2. **Go to Admin Panel:**
   - Navigate to `/admin`
   - Click on "Pablo Ready Bots" tab
   - Find "G-Channel EMA ATR Strategy"
   - Click "Create Bot" or use the Quick Start button

3. **Customize when creating:**
   - **Symbol**: Enter your custom trading pair (e.g., BTCUSDT, ETHUSDT)
   - **Timeframe**: Choose your preferred timeframe (1m, 5m, 15m, 1h, etc.)
   - **Trade Amount**: Set your desired trade size in USD
   - **Paper Trading**: Toggle if you want to test first

### Option 2: Create Bot Directly via SQL
This creates a bot immediately for your account.

1. **Run the SQL script:**
   ```sql
   -- Run this in Supabase SQL Editor
   -- File: CREATE_G_CHANNEL_EMA_ATR_BOT.sql
   ```

2. **Before running, modify:**
   - Change `'CUSTOM'` to your desired symbol (e.g., `'BTCUSDT'`)
   - Change `'15m'` to your desired timeframe
   - Change `100` to your desired trade amount
   - Verify your email is correct: `'digimiami@gmail.com'`

3. **After running:**
   - The bot will be created and set to `'running'` status
   - It will appear in your `/bots` page
   - You can edit it from there if needed

## Bot Configuration Details

### Entry Conditions (from Pine Script)
- **Long Entry**: RSI crosses above oversold (30) AND price is below EMA(50)
- **Short Entry**: RSI crosses below overbought (70) AND price is above EMA(50)

### Exit Conditions (ATR-Based)
- **Long TP**: Entry Price + (4.0 × ATR)
- **Long SL**: Entry Price - (2.0 × ATR)
- **Short TP**: Entry Price - (4.0 × ATR)
- **Short SL**: Entry Price + (2.0 × ATR)

### Risk Management
- **Max Trades/Day**: 20
- **Max Concurrent Positions**: 3
- **Cooldown**: 3 bars between trades
- **Risk per Trade**: 1.0% of account

## Customization Options

### Change Trade Mode
To trade only long or only short, update the `bias_mode` in `strategy_config`:
```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
    strategy_config,
    '{bias_mode}',
    '"long_only"'  -- or '"short_only"'
)
WHERE name = 'G-Channel EMA ATR Strategy Bot';
```

### Adjust ATR Multipliers
To change TP/SL multipliers:
```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
    strategy_config,
    '{tp_atr_multiplier}',
    '3.5'  -- Change TP multiplier
)
WHERE name = 'G-Channel EMA ATR Strategy Bot';

UPDATE trading_bots
SET strategy_config = jsonb_set(
    strategy_config,
    '{sl_atr_multiplier}',
    '1.8'  -- Change SL multiplier
)
WHERE name = 'G-Channel EMA ATR Strategy Bot';
```

### Adjust RSI Thresholds
To make entries more/less aggressive:
```sql
UPDATE trading_bots
SET strategy_config = jsonb_set(
    strategy_config,
    '{rsi_oversold}',
    '35'  -- More signals (less strict)
)
WHERE name = 'G-Channel EMA ATR Strategy Bot';

UPDATE trading_bots
SET strategy_config = jsonb_set(
    strategy_config,
    '{rsi_overbought}',
    '65'  -- More signals (less strict)
)
WHERE name = 'G-Channel EMA ATR Strategy Bot';
```

## Verification

After creating the bot, verify it was created correctly:

```sql
SELECT 
    id,
    name,
    exchange,
    symbol,
    timeframe,
    leverage,
    trade_amount,
    status,
    strategy_config->>'ema_length' as ema_length,
    strategy_config->>'atr_length' as atr_length,
    strategy_config->>'rsi_oversold' as rsi_oversold,
    strategy_config->>'rsi_overbought' as rsi_overbought,
    strategy_config->>'tp_atr_multiplier' as tp_multiplier,
    strategy_config->>'sl_atr_multiplier' as sl_multiplier,
    strategy_config->>'bias_mode' as trade_mode
FROM trading_bots
WHERE name LIKE 'G-Channel EMA ATR%'
ORDER BY created_at DESC;
```

## Next Steps

1. **Monitor the bot** on the `/bots` page
2. **Check activity logs** to see if it's trading
3. **Adjust parameters** if needed based on performance
4. **Set up sound notifications** if you want alerts for real trades

## Notes

- The bot uses **futures trading** on Bybit
- Default leverage is **5x** (adjustable)
- The strategy supports **both long and short** trades
- ATR-based exits provide **dynamic stop loss and take profit** levels
- The bot will start trading immediately if set to `'running'` status

