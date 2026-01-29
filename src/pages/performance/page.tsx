import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Card from '../../components/base/Card';
import PaperTradingPerformance from '../../components/paper/PaperTradingPerformance';
import { usePerformance, type PerformanceMode } from '../../hooks/usePerformance';

type PerformanceViewMode = 'real' | 'paper' | 'both';

export default function Performance() {
  const [performanceViewMode, setPerformanceViewMode] = useState<PerformanceViewMode>('both');
  const [assetType, setAssetType] = useState<'all' | 'perpetuals' | 'spot'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
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

      const pairsSet = new Set<string>();

      // Paper pairs from open paper positions and closed paper trades
      if (performanceViewMode === 'paper' || performanceViewMode === 'both') {
        const { data: positions } = await supabase
          .from('paper_trading_positions')
          .select('symbol')
          .eq('user_id', user.id)
          .eq('status', 'open');
        (positions || []).forEach((p: { symbol: string }) => pairsSet.add(p.symbol));
        const { data: paperTrades } = await supabase
          .from('paper_trading_trades')
          .select('symbol')
          .eq('user_id', user.id)
          .eq('status', 'closed');
        (paperTrades || []).forEach((t: { symbol: string }) => pairsSet.add(t.symbol));
      }

      // Real pairs from trades
      if (performanceViewMode === 'real' || performanceViewMode === 'both') {
        const { data: trades } = await supabase
          .from('trades')
          .select('symbol')
          .eq('user_id', user.id);
        (trades || []).forEach((t: { symbol?: string }) => t.symbol && pairsSet.add(t.symbol));
      }

      const uniquePairs = [...pairsSet].sort();
      setAvailablePairs(uniquePairs);
      setSelectedPair(prev => {
        if (uniquePairs.length === 0) return '';
        if (prev === 'all') return 'all';
        if (prev && uniquePairs.includes(prev)) return prev;
        return '';
      });
    } catch (error) {
      console.error('Error fetching pairs:', error);
      setAvailablePairs([]);
      setSelectedPair('');
    }
  }, [performanceViewMode]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  // Calculate date range based on selected period - memoized to prevent infinite loops
  const dateRange = useMemo(() => {
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
  }, [selectedPeriod]);

  const { metrics: realMetrics, loading: realLoading, error: realError } = usePerformance(dateRange.start, dateRange.end, assetType, 'real' as PerformanceMode);
  const { metrics: paperMetrics, loading: paperLoading, error: paperError } = usePerformance(dateRange.start, dateRange.end, assetType, 'paper');

  const metrics = performanceViewMode === 'real' ? realMetrics : performanceViewMode === 'paper' ? paperMetrics : null;
  const loading = performanceViewMode === 'real' ? realLoading : performanceViewMode === 'paper' ? paperLoading : (realLoading || paperLoading);
  const error = performanceViewMode === 'real' ? realError : performanceViewMode === 'paper' ? paperError : (realError || paperError);

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

  // Prepare chart data (for single-mode view; both mode uses per-section data below)
  const chartData = metrics?.dailyPnL || [];
  const pnlValues = chartData.length > 0 ? chartData.map(d => Math.abs(d.pnl)) : [0];
  const maxPnL = Math.max(...pnlValues, 1);
  const minPnL = chartData.length > 0 ? Math.min(...chartData.map(d => d.pnl), 0) : 0;

  const renderChart = (m: typeof metrics, title: string) => {
    if (!m?.dailyPnL?.length) return null;
    const data = m.dailyPnL;
    const maxV = Math.max(...data.map(d => Math.abs(d.pnl)), 1);
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="relative h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <svg className="w-full h-full" viewBox={`0 0 ${data.length * 40} 200`} preserveAspectRatio="none">
            <line x1="0" y1="100" x2={data.length * 40} y2="100" stroke="currentColor" strokeWidth="1" className="text-gray-300 dark:text-gray-600" />
            <polyline
              points={data.map((d, i) => {
                const x = i * 40 + 20;
                const y = 100 - (d.pnl / maxV) * 80;
                return `${x},${Math.max(0, Math.min(200, y))}`;
              }).join(' ')}
              fill="none"
              stroke={(m.overview.totalPnL || 0) >= 0 ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              className="dark:opacity-80"
            />
            {data.map((d, i) => {
              const x = i * 40 + 20;
              const y = Math.max(0, Math.min(200, 100 - (d.pnl / maxV) * 80));
              const height = Math.abs(100 - y);
              return (
                <rect
                  key={i}
                  x={x - 15}
                  y={Math.min(y, 100)}
                  width={30}
                  height={height}
                  fill={d.pnl >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
                  className="dark:opacity-50"
                />
              );
            })}
          </svg>
          <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{new Date(data[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {data.length > 1 && <span>{new Date(data[Math.floor(data.length / 2)]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            {data.length > 2 && <span>{new Date(data[data.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
        </div>
      </Card>
    );
  };

  const renderSymbolRanking = (m: typeof metrics, title: string) => {
    if (!m?.symbolRanking?.length) return null;
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="space-y-3">
          {m.symbolRanking.map((symbol) => {
            const maxAbsPnL = Math.max(...m.symbolRanking!.map(s => Math.abs(s.pnl)), 1);
            const barWidth = (Math.abs(symbol.pnl) / maxAbsPnL) * 100;
            const isPositive = symbol.pnl >= 0;
            return (
              <div key={symbol.symbol} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-white">{symbol.symbol}</span>
                  <span className={`font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(symbol.pnl)}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full ${isPositive ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'}`} style={{ width: `${Math.min(barWidth, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Volume: {formatCurrency(symbol.volume)}</span>
                  <span>Trades: {symbol.trades} | WR: {(symbol.winRate ?? 0).toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  if (loading && performanceViewMode !== 'both') {
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

  if (error && performanceViewMode !== 'both') {
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

  const renderKpiBlock = (m: typeof metrics, label: string) => {
    if (!m) return null;
    return (
      <div className="space-y-6">
        {label && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            {label}
          </h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="text-center">
              <div className={`text-3xl font-bold mb-2 ${(m.overview.totalPnL || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(m.overview.totalPnL || 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total P&L</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">{(m.overview.winRate ?? 0).toFixed(1)}%</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Win Rate</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{m.overview.totalTrades || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Trades</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{m.overview.winningTrades || 0}/{m.overview.losingTrades || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Win/Loss</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">{formatCurrency(m.overview.totalFees || 0)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Fees</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">{formatCurrency(m.overview.maxDrawdown || 0)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">+{formatVolume(m.overview.tradingVolume || 0)}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Trading Volume</div>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Performance & P&L Analysis" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Real / Paper / Both toggle */}
        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Performance view</label>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'real' as const, label: 'Real trading' },
              { key: 'paper' as const, label: 'Paper trading' },
              { key: 'both' as const, label: 'Real & Paper' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPerformanceViewMode(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  performanceViewMode === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>

        {/* Pair Selection */}
        {availablePairs.length > 0 && (
          <Card className="p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Trading Pair
            </label>
            <select
              aria-label="Select trading pair"
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
            {selectedPair && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {selectedPair === 'all' 
                  ? `Showing report for all pairs (${availablePairs.length} pairs)`
                  : (
                    <>
                      Showing report for <span className="font-semibold">{selectedPair}</span>
                    </>
                  )
                }
              </p>
            )}
          </Card>
        )}

        {/* Paper Trading Performance - Show Open Positions & Activity Logs when Paper or Both; always show when pair selected */}
        {(performanceViewMode === 'paper' || performanceViewMode === 'both') ? (
          <PaperTradingPerformance
            selectedPair={selectedPair === 'all' ? '' : selectedPair || ''}
            onReset={fetchPairs}
          />
        ) : selectedPair ? (
          <PaperTradingPerformance
            selectedPair={selectedPair === 'all' ? '' : selectedPair}
            onReset={fetchPairs}
          />
        ) : availablePairs.length > 0 ? (
          <Card className="p-6 text-center">
            <i className="ri-search-line text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a Trading Pair
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Choose a pair from the dropdown above to view detailed performance report and open positions ({availablePairs.length} pairs available).
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Or switch to <strong>Paper trading</strong> or <strong>Real &amp; Paper</strong> above to see Open Positions and Activity Logs for all pairs.
            </p>
          </Card>
        ) : (
          <PaperTradingPerformance
            selectedPair=""
            onReset={fetchPairs}
          />
        )}

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
        {performanceViewMode === 'both' ? (
          <div className="space-y-8">
            <Card className="p-6">{renderKpiBlock(realMetrics, 'Real trading')}</Card>
            <Card className="p-6">{renderKpiBlock(paperMetrics, 'Paper trading')}</Card>
          </div>
        ) : (
          renderKpiBlock(metrics, '')
        )}

        {/* P&L Chart */}
        {performanceViewMode === 'both' ? (
          <div className="space-y-6">
            {renderChart(realMetrics, 'Real trading – P&L Chart')}
            {renderChart(paperMetrics, 'Paper trading – P&L Chart')}
          </div>
        ) : chartData.length > 0 ? (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Chart</h3>
            <div className="relative h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <svg className="w-full h-full" viewBox={`0 0 ${chartData.length * 40} 200`} preserveAspectRatio="none">
                <line x1="0" y1="100" x2={chartData.length * 40} y2="100" stroke="currentColor" strokeWidth="1" className="text-gray-300 dark:text-gray-600" />
                <polyline
                  points={chartData.map((d, i) => {
                    const x = i * 40 + 20;
                    const scale = maxPnL > 0 ? maxPnL : 1;
                    const y = 100 - (d.pnl / scale) * 80;
                    return `${x},${Math.max(0, Math.min(200, y))}`;
                  }).join(' ')}
                  fill="none"
                  stroke={(metrics?.overview.totalPnL || 0) >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth="2"
                  className="dark:opacity-80"
                />
                {chartData.map((d, i) => {
                  const x = i * 40 + 20;
                  const scale = maxPnL > 0 ? maxPnL : 1;
                  const y = Math.max(0, Math.min(200, 100 - (d.pnl / scale) * 80));
                  const height = Math.abs(100 - y);
                  return (
                    <rect key={i} x={x - 15} y={Math.min(y, 100)} width={30} height={height} fill={d.pnl >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'} className="dark:opacity-50" />
                  );
                })}
              </svg>
              <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{new Date(chartData[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                {chartData.length > 1 && <span>{new Date(chartData[Math.floor(chartData.length / 2)]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                {chartData.length > 2 && <span>{new Date(chartData[chartData.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">Data as of {dateRange.end.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} (UTC)</div>
          </Card>
        ) : null}

        {/* P&L Ranking by Symbol */}
        {performanceViewMode === 'both' ? (
          <div className="space-y-6">
            {renderSymbolRanking(realMetrics, 'Real trading – P&L Ranking')}
            {renderSymbolRanking(paperMetrics, 'Paper trading – P&L Ranking')}
          </div>
        ) : (
          metrics?.symbolRanking && metrics.symbolRanking.length > 0 && renderSymbolRanking(metrics, 'P&L Ranking')
        )}

        {/* Additional Stats */}
        {performanceViewMode === 'both' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Real trading</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center"><div className="text-xl font-bold text-gray-900 dark:text-white">{realMetrics?.overview.totalTrades || 0}</div><div className="text-xs text-gray-500">Trades</div></div>
                <div className="text-center"><div className="text-xl font-bold text-blue-600">{(realMetrics?.overview.winRate ?? 0).toFixed(1)}%</div><div className="text-xs text-gray-500">Win Rate</div></div>
                <div className="text-center"><div className="text-xl font-bold text-green-600">{formatCurrency(realMetrics?.overview.avgWin || 0)}</div><div className="text-xs text-gray-500">Avg Win</div></div>
                <div className="text-center"><div className="text-xl font-bold text-red-600">{formatCurrency(realMetrics?.overview.avgLoss || 0)}</div><div className="text-xs text-gray-500">Avg Loss</div></div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Paper trading</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center"><div className="text-xl font-bold text-gray-900 dark:text-white">{paperMetrics?.overview.totalTrades || 0}</div><div className="text-xs text-gray-500">Trades</div></div>
                <div className="text-center"><div className="text-xl font-bold text-blue-600">{(paperMetrics?.overview.winRate ?? 0).toFixed(1)}%</div><div className="text-xs text-gray-500">Win Rate</div></div>
                <div className="text-center"><div className="text-xl font-bold text-green-600">{formatCurrency(paperMetrics?.overview.avgWin || 0)}</div><div className="text-xs text-gray-500">Avg Win</div></div>
                <div className="text-center"><div className="text-xl font-bold text-red-600">{formatCurrency(paperMetrics?.overview.avgLoss || 0)}</div><div className="text-xs text-gray-500">Avg Loss</div></div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{metrics?.overview.totalTrades || 0}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Trades</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{(metrics?.overview.winRate ?? 0).toFixed(1)}%</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Win Rate</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">{formatCurrency(metrics?.overview.avgWin || 0)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Win</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">{formatCurrency(metrics?.overview.avgLoss || 0)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Loss</div>
              </div>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {(performanceViewMode === 'both'
          ? ((!realMetrics || realMetrics.overview.totalTrades === 0) && (!paperMetrics || paperMetrics.overview.totalTrades === 0))
          : (!metrics || metrics.overview.totalTrades === 0)) && (
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

