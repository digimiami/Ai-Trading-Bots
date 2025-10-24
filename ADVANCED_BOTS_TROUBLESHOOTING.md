# 🔍 ADVANCED BOTS TROUBLESHOOTING GUIDE
# Why Your Advanced Bots Are Not Trading

## 🚨 IMMEDIATE DIAGNOSTIC STEPS

### **Step 1: Run Diagnostic SQL Query**
Execute the queries in `advanced_bots_diagnostic.sql` to check:

1. **Bot Status**: Are they running, paused, or stopped?
2. **Recent Trades**: Any trades in the last 24 hours?
3. **Error Logs**: What errors are occurring?
4. **API Keys**: Are exchange API keys configured?
5. **Strategy Configuration**: Are strategies properly set?

### **Step 2: Check Common Issues**

## 🔧 COMMON REASONS WHY ADVANCED BOTS DON'T TRADE

### **1. ❌ Bot Status Issues**
- **Problem**: Bots are `paused` or `stopped`
- **Solution**: Start the bots from the admin panel or bots page
- **Check**: Run SQL query #1 in diagnostic file

### **2. ❌ Missing API Keys**
- **Problem**: No API keys configured for Bybit/OKX
- **Error**: `No API keys found for bybit`
- **Solution**: 
  - Go to Settings → API Keys
  - Add valid Bybit API keys
  - Ensure keys have trading permissions

### **3. ❌ Insufficient Balance**
- **Problem**: Not enough USDT for trading
- **Error**: `Insufficient balance (Code: 170131)`
- **Solution**: 
  - Check Bybit account balance
  - Ensure minimum $10 per trade
  - Add more USDT if needed

### **4. ❌ Spot Trading Limitations**
- **Problem**: Trying to sell assets you don't own
- **Error**: `Cannot sell on spot market without owning the asset`
- **Solution**: 
  - Switch bots from `spot` to `futures` trading
  - Or only use buy signals for spot trading

### **5. ❌ Strategy Not Triggering**
- **Problem**: Market conditions don't meet strategy criteria
- **Check**: RSI, ADX, and price conditions
- **Solution**: 
  - Review strategy parameters
  - Adjust RSI thresholds (30/70)
  - Check ADX trend strength (>25)

### **6. ❌ Market Data Issues**
- **Problem**: Cannot fetch price/RSI/ADX data
- **Error**: `Error fetching price for BTCUSDT`
- **Solution**: 
  - Check internet connection
  - Verify exchange API endpoints
  - Check symbol format (BTCUSDT, ETHUSDT, etc.)

### **7. ❌ Order Size Too Small**
- **Problem**: Order value below minimum
- **Error**: `Order value too low (Code: 170140)`
- **Solution**: 
  - Increase trade amount to minimum $10
  - Adjust bot configuration

### **8. ❌ Exchange API Errors**
- **Problem**: Exchange API issues
- **Error**: `401 Unauthorized` or `403 Forbidden`
- **Solution**: 
  - Regenerate API keys
  - Check API permissions
  - Verify IP whitelist settings

## 🎯 SPECIFIC BOT ANALYSIS

### **PABLO BTC DCA-5X ADVANCED**
- **Strategy**: Dollar Cost Averaging with 5x leverage
- **Check**: 
  - Is it set to `futures` trading?
  - Is leverage set to 5x?
  - Are DCA intervals configured?

### **PABLO ETH MR-SCALPER**
- **Strategy**: Mean Reversion Scalping
- **Check**: 
  - RSI thresholds (oversold <30, overbought >70)
  - Quick profit targets
  - High frequency trading enabled?

### **PABLO SOL TF-BREAKOUT**
- **Strategy**: Timeframe Breakout
- **Check**: 
  - Breakout levels configured
  - Volume confirmation
  - Timeframe settings

### **PABLO BNB AI-COMBO**
- **Strategy**: AI Combination Strategy
- **Check**: 
  - Multiple indicators configured
  - AI model parameters
  - Risk management settings

## 🚀 QUICK FIXES

### **Fix 1: Start All Bots**
```sql
UPDATE trading_bots 
SET status = 'running' 
WHERE name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
);
```

### **Fix 2: Switch to Futures Trading**
```sql
UPDATE trading_bots 
SET trading_type = 'futures' 
WHERE name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
) AND trading_type = 'spot';
```

### **Fix 3: Check Recent Activity**
```sql
SELECT 
    b.name,
    b.status,
    b.trading_type,
    COUNT(t.id) as trades_24h,
    MAX(t.created_at) as last_trade
FROM trading_bots b
LEFT JOIN trades t ON b.id = t.bot_id 
    AND t.created_at >= NOW() - INTERVAL '24 hours'
WHERE b.name IN (
    'PABLO BTC DCA-5X ADVANCED',
    'PABLO ETH MR-SCALPER', 
    'PABLO SOL TF-BREAKOUT',
    'PABLO BNB AI-COMBO'
)
GROUP BY b.id, b.name, b.status, b.trading_type;
```

## 📊 MONITORING COMMANDS

### **Real-time Bot Status**
```sql
SELECT 
    name,
    status,
    trading_type,
    total_trades,
    last_trade_at,
    CASE 
        WHEN last_trade_at IS NULL THEN 'NEVER TRADED'
        WHEN last_trade_at < NOW() - INTERVAL '1 hour' THEN 'NOT TRADING'
        ELSE 'TRADING RECENTLY'
    END as trading_status
FROM trading_bots 
WHERE name LIKE 'PABLO%'
ORDER BY last_trade_at DESC NULLS LAST;
```

### **Error Log Analysis**
```sql
SELECT 
    b.name,
    bal.level,
    bal.message,
    bal.created_at
FROM bot_activity_logs bal
JOIN trading_bots b ON bal.bot_id = b.id
WHERE b.name LIKE 'PABLO%'
    AND bal.level IN ('error', 'warning')
ORDER BY bal.created_at DESC
LIMIT 20;
```

## 🎯 NEXT STEPS

1. **Run the diagnostic SQL queries**
2. **Check bot status and configuration**
3. **Verify API keys and balance**
4. **Review error logs**
5. **Adjust strategy parameters if needed**
6. **Monitor trading activity**

## 📞 SUPPORT

If bots still don't trade after these checks:
1. Check the admin panel for detailed logs
2. Review the trading guide in `TRADING_GUIDE.md`
3. Verify exchange account status
4. Test with smaller amounts first

**Remember**: Advanced bots require proper configuration, sufficient balance, and active market conditions to trade successfully! 🚀

