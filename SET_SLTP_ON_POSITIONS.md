# Setting SL/TP on Existing Positions

## Your Current Positions

From Bybit Testnet:
1. **BTCUSDT Perpetual:** 0.020 BTC Long (10x leverage)
   - Entry: ~$80,189
   - Current PnL: -$52.46 (-32.56%)
   - **No SL/TP set**

2. **ETHUSDT Perpetual:** 0.26 ETH Long (10x leverage)
   - Entry: ~$13,715
   - Current PnL: -$71.40 (-19.92%)
   - **No SL/TP set**

## Why SL/TP Failed on Market Orders

The Bybit V5 API doesn't allow setting SL/TP directly in market order creation for perpetual futures. Instead, you must:

1. Place the market order first
2. Then use the Position Management API to set SL/TP

## Manual SL/TP Setup (Quick Fix)

### For BTCUSDT Position:
- **Stop Loss:** Set at $78,585 (2% below entry ~$80,189)
- **Take Profit:** Set at $82,595 (3% above entry)

### For ETHUSDT Position:
- **Stop Loss:** Set at $13,441 (2% below entry ~$13,715)
- **Take Profit:** Set at $14,126 (3% above entry)

## How to Set SL/TP Manually on Bybit:

1. Go to **Positions** tab
2. Click the position (BTCUSDT or ETHUSDT)
3. Click "TP/SL" button
4. Set:
   - **Take Profit:** 3% above entry
   - **Stop Loss:** 2% below entry
5. Click "Confirm"

## Automated SL/TP Implementation (Next Step)

The proper way to implement automated SL/TP:

```typescript
// After market order is placed and filled:
// 1. Get the position
// 2. Use /v5/position/trading-stop to set SL/TP

const response = await fetch(`${baseUrl}/v5/position/trading-stop`, {
  method: 'POST',
  headers: { /* auth headers */ },
  body: JSON.stringify({
    category: 'linear',
    symbol: 'BTCUSDT',
    stopLoss: '78585.00',
    takeProfit: '82595.00',
    positionIdx: 0  // 0 for one-way mode
  })
});
```

## Recommendation

**For NOW:**
1. **Manually set SL/TP** on your 2 open positions in Bybit
2. **Close positions** or wait for them to hit SL/TP
3. **Then we can implement** automated SL/TP via position management API

**Would you like me to implement the automated position SL/TP management?**

