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
}

export default function PaperTradingPerformance() {
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

      // Get all closed trades
      const { data: trades } = await supabase
        .from('paper_trading_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      // Get open positions
      const { data: openPositions } = await supabase
        .from('paper_trading_positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (openPositions) {
        setPositions(openPositions as PaperPosition[]);
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
          currentBalance: account?.balance || initialBalance,
          initialBalance: initialBalance,
          openPositions: openPositions?.length || 0,
          totalVolume: totalVolume
        });
      } else {
        // No trades yet
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
          currentBalance: account?.balance || 10000,
          initialBalance: account?.initial_balance || 10000,
          openPositions: openPositions?.length || 0,
          totalVolume: 0
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
  }, []);

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
    </div>
  );
}

