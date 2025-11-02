import { useState } from 'react';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import { usePerformance } from '../../hooks/usePerformance';

export default function Performance() {
  const [assetType, setAssetType] = useState<'all' | 'perpetuals' | 'spot'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  // Calculate date range based on selected period
  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch (selectedPeriod) {
      case '7d':
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '60d':
        start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '180d':
        start = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();
  const { metrics, loading, error } = usePerformance(start, end, assetType);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  // Prepare chart data
  const chartData = metrics?.dailyPnL || [];
  const maxPnL = Math.max(...(chartData.map(d => Math.abs(d.pnl)) || [0]), 1);
  const minPnL = Math.min(...(chartData.map(d => d.pnl) || [0]), 0);

  // Get worst performing symbol (most negative P&L)
  const worstSymbol = metrics?.symbolRanking?.[0] || null;
  const bestSymbol = metrics?.symbolRanking?.[metrics?.symbolRanking.length - 1] || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title="Performance & P&L Analysis" />
        <div className="pt-20 pb-20 px-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading performance data...</p>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header title="Performance & P&L Analysis" />
        <div className="pt-20 pb-20 px-4">
          <Card className="p-6 text-center">
            <i className="ri-error-warning-line text-4xl text-red-500 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Data</h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </Card>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Performance & P&L Analysis" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Asset Type Tabs */}
        <Card className="p-4">
          <div className="flex space-x-2 mb-4">
            {[
              { key: 'all', label: 'All Assets' },
              { key: 'perpetuals', label: 'Perpetuals & Futures' },
              { key: 'spot', label: 'Spot' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setAssetType(key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  assetType === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period Selection */}
          <div className="flex space-x-2">
            {[
              { key: '7d', label: 'Last 7 D' },
              { key: '30d', label: 'Last 30 D' },
              { key: '60d', label: 'Last 60 D' },
              { key: '90d', label: 'Last 90 D' },
              { key: '180d', label: 'Last 180 D' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${
                (metrics?.overview.totalPnL || 0) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(metrics?.overview.totalPnL || 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total P&L</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                +{formatVolume(metrics?.overview.tradingVolume || 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Trading Volume</div>
            </div>
          </Card>
        </div>

        {/* P&L Chart */}
        {chartData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Chart</h3>
            <div className="relative h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <svg className="w-full h-full" viewBox={`0 0 ${chartData.length * 40} 200`} preserveAspectRatio="none">
                {/* X-axis */}
                <line
                  x1="0"
                  y1="100"
                  x2={chartData.length * 40}
                  y2="100"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-gray-300 dark:text-gray-600"
                />
                
                {/* P&L Line */}
                <polyline
                  points={chartData
                    .map((d, i) => {
                      const x = i * 40 + 20;
                      // Scale P&L to fit chart (100 is center/zero line)
                      const y = 100 - (d.pnl / maxPnL) * 80;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={metrics?.overview.totalPnL >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth="2"
                  className="dark:opacity-80"
                />
                
                {/* Area under curve */}
                {chartData.map((d, i) => {
                  const x = i * 40 + 20;
                  const y = 100 - (d.pnl / maxPnL) * 80;
                  const height = 100 - y;
                  return (
                    <rect
                      key={i}
                      x={x - 15}
                      y={y}
                      width="30"
                      height={height}
                      fill={d.pnl >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
                      className="dark:opacity-50"
                    />
                  );
                })}
              </svg>
              
              {/* Date labels (show first, middle, last) */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{new Date(chartData[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                {chartData.length > 1 && (
                  <span>{new Date(chartData[Math.floor(chartData.length / 2)]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
                {chartData.length > 2 && (
                  <span>{new Date(chartData[chartData.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
              Data as of {end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (UTC)
            </div>
          </Card>
        )}

        {/* P&L Ranking by Symbol */}
        {metrics?.symbolRanking && metrics.symbolRanking.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Ranking</h3>
            <div className="space-y-3">
              {metrics.symbolRanking.map((symbol, index) => {
                const maxLoss = Math.min(...metrics.symbolRanking.map(s => s.pnl));
                const barWidth = Math.abs(symbol.pnl / maxLoss) * 100;
                const isPositive = symbol.pnl >= 0;
                
                return (
                  <div key={symbol.symbol} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">{symbol.symbol}</span>
                      <span className={`font-medium ${
                        isPositive 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(symbol.pnl)}
                      </span>
                    </div>
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 h-full ${
                          isPositive 
                            ? 'bg-green-500 dark:bg-green-400' 
                            : 'bg-red-500 dark:bg-red-400'
                        }`}
                        style={{ width: `${Math.min(barWidth, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Volume: {formatCurrency(symbol.volume)}</span>
                      <span>Trades: {symbol.trades} | WR: {symbol.winRate.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {metrics?.overview.totalTrades || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Trades</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {metrics?.overview.winRate.toFixed(1) || '0.0'}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Win Rate</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                {formatCurrency(metrics?.overview.avgWin || 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg Win</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                {formatCurrency(metrics?.overview.avgLoss || 0)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg Loss</div>
            </div>
          </Card>
        </div>

        {/* Empty State */}
        {(!metrics || metrics.overview.totalTrades === 0) && (
          <Card className="p-8 text-center">
            <i className="ri-line-chart-line text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Performance Data</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Start trading to see your performance metrics here.
            </p>
          </Card>
        )}
      </div>

      <Navigation />
    </div>
  );
}

