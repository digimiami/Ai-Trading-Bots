import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import { createClient } from '@supabase/supabase-js';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  const [isSaving, setIsSaving] = useState(false);

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveBacktest = async () => {
    if (!results || !config.name.trim()) {
      alert('Please complete a backtest first');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get the symbols used in the backtest
      const symbols = config.useCustomPairs && config.customPairs.trim()
        ? config.customPairs
            .split(/[\n,]/)
            .map(pair => pair.trim().toUpperCase())
            .filter(pair => pair.length > 0)
        : config.symbols;

      const { data, error } = await supabase
        .from('backtests')
        .insert({
          user_id: session.user.id,
          name: config.name,
          symbols: symbols,
          custom_pairs: config.useCustomPairs ? config.customPairs : null,
          exchange: config.exchange,
          trading_type: config.tradingType,
          timeframe: config.timeframe,
          leverage: config.leverage,
          risk_level: config.riskLevel,
          trade_amount: config.tradeAmount,
          stop_loss: config.stopLoss,
          take_profit: config.takeProfit,
          strategy: strategy,
          strategy_config: advancedConfig,
          start_date: config.startDate,
          end_date: config.endDate,
          status: 'completed',
          progress: 100,
          total_trades: results.total_trades || 0,
          winning_trades: results.winning_trades || 0,
          losing_trades: results.losing_trades || 0,
          win_rate: results.win_rate || 0,
          total_pnl: results.total_pnl || 0,
          total_pnl_percentage: results.total_pnl_percentage || 0,
          max_drawdown: results.max_drawdown || 0,
          sharpe_ratio: results.sharpe_ratio || 0,
          profit_factor: results.profit_factor || 0,
          results_per_pair: results.results_per_pair || {},
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      alert('✅ Backtest saved successfully!');
      setBacktestId(data.id);
    } catch (error: any) {
      console.error('Error saving backtest:', error);
      alert(`Failed to save backtest: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!results) return;

    let csv = 'Backtest Results\n';
    csv += `Backtest Name: ${config.name}\n`;
    csv += `Date Range: ${config.startDate} to ${config.endDate}\n`;
    csv += `Exchange: ${config.exchange.toUpperCase()}\n`;
    csv += `Trading Type: ${config.tradingType}\n`;
    csv += `Generated: ${new Date().toISOString()}\n\n`;

    // Overview Summary
    csv += 'OVERVIEW SUMMARY\n';
    csv += `Total Trades,${results.total_trades || 0}\n`;
    csv += `Winning Trades,${results.winning_trades || 0}\n`;
    csv += `Losing Trades,${results.losing_trades || 0}\n`;
    csv += `Win Rate,${(results.win_rate || 0).toFixed(2)}%\n`;
    csv += `Total P&L,$${(results.total_pnl || 0).toFixed(2)}\n`;
    csv += `Total P&L %,${(results.total_pnl_percentage || 0).toFixed(2)}%\n`;
    csv += `Max Drawdown,${(results.max_drawdown || 0).toFixed(2)}%\n`;
    csv += `Sharpe Ratio,${(results.sharpe_ratio || 0).toFixed(2)}\n`;
    csv += `Profit Factor,${(results.profit_factor || 0).toFixed(2)}\n\n`;

    // Per-Pair Results
    if (results.results_per_pair && Object.keys(results.results_per_pair).length > 0) {
      csv += 'PER-PAIR PERFORMANCE\n';
      csv += 'Pair,Trades,Win Rate,Total P&L\n';
      Object.entries(results.results_per_pair).forEach(([pair, data]: [string, any]) => {
        csv += `${pair},${data.trades || 0},${(data.win_rate || 0).toFixed(2)}%,$${(data.pnl || 0).toFixed(2)}\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest-${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!results) return;

    const exportData = {
      backtest_name: config.name,
      date_range: {
        start: config.startDate,
        end: config.endDate
      },
      configuration: {
        exchange: config.exchange,
        trading_type: config.tradingType,
        timeframe: config.timeframe,
        leverage: config.leverage,
        risk_level: config.riskLevel,
        trade_amount: config.tradeAmount,
        stop_loss: config.stopLoss,
        take_profit: config.takeProfit,
        symbols: config.useCustomPairs && config.customPairs.trim()
          ? config.customPairs
              .split(/[\n,]/)
              .map(pair => pair.trim().toUpperCase())
              .filter(pair => pair.length > 0)
          : config.symbols
      },
      strategy: strategy,
      strategy_config: advancedConfig,
      results: results,
      generated_at: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest-${config.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      // Validate backtest name
      if (!config.name.trim()) {
        throw new Error('Please enter a backtest name');
      }

      // Parse custom pairs if enabled
      let symbols: string[] = [];
      if (config.useCustomPairs) {
        if (!config.customPairs.trim()) {
          throw new Error('Please enter at least one trading pair when using custom pairs');
        }
        
        symbols = config.customPairs
          .split(/[\n,]/)
          .map(pair => pair.trim().toUpperCase())
          .filter(pair => pair.length > 0);
        
        if (symbols.length === 0) {
          throw new Error('Please enter at least one valid trading pair (e.g., BTCUSDT, ETHUSDT)');
        }

        // Validate pair format (should be like BTCUSDT, ETHUSDT, etc.)
        const invalidPairs = symbols.filter(pair => !/^[A-Z]{2,10}USDT$/i.test(pair));
        if (invalidPairs.length > 0) {
          throw new Error(`Invalid pair format: ${invalidPairs.join(', ')}. Pairs should be in format like BTCUSDT, ETHUSDT`);
        }
      } else {
        if (config.symbols.length === 0) {
          throw new Error('Please select at least one trading pair');
        }
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
      console.log(`Parsed ${symbols.length} symbols:`, symbols);
      
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
        // Generate results based on actual symbols used
        const resultsPerPair: { [key: string]: any } = {};
        symbols.forEach((symbol, index) => {
          // Generate realistic demo data for each symbol
          const trades = Math.floor(Math.random() * 30) + 15;
          const winRate = Math.random() * 20 + 50; // 50-70%
          const pnl = (Math.random() * 2000) - 500; // -500 to 1500
          
          resultsPerPair[symbol] = {
            trades,
            win_rate: winRate,
            pnl: pnl
          };
        });

        const demoResults = {
          total_trades: Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.trades || 0), 0),
          winning_trades: Math.floor(Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.trades || 0) * (data.win_rate || 0) / 100, 0)),
          losing_trades: 0,
          win_rate: Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.win_rate || 0), 0) / symbols.length,
          total_pnl: Object.values(resultsPerPair).reduce((sum: number, data: any) => sum + (data.pnl || 0), 0),
          total_pnl_percentage: 0,
          max_drawdown: -12.5,
          sharpe_ratio: 1.85,
          profit_factor: 1.92,
          results_per_pair: resultsPerPair
        };
        
        demoResults.losing_trades = demoResults.total_trades - demoResults.winning_trades;
        demoResults.total_pnl_percentage = (demoResults.total_pnl / (config.tradeAmount * symbols.length * 10)) * 100;
        
        setResults(demoResults);
        setIsRunning(false);
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start backtest');
      setIsRunning(false);
      setProgress(0);
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

                {(() => {
                  // Get the actual selected symbols (either from config.symbols or parsed custom pairs)
                  const displaySymbols = config.useCustomPairs && config.customPairs.trim()
                    ? config.customPairs
                        .split(/[\n,]/)
                        .map(pair => pair.trim().toUpperCase())
                        .filter(pair => pair.length > 0)
                    : config.symbols;
                  
                  return displaySymbols.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        ✅ Selected {displaySymbols.length} pair{displaySymbols.length !== 1 ? 's' : ''}: {displaySymbols.join(', ')}
                      </p>
                    </div>
                  );
                })()}
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

            {/* Timeframe, Leverage, Trade Amount */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe
                </label>
                <select
                  value={config.timeframe}
                  onChange={(e) => setConfig(prev => ({ ...prev, timeframe: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1m">1 Minute</option>
                  <option value="3m">3 Minutes</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="2h">2 Hours</option>
                  <option value="4h">4 Hours</option>
                  <option value="6h">6 Hours</option>
                  <option value="12h">12 Hours</option>
                  <option value="1d">1 Day</option>
                  <option value="1w">1 Week</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Leverage
                </label>
                <input
                  type="number"
                  value={config.leverage}
                  onChange={(e) => setConfig(prev => ({ ...prev, leverage: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="100"
                  step="1"
                  disabled={config.tradingType === 'spot'}
                />
                {config.tradingType === 'spot' && (
                  <p className="text-xs text-gray-500 mt-1">Leverage not available for spot trading</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trade Amount ($)
                </label>
                <input
                  type="number"
                  value={config.tradeAmount}
                  onChange={(e) => setConfig(prev => ({ ...prev, tradeAmount: parseFloat(e.target.value) || 100 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="10"
                  max="10000"
                  step="10"
                />
              </div>
            </div>

            {/* Stop Loss & Take Profit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  value={config.stopLoss}
                  onChange={(e) => setConfig(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) || 2.0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0.5"
                  max="10"
                  step="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  value={config.takeProfit}
                  onChange={(e) => setConfig(prev => ({ ...prev, takeProfit: parseFloat(e.target.value) || 4.0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="20"
                  step="0.5"
                />
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
                        min="1"
                        max="200"
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

                {/* Action Buttons Row */}
                <div className="mt-6 pt-6 border-t border-green-300 space-y-3">
                  {/* Export/Save Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSaveBacktest}
                      disabled={isSaving}
                      className="w-full"
                    >
                      {isSaving ? (
                        <>
                          <i className="ri-loader-4-line animate-spin mr-2"></i>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="ri-save-line mr-2"></i>
                          Save to Database
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleExportCSV}
                      className="w-full"
                    >
                      <i className="ri-file-download-line mr-2"></i>
                      Export CSV
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleExportJSON}
                      className="w-full"
                    >
                      <i className="ri-file-code-line mr-2"></i>
                      Export JSON
                    </Button>
                  </div>

                  {/* Create Bot Button */}
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
                  {(() => {
                    // Get the actual symbol count being used in the backtest
                    const symbolCount = config.useCustomPairs && config.customPairs.trim()
                      ? config.customPairs
                          .split(/[\n,]/)
                          .map(pair => pair.trim().toUpperCase())
                          .filter(pair => pair.length > 0).length
                      : config.symbols.length;
                    return `Simulating trades across ${symbolCount} pair${symbolCount !== 1 ? 's' : ''}...`;
                  })()}
                </p>
              </Card>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

