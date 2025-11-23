import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import type { TradingStrategy, TradingBot, AdvancedStrategyConfig } from '../../types/trading';
import { useBots } from '../../hooks/useBots';
import AutoOptimizer from '../../components/bot/AutoOptimizer';
import { STRATEGY_PRESETS, type StrategyPreset } from '../../constants/strategyPresets';

export default function EditBotPage() {
  const navigate = useNavigate();
  const { botId } = useParams<{ botId: string }>();
  const { bots, updateBot } = useBots();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx',
    tradingType: 'spot' as 'spot' | 'futures',
    symbol: 'BTCUSDT',
    timeframe: '1h' as '1m' | '5m' | '15m' | '1h' | '2h' | '3h' | '4h' | '1d' | '1w',
    leverage: 5,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    tradeAmount: 100,
    stopLoss: 2.0,
    takeProfit: 4.0
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
    // Directional Bias
    bias_mode: 'auto',
    htf_timeframe: '4h',
    htf_trend_indicator: 'EMA200',
    ema_fast_period: 50,
    require_price_vs_trend: 'any',
    adx_min_htf: 23,
    require_adx_rising: true,
    
    // Regime Filter
    regime_mode: 'auto',
    adx_trend_min: 25,
    adx_meanrev_max: 19,
    
    // Session/Timing
    session_filter_enabled: false,
    allowed_hours_utc: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
    cooldown_bars: 8,
    
    // Volatility/Liquidity Gates
    atr_percentile_min: 20,
    bb_width_min: 0.012,
    bb_width_max: 0.03,
    min_24h_volume_usd: 500000000,
    max_spread_bps: 3,
    
    // Risk & Exits
    risk_per_trade_pct: 0.75,
    daily_loss_limit_pct: 3.0,
    weekly_loss_limit_pct: 6.0,
    max_trades_per_day: 8,
    max_concurrent: 2,
    max_consecutive_losses: 5,
    sl_atr_mult: 1.3,
    tp1_r: 1.0,
    tp2_r: 2.0,
    tp1_size: 0.5,
    breakeven_at_r: 0.8,
    trail_after_tp1_atr: 1.0,
    time_stop_hours: 48,
    
    // Technical Indicators
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    atr_period: 14,
    atr_tp_multiplier: 3,
    
    // ML/AI Settings
    use_ml_prediction: true,
    ml_confidence_threshold: 0.6,
    ml_min_samples: 100
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(false);

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  // Load bot data when component mounts
  useEffect(() => {
    if (botId && bots.length > 0) {
      const bot = bots.find(b => b.id === botId);
      console.log('Edit bot: Found bot:', bot);
      if (bot) {
        setFormData({
          name: bot.name,
          exchange: bot.exchange as 'bybit' | 'okx',
          tradingType: bot.tradingType as 'spot' | 'futures',
          symbol: bot.symbol,
          timeframe: bot.timeframe || '1h',
          leverage: bot.leverage || 5,
          riskLevel: bot.riskLevel as 'low' | 'medium' | 'high',
          tradeAmount: bot.tradeAmount || 100,
          stopLoss: bot.stopLoss || 2.0,
          takeProfit: bot.takeProfit || 4.0
        });
        
        if (bot.strategy) {
          setStrategy(bot.strategy as TradingStrategy);
        }
        
        // Load advanced config from strategyConfig
        if (bot.strategyConfig) {
          setAdvancedConfig(prev => ({
            ...prev,
            ...bot.strategyConfig,
            atr_period: bot.strategyConfig.atr_period ?? prev.atr_period ?? 14,
            atr_tp_multiplier: bot.strategyConfig.atr_tp_multiplier ?? prev.atr_tp_multiplier ?? 3,
            ema_fast_period: bot.strategyConfig.ema_fast_period ?? prev.ema_fast_period,
            rsi_period: bot.strategyConfig.rsi_period ?? prev.rsi_period ?? 14,
            rsi_overbought: bot.strategyConfig.rsi_overbought ?? prev.rsi_overbought ?? 70,
            rsi_oversold: bot.strategyConfig.rsi_oversold ?? prev.rsi_oversold ?? 30,
            sl_atr_mult: bot.strategyConfig.sl_atr_mult ?? prev.sl_atr_mult
          }));
        }
        
        // Load sound notifications setting
        setSoundNotificationsEnabled(bot.soundNotificationsEnabled || false);
        
        console.log('Edit bot: Form data set:', formData);
      } else {
        console.log('Edit bot: Bot not found with ID:', botId);
      }
    }
  }, [botId, bots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botId) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const botData = {
        name: formData.name,
        exchange: formData.exchange,
        tradingType: formData.tradingType,
        symbol: formData.symbol,
        timeframe: formData.timeframe,
        leverage: formData.leverage,
        riskLevel: formData.riskLevel,
        tradeAmount: formData.tradeAmount,
        stopLoss: formData.stopLoss,
        takeProfit: formData.takeProfit,
        strategy: strategy,
        strategyConfig: advancedConfig,
        soundNotificationsEnabled: soundNotificationsEnabled
      };
      
      console.log('Edit bot: Updating bot data:', botData);
      console.log('Edit bot: Bot ID:', botId);
      
      await updateBot(botId, botData);
      
      console.log('Edit bot: Update successful, navigating...');
      navigate('/bots', { state: { message: `Bot "${formData.name}" updated successfully!` } });
    } catch (error: any) {
      console.error('Edit bot: Update failed:', error);
      setError(error.message || 'Failed to update bot');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  const applyStrategyPreset = (preset: StrategyPreset) => {
    setStrategy({ ...preset.strategy });
    setAdvancedConfig(prev => ({
      ...prev,
      ...preset.advanced,
      allowed_hours_utc: [...preset.advanced.allowed_hours_utc]
    }));
    setFormData(prev => ({
      ...prev,
      tradeAmount: preset.recommendedTradeAmount ?? prev.tradeAmount,
      stopLoss: preset.recommendedStopLoss ?? prev.stopLoss,
      takeProfit: preset.recommendedTakeProfit ?? prev.takeProfit,
      riskLevel: preset.recommendedRiskLevel ?? prev.riskLevel
    }));
    console.log('Applied strategy preset:', preset.key);
  };

  if (!botId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Edit Bot" />
        <div className="pt-16 pb-6 px-4">
          <div className="max-w-2xl mx-auto">
            <Card>
              <div className="text-center py-8">
                <p className="text-gray-500">Bot not found</p>
                <Button variant="primary" onClick={() => navigate('/bots')} className="mt-4">
                  Back to Bots
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Edit Bot" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-6">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/bots')}
              className="mr-4"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Bots
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Trading Bot</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <Card>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bot Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter bot name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Exchange
                    </label>
                    <select
                      value={formData.exchange}
                      onChange={(e) => handleInputChange('exchange', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      value={formData.tradingType}
                      onChange={(e) => handleInputChange('tradingType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="spot">Spot Trading</option>
                      <option value="futures">Futures Trading</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trading Pair
                    </label>
                    <select
                      value={formData.symbol}
                      onChange={(e) => handleInputChange('symbol', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {popularSymbols.map(symbol => (
                        <option key={symbol} value={symbol}>{symbol}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Frame
                    </label>
                    <select
                      value={formData.timeframe}
                      onChange={(e) => handleInputChange('timeframe', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="1m">1 Minute</option>
                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="2h">2 Hours</option>
                      <option value="3h">3 Hours</option>
                      <option value="4h">4 Hours</option>
                      <option value="1d">1 Day</option>
                      <option value="1w">1 Week</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Chart interval for technical analysis
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Leverage
                    </label>
                    <select
                      value={formData.leverage}
                      onChange={(e) => handleInputChange('leverage', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                      <option value={5}>5x</option>
                      <option value={10}>10x</option>
                      <option value={20}>20x</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Level
                    </label>
                    <select
                      value={formData.riskLevel}
                      onChange={(e) => handleInputChange('riskLevel', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Trade Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={formData.tradeAmount}
                      onChange={(e) => handleInputChange('tradeAmount', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="10"
                      max="10000"
                      step="10"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Base trade amount in USD (will be multiplied by leverage and risk level)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stop Loss (%)
                    </label>
                    <input
                      type="number"
                      value={formData.stopLoss}
                      onChange={(e) => handleInputChange('stopLoss', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0.5"
                      max="10"
                      step="0.5"
                      required
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
                      value={formData.takeProfit}
                      onChange={(e) => handleInputChange('takeProfit', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      max="20"
                      step="0.5"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Target profit percentage before closing position
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Sound Notifications (Real Trades)
                      </label>
                      <div className="flex items-center">
                        <span className={`text-xs mr-2 ${soundNotificationsEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                          {soundNotificationsEnabled ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={soundNotificationsEnabled}
                            onChange={(e) => setSoundNotificationsEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Play a sound notification when this bot executes a real trade (paper trading excluded)
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Cooldown (Bars)
                      </label>
                      <div className="flex items-center">
                        <span className={`text-xs mr-2 ${advancedConfig.cooldown_bars > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {advancedConfig.cooldown_bars > 0 ? 'ON' : 'OFF'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.cooldown_bars > 0}
                            onChange={(e) => {
                              setAdvancedConfig(prev => ({
                                ...prev,
                                cooldown_bars: e.target.checked ? (prev.cooldown_bars || 8) : 0
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                    {advancedConfig.cooldown_bars > 0 ? (
                      <>
                        <input
                          type="number"
                          value={advancedConfig.cooldown_bars}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, cooldown_bars: parseInt(e.target.value) || 8 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="1"
                          max="100"
                          step="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Number of bars to wait between trades (prevents overtrading)
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic mt-1">
                        Cooldown disabled - bot can trade on every bar
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        ADX Min (HTF): {advancedConfig.adx_min_htf}
                      </label>
                      <div className="flex items-center">
                        <span className={`text-xs mr-2 ${advancedConfig.disable_htf_adx_check ? 'text-green-600' : 'text-gray-400'}`}>
                          {advancedConfig.disable_htf_adx_check ? 'DISABLED' : 'ENABLED'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.disable_htf_adx_check || false}
                            onChange={(e) => {
                              setAdvancedConfig(prev => ({
                                ...prev,
                                disable_htf_adx_check: e.target.checked
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>
                    </div>
                    {!advancedConfig.disable_htf_adx_check && (
                      <>
                        <input
                          type="range"
                          value={advancedConfig.adx_min_htf}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, adx_min_htf: parseFloat(e.target.value) }))}
                          className="w-full"
                          min="15"
                          max="35"
                          step="1"
                        />
                        <p className="text-xs text-gray-500">Minimum ADX for trend confirmation (15-35)</p>
                      </>
                    )}
                    {advancedConfig.disable_htf_adx_check && (
                      <p className="text-xs text-red-600 italic mt-1">
                        HTF ADX check disabled - bot will trade regardless of HTF ADX value
                      </p>
                    )}
                  </div>

                  <div>
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
                          // Convert UTC hour to EST for display (EST = UTC - 5)
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

                {/* Indicator Settings */}
                <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                  <h3 className="text-md font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                    <i className="ri-sliders-line"></i>
                    Indicator Settings
                  </h3>
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
                </div>

                {/* Strategy Settings */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Settings</h3>
                  <div className="mb-6">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-purple-900 flex items-center gap-2 text-sm md:text-base">
                          <i className="ri-brain-line"></i>
                          AI Strategy Presets
                        </h4>
                        <span className="hidden md:block text-xs text-purple-700">
                          Rapidly align this bot with proven AI templates
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {STRATEGY_PRESETS.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => applyStrategyPreset(preset)}
                            className="px-3 py-2 rounded-lg border border-purple-300 bg-white text-purple-700 hover:bg-purple-100 text-sm font-medium flex items-center gap-2 transition-colors"
                          >
                            <i className="ri-flashlight-line"></i>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-purple-700 mt-3">
                        Applying a preset updates strategy parameters, risk controls, and recommended trade sizing.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        RSI Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.rsiThreshold}
                        onChange={(e) => handleStrategyChange('rsiThreshold', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="50"
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
                        onChange={(e) => handleStrategyChange('adxThreshold', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="15"
                        max="50"
                        step="5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bollinger Band Width Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.bbWidthThreshold}
                        onChange={(e) => handleStrategyChange('bbWidthThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.01"
                        max="0.1"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        EMA Slope
                      </label>
                      <input
                        type="number"
                        value={strategy.emaSlope}
                        onChange={(e) => handleStrategyChange('emaSlope', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.1"
                        max="2.0"
                        step="0.1"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VWAP Distance
                      </label>
                      <input
                        type="number"
                        value={strategy.vwapDistance}
                        onChange={(e) => handleStrategyChange('vwapDistance', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Momentum Threshold
                      </label>
                      <input
                        type="number"
                        value={strategy.momentumThreshold}
                        onChange={(e) => handleStrategyChange('momentumThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min Samples for ML
                      </label>
                      <input
                        type="number"
                        value={strategy.minSamplesForML}
                        onChange={(e) => handleStrategyChange('minSamplesForML', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="50"
                        max="1000"
                        step="50"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={strategy.useMLPrediction}
                        onChange={(e) => handleStrategyChange('useMLPrediction', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Use Machine Learning Prediction
                      </span>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex space-x-4 pt-6 border-t">
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Updating Bot...
                      </>
                    ) : (
                      <>
                        <i className="ri-save-line mr-2"></i>
                        Update Bot
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/bots')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </form>

          {/* AI Auto-Optimization Component */}
          {botId && (
            <div className="mt-6">
              {(() => {
                const currentBot = bots.find(b => b.id === botId);
                if (currentBot) {
                  return <AutoOptimizer bot={currentBot as TradingBot} />;
                }
                // Show loading state while bots are being fetched
                return (
                  <Card title="AI Auto-Optimization" className="mt-4">
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Loading bot information...
                      </p>
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
