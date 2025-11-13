import { useState, useEffect } from 'react';
import { supabase, API_ENDPOINTS, apiCall } from '../../lib/supabase';
import Card from '../base/Card';
import Button from '../base/Button';

interface PaperPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  current_price: number;
  quantity: number;
  leverage: number;
  unrealized_pnl: number;
  margin_used: number;
  status: string;
  opened_at: string;
}

interface PairPerformance {
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalFees: number;
  totalVolume: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  openPositions: number;
  unrealizedPnL: number;
  runningHours: number;
  botNames: string[];
}

interface PaperPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLBeforeFees: number;
  totalFees: number;
  totalPnLPercentage: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currentBalance: number;
  initialBalance: number;
  openPositions: number;
  totalVolume: number;
  pairsPerformance: PairPerformance[];
}

interface PaperTradingPerformanceProps {
  selectedPair?: string;
  onReset?: () => Promise<void> | void;
}

export default function PaperTradingPerformance({ selectedPair = '', onReset }: PaperTradingPerformanceProps) {
  const [performance, setPerformance] = useState<PaperPerformance | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const ensureAccountExists = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/paper-trading`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'get_balance' })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Failed to ensure paper account exists:', err?.error || response.statusText);
      return null;
    }

    const result = await response.json().catch(() => null);
    return result?.account ?? null;
  };

  const fetchPerformance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get account balance
      const { data: account } = await supabase
        .from('paper_trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Get all closed trades - filter by selected pair if provided
      let tradesQuery = supabase
        .from('paper_trading_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });
      
      if (selectedPair) {
        tradesQuery = tradesQuery.eq('symbol', selectedPair);
      }
      
      const { data: trades } = await tradesQuery;

      // Get open positions - filter by selected pair if provided
      let openPositionsQuery = supabase
        .from('paper_trading_positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });
      
      if (selectedPair) {
        openPositionsQuery = openPositionsQuery.eq('symbol', selectedPair);
      }
      
      const { data: openPositions } = await openPositionsQuery;

      // Fetch bot names for all bot_ids found in trades and positions
      const botIds = new Set<string>();
      if (trades) {
        trades.forEach((trade: any) => {
          if (trade.bot_id) botIds.add(trade.bot_id);
        });
      }
      if (openPositions) {
        openPositions.forEach((position: any) => {
          if (position.bot_id) botIds.add(position.bot_id);
        });
      }

      // Fetch bot names
      const botNamesMap = new Map<string, string>();
      if (botIds.size > 0) {
        const { data: bots } = await supabase
          .from('trading_bots')
          .select('id, name')
          .in('id', Array.from(botIds));
        
        if (bots) {
          bots.forEach((bot: any) => {
            botNamesMap.set(bot.id, bot.name || 'Unknown Bot');
          });
        }
      }

      const accountData = account || (await ensureAccountExists());

      // Helper to normalize numeric fields (Supabase returns numerics as strings)
      const normalizePosition = (raw: any, overrides: Partial<PaperPosition> = {}): PaperPosition => {
        const toNumber = (value: any, fallback = 0) => {
          const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
          return Number.isFinite(parsed) ? parsed : fallback;
        };

        const entryPrice = toNumber(raw.entry_price);
        const quantity = toNumber(raw.quantity);
        const leverage = toNumber(raw.leverage, 1);
        const marginUsed = toNumber(raw.margin_used);
        const currentPrice = overrides.current_price !== undefined
          ? overrides.current_price
          : toNumber(raw.current_price, entryPrice);
        const unrealizedPnL = overrides.unrealized_pnl !== undefined
          ? overrides.unrealized_pnl
          : toNumber(raw.unrealized_pnl);
        const side = (raw.side || 'long').toString().toLowerCase() === 'short' ? 'short' : 'long';
        const normalized: PaperPosition = {
          id: raw.id,
          symbol: raw.symbol || 'UNKNOWN',
          side,
          entry_price: entryPrice,
          current_price: currentPrice,
          quantity,
          leverage,
          unrealized_pnl: unrealizedPnL,
          margin_used: marginUsed,
          status: raw.status || 'open',
          opened_at: raw.opened_at || raw.created_at || new Date().toISOString()
        };
        return normalized;
      };

      // Fetch current prices for open positions
      let positionsWithPrices: PaperPosition[] = [];
      if (openPositions && openPositions.length > 0) {
        positionsWithPrices = await Promise.all(
          openPositions.map(async (position: any) => {
            try {
              // Fetch current price from market data via Supabase Edge Function
              const symbol = position.symbol;

              // Use bot-executor edge function to get current price (avoids CORS)
              try {
                const marketData = await apiCall(
                  `${API_ENDPOINTS.BOT_EXECUTOR}?action=market-data&symbol=${symbol}&exchange=bybit`
                );
                
                const currentPrice = marketData?.price || 0;
                
                if (currentPrice > 0) {
                  // Calculate unrealized PnL
                  const entryPrice = parseFloat(position.entry_price ?? '') || 0;
                  const leverage = parseFloat(position.leverage ?? '1') || 1;
                  const marginUsed = parseFloat(position.margin_used ?? '') || 0;
                  
                  let unrealizedPnL = 0;
                  if (entryPrice > 0 && marginUsed !== 0) {
                    if ((position.side || '').toLowerCase() === 'long') {
                    unrealizedPnL = ((currentPrice - entryPrice) / entryPrice) * marginUsed * leverage;
                  } else {
                    unrealizedPnL = ((entryPrice - currentPrice) / entryPrice) * marginUsed * leverage;
                    }
                  }
                  
                  return normalizePosition(position, {
                    current_price: currentPrice,
                    unrealized_pnl: unrealizedPnL
                  });
                }
              } catch (apiError) {
                console.error(`Error fetching price for ${position.symbol} via API:`, apiError);
                // Fallback handled below
              }
            } catch (error) {
              console.error(`Error fetching price for ${position.symbol}:`, error);
            }
            
            return normalizePosition(position);
          })
        );
        
        setPositions(positionsWithPrices);
      } else {
        setPositions([]);
      }

      // Calculate performance metrics
      if (trades && trades.length > 0) {
        const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
        const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
        
        // Calculate fees (fees are already deducted from PnL in paper trading)
        const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);
        const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        // PnL before fees (PnL already includes fees deduction, so we add fees back)
        const totalPnLBeforeFees = totalPnL + totalFees;
        
        // Calculate total volume
        const totalVolume = trades.reduce((sum, t) => {
          const orderValue = parseFloat(t.quantity || 0) * parseFloat(t.price || 0);
          return sum + orderValue;
        }, 0);
        
        const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
        
        const initialBalance = accountData?.initial_balance || account?.initial_balance || 10000;
        const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
        const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

        // Calculate max drawdown (simplified)
        let runningBalance = initialBalance;
        let maxBalance = initialBalance;
        let maxDrawdown = 0;
        
        for (const trade of trades.sort((a, b) => 
          new Date(a.closed_at || a.executed_at).getTime() - 
          new Date(b.closed_at || b.executed_at).getTime()
        )) {
          runningBalance += trade.pnl || 0;
          if (runningBalance > maxBalance) {
            maxBalance = runningBalance;
          }
          const drawdown = ((maxBalance - runningBalance) / maxBalance) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }

        // Calculate total unrealized PnL from open positions
        let totalUnrealizedPnL = 0;
        let totalMarginUsed = 0;
        if (positionsWithPrices && positionsWithPrices.length > 0) {
          positionsWithPrices.forEach((position) => {
            totalUnrealizedPnL += position.unrealized_pnl || 0;
            totalMarginUsed += position.margin_used || 0;
          });
        }
        
        // Calculate current balance correctly:
        // Initial Balance + Total Deposited + Total Realized PnL + Total Unrealized PnL
        // Note: Margin is already deducted from balance when position opens, so we only add unrealized PnL
        const realizedPnL = totalPnL; // Total PnL from closed trades
        const calculatedCurrentBalance = initialBalance + 
          parseFloat((accountData?.total_deposited ?? account?.total_deposited) || 0) + 
          realizedPnL + 
          totalUnrealizedPnL;
        
        // Calculate performance by pair
        const pairsMap = new Map<string, PairPerformance>();
        
        // Process closed trades by symbol
        trades.forEach((trade: any) => {
          const symbol = trade.symbol || 'UNKNOWN';
          if (!pairsMap.has(symbol)) {
            pairsMap.set(symbol, {
              symbol: symbol,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              winRate: 0,
              totalPnL: 0,
              totalFees: 0,
              totalVolume: 0,
              averageWin: 0,
              averageLoss: 0,
              profitFactor: 0,
              openPositions: 0,
              unrealizedPnL: 0,
              runningHours: 0,
              botNames: []
            });
          }
          
          const pairPerf = pairsMap.get(symbol)!;
          pairPerf.totalTrades++;
          pairPerf.totalPnL += trade.pnl || 0;
          pairPerf.totalFees += trade.fees || 0;
          pairPerf.totalVolume += parseFloat(trade.quantity || 0) * parseFloat(trade.price || 0);
          
          // Add bot name if available
          if (trade.bot_id && botNamesMap.has(trade.bot_id)) {
            const botName = botNamesMap.get(trade.bot_id)!;
            if (!pairPerf.botNames.includes(botName)) {
              pairPerf.botNames.push(botName);
            }
          }
          
          if ((trade.pnl || 0) > 0) {
            pairPerf.winningTrades++;
          } else if ((trade.pnl || 0) < 0) {
            pairPerf.losingTrades++;
          }
        });
        
        // Process open positions by symbol
        if (openPositions && positionsWithPrices) {
          openPositions.forEach((position: any) => {
            const symbol = position.symbol || 'UNKNOWN';
            if (!pairsMap.has(symbol)) {
            pairsMap.set(symbol, {
              symbol: symbol,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
              winRate: 0,
              totalPnL: 0,
              totalFees: 0,
              totalVolume: 0,
              averageWin: 0,
              averageLoss: 0,
              profitFactor: 0,
              openPositions: 0,
              unrealizedPnL: 0,
              runningHours: 0,
              botNames: []
            });
            }
            
            const pairPerf = pairsMap.get(symbol)!;
            pairPerf.openPositions++;
            
            // Add bot name if available
            if (position.bot_id && botNamesMap.has(position.bot_id)) {
              const botName = botNamesMap.get(position.bot_id)!;
              if (!pairPerf.botNames.includes(botName)) {
                pairPerf.botNames.push(botName);
              }
            }
            
            // Get unrealized PnL from positionsWithPrices
            const positionWithPrice = positionsWithPrices.find((p) => p.id === position.id);
            if (positionWithPrice) {
              pairPerf.unrealizedPnL += positionWithPrice.unrealized_pnl || 0;
            } else {
              // Fallback to stored unrealized_pnl
              pairPerf.unrealizedPnL += parseFloat(position.unrealized_pnl || 0);
            }
          });
        }
        
        // Calculate final metrics for each pair
        const pairsPerformance: PairPerformance[] = Array.from(pairsMap.values()).map((pair) => {
          const pairTrades = trades.filter((t: any) => (t.symbol || 'UNKNOWN') === pair.symbol);
          const pairWinningTrades = pairTrades.filter((t: any) => (t.pnl || 0) > 0);
          const pairLosingTrades = pairTrades.filter((t: any) => (t.pnl || 0) < 0);
          
          const pairTotalWins = pairWinningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const pairTotalLosses = Math.abs(pairLosingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
          
          // Calculate running hours for this pair
          // Find earliest trade or position date
          const pairOpenPositions = openPositions?.filter((p: any) => (p.symbol || 'UNKNOWN') === pair.symbol) || [];
          
          let earliestTimestamp: number | null = null;
          let latestTimestamp: number | null = null;
          
          // Check trades
          if (pairTrades.length > 0) {
            const tradeDates = pairTrades.map((t: any) => new Date(t.executed_at || t.closed_at || t.created_at)).filter(d => !isNaN(d.getTime()));
            if (tradeDates.length > 0) {
              const earliestTradeTime = Math.min(...tradeDates.map(d => d.getTime()));
              const latestTradeTime = Math.max(...tradeDates.map(d => d.getTime()));
              const earliestCurrent = earliestTimestamp ?? Number.POSITIVE_INFINITY;
              const latestCurrent = latestTimestamp ?? Number.NEGATIVE_INFINITY;
              if (earliestTradeTime < earliestCurrent) earliestTimestamp = earliestTradeTime;
              if (latestTradeTime > latestCurrent) latestTimestamp = latestTradeTime;
            }
          }
          
          // Check open positions
          if (pairOpenPositions.length > 0) {
            const positionDates = pairOpenPositions.map((p: any) => new Date(p.opened_at || p.created_at)).filter(d => !isNaN(d.getTime()));
            if (positionDates.length > 0) {
              const earliestPositionTime = Math.min(...positionDates.map(d => d.getTime()));
              const earliestPositionCurrent = earliestTimestamp ?? Number.POSITIVE_INFINITY;
              if (earliestPositionTime < earliestPositionCurrent) earliestTimestamp = earliestPositionTime;
              // For open positions, use current time as latest
              latestTimestamp = Date.now();
            }
          }
          
          // Calculate running hours
          let runningHours = 0;
          if (earliestTimestamp !== null && latestTimestamp !== null) {
            const diffMs = latestTimestamp - earliestTimestamp;
            runningHours = diffMs / (1000 * 60 * 60); // Convert to hours
          }
          
          return {
            ...pair,
            winRate: pair.totalTrades > 0 ? (pair.winningTrades / pair.totalTrades) * 100 : 0,
            averageWin: pair.winningTrades > 0 ? pairTotalWins / pair.winningTrades : 0,
            averageLoss: pair.losingTrades > 0 ? pairTotalLosses / pair.losingTrades : 0,
            profitFactor: pairTotalLosses > 0 ? pairTotalWins / pairTotalLosses : pairTotalWins > 0 ? 999 : 0,
            runningHours: runningHours
          };
        }).sort((a, b) => {
          // Sort by total PnL (realized + unrealized) descending
          const aTotal = a.totalPnL + a.unrealizedPnL;
          const bTotal = b.totalPnL + b.unrealizedPnL;
          return bTotal - aTotal;
        });

        setPerformance({
          totalTrades: trades.length,
          winningTrades: winningTrades.length,
          losingTrades: losingTrades.length,
          winRate: winRate,
          totalPnL: totalPnL,
          totalPnLBeforeFees: totalPnLBeforeFees,
          totalFees: totalFees,
          totalPnLPercentage: (totalPnL / initialBalance) * 100,
          averageWin: averageWin,
          averageLoss: averageLoss,
          profitFactor: profitFactor,
          maxDrawdown: maxDrawdown,
          currentBalance: calculatedCurrentBalance, // Use calculated balance that includes unrealized PnL
          initialBalance: initialBalance,
          openPositions: openPositions?.length || 0,
          totalVolume: totalVolume,
          pairsPerformance: pairsPerformance
        });
      } else {
        // No trades yet - calculate balance including unrealized PnL from open positions
        const initialBalance = accountData?.initial_balance || account?.initial_balance || 10000;
        let totalUnrealizedPnL = 0;
        if (positionsWithPrices && positionsWithPrices.length > 0) {
          positionsWithPrices.forEach((position) => {
            totalUnrealizedPnL += position.unrealized_pnl || 0;
          });
        }
        const calculatedCurrentBalance = initialBalance + 
          parseFloat((accountData?.total_deposited ?? account?.total_deposited) || 0) + 
          totalUnrealizedPnL;
        
        // Calculate pairsPerformance even when there are no closed trades (only open positions)
        const pairsMap = new Map<string, PairPerformance>();
        
        // Process open positions by symbol
        if (openPositions && positionsWithPrices) {
          openPositions.forEach((position: any) => {
            const symbol = position.symbol || 'UNKNOWN';
            if (!pairsMap.has(symbol)) {
              pairsMap.set(symbol, {
                symbol: symbol,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnL: 0,
                totalFees: 0,
                totalVolume: 0,
                averageWin: 0,
                averageLoss: 0,
                profitFactor: 0,
                openPositions: 0,
                unrealizedPnL: 0,
                runningHours: 0,
                botNames: []
              });
            }
            
            const pairPerf = pairsMap.get(symbol)!;
            pairPerf.openPositions++;
            
            // Add bot name if available
            if (position.bot_id && botNamesMap.has(position.bot_id)) {
              const botName = botNamesMap.get(position.bot_id)!;
              if (!pairPerf.botNames.includes(botName)) {
                pairPerf.botNames.push(botName);
              }
            }
            
            const positionWithPrice = positionsWithPrices.find((p) => p.id === position.id);
            if (positionWithPrice) {
              pairPerf.unrealizedPnL += positionWithPrice.unrealized_pnl || 0;
            } else {
              pairPerf.unrealizedPnL += parseFloat(position.unrealized_pnl || 0);
            }
            
            // Calculate running hours
            const openedAt = new Date(position.opened_at || position.created_at);
            if (!isNaN(openedAt.getTime())) {
              const diffMs = new Date().getTime() - openedAt.getTime();
              const hours = diffMs / (1000 * 60 * 60);
              if (pairPerf.runningHours === 0 || hours > pairPerf.runningHours) {
                pairPerf.runningHours = hours;
              }
            }
          });
        }
        
        const pairsPerformance: PairPerformance[] = Array.from(pairsMap.values()).sort((a, b) => {
          const aTotal = a.totalPnL + a.unrealizedPnL;
          const bTotal = b.totalPnL + b.unrealizedPnL;
          return bTotal - aTotal;
        });
        
        setPerformance({
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalPnL: 0,
          totalPnLBeforeFees: 0,
          totalFees: 0,
          totalPnLPercentage: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          currentBalance: calculatedCurrentBalance,
          initialBalance: initialBalance,
          openPositions: openPositions?.length || 0,
          totalVolume: 0,
          pairsPerformance: pairsPerformance
        });
      }
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPerformance();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedPair]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPerformance();
  };

  const handleResetPerformance = async () => {
    const confirmed = window.confirm('Resetting will clear all paper trades, performance stats, and open positions. Continue?');
    if (!confirmed) {
      return;
    }

    setResetting(true);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/paper-trading`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reset_performance',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to reset paper performance');
      }

      await fetchPerformance();
      if (onReset) {
        await onReset();
      }
      alert('✅ Paper trading performance reset successfully');
    } catch (error: any) {
      console.error('Error resetting paper performance:', error);
      alert('Error resetting paper performance: ' + (error?.message || 'Unknown error'));
    } finally {
      setResetting(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading performance data...</p>
        </div>
      </Card>
    );
  }

  if (!performance) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Performance Overview */}
      <Card className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📊 Paper Trading Performance</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="secondary"
              size="sm"
              loading={refreshing}
            >
              <i className="ri-refresh-line mr-2"></i>
              Refresh
            </Button>
            <Button
              onClick={handleResetPerformance}
              variant="danger"
              size="sm"
              loading={resetting}
            >
              <i className="ri-history-line mr-2"></i>
              Reset
            </Button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total PnL</div>
            <div className={`text-2xl font-bold ${performance.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${performance.totalPnL.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {performance.totalPnLPercentage >= 0 ? '+' : ''}{performance.totalPnLPercentage.toFixed(2)}%
            </div>
            {performance.totalFees > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                Fees: ${performance.totalFees.toFixed(2)}
              </div>
            )}
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Win Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {performance.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {performance.winningTrades}W / {performance.losingTrades}L
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-purple-600">
              {performance.totalTrades}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {performance.openPositions} open positions
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Current Balance</div>
            <div className={`text-2xl font-bold ${performance.currentBalance >= performance.initialBalance ? 'text-green-600' : 'text-red-600'}`}>
              ${performance.currentBalance.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Initial: ${performance.initialBalance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Advanced Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
          <div>
            <div className="text-sm text-gray-600 mb-1">Average Win</div>
            <div className="text-lg font-semibold text-green-600">
              ${performance.averageWin.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Average Loss</div>
            <div className="text-lg font-semibold text-red-600">
              ${performance.averageLoss.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Profit Factor</div>
            <div className={`text-lg font-semibold ${performance.profitFactor >= 1 ? 'text-green-600' : 'text-red-600'}`}>
              {performance.profitFactor.toFixed(2)}x
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Max Drawdown</div>
            <div className="text-lg font-semibold text-orange-600">
              {performance.maxDrawdown.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Fees</div>
            <div className="text-lg font-semibold text-red-600">
              ${performance.totalFees.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {performance.totalVolume > 0 ? ((performance.totalFees / performance.totalVolume) * 100).toFixed(3) + '%' : '0%'} of volume
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Volume</div>
            <div className="text-lg font-semibold text-blue-600">
              ${performance.totalVolume.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {performance.totalTrades} trades
            </div>
          </div>
        </div>
      </Card>

      {/* Open Positions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📈 Open Positions 
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({positions.length} {positions.length === 1 ? 'position' : 'positions'})
          </span>
        </h3>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="ri-inbox-line text-4xl mb-3 block"></i>
            <p>No open positions</p>
            <p className="text-sm mt-1">Positions will appear here when bots open trades</p>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((position) => {
              const marginUsed = Number(position.margin_used ?? 0);
              const pnlPercentage = position.entry_price > 0 && marginUsed !== 0
                ? (position.unrealized_pnl / marginUsed) * 100
                : 0;

              return (
                <div
                  key={position.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        position.side === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {position.side.toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">{position.symbol}</span>
                      <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{position.leverage}x</span>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        position.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs mt-1 ${
                        pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Entry Price</span>
                      <span className="font-medium text-gray-900 dark:text-white">${position.entry_price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Current Price</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${position.current_price?.toFixed(2) || 'Loading...'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Quantity</span>
                      <span className="font-medium text-gray-900 dark:text-white">{position.quantity.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Margin Used</span>
                      <span className="font-medium text-gray-900 dark:text-white">${marginUsed.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
                    <span>Opened: {new Date(position.opened_at).toLocaleString()}</span>
                    <span className="capitalize">{position.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Performance by Pair - Always show if there are pairs or open positions */}
      {performance.pairsPerformance && performance.pairsPerformance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            📊 Performance by Trading Pair
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({performance.pairsPerformance.length} {performance.pairsPerformance.length === 1 ? 'pair' : 'pairs'})
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performance.pairsPerformance.map((pair) => {
              const totalPnLWithUnrealized = pair.totalPnL + pair.unrealizedPnL;
              
              return (
                <div
                  key={pair.symbol}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-lg">{pair.symbol}</h4>
                      {pair.botNames && pair.botNames.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {pair.botNames.map((botName, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                            >
                              <i className="ri-robot-line mr-1"></i>
                              {botName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`text-right ${totalPnLWithUnrealized >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      <div className="text-xl font-bold">
                        {totalPnLWithUnrealized >= 0 ? '+' : ''}${totalPnLWithUnrealized.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {pair.unrealizedPnL !== 0 && (
                          <span>
                            ${pair.totalPnL.toFixed(2)} realized
                            {pair.unrealizedPnL > 0 ? ' +' : ' '}
                            ${pair.unrealizedPnL.toFixed(2)} unrealized
                          </span>
                        )}
                        {pair.unrealizedPnL === 0 && pair.totalPnL !== 0 && (
                          <span>Realized PnL</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Win Rate</span>
                      <span className={`font-semibold ${pair.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                        {pair.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Trades</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {pair.totalTrades} ({pair.winningTrades}W / {pair.losingTrades}L)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Profit Factor</span>
                      <span className={`font-semibold ${pair.profitFactor >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {pair.profitFactor.toFixed(2)}x
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Open Positions</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {pair.openPositions}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Avg Win:</span>
                        <span className="ml-1 font-medium text-green-600">
                          ${pair.averageWin.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Avg Loss:</span>
                        <span className="ml-1 font-medium text-red-600">
                          ${pair.averageLoss.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Volume:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-white">
                          ${pair.totalVolume.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Fees:</span>
                        <span className="ml-1 font-medium text-red-600">
                          ${pair.totalFees.toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Running Hours:</span>
                        <span className="ml-1 font-medium text-blue-600">
                          {pair.runningHours >= 24 
                            ? `${Math.floor(pair.runningHours / 24)}d ${Math.floor(pair.runningHours % 24)}h`
                            : `${pair.runningHours.toFixed(1)}h`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

