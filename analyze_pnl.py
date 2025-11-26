#!/usr/bin/env python3
"""
Analyze Bybit Transaction Log CSV for PnL Optimization
Usage: python analyze_pnl.py <path_to_csv>
"""

import csv
import sys
from collections import defaultdict
from datetime import datetime

def analyze_transaction_log(csv_path):
    """Analyze transaction log and provide optimization recommendations"""
    
    trades = []
    total_fees = 0
    total_pnl = 0
    open_trades = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Type'] != 'TRADE' or row['Contract'] != 'BTCUSDT':
                continue
                
            action = row['Action']
            direction = row['Direction']
            quantity = float(row['Quantity'])
            price = float(row['Filled Price'])
            fee = float(row['Fee Paid'])
            change = float(row['Change'])
            time_str = row['Time']
            
            total_fees += abs(fee)
            
            if action == 'OPEN':
                # Opening a position
                if direction == 'SELL':
                    # Short position
                    open_trades[time_str] = {
                        'side': 'SELL',
                        'quantity': quantity,
                        'price': price,
                        'fee': fee,
                        'time': time_str
                    }
            elif action == 'CLOSE':
                # Closing a position
                total_pnl += change
                trades.append({
                    'side': direction,
                    'quantity': quantity,
                    'price': price,
                    'fee': fee,
                    'pnl': change,
                    'time': time_str
                })
    
    # Calculate statistics
    winning_trades = [t for t in trades if t['pnl'] > 0]
    losing_trades = [t for t in trades if t['pnl'] < 0]
    
    total_trades = len(trades)
    win_rate = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
    
    avg_win = sum(t['pnl'] for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t['pnl'] for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    net_pnl = total_pnl - total_fees
    
    # Print analysis
    print("=" * 60)
    print("BTCUSDT BOT PnL ANALYSIS")
    print("=" * 60)
    print(f"\n📊 Trade Statistics:")
    print(f"   Total Trades: {total_trades}")
    print(f"   Winning Trades: {len(winning_trades)} ({win_rate:.1f}%)")
    print(f"   Losing Trades: {len(losing_trades)} ({100-win_rate:.1f}%)")
    print(f"\n💰 PnL Analysis:")
    print(f"   Total PnL (before fees): ${total_pnl:.2f}")
    print(f"   Total Fees Paid: ${total_fees:.2f}")
    print(f"   Net PnL (after fees): ${net_pnl:.2f}")
    print(f"   Fee Impact: {(total_fees/abs(total_pnl)*100) if total_pnl != 0 else 0:.1f}% of gross PnL")
    print(f"\n📈 Performance Metrics:")
    print(f"   Average Win: ${avg_win:.2f}")
    print(f"   Average Loss: ${avg_loss:.2f}")
    print(f"   Risk/Reward Ratio: {abs(avg_win/avg_loss) if avg_loss != 0 else 0:.2f}")
    
    if winning_trades:
        best_trade = max(winning_trades, key=lambda x: x['pnl'])
        print(f"   Best Trade: ${best_trade['pnl']:.2f} at {best_trade['time']}")
    
    if losing_trades:
        worst_trade = min(losing_trades, key=lambda x: x['pnl'])
        print(f"   Worst Trade: ${worst_trade['pnl']:.2f} at {worst_trade['time']}")
    
    # Recommendations
    print(f"\n🎯 OPTIMIZATION RECOMMENDATIONS:")
    print("=" * 60)
    
    if win_rate < 50:
        print("⚠️  Win rate is below 50% - Need better entry conditions")
        print("   → Increase RSI thresholds (oversold: 35, overbought: 65)")
        print("   → Require higher ADX (25+) for stronger trends")
        print("   → Increase ML confidence threshold (70%+)")
    
    if total_fees > abs(total_pnl) * 0.3:
        print("⚠️  Fees are eating too much profit (>30%)")
        print("   → Reduce trade frequency (increase cooldown to 5-7 bars)")
        print("   → Increase position sizes (fewer but larger trades)")
        print("   → Use limit orders (maker fees are lower)")
    
    if abs(avg_loss) > avg_win * 0.8:
        print("⚠️  Average loss is too close to average win")
        print("   → Tighten stop loss (1.5% instead of 2%)")
        print("   → Cut losses faster")
        print("   → Let winners run longer (trailing stop)")
    
    if total_trades > 100:
        print("⚠️  Too many trades - Over-trading detected")
        print("   → Increase cooldown period (5-10 bars)")
        print("   → Stricter entry conditions")
        print("   → Reduce max_trades_per_day to 20-25")
    
    print(f"\n✅ RECOMMENDED SETTINGS:")
    print("   RSI Oversold: 35 (was 50)")
    print("   RSI Overbought: 65 (was 50)")
    print("   ADX Threshold: 25 (was 10)")
    print("   Cooldown Bars: 5-7 (was 0)")
    print("   ML Confidence: 70% (was 50%)")
    print("   Stop Loss: 1.5% (was 2%)")
    print("   Take Profit: 3% (was 4%)")
    print("   Max Trades/Day: 25 (was 8+)")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze_pnl.py <path_to_csv>")
        sys.exit(1)
    
    analyze_transaction_log(sys.argv[1])

