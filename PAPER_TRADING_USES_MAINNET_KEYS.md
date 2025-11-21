# Paper Trading Uses Mainnet API Keys

## Important Understanding

**Paper trading is a SIMULATOR that:**
- ✅ Uses **MAINNET API keys** to get real market prices and data
- ✅ **Simulates trades** in the database (paper_trading_trades table)
- ❌ Does NOT place actual orders on the exchange
- ❌ Does NOT use real money

**This is different from testnet trading:**
- Testnet = Uses testnet API keys + testnet market data + testnet orders
- Paper = Uses mainnet API keys + real market data + simulated orders (database only)

## Why Paper Trading Uses Mainnet Keys

1. **Real Market Data**: Paper trading needs real, live market prices to accurately simulate trading
2. **Accurate Testing**: You want to test your strategy against real market conditions, not fake testnet data
3. **No Risk**: Even though you use mainnet keys, NO orders are placed on the exchange - everything is simulated

## How It Works

When `paper_trading = true`:
1. Bot fetches API keys with `is_testnet = false` (mainnet keys)
2. Bot fetches real market data (prices, RSI, ADX, etc.)
3. Bot evaluates strategy against real conditions
4. If strategy says "BUY" or "SELL":
   - **Real Trading**: Places order on exchange
   - **Paper Trading**: Records simulated trade in `paper_trading_trades` table
5. Paper trades are tracked with P&L calculations just like real trades

## Current Configuration

All your paper trading bots are correctly configured:
- ✅ `paper_trading = true`
- ✅ Using mainnet API keys (`is_testnet = false`)
- ✅ Getting real market data
- ✅ Simulating trades (no real orders placed)

## What Was Wrong Before

The system was incorrectly trying to use **testnet API keys** for paper trading, which caused:
- ❌ "API key is invalid" errors
- ❌ Confusion about testnet vs paper trading

## The Fix

Updated `bot-executor` to:
```typescript
// Always use mainnet keys (is_testnet = false) for real market data
.eq('is_testnet', false)
```

This ensures:
1. ✅ Paper trading bots use mainnet keys
2. ✅ Real trading bots use mainnet keys
3. ✅ Real market data is used for both
4. ✅ Only the trade execution differs (real vs simulated)

## Testnet Keys (Optional)

Testnet keys are ONLY needed if you want to:
- Test against Bybit's testnet environment
- Use fake testnet data and testnet orders
- Practice with testnet funds

**For normal paper trading, you do NOT need testnet keys!**

## Summary

| Mode | API Keys | Market Data | Orders | Money |
|------|----------|-------------|--------|-------|
| **Paper Trading** | Mainnet (is_testnet=false) | Real | Simulated (database) | None |
| **Real Trading** | Mainnet (is_testnet=false) | Real | Real (exchange) | Real |
| **Testnet Trading** | Testnet (is_testnet=true) | Testnet | Testnet (exchange) | Fake |

Your current setup is **CORRECT** ✅

All paper trading bots will now use mainnet API keys to get real market data and simulate trades!

