# Trading Bot Configuration Guide

## Understanding Spot vs Futures Trading

### **Spot Trading**
- **Buy Only:** You can only BUY assets using your USDT balance
- **Cannot Sell:** You cannot sell assets you don't own
- **Example:** With 8,929 USDT, you can:
  - ✅ BUY BTC with USDT
  - ✅ BUY ETH with USDT
  - ✅ BUY DOT with USDT
  - ❌ SELL BTC (unless you own BTC)
  - ❌ SELL ETH (unless you own ETH)

### **Futures Trading (Perpetual/Linear)**
- **Buy (Long):** Open a long position (bet price goes up)
- **Sell (Short):** Open a short position (bet price goes down)
- **With 8,929 USDT:** You can open both long AND short positions
- **Risk Management:** Automatic SL/TP applied:
  - Stop Loss: 2% from entry
  - Take Profit: 3% from entry

---

## Current Issues & Solutions

### ❌ Issue 1: Insufficient Balance for Spot Pairs

**Error:** `Insufficient balance (Code: 170131)`

**Why:** Your bots are trying to SELL coins you don't own.

**Your Balance:**
- ✅ USDT: 8,929 USDT (can buy anything)
- ❌ ETH: 0
- ❌ DOT: 0
- ❌ AVAX: 0
- ❌ UNI: 0

**Solutions:**

1. **Option A: Switch Spot Bots to Futures** (Recommended)
   - Change trading type from `spot` to `futures`
   - This allows both buy and sell signals
   - SL/TP will be automatically applied

2. **Option B: Only Use Buy Signals for Spot**
   - Keep as `spot` trading
   - Bot will skip all SELL signals
   - Only BUY signals will execute

3. **Option C: Buy Coins First**
   - Manually buy ETH, DOT, AVAX, UNI on Bybit
   - Then spot bots can sell them

---

### ❌ Issue 2: OKX 401 Error

**Error:** `OKX API error: 401`

**Why:** OKX API keys are not configured or invalid

**Solutions:**

1. **Option A: Add Valid OKX API Keys**
   - Go to OKX Exchange
   - Generate API keys
   - Add them in your app's API Keys section

2. **Option B: Delete OKX Bots** (Quickest)
   - Remove "OKX BTC" and "OKX ETH" bots
   - Focus on Bybit trading

3. **Option C: Stop OKX Bots**
   - Use the new "Stop All" button
   - Or stop individual OKX bots

---

## Recommended Configuration

### For Testing with Your Current Balance (8,929 USDT):

**Best Setup:**
- ✅ **BTC Futures:** Working perfectly! (10 trades completed)
- ✅ **ETH Futures:** Switch from spot to futures
- ✅ **DOT Futures:** Switch from spot to futures  
- ✅ **AVAX Futures:** Switch from spot to futures
- ✅ **UNI Futures:** Switch from spot to futures

**This allows:**
- Both BUY and SELL signals
- Automatic SL/TP protection
- Full use of your USDT balance
- No need to own the actual coins

---

## How to Change Bot from Spot to Futures

1. Go to `/bots` page
2. Click on the bot you want to edit
3. Change "Trading Type" from `spot` to `futures`
4. Save the bot
5. Bot will now support both buy and sell signals with SL/TP

---

## Current Working Bots

✅ **TES (BTCUSDT Futures)**
- Status: Running
- Total Trades: 10
- PnL: -$16.16
- SL/TP: Active

---

## Error Code Reference

| Code | Message | Solution |
|------|---------|----------|
| 10001 | Side invalid / Qty invalid | Fixed! Capitalization + precision |
| 170131 | Insufficient balance | Switch spot to futures OR only use buy signals |
| 170140 | Order value too low | Minimum ~$10 per order |
| 170380 | No active orders | Trying to close non-existent position |
| 30209 | Price below minimum | SL price too low (now fixed) |
| 401 | OKX unauthorized | Add valid OKX API keys |

---

## Next Steps

1. **Switch all spot bots to futures** (recommended)
2. **Or delete OKX bots** to reduce errors
3. **Monitor with SQL:**
   ```sql
   SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;
   ```

Your system is fully functional - just needs proper bot configuration! 🚀

