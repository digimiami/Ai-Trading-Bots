import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PerformanceData {
  totalPnL: number;
  tradingVolume: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitableDays: number;
  totalDays: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  volume: number;
  trades: number;
  profit: number;
  loss: number;
}

export interface SymbolPnL {
  symbol: string;
  pnl: number;
  volume: number;
  trades: number;
  winRate: number;
}

export interface PerformanceMetrics {
  overview: PerformanceData;
  dailyPnL: DailyPnL[];
  symbolRanking: SymbolPnL[];
}

export function usePerformance(
  startDate?: Date,
  endDate?: Date,
  assetType?: 'all' | 'perpetuals' | 'spot'
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Default to last 7 days if no dates provided
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all trades within date range
      // Use executed_at, created_at, or timestamp - whichever is available
      let query = supabase
        .from('trades')
        .select('*, trading_bots(symbol, trading_type)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      const { data: trades, error: tradesError } = await query;
      
      if (tradesError) throw tradesError;

      // Filter by asset type if specified
      let filteredTrades = trades || [];
      if (assetType && assetType !== 'all') {
        const tradingType = assetType === 'perpetuals' ? 'futures' : 'spot';
        filteredTrades = filteredTrades.filter(
          (t: any) => t.trading_bots?.trading_type === tradingType
        );
      }

      if (!filteredTrades || filteredTrades.length === 0) {
        setMetrics({
          overview: {
            totalPnL: 0,
            tradingVolume: 0,
            totalTrades: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            profitableDays: 0,
            totalDays: 0,
          },
          dailyPnL: [],
          symbolRanking: [],
        });
        return;
      }

      // Calculate overview metrics
      const closedTrades = filteredTrades.filter(
        (t: any) => (t.status === 'filled' || t.status === 'closed') && t.pnl !== null && t.pnl !== undefined
      );
      const winningTrades = closedTrades.filter((t: any) => (parseFloat(t.pnl) || 0) > 0);
      const losingTrades = closedTrades.filter((t: any) => (parseFloat(t.pnl) || 0) <= 0);

      const totalPnL = closedTrades.reduce(
        (sum: number, t: any) => sum + (parseFloat(t.pnl) || 0),
        0
      );

      const tradingVolume = filteredTrades.reduce(
        (sum: number, t: any) =>
          sum + (parseFloat(t.amount) || 0) * (parseFloat(t.price) || 0),
        0
      );

      const winRate =
        closedTrades.length > 0
          ? (winningTrades.length / closedTrades.length) * 100
          : 0;

      const avgWin =
        winningTrades.length > 0
          ? winningTrades.reduce(
              (sum: number, t: any) => sum + (parseFloat(t.pnl) || 0),
              0
            ) / winningTrades.length
          : 0;

      const avgLoss =
        losingTrades.length > 0
          ? losingTrades.reduce(
              (sum: number, t: any) => sum + Math.abs(parseFloat(t.pnl) || 0),
              0
            ) / losingTrades.length
          : 0;

      // Calculate daily P&L
      const dailyPnLMap = new Map<string, DailyPnL>();

      filteredTrades.forEach((trade: any) => {
        const tradeDate = trade.executed_at || trade.created_at || trade.timestamp;
        const date = new Date(tradeDate).toISOString().split('T')[0];

        if (!dailyPnLMap.has(date)) {
          dailyPnLMap.set(date, {
            date,
            pnl: 0,
            volume: 0,
            trades: 0,
            profit: 0,
            loss: 0,
          });
        }

        const daily = dailyPnLMap.get(date)!;
        const pnl = parseFloat(trade.pnl) || 0;
        const volume =
          (parseFloat(trade.amount) || 0) * (parseFloat(trade.price) || 0);

        daily.pnl += pnl;
        daily.volume += volume;
        daily.trades += 1;

        if (pnl > 0) {
          daily.profit += pnl;
        } else {
          daily.loss += Math.abs(pnl);
        }
      });

      const dailyPnL = Array.from(dailyPnLMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => ({
          ...day,
          pnl: parseFloat(day.pnl.toFixed(2)),
          volume: parseFloat(day.volume.toFixed(2)),
        }));

      const profitableDays = dailyPnL.filter((day) => day.pnl > 0).length;

      // Calculate symbol ranking
      const symbolMap = new Map<string, SymbolPnL>();

      closedTrades.forEach((trade: any) => {
        const symbol = trade.symbol;
        const pnl = parseFloat(trade.pnl) || 0;
        const volume =
          (parseFloat(trade.amount) || 0) * (parseFloat(trade.price) || 0);

        if (!symbolMap.has(symbol)) {
          symbolMap.set(symbol, {
            symbol,
            pnl: 0,
            volume: 0,
            trades: 0,
            winRate: 0,
          });
        }

        const symbolData = symbolMap.get(symbol)!;
        symbolData.pnl += pnl;
        symbolData.volume += volume;
        symbolData.trades += 1;
      });

      // Calculate win rate for each symbol
      symbolMap.forEach((symbolData, symbol) => {
        const symbolTrades = closedTrades.filter(
          (t: any) => t.symbol === symbol
        );
        const wins = symbolTrades.filter(
          (t: any) => (parseFloat(t.pnl) || 0) > 0
        ).length;
        symbolData.winRate =
          symbolTrades.length > 0 ? (wins / symbolTrades.length) * 100 : 0;
      });

      const symbolRanking = Array.from(symbolMap.values())
        .sort((a, b) => a.pnl - b.pnl) // Sort by P&L (ascending - worst to best)
        .map((s) => ({
          ...s,
          pnl: parseFloat(s.pnl.toFixed(2)),
          volume: parseFloat(s.volume.toFixed(2)),
          winRate: parseFloat(s.winRate.toFixed(2)),
        }));

      // Calculate total days in range
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );

      setMetrics({
        overview: {
          totalPnL: parseFloat(totalPnL.toFixed(2)),
          tradingVolume: parseFloat(tradingVolume.toFixed(2)),
          totalTrades: filteredTrades.length,
          winRate: parseFloat(winRate.toFixed(2)),
          avgWin: parseFloat(avgWin.toFixed(2)),
          avgLoss: parseFloat(avgLoss.toFixed(2)),
          profitableDays,
          totalDays: daysDiff,
        },
        dailyPnL,
        symbolRanking,
      });
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [startDate?.getTime(), endDate?.getTime(), assetType]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchPerformance,
  };
}

