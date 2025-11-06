import { useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { Trade } from '../../types/trading';
import { useTrades } from '../../hooks/useTrades';
import { useBots } from '../../hooks/useBots';

export default function Trades() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedBot, setSelectedBot] = useState('all');
  const { trades, loading: tradesLoading, fetchTrades } = useTrades();
  const { bots } = useBots();

  const filteredTrades = trades.filter(trade => {
    if (selectedFilter !== 'all' && trade.status !== selectedFilter) return false;
    if (selectedBot !== 'all' && trade.botId !== selectedBot) return false;
    return true;
  });

  const getTradeStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-50';
      case 'closed': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'long' ? 'text-green-600' : 'text-red-600';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(price);
  };

  const formatPnL = (pnl?: number) => {
    if (!pnl) return '-';
    const color = pnl >= 0 ? 'text-green-600' : 'text-red-600';
    const sign = pnl >= 0 ? '+' : '';
    return (
      <span className={color}>
        {sign}{formatPrice(pnl)}
      </span>
    );
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all trade data? This will clear all trade history.')) {
      // Clear trades from localStorage or call API to clear
      localStorage.removeItem('trades');
      fetchTrades(); // Refresh the trades
    }
  };

  const getBotName = (botId: string) => {
    const bot = bots.find(b => b.id === botId);
    return bot?.name || 'Unknown Bot';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Trades" 
        subtitle="Monitor your trading activity"
        rightAction={
          <Button
            variant="danger"
            size="sm"
            onClick={handleReset}
          >
            <i className="ri-refresh-line mr-1"></i>
            Reset
          </Button>
        }
      />
      
      <div className="pt-20 pb-20 px-4 space-y-4">
        {/* Filters */}
        <Card className="p-4">
          <div className="space-y-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="flex space-x-2">
                {['all', 'open', 'closed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedFilter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bot Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bot</label>
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="w-full bg-gray-100 border-none rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Trade Statistics */}
        {(() => {
          const closedTrades = filteredTrades.filter(t => t.status === 'closed' || t.status === 'filled');
          const tradesWithPnL = closedTrades.filter(t => t.pnl !== null && t.pnl !== undefined && t.pnl !== 0);
          const winningTrades = tradesWithPnL.filter(t => (t.pnl || 0) > 0);
          const losingTrades = tradesWithPnL.filter(t => (t.pnl || 0) < 0);
          
          const totalPnL = tradesWithPnL.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
          const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
          
          const winRate = tradesWithPnL.length > 0 ? (winningTrades.length / tradesWithPnL.length) * 100 : 0;
          const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);
          const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
          const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
          
          // Calculate total volume (estimate from trade size and entry price)
          const totalVolume = filteredTrades.reduce((sum, t) => {
            const size = parseFloat(t.size?.toString() || '0');
            const entryPrice = parseFloat(t.entryPrice?.toString() || '0');
            return sum + (size * entryPrice);
          }, 0);
          
          // Calculate total fees (estimate 0.1% of volume)
          const totalFees = totalVolume * 0.001;
          
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {filteredTrades.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Trades</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {filteredTrades.filter(t => t.status === 'open').length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Active Trades</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {winRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Win Rate</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${profitFactor >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {profitFactor.toFixed(2)}x
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Profit Factor</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${avgWin.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Win</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${avgLoss.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Loss</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${totalVolume.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Volume</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total PnL</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Fees: ${totalFees.toFixed(2)}
                  </div>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Trades List */}
        <div className="space-y-3">
          {tradesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading trades...</p>
            </div>
          ) : filteredTrades.length === 0 ? (
            <Card className="p-8 text-center">
              <i className="ri-file-list-line text-4xl text-gray-300 mb-4"></i>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Trades Found</h3>
              <p className="text-gray-500">No trades match your current filters.</p>
            </Card>
          ) : (
            filteredTrades.map((trade) => (
              <Card key={trade.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTradeStatusColor(trade.status)}`}>
                      {trade.status.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {trade.symbol}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {trade.exchange}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Bot</div>
                    <div className="text-sm font-medium text-gray-900">
                      {getBotName(trade.botId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Side</div>
                    <div className={`text-sm font-medium ${getSideColor(trade.side)}`}>
                      {trade.side.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Size</div>
                    <div className="font-medium">{trade.size}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Entry Price</div>
                    <div className="font-medium">{formatPrice(trade.entryPrice)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">
                      {trade.status === 'open' ? 'Current P&L' : 'P&L'}
                    </div>
                    <div className="font-medium">
                      {formatPnL(trade.pnl)}
                    </div>
                  </div>
                </div>

                {trade.exitPrice && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Exit Price:</span>
                      <span className="font-medium">{formatPrice(trade.exitPrice)}</span>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center">
              <i className="ri-download-line mr-2"></i>
              Export Trades
            </button>
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition-colors flex items-center justify-center">
              <i className="ri-refresh-line mr-2"></i>
              Refresh Data
            </button>
          </div>
        </Card>
      </div>

      <Navigation />
    </div>
  );
}