import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import NotificationBell from '../../components/feature/NotificationBell';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { usePositions, type ExchangePosition, type ClosedPosition } from '../../hooks/usePositions';
import PortfolioPnLChart from '../../components/positions/PortfolioPnLChart';

export default function PositionsPage() {
  const navigate = useNavigate();
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'bybit' | 'okx' | 'bitunix'>('all');
  const [sortBy, setSortBy] = useState<'pnl' | 'size' | 'exchange' | 'symbol'>('pnl');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const { positions, closedPositions, loading, closedLoading, error, fetchPositions, fetchClosedPositions, closePosition } = usePositions(exchangeFilter);

  const filteredPositions = useMemo(() => {
    let filtered = [...positions];

    // Sort positions
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'pnl':
          comparison = a.unrealizedPnL - b.unrealizedPnL;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'exchange':
          comparison = a.exchange.localeCompare(b.exchange);
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [positions, sortBy, sortOrder]);

  const handleClosePosition = async (position: ExchangePosition) => {
    if (!confirm(`Close ${position.side.toUpperCase()} position for ${position.symbol}?\n\nSize: ${position.size}\nEntry Price: $${position.entryPrice.toFixed(4)}\nCurrent Price: $${position.currentPrice.toFixed(4)}\nUnrealized PnL: $${position.unrealizedPnL.toFixed(2)}`)) {
      return;
    }

    const positionId = `${position.exchange}-${position.symbol}-${position.side}`;
    setClosingPositionId(positionId);

    try {
      await closePosition(position.exchange, position.symbol, position.side, position.size);
      alert('✅ Position closed successfully!');
    } catch (err: any) {
      console.error('Error closing position:', err);
      alert(`❌ Failed to close position: ${err.message || String(err)}`);
    } finally {
      setClosingPositionId(null);
    }
  };

  const getExchangeIcon = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return 'ri-currency-line';
      case 'okx':
        return 'ri-exchange-line';
      case 'bitunix':
        return 'ri-bit-coin-line';
      default:
        return 'ri-exchange-box-line';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(price);
  };

  const formatPnL = (pnl: number) => {
    const color = pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const sign = pnl >= 0 ? '+' : '';
    return (
      <span className={color}>
        {sign}{formatPrice(pnl)}
      </span>
    );
  };

  const totalPnL = useMemo(() => {
    return positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  }, [positions]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <Header
        title="Exchange Positions"
        subtitle="View and manage your open positions across all exchanges"
        rightAction={
          <div className="flex space-x-2">
            <NotificationBell />
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchPositions}
            >
              <i className="ri-refresh-line mr-1"></i>
              Refresh
            </Button>
          </div>
        }
      />

      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {positions.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Positions</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}{formatPrice(totalPnL).replace('$', '')}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Unrealized PnL</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {positions.filter(p => p.unrealizedPnL >= 0).length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Profitable Positions</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {positions.filter(p => p.unrealizedPnL < 0).length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Losing Positions</div>
              </div>
            </Card>
          </div>

          {/* Portfolio Graph */}
          {positions.length > 0 && (
            <Card className="p-6">
              <PortfolioPnLChart positions={positions} />
            </Card>
          )}

          {/* Filters and Sort */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Exchange Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exchange</label>
                <div className="flex space-x-2">
                  {['all', 'bybit', 'okx', 'bitunix'].map((exchange) => (
                    <button
                      key={exchange}
                      onClick={() => setExchangeFilter(exchange as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        exchangeFilter === exchange
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {exchange.charAt(0).toUpperCase() + exchange.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="pnl">PnL</option>
                  <option value="size">Size</option>
                  <option value="exchange">Exchange</option>
                  <option value="symbol">Symbol</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <i className={`ri-arrow-${sortOrder === 'asc' ? 'up' : 'down'}-line`}></i>
                </button>
              </div>
            </div>
          </Card>

          {/* Error Message */}
          {error && (
            <Card className="border border-red-200 bg-red-50 dark:bg-red-900/20 p-5 text-red-700 dark:text-red-300">
              <p>Error loading positions: {error}</p>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading positions...</p>
            </Card>
          )}

          {/* Positions Table */}
          {!loading && !error && (
            <>
              {filteredPositions.length === 0 ? (
                <Card className="p-12 text-center">
                  <i className="ri-inbox-line text-4xl text-gray-400 mb-4"></i>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No positions found</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {exchangeFilter === 'all' 
                      ? 'You don\'t have any open positions on any exchange.'
                      : `You don't have any open positions on ${exchangeFilter.toUpperCase()}.`}
                  </p>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exchange</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Side</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entry Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stop Loss</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Take Profit</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leverage</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unrealized PnL</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PnL %</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredPositions.map((position, index) => {
                          const positionId = `${position.exchange}-${position.symbol}-${position.side}`;
                          const isClosing = closingPositionId === positionId;

                          return (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <i className={`${getExchangeIcon(position.exchange)} text-lg mr-2`}></i>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {position.exchange.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {position.symbol}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  position.side === 'long' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                  {position.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {position.size.toFixed(4)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {formatPrice(position.entryPrice).replace('$', '$')}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {formatPrice(position.currentPrice).replace('$', '$')}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {position.stopLoss && position.stopLoss > 0 ? (
                                  <span className="text-red-600 dark:text-red-400 font-medium">
                                    {formatPrice(position.stopLoss).replace('$', '$')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {position.takeProfit && position.takeProfit > 0 ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {formatPrice(position.takeProfit).replace('$', '$')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                {position.leverage}x
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold">
                                {formatPnL(position.unrealizedPnL)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold">
                                <span className={position.unrealizedPnLPercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                  {position.unrealizedPnLPercentage >= 0 ? '+' : ''}{position.unrealizedPnLPercentage.toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleClosePosition(position)}
                                  disabled={isClosing}
                                >
                                  {isClosing ? (
                                    <>
                                      <i className="ri-loader-4-line mr-1 animate-spin"></i>
                                      Closing...
                                    </>
                                  ) : (
                                    <>
                                      <i className="ri-close-circle-line mr-1"></i>
                                      Close
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Recently Closed Positions */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Closed Positions</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your recently closed positions with fees and PnL</p>
            </div>
            {closedLoading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading closed positions...</p>
              </div>
            ) : closedPositions.length === 0 ? (
              <div className="p-12 text-center">
                <i className="ri-archive-line text-4xl text-gray-400 mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No closed positions found</h3>
                <p className="text-gray-500 dark:text-gray-400">Closed positions will appear here once trades are completed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exchange</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Side</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entry Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fees</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PnL</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PnL %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Closed At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {closedPositions.map((position, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <i className={`${getExchangeIcon(position.exchange)} text-lg mr-2`}></i>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {position.exchange.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {position.symbol}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            position.side === 'long' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {position.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {position.size.toFixed(4)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {formatPrice(position.entryPrice).replace('$', '$')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {formatPrice(position.exitPrice).replace('$', '$')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-red-600 dark:text-red-400">
                          {formatPrice(position.fees).replace('$', '$')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold">
                          {formatPnL(position.pnl)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-semibold">
                          <span className={position.pnlPercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {position.pnlPercentage >= 0 ? '+' : ''}{position.pnlPercentage.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-gray-400">
                          {new Date(position.closedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
