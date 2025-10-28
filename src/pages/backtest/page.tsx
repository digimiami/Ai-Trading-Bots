import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';

interface BacktestConfig {
  name: string;
  symbols: string[];
  customPairs: string;
  useCustomPairs: boolean;
  exchange: 'bybit' | 'okx';
  tradingType: 'spot' | 'futures';
  timeframe: string;
  leverage: number;
  riskLevel: 'low' | 'medium' | 'high';
  tradeAmount: number;
  stopLoss: number;
  takeProfit: number;
  startDate: string;
  endDate: string;
}

export default function BacktestPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<BacktestConfig>({
    name: '',
    symbols: ['BTCUSDT'],
    customPairs: '',
    useCustomPairs: false,
    exchange: 'bybit',
    tradingType: 'futures',
    timeframe: '1h',
    leverage: 5,
    riskLevel: 'medium',
    tradeAmount: 100,
    stopLoss: 2.0,
    takeProfit: 4.0,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // Today
  });

  const [strategy, setStrategy] = useState<TradingStrategy>({
    rsiThreshold: 70,
    adxThreshold: 25,
    bbWidthThreshold: 0.02,
    emaSlope: 0.5,
    atrPercentage: 2.5,
    vwapDistance: 1.2,
    momentumThreshold: 0.8,
    useMLPrediction: true,
    minSamplesForML: 100
  });

  const [advancedConfig, setAdvancedConfig] = useState<AdvancedStrategyConfig>({
    bias_mode: 'auto',
    htf_timeframe: '4h',
    htf_trend_indicator: 'EMA200',
    ema_fast_period: 50,
    require_price_vs_trend: 'any',
    adx_min_htf: 23,
    require_adx_rising: true,
    regime_mode: 'auto',
    adx_trend_min: 25,
    adx_meanrev_max: 19,
    session_filter_enabled: false,
    allowed_hours_utc: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    cooldown_bars: 8,
    atr_percentile_min: 20,
    bb_width_min: 0.012,
    bb_width_max: 0.03,
    min_24h_volume_usd: 500000000,
    max_spread_bps: 3,
    risk_per_trade_pct: 0.75,
    daily_loss_limit_pct: 3.0,
    weekly_loss_limit_pct: 6.0,
    max_trades_per_day: 8,
    max_concurrent: 2,
    sl_atr_mult: 1.3,
    tp1_r: 1.0,
    tp2_r: 2.0,
    tp1_size: 0.5,
    breakeven_at_r: 0.8,
    trail_after_tp1_atr: 1.0,
    time_stop_hours: 48,
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    use_ml_prediction: true,
    ml_confidence_threshold: 0.6,
    ml_min_samples: 100
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [backtestId, setBacktestId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [botName, setBotName] = useState('');

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateBotFromResults = async () => {
    if (!results || !botName.trim()) {
      alert('Please enter a bot name');
      return;
    }

    try {
      // Navigate to create bot page with pre-filled data
      navigate('/create-bot', { 
        state: { 
          fromBacktest: true,
          backtestResults: results,
          botName: botName,
          backtestConfig: config,
          backtestStrategy: strategy,
          backtestAdvancedConfig: advancedConfig
        } 
      });
    } catch (error) {
      console.error('Error creating bot from results:', error);
      alert('Failed to create bot. Please try again.');
    }
  };

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  const handleStartBacktest = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      // Parse custom pairs if enabled
      let symbols: string[] = [];
      if (config.useCustomPairs && config.customPairs.trim()) {
        symbols = config.customPairs
          .split(/[\n,]/)
          .map(pair => pair.trim().toUpperCase())
          .filter(pair => pair.length > 0);
        
        if (symbols.length === 0) {
          throw new Error('Please enter at least one trading pair');
        }
      } else {
        symbols = config.symbols;
      }

      const backtestData = {
        name: config.name,
        symbols,
        customPairs: config.useCustomPairs ? config.customPairs : undefined,
        exchange: config.exchange,
        tradingType: config.tradingType,
        timeframe: config.timeframe,
        leverage: config.leverage,
        riskLevel: config.riskLevel,
        tradeAmount: config.tradeAmount,
        stopLoss: config.stopLoss,
        takeProfit: config.takeProfit,
        strategy,
        strategyConfig: advancedConfig,
        startDate: config.startDate,
        endDate: config.endDate,
      };

      console.log('Starting backtest with data:', backtestData);
      
      // Simulate backtest execution with delay
      setIsRunning(true);
      setProgress(0);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);
      
      // Simulate backtest running...
      setTimeout(() => {
        clearInterval(progressInterval);
        setProgress(100);
        
        // Demo results - replace with actual API call later
        const demoResults = {
          total_trades: 127,
          winning_trades: 78,
          losing_trades: 49,
          win_rate: 61.4,
          total_pnl: 3428.75,
          total_pnl_percentage: 34.3,
          max_drawdown: -12.5,
          sharpe_ratio: 1.85,
          profit_factor: 1.92,
          results_per_pair: {
            'BTCUSDT': { trades: 45, win_rate: 68.9, pnl: 1520.30 },
            'ETHUSDT': { trades: 38, win_rate: 57.9, pnl: 980.15 },
            'SOLUSDT': { trades: 29, win_rate: 62.1, pnl: 678.50 },
            'ADAUSDT': { trades: 15, win_rate: 53.3, pnl: 249.80 }
          }
        };
        
        setResults(demoResults);
        setIsRunning(false);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start backtest');
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Multiple Pairs Backtesting" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-6">📊 New Backtest</h2>

            {/* Backtest Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backtest Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter backtest name"
                required
              />
            </div>

            {/* Trading Pairs Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📈 Trading Pairs to Test
              </label>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="pairMode"
                    checked={!config.useCustomPairs}
                    onChange={() => setConfig(prev => ({ ...prev, useCustomPairs: false }))}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Select from popular pairs</label>
                </div>
                
                {!config.useCustomPairs ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {popularSymbols.map(symbol => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => {
                          const newSymbols = config.symbols.includes(symbol)
                            ? config.symbols.filter(s => s !== symbol)
                            : [...config.symbols, symbol];
                          setConfig(prev => ({ ...prev, symbols: newSymbols }));
                        }}
                        className={`px-3 py-2 rounded-lg border-2 ${
                          config.symbols.includes(symbol)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={config.customPairs}
                    onChange={(e) => setConfig(prev => ({ ...prev, customPairs: e.target.value }))}
                    placeholder="Enter pairs separated by comma or new line&#10;Example: BTCUSDT, ETHUSDT, SOLUSDT"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                )}
                
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="pairMode"
                    checked={config.useCustomPairs}
                    onChange={() => setConfig(prev => ({ ...prev, useCustomPairs: true }))}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Use custom pairs</label>
                </div>

                {config.symbols.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      ✅ Selected {config.symbols.length} pair{config.symbols.length !== 1 ? 's' : ''}: {config.symbols.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={config.startDate}
                  onChange={(e) => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={config.endDate}
                  onChange={(e) => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Exchange & Trading Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exchange
                </label>
                <select
                  value={config.exchange}
                  onChange={(e) => setConfig(prev => ({ ...prev, exchange: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bybit">Bybit</option>
                  <option value="okx">OKX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trading Type
                </label>
                <select
                  value={config.tradingType}
                  onChange={(e) => setConfig(prev => ({ ...prev, tradingType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="spot">Spot Trading</option>
                  <option value="futures">Futures Trading</option>
                </select>
              </div>
            </div>

            {/* Strategy Parameters Section */}
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Strategy Parameters</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSI Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.rsiThreshold}
                    onChange={(e) => handleStrategyChange('rsiThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="30"
                    max="90"
                    step="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ADX Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.adxThreshold}
                    onChange={(e) => handleStrategyChange('adxThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="10"
                    max="50"
                    step="5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BB Width Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.bbWidthThreshold}
                    onChange={(e) => handleStrategyChange('bbWidthThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0.01"
                    max="0.1"
                    step="0.005"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ATR Percentage
                  </label>
                  <input
                    type="number"
                    value={strategy.atrPercentage}
                    onChange={(e) => handleStrategyChange('atrPercentage', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="10"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={strategy.useMLPrediction}
                    onChange={(e) => handleStrategyChange('useMLPrediction', e.target.checked)}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable ML Prediction
                  </span>
                </label>
              </div>
            </Card>

            {/* Advanced Strategy Configuration */}
            <Card className="p-6 mt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  ⚙️ Advanced Strategy Configuration
                </h2>
                <i className={`ri-arrow-${showAdvanced ? 'up' : 'down'}-s-line text-2xl text-gray-600`}></i>
              </button>
              
              {showAdvanced && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Risk Per Trade (%)
                      </label>
                      <input
                        type="range"
                        value={advancedConfig.risk_per_trade_pct}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, risk_per_trade_pct: parseFloat(e.target.value) }))}
                        className="w-full"
                        min="0.25"
                        max="2.0"
                        step="0.25"
                      />
                      <p className="text-xs text-gray-500">{advancedConfig.risk_per_trade_pct}%</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Trades/Day
                      </label>
                      <input
                        type="range"
                        value={advancedConfig.max_trades_per_day}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, max_trades_per_day: parseInt(e.target.value) }))}
                        className="w-full"
                        min="2"
                        max="20"
                        step="1"
                      />
                      <p className="text-xs text-gray-500">{advancedConfig.max_trades_per_day}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Results Section */}
            {results && (
              <Card className="p-6 mt-6 bg-green-50 border-green-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Backtest Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">{results.total_trades || 0}</div>
                    <div className="text-sm text-gray-500">Total Trades</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{(results.win_rate || 0).toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Win Rate</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-600">${(results.total_pnl || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Total PnL</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-orange-600">{(results.sharpe_ratio || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Sharpe Ratio</div>
                  </div>
                </div>

                {/* Per-Pair Results */}
                {results.results_per_pair && Object.keys(results.results_per_pair).length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">Performance by Pair</h4>
                    <div className="space-y-2">
                      {Object.entries(results.results_per_pair).map(([pair, data]: [string, any]) => (
                        <div key={pair} className="bg-white rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{pair}</div>
                            <div className="text-sm text-gray-500">{data.trades || 0} trades</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${(data.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${(data.pnl || 0).toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-500">{(data.win_rate || 0).toFixed(1)}% win</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create Bot from Results Button */}
                <div className="mt-6 pt-6 border-t border-green-300">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowCreateBot(true)}
                    className="w-full"
                  >
                    <i className="ri-robot-add-line mr-2"></i>
                    Create Trading Bot from This Backtest
                  </Button>
                </div>
              </Card>
            )}

            {/* Create Bot Modal */}
            {showCreateBot && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md p-6">
                  <h3 className="text-lg font-semibold mb-4">Create Trading Bot from Backtest</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Use this successful backtest to create a live trading bot with the same strategy.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bot Name
                    </label>
                    <input
                      type="text"
                      value={botName}
                      onChange={(e) => setBotName(e.target.value)}
                      placeholder="Enter bot name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-500">Win Rate</div>
                      <div className="text-xl font-bold text-green-600">{results?.win_rate?.toFixed(1)}%</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-gray-500">Total PnL</div>
                      <div className="text-xl font-bold text-purple-600">${results?.total_pnl?.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowCreateBot(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleCreateBotFromResults}
                      className="flex-1"
                      disabled={!botName.trim()}
                    >
                      Create Bot
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/bots')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStartBacktest}
                loading={isRunning}
                className="flex-1"
              >
                {isRunning ? 'Running Backtest...' : '🚀 Start Backtest'}
              </Button>
            </div>

            {/* Progress Bar */}
            {isRunning && (
              <Card className="p-6 mt-6">
                <div className="mb-2 flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Backtest Progress</span>
                  <span className="text-sm font-medium text-blue-600">{Math.floor(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Simulating trades across {config.symbols.length} pairs...
                </p>
              </Card>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

