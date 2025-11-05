import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
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
}

export default function PaperTradingPerformance({ selectedPair = '' }: PaperTradingPerformanceProps) {
  const [performance, setPerformance] = useState<PaperPerformance | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      // Fetch current prices for open positions
      let positionsWithPrices: any[] = [];
      if (openPositions && openPositions.length > 0) {
        positionsWithPrices = await Promise.all(
          openPositions.map(async (position: any) => {
            try {
              // Fetch current price from market data
              const symbol = position.symbol;
              const tradingType = position.trading_type || 'futures';
              
              // Use Bybit API to get current price
              const category = tradingType === 'spot' ? 'spot' : 'linear';
              const response = await fetch(
                `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${symbol}`
              );
              
              if (response.ok) {
                const data = await response.json();
                const currentPrice = parseFloat(data.result?.list?.[0]?.lastPrice || '0');
                
                if (currentPrice > 0) {
                  // Calculate unrealized PnL
                  const entryPrice = parseFloat(position.entry_price);
                  const quantity = parseFloat(position.quantity);
                  const leverage = parseFloat(position.leverage || 1);
                  const marginUsed = parseFloat(position.margin_used || 0);
                  
                  let unrealizedPnL = 0;
                  if (position.side === 'long') {
                    unrealizedPnL = ((currentPrice - entryPrice) / entryPrice) * marginUsed * leverage;
                  } else {
                    unrealizedPnL = ((entryPrice - currentPrice) / entryPrice) * marginUsed * leverage;
                  }
                  
                  return {
                    ...position,
                    current_price: currentPrice,
                    unrealized_pnl: unrealizedPnL
                  };
                }
              }
            } catch (error) {
              console.error(`Error fetching price for ${position.symbol}:`, error);
            }
            
            return position;
          })
        );
        
        setPositions(positionsWithPrices as PaperPosition[]);
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
        
        const initialBalance = account?.initial_balance || 10000;
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
          positionsWithPrices.forEach((position: any) => {
            totalUnrealizedPnL += parseFloat(position.unrealized_pnl || 0);
            totalMarginUsed += parseFloat(position.margin_used || 0);
          });
        }
        
        // Calculate current balance correctly:
        // Initial Balance + Total Deposited + Total Realized PnL + Total Unrealized PnL
        // Note: Margin is already deducted from balance when position opens, so we only add unrealized PnL
        const realizedPnL = totalPnL; // Total PnL from closed trades
        const calculatedCurrentBalance = initialBalance + 
          parseFloat(account?.total_deposited || 0) + 
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
              unrealizedPnL: 0
            });
          }
          
          const pairPerf = pairsMap.get(symbol)!;
          pairPerf.totalTrades++;
          pairPerf.totalPnL += trade.pnl || 0;
          pairPerf.totalFees += trade.fees || 0;
          pairPerf.totalVolume += parseFloat(trade.quantity || 0) * parseFloat(trade.price || 0);
          
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
                unrealizedPnL: 0
              });
            }
            
            const pairPerf = pairsMap.get(symbol)!;
            pairPerf.openPositions++;
            // Get unrealized PnL from positionsWithPrices
            const positionWithPrice = positionsWithPrices.find((p: any) => p.id === position.id);
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
          
          return {
            ...pair,
            winRate: pair.totalTrades > 0 ? (pair.winningTrades / pair.totalTrades) * 100 : 0,
            averageWin: pair.winningTrades > 0 ? pairTotalWins / pair.winningTrades : 0,
            averageLoss: pair.losingTrades > 0 ? pairTotalLosses / pair.losingTrades : 0,
            profitFactor: pairTotalLosses > 0 ? pairTotalWins / pairTotalLosses : pairTotalWins > 0 ? 999 : 0
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
        const initialBalance = account?.initial_balance || 10000;
        let totalUnrealizedPnL = 0;
        if (positionsWithPrices && positionsWithPrices.length > 0) {
          positionsWithPrices.forEach((position: any) => {
            totalUnrealizedPnL += parseFloat(position.unrealized_pnl || 0);
          });
        }
        const calculatedCurrentBalance = initialBalance + 
          parseFloat(account?.total_deposited || 0) + 
          totalUnrealizedPnL;
        
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
          pairsPerformance: []
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📊 Paper Trading Performance</h3>
          <Button
            onClick={handleRefresh}
            variant="secondary"
            size="sm"
            loading={refreshing}
          >
            <i className="ri-refresh-line mr-2"></i>
            Refresh
          </Button>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
              // Calculate PnL percentage
              const pnlPercentage = position.entry_price > 0 
                ? ((position.unrealized_pnl / parseFloat(position.margin_used || '1')) * 100)
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
                      <span className="font-semibold text-gray-900">{position.symbol}</span>
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
                      <span className="font-medium text-gray-900">${position.entry_price.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Current Price</span>
                      <span className="font-medium text-gray-900">
                        ${position.current_price?.toFixed(2) || 'Loading...'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Quantity</span>
                      <span className="font-medium text-gray-900">{position.quantity.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Margin Used</span>
                      <span className="font-medium text-gray-900">${parseFloat(position.margin_used || '0').toFixed(2)}</span>
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

      {/* Performance by Pair */}
      {performance.pairsPerformance && performance.pairsPerformance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 Performance by Trading Pair
            <span className="ml-2 text-sm font-normal text-gray-500">
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
                    <h4 className="font-semibold text-gray-900 text-lg">{pair.symbol}</h4>
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
                      <span className="font-semibold text-gray-900">
                        {pair.totalTrades} ({pair.winningTrades}W / {pair.losingTrades}L)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Profit Factor</span>
                      <span className={`font-semibold ${pair.profitFactor >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                        {pair.profitFactor.toFixed(2)}x
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Open Positions</span>
                      <span className="font-semibold text-gray-900">
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
                        <span className="ml-1 font-medium text-gray-900">
                          ${pair.totalVolume.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Fees:</span>
                        <span className="ml-1 font-medium text-red-600">
                          ${pair.totalFees.toFixed(2)}
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

