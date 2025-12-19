import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import { createClient } from '@supabase/supabase-js';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';
import {
  HTF_TIMEFRAME_OPTIONS,
  HTF_TREND_INDICATOR_OPTIONS
} from '../../constants/strategyOptions';
import { supabase } from '../../lib/supabase';
import { getOptimizedSettingsForIndicator } from '../../utils/htfIndicatorSettings';
import PairRecommendations from '../../components/bot/PairRecommendations';
import type { PairRecommendation } from '../../services/pairRecommendations';

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
  atr_period: 14,
  atr_tp_multiplier: 3,
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

  const handleApplyRecommendation = (recommendation: PairRecommendation) => {
    // Apply recommended strategy parameters
    if (recommendation.strategy) {
      setStrategy(recommendation.strategy);
      console.log('✅ Applied Strategy Parameters:', recommendation.strategy);
    }

    // Apply recommended advanced config - ensure ALL parameters are applied
    if (recommendation.advancedConfig) {
      setAdvancedConfig(prev => {
        // Deep merge to ensure all advanced config parameters are included
        const merged: AdvancedStrategyConfig = {
          ...prev,
          ...recommendation.advancedConfig,
          // Ensure nested arrays are properly merged
          allowed_hours_utc: recommendation.advancedConfig!.allowed_hours_utc || prev.allowed_hours_utc
        };
        console.log('✅ Applied Advanced Strategy Config:', merged);
        return merged;
      });
    }

    // Apply recommended basic settings
    setConfig(prev => ({
      ...prev,
      tradeAmount: recommendation.suggestedTradeAmount || prev.tradeAmount,
      leverage: recommendation.suggestedLeverage || prev.leverage,
      stopLoss: recommendation.suggestedStopLoss || prev.stopLoss,
      takeProfit: recommendation.suggestedTakeProfit || prev.takeProfit,
      riskLevel: (recommendation.riskAssessment as 'low' | 'medium' | 'high') || prev.riskLevel
    }));

    // Count strategy and advanced config changes separately
    const strategyChanges = recommendation.changes.filter(c => c.parameter.startsWith('Strategy.')).length;
    const advancedChanges = recommendation.changes.filter(c => c.parameter.startsWith('Advanced.')).length;
    const totalChanges = recommendation.changes.length;

    // Show detailed success message
    const message = `✅ AI Recommendations Applied!

📊 Summary:
• Strategy Parameters: ${strategyChanges} optimized
• Advanced Config: ${advancedChanges} optimized
• Basic Settings: Updated
• Total Changes: ${totalChanges} parameters

All settings have been applied to your backtest configuration.`;
    
    alert(message);
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
    csv += `Gross Profit,$${(results.gross_profit || 0).toFixed(2)}\n`;
    csv += `Gross Loss,$${(results.gross_loss || 0).toFixed(2)}\n`;
    csv += `Net Profit,$${(results.net_profit || results.total_pnl || 0).toFixed(2)}\n`;
    csv += `Total P&L %,${(results.total_pnl_percentage || 0).toFixed(2)}%\n`;
    csv += `Max Drawdown (%),${(results.max_drawdown || 0).toFixed(2)}%\n`;
    csv += `Max Drawdown ($),$${Math.abs(results.max_drawdown_value || 0).toFixed(2)}\n`;
    csv += `Avg Drawdown,${(results.avg_drawdown || 0).toFixed(2)}%\n`;
    csv += `Sharpe Ratio,${(results.sharpe_ratio || 0).toFixed(2)}\n`;
    csv += `Profit Factor,${(results.profit_factor || 0).toFixed(2)}\n\n`;
    
    // Position Size
    csv += 'POSITION SIZE\n';
    csv += `Average Size,${(results.avg_position_size || 0).toFixed(4)}\n`;
    csv += `Min Size,${(results.min_position_size || 0).toFixed(4)}\n`;
    csv += `Max Size,${(results.max_position_size || 0).toFixed(4)}\n\n`;
    
    // Long/Short Breakdown
    csv += 'LONG/SHORT BREAKDOWN\n';
    csv += `Long Trades,${results.long_trades || 0}\n`;
    csv += `Long Wins,${results.long_wins || 0}\n`;
    csv += `Long Losses,${results.long_losses || 0}\n`;
    csv += `Long Win Rate,${(results.long_win_rate || 0).toFixed(2)}%\n`;
    csv += `Long PnL,$${(results.long_pnl || 0).toFixed(2)}\n`;
    csv += `Short Trades,${results.short_trades || 0}\n`;
    csv += `Short Wins,${results.short_wins || 0}\n`;
    csv += `Short Losses,${results.short_losses || 0}\n`;
    csv += `Short Win Rate,${(results.short_win_rate || 0).toFixed(2)}%\n`;
    csv += `Short PnL,$${(results.short_pnl || 0).toFixed(2)}\n\n`;

    // Per-Pair Results
    if (results.results_per_pair && Object.keys(results.results_per_pair).length > 0) {
      csv += 'PER-PAIR PERFORMANCE\n';
      csv += 'Pair,Trades,Win Rate,Total P&L,Long Trades,Short Trades,Long Wins,Long Losses,Short Wins,Short Losses,Gross Profit,Gross Loss\n';
      Object.entries(results.results_per_pair).forEach(([pair, data]: [string, any]) => {
        csv += `${pair},${data.trades || 0},${(data.win_rate || 0).toFixed(2)}%,$${(data.pnl || 0).toFixed(2)},${data.long_trades || 0},${data.short_trades || 0},${data.long_wins || 0},${data.long_losses || 0},${data.short_wins || 0},${data.short_losses || 0},$${(data.gross_profit || 0).toFixed(2)},$${(data.gross_loss || 0).toFixed(2)}\n`;
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
      
      // Call real backtest engine API
      setIsRunning(true);
      setProgress(0);
      
      // Update progress periodically
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            return prev;
          }
          return prev + 1;
        });
      }, 500);
      
      try {
        const { data, error } = await supabase.functions.invoke('backtest-engine', {
          body: backtestData
        });
        
        clearInterval(progressInterval);
        setProgress(100);
        
        if (error) {
          throw new Error(error.message || 'Backtest failed');
        }
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        console.log('Backtest results:', data);
        setResults(data);
      } catch (apiError: any) {
        clearInterval(progressInterval);
        throw new Error(apiError.message || 'Failed to run backtest');
      } finally {
        setIsRunning(false);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to start backtest');
      setIsRunning(false);
      setProgress(0);
    }
  };

  // Calculate effective symbol for AI recommendations (use first selected symbol)
  const effectiveSymbol = (() => {
    if (config.useCustomPairs && config.customPairs.trim()) {
      const firstPair = config.customPairs.split(/[,\s]+/).find(p => p.trim());
      if (firstPair) {
        const normalized = firstPair.trim().toUpperCase();
        return normalized.endsWith('USDT') ? normalized : normalized + 'USDT';
      }
    }
    return config.symbols.length > 0 ? config.symbols[0] : null;
  })();

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

            {/* AI Recommendations */}
            {effectiveSymbol && (
              <div className="mb-6">
                <PairRecommendations
                  symbol={effectiveSymbol}
                  tradingType={config.tradingType}
                  currentStrategy={strategy}
                  currentAdvancedConfig={advancedConfig}
                  currentTradeAmount={config.tradeAmount}
                  currentLeverage={config.leverage}
                  currentStopLoss={config.stopLoss}
                  currentTakeProfit={config.takeProfit}
                  onApplyRecommendation={handleApplyRecommendation}
                />
              </div>
            )}

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
                  <option value="bitunix">Bitunix</option>
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
                <p className="text-xs text-gray-500 mt-1">
                  Maximum loss percentage before closing position
                </p>
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
                <p className="text-xs text-gray-500 mt-1">
                  Target profit percentage before closing position
                </p>
              </div>
            </div>

            {/* Cooldown Bars */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cooldown (Bars)
              </label>
              <input
                type="number"
                value={advancedConfig.cooldown_bars}
                onChange={(e) => setAdvancedConfig(prev => ({ ...prev, cooldown_bars: parseInt(e.target.value) || 8 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
                max="100"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of bars to wait between trades (prevents overtrading)
              </p>
            </div>

            {/* Allowed Trading Hours */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allowed Trading Hours (EST)
              </label>
              <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={advancedConfig.allowed_hours_utc.length === 24}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAdvancedConfig(prev => ({ 
                          ...prev, 
                          allowed_hours_utc: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
                          session_filter_enabled: false
                        }));
                      } else {
                        setAdvancedConfig(prev => ({ 
                          ...prev, 
                          allowed_hours_utc: [],
                          session_filter_enabled: true
                        }));
                      }
                    }}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All (24/7)</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 24 }, (_, i) => {
                    const estHour = (i - 5 + 24) % 24;
                    const isSelected = advancedConfig.allowed_hours_utc.includes(i);
                    return (
                      <label key={i} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdvancedConfig(prev => ({
                                ...prev,
                                allowed_hours_utc: [...prev.allowed_hours_utc, i].sort((a, b) => a - b),
                                session_filter_enabled: true
                              }));
                            } else {
                              setAdvancedConfig(prev => ({
                                ...prev,
                                allowed_hours_utc: prev.allowed_hours_utc.filter(h => h !== i),
                                session_filter_enabled: prev.allowed_hours_utc.filter(h => h !== i).length > 0
                              }));
                            }
                          }}
                          className="mr-1 h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-xs text-gray-700">
                          {estHour.toString().padStart(2, '0')}:00 EST
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select hours when bot is allowed to trade (stored in UTC, displayed in EST)
              </p>
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
                <div className="mt-6 space-y-6">
                  {/* Directional Bias */}
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">🎯 Directional Bias</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bias Mode
                        </label>
                        <select
                          value={advancedConfig.bias_mode}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, bias_mode: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="auto">Auto (Follow HTF Trend)</option>
                          <option value="long-only">Long Only</option>
                          <option value="short-only">Short Only</option>
                          <option value="both">Both Directions</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTF Timeframe
                        </label>
                        <select
                          value={advancedConfig.htf_timeframe}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              htf_timeframe: e.target.value as typeof prev.htf_timeframe
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {HTF_TIMEFRAME_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTF Trend Indicator
                        </label>
                        <select
                          value={advancedConfig.htf_trend_indicator}
                          onChange={(e) => {
                            const newIndicator = e.target.value as typeof advancedConfig.htf_trend_indicator;
                            // Auto-adjust related settings based on selected indicator
                            const optimizedSettings = getOptimizedSettingsForIndicator(newIndicator, advancedConfig);
                            
                            setAdvancedConfig(prev => ({
                              ...prev,
                              htf_trend_indicator: newIndicator,
                              ...optimizedSettings
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {HTF_TREND_INDICATOR_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ADX Min (HTF): {advancedConfig.adx_min_htf}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.adx_min_htf}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, adx_min_htf: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="15"
                          max="35"
                          step="1"
                        />
                        <p className="text-xs text-gray-500">Minimum ADX for trend confirmation</p>
                      </div>
                    </div>
                  </div>

                  {/* Indicator Settings */}
                  <div className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">📐 Indicator Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          EMA Length
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.ema_fast_period ?? 50}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              ema_fast_period: parseInt(e.target.value) || 50
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={1}
                          max={500}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ATR Length
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.atr_period ?? 14}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              atr_period: parseInt(e.target.value) || 14
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={1}
                          max={200}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ATR TP Multiplier
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.atr_tp_multiplier ?? 3}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              atr_tp_multiplier: parseFloat(e.target.value) || 3
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={0.5}
                          max={10}
                          step={0.1}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ATR SL Multiplier
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.sl_atr_mult}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              sl_atr_mult: parseFloat(e.target.value) || prev.sl_atr_mult
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={0.5}
                          max={5}
                          step={0.1}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          RSI Length
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.rsi_period ?? 14}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              rsi_period: parseInt(e.target.value) || 14
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={5}
                          max={50}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          RSI Overbought
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.rsi_overbought ?? 70}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              rsi_overbought: parseInt(e.target.value) || 70
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={50}
                          max={100}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          RSI Oversold
                        </label>
                        <input
                          type="number"
                          value={advancedConfig.rsi_oversold ?? 30}
                          onChange={(e) =>
                            setAdvancedConfig(prev => ({
                              ...prev,
                              rsi_oversold: parseInt(e.target.value) || 30
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min={0}
                          max={50}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Regime Filter */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">📊 Regime Filter</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Regime Mode
                        </label>
                        <select
                          value={advancedConfig.regime_mode}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, regime_mode: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="auto">Auto Detect</option>
                          <option value="trend">Trend Only</option>
                          <option value="mean-reversion">Mean Reversion Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ADX Trend Min: {advancedConfig.adx_trend_min}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.adx_trend_min}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, adx_trend_min: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="20"
                          max="35"
                          step="1"
                        />
                        <p className="text-xs text-gray-500">ADX ≥ this = trending</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ADX Mean Rev Max: {advancedConfig.adx_meanrev_max}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.adx_meanrev_max}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, adx_meanrev_max: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="15"
                          max="25"
                          step="1"
                        />
                        <p className="text-xs text-gray-500">ADX ≤ this = ranging</p>
                      </div>
                    </div>
                  </div>

                  {/* Risk Management */}
                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">🛡️ Risk Management</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Risk Per Trade: {advancedConfig.risk_per_trade_pct}%
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
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                          Daily Loss Limit: {advancedConfig.daily_loss_limit_pct}%
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.daily_loss_limit_pct}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, daily_loss_limit_pct: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="1"
                          max="10"
                          step="0.5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Trades/Day: {advancedConfig.max_trades_per_day}
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
                    </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Weekly Loss Limit: {advancedConfig.weekly_loss_limit_pct}%
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.weekly_loss_limit_pct}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, weekly_loss_limit_pct: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="2"
                          max="15"
                          step="0.5"
                        />
                        <p className="text-xs text-gray-500">Auto-pause if weekly loss exceeds</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Concurrent Positions: {advancedConfig.max_concurrent}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.max_concurrent}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, max_concurrent: parseInt(e.target.value) }))}
                          className="w-full"
                          min="1"
                          max="5"
                          step="1"
                        />
                        <p className="text-xs text-gray-500">Max open positions simultaneously</p>
                      </div>
                    </div>
                  </div>

                  {/* Safety Features */}
                  <div className="border-l-4 border-orange-500 pl-4 mt-6">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">🛡️ Safety Features</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Configure automatic safety limits to protect your bot from excessive losses.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Consecutive Losses: {advancedConfig.max_consecutive_losses || 5}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.max_consecutive_losses || 5}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, max_consecutive_losses: parseInt(e.target.value) }))}
                          className="w-full"
                          min="2"
                          max="10"
                          step="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-pause bot after this many consecutive losses
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exit Strategy */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">🎯 Exit Strategy</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          TP1 (R): {advancedConfig.tp1_r}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.tp1_r}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp1_r: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="0.5"
                          max="3.0"
                          step="0.25"
                        />
                        <p className="text-xs text-gray-500">First take profit (R = Risk units)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          TP2 (R): {advancedConfig.tp2_r}
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.tp2_r}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp2_r: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="1.0"
                          max="5.0"
                          step="0.25"
                        />
                        <p className="text-xs text-gray-500">Second take profit</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          TP1 Size: {(advancedConfig.tp1_size * 100).toFixed(0)}%
                        </label>
                        <input
                          type="range"
                          value={advancedConfig.tp1_size}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp1_size: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="0.25"
                          max="0.75"
                          step="0.05"
                        />
                        <p className="text-xs text-gray-500">% to close at TP1</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">⚡ Quick Presets</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setAdvancedConfig({
                          ...advancedConfig,
                          bias_mode: 'auto',
                          regime_mode: 'trend',
                          risk_per_trade_pct: 0.5,
                          max_trades_per_day: 6,
                          tp1_r: 1.5,
                          tp2_r: 3.0
                        })}
                        className="px-4 py-2 bg-white border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-medium"
                      >
                        🐢 Conservative
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvancedConfig({
                          ...advancedConfig,
                          bias_mode: 'auto',
                          regime_mode: 'auto',
                          risk_per_trade_pct: 0.75,
                          max_trades_per_day: 8,
                          tp1_r: 1.0,
                          tp2_r: 2.0
                        })}
                        className="px-4 py-2 bg-white border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-medium"
                      >
                        ⚖️ Balanced
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvancedConfig({
                          ...advancedConfig,
                          bias_mode: 'both',
                          regime_mode: 'auto',
                          risk_per_trade_pct: 1.0,
                          max_trades_per_day: 12,
                          tp1_r: 0.8,
                          tp2_r: 1.5
                        })}
                        className="px-4 py-2 bg-white border-2 border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-medium"
                      >
                        🚀 Aggressive
                      </button>
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
                
                {/* Overview Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">{results.total_trades || 0}</div>
                    <div className="text-sm text-gray-500">Total Trades</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{(results.win_rate || 0).toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Win Rate</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-600">${(results.net_profit || results.total_pnl || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Net Profit</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-orange-600">{(results.sharpe_ratio || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Sharpe Ratio</div>
                  </div>
                </div>

                {/* Profit Metrics */}
                <div className="bg-white rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-800">💰 Profit Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-bold text-green-600">${(results.gross_profit || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Gross Profit</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">${(results.gross_loss || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Gross Loss</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${(results.net_profit || results.total_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(results.net_profit || results.total_pnl || 0).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">Net Profit</div>
                    </div>
                  </div>
                </div>

                {/* Position Size Metrics */}
                <div className="bg-white rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-800">📏 Position Size</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{(results.avg_position_size || 0).toFixed(4)}</div>
                      <div className="text-sm text-gray-500">Average Size</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-600">{(results.min_position_size || 0).toFixed(4)}</div>
                      <div className="text-sm text-gray-500">Min Size</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-600">{(results.max_position_size || 0).toFixed(4)}</div>
                      <div className="text-sm text-gray-500">Max Size</div>
                    </div>
                  </div>
                </div>

                {/* Long/Short Breakdown */}
                <div className="bg-white rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-800">📈 Long/Short Performance</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Long Trades */}
                    <div className="border-l-4 border-green-500 pl-4">
                      <h5 className="font-medium text-green-700 mb-2">🔼 Long Trades</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold">{results.long_trades || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Wins:</span>
                          <span className="font-semibold text-green-600">{results.long_wins || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Losses:</span>
                          <span className="font-semibold text-red-600">{results.long_losses || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Win Rate:</span>
                          <span className="font-semibold">{(results.long_win_rate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">PnL:</span>
                          <span className={`font-bold ${(results.long_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${(results.long_pnl || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Short Trades */}
                    <div className="border-l-4 border-red-500 pl-4">
                      <h5 className="font-medium text-red-700 mb-2">🔽 Short Trades</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold">{results.short_trades || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Wins:</span>
                          <span className="font-semibold text-green-600">{results.short_wins || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Losses:</span>
                          <span className="font-semibold text-red-600">{results.short_losses || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Win Rate:</span>
                          <span className="font-semibold">{(results.short_win_rate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">PnL:</span>
                          <span className={`font-bold ${(results.short_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${(results.short_pnl || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drawdown Metrics */}
                <div className="bg-white rounded-lg p-4 mb-6">
                  <h4 className="font-semibold mb-3 text-gray-800">📉 Drawdown Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-bold text-red-600">{(results.max_drawdown || 0).toFixed(2)}%</div>
                      <div className="text-sm text-gray-500">Max Drawdown (%)</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">${Math.abs(results.max_drawdown_value || 0).toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Max Drawdown ($)</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-600">{(results.avg_drawdown || 0).toFixed(2)}%</div>
                      <div className="text-sm text-gray-500">Avg Drawdown (%)</div>
                    </div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xl font-bold text-green-600">{results.winning_trades || 0}</div>
                    <div className="text-sm text-gray-500">Winning Trades</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xl font-bold text-red-600">{results.losing_trades || 0}</div>
                    <div className="text-sm text-gray-500">Losing Trades</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-xl font-bold text-blue-600">{(results.profit_factor || 0).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Profit Factor</div>
                  </div>
                </div>

                {/* Per-Pair Results */}
                {results.results_per_pair && Object.keys(results.results_per_pair).length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">Performance by Pair</h4>
                    <div className="space-y-2">
                      {Object.entries(results.results_per_pair).map(([pair, data]: [string, any]) => (
                        <div key={pair} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-lg">{pair}</div>
                              <div className="text-sm text-gray-500">{data.trades || 0} trades</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-lg ${(data.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${(data.pnl || 0).toFixed(2)}
                              </div>
                              <div className="text-sm text-gray-500">{(data.win_rate || 0).toFixed(1)}% win</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200 text-xs">
                            <div>
                              <div className="text-gray-500">Long: {data.long_trades || 0}</div>
                              <div className="text-gray-500">Short: {data.short_trades || 0}</div>
                            </div>
                            <div>
                              <div className="text-green-600">Wins: {((data.long_wins || 0) + (data.short_wins || 0))}</div>
                              <div className="text-red-600">Losses: {((data.long_losses || 0) + (data.short_losses || 0))}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Gross Profit:</div>
                              <div className="text-green-600 font-semibold">${(data.gross_profit || 0).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Gross Loss:</div>
                              <div className="text-red-600 font-semibold">${(data.gross_loss || 0).toFixed(2)}</div>
                            </div>
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

