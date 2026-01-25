import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface PerformanceData {
  totalPnL: number;
  tradingVolume: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitableDays: number;
  totalDays: number;
  totalFees: number;
  maxDrawdown: number;
  winningTrades: number;
  losingTrades: number;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const fetchPerformance = async () => {
    // Cancel any pending request
    if (abortController) {
      abortController.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      setLoading(true);
      setError(null);

      // Get current user if not available from hook
      let currentUser = user;
      if (!currentUser) {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
          // Set empty metrics if no user
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
              totalFees: 0,
              maxDrawdown: 0,
              winningTrades: 0,
              losingTrades: 0,
            },
            dailyPnL: [],
            symbolRanking: [],
          });
          setLoading(false);
          return;
        }
        currentUser = authUser;
      }

      // Default to last 7 days if no dates provided
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all trades for the current user first (with user_id filter)
      // Then filter by date range in JavaScript to handle both executed_at and created_at
      let query = supabase
        .from('trades')
        .select('*, trading_bots(symbol, trading_type, user_id)')
        .eq('user_id', currentUser.id) // CRITICAL: Filter by user_id
        .order('executed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10000); // Limit to prevent excessive data

      const { data: allTrades, error: tradesError } = await query;

      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      
      if (tradesError) throw tradesError;

      // Filter trades by date range (check both executed_at and created_at)
      let filteredTrades = (allTrades || []).filter((t: any) => {
        const tradeDate = t.executed_at || t.created_at;
        if (!tradeDate) return false;
        const date = new Date(tradeDate);
        return date >= start && date <= end;
      });

      // Debug: Log trade counts to help diagnose issues
      console.log(`📊 usePerformance: Found ${allTrades?.length || 0} total trades for user ${currentUser.id?.substring(0, 8)}, ${filteredTrades.length} in date range ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

      // Filter by asset type if specified
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
            totalFees: 0,
            maxDrawdown: 0,
            winningTrades: 0,
            losingTrades: 0,
          },
          dailyPnL: [],
          symbolRanking: [],
        });
        return;
      }

      // Debug: Log sample trade data to see what we're getting
      if (filteredTrades.length > 0) {
        const firstTrade = filteredTrades[0];
        const statuses = [...new Set(filteredTrades.map((t: any) => t.status))];
        const sides = [...new Set(filteredTrades.map((t: any) => t.side))];
        const hasExitPrices = filteredTrades.filter((t: any) => t.exit_price).length;
        console.log(`📊 Sample trade data: Count=${filteredTrades.length}, Statuses=[${statuses.join(', ')}], Sides=[${sides.join(', ')}], HasExitPrice=${hasExitPrices}/${filteredTrades.length}`);
        console.log(`📊 First trade: ID=${firstTrade.id?.substring(0, 8)}, Status=${firstTrade.status}, Side=${firstTrade.side}, Entry=${firstTrade.entry_price || firstTrade.price}, Exit=${firstTrade.exit_price || 'none'}, Size=${firstTrade.size || firstTrade.amount}, PnL=${firstTrade.pnl || 0}`);
      }

      // Calculate overview metrics
      // Include all filled trades, even if PnL is 0 (it may be calculated later)
      const closedTrades = filteredTrades.filter(
        (t: any) => t.status === 'filled' || t.status === 'closed' || t.status === 'completed'
      );
      
      // For spot trading, match buy/sell pairs to calculate PnL
      // Group trades by symbol and try to match long/short pairs
      const symbolGroups = new Map<string, any[]>();
      closedTrades.forEach((t: any) => {
        const symbol = t.symbol || t.trading_bots?.symbol;
        if (!symbol) {
          console.warn('Trade missing symbol, skipping:', t.id);
          return; // Skip trades without symbol
        }
        if (!symbolGroups.has(symbol)) {
          symbolGroups.set(symbol, []);
        }
        symbolGroups.get(symbol)!.push(t);
      });
      
      // Match buy/sell pairs for spot trading and calculate PnL
      const processedTradesMap = new Map<string, any>();
      
      symbolGroups.forEach((trades, symbol) => {
        // Sort by date (oldest first)
        trades.sort((a, b) => {
          const dateA = new Date(a.executed_at || a.created_at || a.timestamp || 0).getTime();
          const dateB = new Date(b.executed_at || b.created_at || b.timestamp || 0).getTime();
          return dateA - dateB;
        });
        
        // Match buys and sells (long and short)
        const buys: any[] = [];
        const sells: any[] = [];
        
        trades.forEach((t: any) => {
          const side = (t.side || 'long').toLowerCase();
          if (side === 'long' || side === 'buy') {
            buys.push(t);
          } else if (side === 'short' || side === 'sell') {
            sells.push(t);
          }
        });
        
        // Match buy/sell pairs using FIFO (First In First Out)
        let buyIndex = 0;
        sells.forEach((sell: any) => {
          while (buyIndex < buys.length) {
            const buy = buys[buyIndex];
            
            // Get prices and sizes
            const buyPrice = parseFloat(buy.entry_price || buy.price || 0);
            const sellPrice = parseFloat(sell.entry_price || sell.price || 0);
            const buySize = parseFloat(buy.size || buy.amount || 0);
            const sellSize = parseFloat(sell.size || sell.amount || 0);
            
            if (buyPrice > 0 && sellPrice > 0 && buySize > 0 && sellSize > 0) {
              // Calculate PnL for this pair
              const matchedSize = Math.min(buySize, sellSize);
              const pnl = (sellPrice - buyPrice) * matchedSize;
              
              // Update buy trade with PnL
              if (!processedTradesMap.has(buy.id)) {
                processedTradesMap.set(buy.id, { ...buy, pnl: pnl, matched: true });
              } else {
                const existing = processedTradesMap.get(buy.id);
                processedTradesMap.set(buy.id, { ...existing, pnl: (existing.pnl || 0) + pnl });
              }
              
              // Update sell trade with PnL (same value)
              if (!processedTradesMap.has(sell.id)) {
                processedTradesMap.set(sell.id, { ...sell, pnl: pnl, matched: true });
              } else {
                const existing = processedTradesMap.get(sell.id);
                processedTradesMap.set(sell.id, { ...existing, pnl: (existing.pnl || 0) + pnl });
              }
              
              // Reduce remaining sizes
              if (sellSize >= buySize) {
                buyIndex++;
                break;
              } else {
                buys[buyIndex] = { ...buy, size: buySize - sellSize };
                break;
              }
            } else {
              buyIndex++;
            }
          }
        });
      });
      
      // Try to calculate PnL for trades that don't have it yet
      // This handles trades where PnL wasn't calculated when closed
      const processedTrades = closedTrades.map((t: any) => {
        // If already processed from matching, use that
        if (processedTradesMap.has(t.id)) {
          return processedTradesMap.get(t.id);
        }
        // If PnL is already calculated and non-zero, use it
        if (t.pnl !== null && t.pnl !== undefined && parseFloat(t.pnl) !== 0) {
          return t;
        }
        
        // Get entry price and size (handle field variations)
        const entryPrice = parseFloat(t.entry_price || t.price || 0);
        const exitPrice = parseFloat(t.exit_price || 0);
        const size = parseFloat(t.size || t.amount || 0);
        const side = (t.side || 'long').toLowerCase();
        const fee = parseFloat(t.fee || 0);
        
        // Debug: Log trade details to understand why PnL can't be calculated
        // Only log first few trades to avoid console spam
        const shouldLog = closedTrades.length > 0 && !t.pnl && closedTrades.indexOf(t) < 3;
        if (shouldLog) {
          const reason = !exitPrice ? 'Missing exit_price' : entryPrice === 0 ? 'Missing entry_price' : size === 0 ? 'Missing size' : 'Unknown';
          console.log(`📊 Trade PnL calculation (first 3): ID=${t.id?.substring(0, 8) || 'unknown'}, Status=${t.status}, Side=${side}, Entry=${entryPrice}, Exit=${exitPrice}, Size=${size}, Reason="${reason}", CanCalculate=${entryPrice > 0 && exitPrice > 0 && size > 0}`);
        }
        
        // If we have exit price, calculate realized PnL
        if (entryPrice > 0 && exitPrice > 0 && size > 0) {
          let calculatedPnL = 0;
          if (side === 'long') {
            calculatedPnL = (exitPrice - entryPrice) * size - fee;
          } else {
            calculatedPnL = (entryPrice - exitPrice) * size - fee;
          }
          
          return {
            ...t,
            pnl: calculatedPnL
          };
        }
        
        // Return trade as-is if we can't calculate PnL (no exit_price)
        return t;
      });
      
      // Separate trades with actual PnL vs trades with PnL = 0 or null
      const tradesWithPnL = processedTrades.filter(
        (t: any) => {
          const pnl = parseFloat(t.pnl || 0);
          return !isNaN(pnl) && pnl !== 0;
        }
      );
      
      const winningTrades = tradesWithPnL.filter((t: any) => (parseFloat(t.pnl) || 0) > 0);
      const losingTrades = tradesWithPnL.filter((t: any) => (parseFloat(t.pnl) || 0) <= 0);

      // Calculate total P&L from trades that have actual PnL values
      const totalPnL = tradesWithPnL.reduce(
        (sum: number, t: any) => sum + (parseFloat(t.pnl) || 0),
        0
      );

      // Calculate trading volume - try both field name variations
      const tradingVolume = filteredTrades.reduce(
        (sum: number, t: any) => {
          const amount = parseFloat(t.amount || t.size || 0);
          const price = parseFloat(t.price || t.entry_price || 0);
          return sum + (amount * price);
        },
        0
      );

      // Win rate should only be calculated from trades with actual PnL values
      const winRate =
        tradesWithPnL.length > 0
          ? (winningTrades.length / tradesWithPnL.length) * 100
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

      // Use processed trades for daily PnL calculation
      processedTrades.forEach((trade: any) => {
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
        // Use calculated PnL if available
        let pnl = parseFloat(trade.pnl) || 0;
        
        // If PnL is 0, try to calculate from entry/exit prices
        if (pnl === 0) {
          const entryPrice = parseFloat(trade.entry_price || trade.price || 0);
          const exitPrice = parseFloat(trade.exit_price || 0);
          const size = parseFloat(trade.size || trade.amount || 0);
          const side = (trade.side || 'long').toLowerCase();
          const fee = parseFloat(trade.fee || 0);
          
          if (entryPrice > 0 && exitPrice > 0 && size > 0) {
            if (side === 'long') {
              pnl = (exitPrice - entryPrice) * size - fee;
            } else {
              pnl = (entryPrice - exitPrice) * size - fee;
            }
          }
        }
        
        const amount = parseFloat(trade.amount || trade.size || 0);
        const price = parseFloat(trade.price || trade.entry_price || 0);
        const volume = amount * price;

        daily.pnl += pnl;
        daily.volume += volume;
        daily.trades += 1;

        if (pnl > 0) {
          daily.profit += pnl;
        } else if (pnl < 0) {
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

      // Calculate symbol ranking - only use trades with actual PnL
      const symbolMap = new Map<string, SymbolPnL>();

      // Helper function to extract symbol consistently
      const getSymbol = (trade: any): string | null => {
        return trade.symbol || trade.trading_bots?.symbol || null;
      };

      tradesWithPnL.forEach((trade: any) => {
        const symbol = getSymbol(trade);
        if (!symbol) {
          console.warn('Trade missing symbol:', trade.id);
          return; // Skip trades without symbol
        }
        
        const pnl = parseFloat(trade.pnl) || 0;
        const amount = parseFloat(trade.amount || trade.size || 0);
        const price = parseFloat(trade.price || trade.entry_price || 0);
        const volume = amount * price;

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

      // Also count total trades per symbol (including those with PnL = 0) for volume
      filteredTrades.forEach((trade: any) => {
        const symbol = getSymbol(trade);
        if (!symbol) {
          return; // Skip trades without symbol
        }
        
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
        // Only add volume if not already added from tradesWithPnL
        if (!tradesWithPnL.find((t: any) => t.id === trade.id)) {
          const amount = parseFloat(trade.amount || trade.size || 0);
          const price = parseFloat(trade.price || trade.entry_price || 0);
          symbolData.volume += amount * price;
        }
        symbolData.trades += 1;
      });

      // Calculate win rate for each symbol (only from trades with actual PnL)
      symbolMap.forEach((symbolData, symbol) => {
        const symbolTradesWithPnL = tradesWithPnL.filter(
          (t: any) => {
            const tradeSymbol = t.symbol || t.trading_bots?.symbol;
            return tradeSymbol === symbol;
          }
        );
        if (symbolTradesWithPnL.length > 0) {
          const wins = symbolTradesWithPnL.filter(
            (t: any) => (parseFloat(t.pnl) || 0) > 0
          ).length;
          symbolData.winRate = (wins / symbolTradesWithPnL.length) * 100;
        }
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

      // Calculate total fees (estimate 0.1% of volume)
      const totalFees = tradingVolume * 0.001;

      // Calculate Max Drawdown
      let maxDrawdown = 0;
      let peakPnL = 0;
      let runningPnL = 0;
      
      // Sort trades by timestamp and calculate cumulative drawdown
      const sortedTradesWithPnL = [...tradesWithPnL].sort((a, b) => {
        const dateA = new Date((a as any).executed_at || (a as any).created_at || (a as any).timestamp || 0).getTime();
        const dateB = new Date((b as any).executed_at || (b as any).created_at || (b as any).timestamp || 0).getTime();
        return dateA - dateB;
      });
      
      sortedTradesWithPnL.forEach(trade => {
        const tradePnL = parseFloat((trade as any).pnl || 0);
        runningPnL += tradePnL;
        if (runningPnL > peakPnL) {
          peakPnL = runningPnL;
        }
        const drawdown = peakPnL - runningPnL;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      });

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
          totalFees: parseFloat(totalFees.toFixed(2)),
          maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
        },
        dailyPnL,
        symbolRanking,
      });
    } catch (err: any) {
      // Don't set error if request was aborted
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      console.error('Error fetching performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Don't fetch if user is not available yet (wait for auth to load)
    if (!user) {
      setLoading(true);
      return;
    }

    // Only fetch if dates are valid
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return;
    }

    fetchPerformance();

    // Cleanup: abort request on unmount or dependency change
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, startDate?.getTime(), endDate?.getTime(), assetType]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchPerformance,
  };
}

