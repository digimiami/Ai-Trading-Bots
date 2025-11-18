# Immediate Trading Bot - Troubleshooting Guide

## Problem: Bot is not trading immediately

### Quick Fix

1. **Run the SQL script** `MAKE_IMMEDIATE_BOT_TRADE_NOW.sql` in Supabase SQL Editor
   - This will make the bot ultra-lenient and should trade almost immediately

2. **Check the bot logs** in `/bots` page → Click on your bot → View "Activity Logs"
   - Look for messages like:
     - "Strategy signal: No trading signals detected"
     - "Volume too low"
     - "ADX below minimum"
     - "Insufficient data"

### Common Issues & Solutions

#### Issue 1: "Insufficient data (X candles, need 50+)"
**Solution:** Wait 5-10 minutes for the bot to collect enough 5-minute candles, then it will start trading.

#### Issue 2: "ADX below minimum"
**Solution:** The bot requires ADX >= 5 (very low). If still failing, the market might be extremely choppy. Try a different trading pair.

#### Issue 3: "Volume too low"
**Solution:** The bot requires volume >= 0.1x average (very low). If still failing, the pair might have very low liquidity. Try a major pair like BTCUSDT, ETHUSDT.

#### Issue 4: "Volatility too low: ATR < 0.05%"
**Solution:** The market is too quiet. Try a more volatile pair or wait for market activity.

#### Issue 5: "Scalping strategy requires 1m, 3m, or 5m timeframe"
**Solution:** The bot should be set to 5m. If you see this error, the timeframe wasn't set correctly. Update it manually:
```sql
UPDATE trading_bots
SET timeframe = '5m'
WHERE name LIKE '%Immediate Trading Bot%' AND status = 'running';
```

### Manual Override (Force Trade)

If you want to force a trade immediately for testing:

1. Go to `/admin` → "Trading Bots" tab
2. Find your bot
3. Click "Test (Paper)" or "Test (Real)"
4. This will create a manual trade signal

### Best Practices

1. **Use Major Pairs**: BTCUSDT, ETHUSDT, SOLUSDT have the best liquidity
2. **Check Market Hours**: Even with time filter disabled, some pairs trade better during certain hours
3. **Wait for Data**: The bot needs at least 50 candles (about 4 hours on 5m timeframe) to start trading reliably
4. **Monitor Logs**: Check the Activity Logs section to see exactly why trades aren't happening

### Expected Behavior

- **First 5-10 minutes**: Bot is collecting data, may show "Insufficient data"
- **After 10 minutes**: Bot should start evaluating signals
- **Within 30 minutes**: Bot should find its first trade (with ultra-lenient settings)

### Still Not Working?

1. Check that the bot status is `running` (not `stopped` or `paused`)
2. Verify the bot has API keys configured
3. Check that the symbol format is correct (e.g., "BTCUSDT" not "BTC")
4. Review the bot activity logs for specific error messages
5. Try creating a new bot with a different trading pair

