-- Add BTCC as a supported exchange (https://www.btcc.com)
-- UI and API key storage enabled; full trading integration requires BTCC API implementation in bot-executor.

-- 1. api_keys: allow 'btcc'
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_exchange_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_exchange_check
  CHECK (exchange IN ('bybit', 'mexc', 'bitunix', 'okx', 'btcc'));

-- 2. trading_bots: allow 'btcc'
ALTER TABLE trading_bots DROP CONSTRAINT IF EXISTS trading_bots_exchange_check;
ALTER TABLE trading_bots ADD CONSTRAINT trading_bots_exchange_check
  CHECK (exchange IN ('bybit', 'mexc', 'bitunix', 'okx', 'btcc'));

-- 3. exchange_balances: allow 'btcc'
ALTER TABLE exchange_balances DROP CONSTRAINT IF EXISTS exchange_balances_exchange_check;
ALTER TABLE exchange_balances ADD CONSTRAINT exchange_balances_exchange_check
  CHECK (exchange IN ('bybit', 'mexc', 'bitunix', 'okx', 'btcc'));

-- 4. pablo_ready_bots: allow 'btcc' (optional for admin-created ready bots)
ALTER TABLE pablo_ready_bots DROP CONSTRAINT IF EXISTS pablo_ready_bots_exchange_check;
ALTER TABLE pablo_ready_bots ADD CONSTRAINT pablo_ready_bots_exchange_check
  CHECK (exchange IN ('bybit', 'okx', 'btcc'));
