#!/usr/bin/env python3
"""
Analyze Bybit Transaction Log and Generate Bot Optimization Recommendations
"""

import csv
import sys
from collections import defaultdict
from datetime import datetime

def parse_csv(file_path):
    """Parse the Bybit transaction log CSV"""
    trades = []
    settlements = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Type'] == 'TRADE':
                trades.append({
                    'contract': row['Contract'],
                    'direction': row['Direction'],
                    'quantity': float(row['Quantity']),
                    'position': float(row['Position']),
                    'price': float(row['Filled Price']),
                    'fee': float(row['Fee Paid']),
                    'cash_flow': float(row['Cash Flow']),
                    'change': float(row['Change']),
                    'wallet_balance': float(row['Wallet Balance']),
                    'action': row['Action'],
                    'time': row['Time']
                })
            elif row['Type'] == 'SETTLEMENT':
                settlements.append({
                    'contract': row['Contract'],
                    'funding': float(row['Funding']),
                    'fee': float(row['Fee Paid']),
                    'cash_flow': float(row['Cash Flow']),
                    'time': row['Time']
                })
    
    return trades, settlements

def analyze_trades(trades):
    """Analyze trading performance"""
    by_pair = defaultdict(lambda: {
        'trades': [],
        'opens': [],
        'closes': [],
        'total_fees': 0,
        'total_pnl': 0,
        'wins': 0,
        'losses': 0,
        'winning_pnl': 0,
        'losing_pnl': 0
    })
    
    for trade in trades:
        pair = trade['contract']
        by_pair[pair]['trades'].append(trade)
        by_pair[pair]['total_fees'] += abs(trade['fee'])
        
        if trade['action'] == 'OPEN':
            by_pair[pair]['opens'].append(trade)
        elif trade['action'] == 'CLOSE':
            by_pair[pair]['closes'].append(trade)
            by_pair[pair]['total_pnl'] += trade['change']
            
            if trade['change'] > 0:
                by_pair[pair]['wins'] += 1
                by_pair[pair]['winning_pnl'] += trade['change']
            else:
                by_pair[pair]['losses'] += 1
                by_pair[pair]['losing_pnl'] += trade['change']
    
    return by_pair

def generate_recommendations(analysis, bot_id):
    """Generate optimization recommendations based on analysis"""
    recommendations = []
    
    for pair, data in analysis.items():
        if len(data['closes']) == 0:
            continue
            
        total_trades = data['wins'] + data['losses']
        win_rate = (data['wins'] / total_trades * 100) if total_trades > 0 else 0
        net_pnl = data['total_pnl'] - data['total_fees']
        avg_win = data['winning_pnl'] / data['wins'] if data['wins'] > 0 else 0
        avg_loss = abs(data['losing_pnl'] / data['losses']) if data['losses'] > 0 else 0
        profit_factor = abs(data['winning_pnl'] / data['losing_pnl']) if data['losing_pnl'] != 0 else 0
        
        recommendations.append({
            'pair': pair,
            'total_trades': total_trades,
            'wins': data['wins'],
            'losses': data['losses'],
            'win_rate': win_rate,
            'net_pnl': net_pnl,
            'total_fees': data['total_fees'],
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': profit_factor
        })
    
    return recommendations

def print_analysis(recommendations):
    """Print formatted analysis"""
    print("\n" + "="*80)
    print("TRADING PERFORMANCE ANALYSIS")
    print("="*80)
    
    for rec in recommendations:
        print(f"\n📊 {rec['pair']}")
        print(f"   Total Trades: {rec['total_trades']}")
        print(f"   Wins: {rec['wins']} | Losses: {rec['losses']}")
        print(f"   Win Rate: {rec['win_rate']:.2f}%")
        print(f"   Net P&L: ${rec['net_pnl']:.2f}")
        print(f"   Total Fees: ${rec['total_fees']:.2f}")
        print(f"   Avg Win: ${rec['avg_win']:.2f}")
        print(f"   Avg Loss: ${rec['avg_loss']:.2f}")
        print(f"   Profit Factor: {rec['profit_factor']:.2f}")
    
    print("\n" + "="*80)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze_bot_performance.py <csv_file>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    trades, settlements = parse_csv(file_path)
    analysis = analyze_trades(trades)
    recommendations = generate_recommendations(analysis, '7b3c49a4-099d-4817-8335-c139d24b4643')
    print_analysis(recommendations)

