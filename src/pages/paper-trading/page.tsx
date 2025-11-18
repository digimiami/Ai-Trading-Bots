import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import PaperTradingPerformance from '../../components/paper/PaperTradingPerformance';
import PaperTradingBalance from '../../components/paper/PaperTradingBalance';

export default function PaperTradingDashboard() {
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);

  const fetchPairs = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAvailablePairs([]);
        setSelectedPair('');
        return;
      }

      // Fetch pairs from both open positions AND closed trades
      const [positionsResult, tradesResult] = await Promise.all([
        supabase
          .from('paper_trading_positions')
          .select('symbol')
          .eq('user_id', user.id)
          .eq('status', 'open'),
        supabase
          .from('paper_trading_trades')
          .select('symbol')
          .eq('user_id', user.id)
          .eq('status', 'closed')
      ]);

      const allSymbols = new Set<string>();
      
      // Add symbols from open positions
      if (positionsResult.data && positionsResult.data.length > 0) {
        positionsResult.data.forEach((p: any) => {
          if (p.symbol) allSymbols.add(p.symbol);
        });
      }
      
      // Add symbols from closed trades
      if (tradesResult.data && tradesResult.data.length > 0) {
        tradesResult.data.forEach((t: any) => {
          if (t.symbol) allSymbols.add(t.symbol);
        });
      }

      const uniquePairs = Array.from(allSymbols).sort();

      setAvailablePairs(uniquePairs);
      setSelectedPair(prev => {
        if (uniquePairs.length === 0) {
          return '';
        }
        // Default to 'all' if no pair is selected
        if (!prev || prev === '') {
          return 'all';
        }
        if (prev === 'all') {
          return 'all';
        }
        if (prev && uniquePairs.includes(prev)) {
          return prev;
        }
        return 'all';
      });
    } catch (error) {
      console.error('Error fetching pairs:', error);
      setAvailablePairs([]);
      setSelectedPair('');
    }
  }, []);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="📝 Paper Trading Dashboard" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Pair Selection */}
        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Trading Pair
          </label>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">-- Select a Pair --</option>
            <option value="all">Select All</option>
            {availablePairs.map((pair) => (
              <option key={pair} value={pair}>
                {pair}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {selectedPair === 'all' 
              ? `Showing report for all pairs${availablePairs.length > 0 ? ` (${availablePairs.length} pairs)` : ''}`
              : selectedPair 
                ? (
                    <>
                      Showing report for <span className="font-semibold">{selectedPair}</span>
                    </>
                  )
                : 'Showing report for all pairs'
            }
          </p>
        </Card>

        {/* Paper Trading Balance */}
        <PaperTradingBalance />
        
        {/* Paper Trading Performance - Always show, default to all pairs */}
        <PaperTradingPerformance
          selectedPair={selectedPair === 'all' ? '' : selectedPair}
          onReset={fetchPairs}
        />
      </div>
      
      <Navigation />
    </div>
  );
}

