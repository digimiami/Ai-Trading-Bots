-- Create More Aggressive Bot Configurations
-- This will update existing bots to be more aggressive and trade more frequently

-- ============================================================
-- OPTION 1: Make ALL Paper Trading Bots More Aggressive
-- ============================================================

UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(strategy_config, '{}'::jsonb),
              '{rsi_oversold}', '45'::jsonb  -- Changed from 30 to 45 (buy more often)
            ),
            '{rsi_overbought}', '55'::jsonb  -- Changed from 70 to 55 (sell more often)
          ),
          '{adx_threshold}', '10'::jsonb  -- Changed from 25 to 10 (accept weaker trends)
        ),
        '{min_confidence}', '0.4'::jsonb  -- Changed from 0.6 to 0.4 (lower ML confidence needed)
      ),
      '{cooldown_bars}', '2'::jsonb  -- Changed from 8 to 2 (trade more frequently)
    ),
    '{htf_adx_check}', 'false'::jsonb  -- Disable higher timeframe ADX check
  ),
  '{aggressive_mode}', 'true'::jsonb  -- Mark as aggressive
)
WHERE paper_trading = true
  AND status = 'running'
  AND exchange = 'bybit';

-- ============================================================
-- OPTION 2: Make SPECIFIC Bots Ultra-Aggressive
-- ============================================================

-- Example: Make the "TEST" bot ultra-aggressive
UPDATE trading_bots
SET strategy_config = jsonb_build_object(
  'rsi_oversold', 50,          -- Buy when RSI < 50 (very aggressive)
  'rsi_overbought', 50,         -- Sell when RSI > 50 (very aggressive)
  'adx_threshold', 5,           -- Accept very weak trends
  'min_confidence', 0.3,        -- Low ML confidence OK
  'cooldown_bars', 1,           -- Trade every bar if conditions met
  'htf_adx_check', false,       -- No higher timeframe check
  'aggressive_mode', true,
  'stop_loss_pct', 2.0,         -- 2% stop loss
  'take_profit_pct', 3.0,       -- 3% take profit
  'position_size_pct', 10.0     -- 10% of capital per trade
)
WHERE name = 'TEST'
  AND paper_trading = true;

-- ============================================================
-- OPTION 3: Create New Ultra-Aggressive Scalping Bots
-- ============================================================

-- This creates a new aggressive scalping bot for each symbol you want to trade
-- Just replace the symbol, user_id, and exchange fields

INSERT INTO trading_bots (
  name,
  user_id,
  exchange,
  symbol,
  timeframe,
  strategy,
  status,
  paper_trading,
  trading_type,
  trade_amount,
  strategy_config
)
SELECT 
  'AGGRESSIVE SCALPER - ' || symbol,
  '25fe0687-cc9c-4734-838e-a76113a19f9d',  -- Replace with your user_id
  'bybit',
  symbol,
  '5m',  -- 5-minute scalping
  'scalping',
  'running',
  true,  -- Paper trading
  'futures',
  50,  -- $50 per trade
  jsonb_build_object(
    'rsi_oversold', 45,
    'rsi_overbought', 55,
    'adx_threshold', 8,
    'min_confidence', 0.35,
    'cooldown_bars', 1,
    'htf_adx_check', false,
    'aggressive_mode', true,
    'scalping_mode', true,
    'quick_profit', true,
    'stop_loss_pct', 1.5,
    'take_profit_pct', 2.0,
    'position_size_pct', 15.0
  )
FROM (
  VALUES 
    ('BTCUSDT'),
    ('ETHUSDT'),
    ('SOLUSDT')
) AS symbols(symbol)
WHERE NOT EXISTS (
  SELECT 1 FROM trading_bots 
  WHERE name = 'AGGRESSIVE SCALPER - ' || symbols.symbol
);

-- ============================================================
-- OPTION 4: Specific Aggressive Settings by Strategy Type
-- ============================================================

-- For Scalping Strategies (fast, frequent trades)
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{rsi_oversold}', '48'::jsonb
    ),
    '{rsi_overbought}', '52'::jsonb
  ),
  '{cooldown_bars}', '1'::jsonb
)
WHERE strategy ILIKE '%scalp%'
  AND paper_trading = true
  AND status = 'running';

-- For Trend Following (medium aggression)
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{rsi_oversold}', '40'::jsonb
    ),
    '{rsi_overbought}', '60'::jsonb
  ),
  '{adx_threshold}', '12'::jsonb
)
WHERE strategy ILIKE '%trend%'
  AND paper_trading = true
  AND status = 'running';

-- For Mean Reversion (buy dips, sell rallies)
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(strategy_config, '{}'::jsonb),
      '{rsi_oversold}', '35'::jsonb
    ),
    '{rsi_overbought}', '65'::jsonb
  ),
  '{mean_reversion_mode}', 'true'::jsonb
)
WHERE strategy ILIKE '%mean%reversion%'
  AND paper_trading = true
  AND status = 'running';

-- ============================================================
-- VERIFY CHANGES
-- ============================================================

SELECT 
  name,
  symbol,
  strategy,
  paper_trading,
  status,
  strategy_config->'rsi_oversold' as rsi_buy,
  strategy_config->'rsi_overbought' as rsi_sell,
  strategy_config->'adx_threshold' as adx_min,
  strategy_config->'cooldown_bars' as cooldown,
  strategy_config->'aggressive_mode' as aggressive
FROM trading_bots
WHERE paper_trading = true
  AND status = 'running'
ORDER BY name;

-- ============================================================
-- ROLLBACK (If you want to revert to conservative settings)
-- ============================================================

-- Uncomment to rollback to conservative settings:
/*
UPDATE trading_bots
SET strategy_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(strategy_config, '{}'::jsonb),
        '{rsi_oversold}', '30'::jsonb
      ),
      '{rsi_overbought}', '70'::jsonb
    ),
    '{adx_threshold}', '25'::jsonb
  ),
  '{cooldown_bars}', '8'::jsonb
)
WHERE paper_trading = true;
*/

