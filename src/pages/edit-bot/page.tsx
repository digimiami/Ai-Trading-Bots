import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import { type TradingStrategy, type TradingBot, type AdvancedStrategyConfig, DEFAULT_ADVANCED_STRATEGY_CONFIG, DEFAULT_RISK_ENGINE } from '../../types/trading';
import { useBots } from '../../hooks/useBots';
import AutoOptimizer from '../../components/bot/AutoOptimizer';
import { STRATEGY_PRESETS, type StrategyPreset } from '../../constants/strategyPresets';
import { HTF_TIMEFRAME_OPTIONS, HTF_TREND_INDICATOR_OPTIONS } from '../../constants/strategyOptions';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { getOptimizedSettingsForIndicator } from '../../utils/htfIndicatorSettings';
import { useEmailNotifications } from '../../hooks/useEmailNotifications';
import { supabase } from '../../lib/supabase';

export default function EditBotPage() {
  const navigate = useNavigate();
  const { botId } = useParams<{ botId: string }>();
  const { bots, updateBot, getBotById } = useBots();
  const { settings: userSettings } = useEmailNotifications();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx' | 'bitunix' | 'mexc' | 'btcc',
    tradingType: 'futures' as 'spot' | 'futures',
    symbol: 'BTCUSDT',
    timeframe: '15m' as '1m' | '3m' | '5m' | '15m' | '30m' | '45m' | '1h' | '2h' | '3h' | '4h' | '5h' | '6h' | '7h' | '8h' | '9h' | '10h' | '12h' | '1d' | '1w' | '1M',
    leverage: 5,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    tradeAmount: 70,
    stopLoss: 1.0,
    takeProfit: 1.0
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

  const normalizeRiskEngine = (engine: any) => {
    const resolved = {
      ...DEFAULT_RISK_ENGINE,
      ...(engine || {})
    };
    const toNumber = (value: any, fallback: number) => {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    };
    const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const volatilityLow = Math.max(0, toNumber(resolved.volatility_low, DEFAULT_RISK_ENGINE.volatility_low));
    const volatilityHigh = Math.max(volatilityLow + 0.1, toNumber(resolved.volatility_high, DEFAULT_RISK_ENGINE.volatility_high));
    const drawdownModerate = Math.max(0, toNumber(resolved.drawdown_moderate, DEFAULT_RISK_ENGINE.drawdown_moderate));
    const drawdownSevere = Math.max(drawdownModerate + 1, toNumber(resolved.drawdown_severe, DEFAULT_RISK_ENGINE.drawdown_severe));
    const minSizeMultiplier = clampValue(toNumber(resolved.min_size_multiplier, DEFAULT_RISK_ENGINE.min_size_multiplier), 0.1, 3);
    const maxSizeMultiplier = clampValue(toNumber(resolved.max_size_multiplier, DEFAULT_RISK_ENGINE.max_size_multiplier), minSizeMultiplier, 3);
    const minSignalWeight = clampValue(toNumber(resolved.min_signal_weight, DEFAULT_RISK_ENGINE.min_signal_weight), 0.1, 2);
    const maxSignalWeight = clampValue(toNumber(resolved.max_signal_weight, DEFAULT_RISK_ENGINE.max_signal_weight), minSignalWeight, 2);

    return {
      ...resolved,
      volatility_low: volatilityLow,
      volatility_high: volatilityHigh,
      high_volatility_multiplier: clampValue(toNumber(resolved.high_volatility_multiplier, DEFAULT_RISK_ENGINE.high_volatility_multiplier), 0.1, 3),
      low_volatility_multiplier: clampValue(toNumber(resolved.low_volatility_multiplier, DEFAULT_RISK_ENGINE.low_volatility_multiplier), 0.1, 3),
      max_spread_bps: Math.max(1, toNumber(resolved.max_spread_bps, DEFAULT_RISK_ENGINE.max_spread_bps)),
      spread_penalty_multiplier: clampValue(toNumber(resolved.spread_penalty_multiplier, DEFAULT_RISK_ENGINE.spread_penalty_multiplier), 0.1, 3),
      low_liquidity_multiplier: clampValue(toNumber(resolved.low_liquidity_multiplier, DEFAULT_RISK_ENGINE.low_liquidity_multiplier), 0.1, 3),
      medium_liquidity_multiplier: clampValue(toNumber(resolved.medium_liquidity_multiplier, DEFAULT_RISK_ENGINE.medium_liquidity_multiplier), 0.1, 3),
      drawdown_moderate: drawdownModerate,
      drawdown_severe: drawdownSevere,
      moderate_drawdown_multiplier: clampValue(toNumber(resolved.moderate_drawdown_multiplier, DEFAULT_RISK_ENGINE.moderate_drawdown_multiplier), 0.1, 3),
      severe_drawdown_multiplier: clampValue(toNumber(resolved.severe_drawdown_multiplier, DEFAULT_RISK_ENGINE.severe_drawdown_multiplier), 0.1, 3),
      loss_streak_threshold: Math.max(1, Math.round(toNumber(resolved.loss_streak_threshold, DEFAULT_RISK_ENGINE.loss_streak_threshold))),
      loss_streak_step: clampValue(toNumber(resolved.loss_streak_step, DEFAULT_RISK_ENGINE.loss_streak_step), 0.01, 1),
      min_size_multiplier: minSizeMultiplier,
      max_size_multiplier: maxSizeMultiplier,
      max_slippage_bps: Math.max(1, toNumber(resolved.max_slippage_bps, DEFAULT_RISK_ENGINE.max_slippage_bps)),
      min_execution_size_multiplier: clampValue(toNumber(resolved.min_execution_size_multiplier, DEFAULT_RISK_ENGINE.min_execution_size_multiplier), 0.1, 1),
      limit_spread_bps: Math.max(1, toNumber(resolved.limit_spread_bps, DEFAULT_RISK_ENGINE.limit_spread_bps)),
      signal_learning_rate: clampValue(toNumber(resolved.signal_learning_rate, DEFAULT_RISK_ENGINE.signal_learning_rate), 0.01, 1),
      min_signal_weight: minSignalWeight,
      max_signal_weight: maxSignalWeight
    };
  };

  const [advancedConfig, setAdvancedConfig] = useState<AdvancedStrategyConfig>({ ...DEFAULT_ADVANCED_STRATEGY_CONFIG });

  const riskEngine = normalizeRiskEngine(advancedConfig.risk_engine);

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(false);
  const [sectionEnabled, setSectionEnabled] = useState({
    directionalBias: true,
    indicatorSettings: true,
    riskManagement: true,
    adaptiveRiskEngine: true,
    executionIntelligence: true,
    signalLearning: true,
    exitStrategy: true,
  });

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  const applyBotToForm = (bot: TradingBot) => {
    setFormData({
      name: bot.name,
      exchange: bot.exchange as 'bybit' | 'okx' | 'bitunix' | 'mexc' | 'btcc',
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
    
    const strategyConfig = (bot.strategyConfig || (bot as any).strategy_config) ?? null;
    let normalizedStrategyConfig: any = strategyConfig;
    if (typeof strategyConfig === 'string') {
      try {
        normalizedStrategyConfig = JSON.parse(strategyConfig);
      } catch (parseError) {
        console.warn('Failed to parse strategy_config for edit form:', parseError);
        normalizedStrategyConfig = {};
      }
    }

    if (normalizedStrategyConfig) {
    const mergedRiskEngine = normalizeRiskEngine(normalizedStrategyConfig.risk_engine);
      setAdvancedConfig(prev => ({
        ...prev,
        ...normalizedStrategyConfig,
      risk_engine: mergedRiskEngine,
        atr_period: normalizedStrategyConfig.atr_period ?? prev.atr_period ?? 14,
        atr_tp_multiplier: normalizedStrategyConfig.atr_tp_multiplier ?? prev.atr_tp_multiplier ?? 3,
        ema_fast_period: normalizedStrategyConfig.ema_fast_period ?? prev.ema_fast_period,
        rsi_period: normalizedStrategyConfig.rsi_period ?? prev.rsi_period ?? 14,
        rsi_overbought: normalizedStrategyConfig.rsi_overbought ?? prev.rsi_overbought ?? 70,
        rsi_oversold: normalizedStrategyConfig.rsi_oversold ?? prev.rsi_oversold ?? 30,
        sl_atr_mult: normalizedStrategyConfig.sl_atr_mult ?? prev.sl_atr_mult
      }));
    }

    // Apply risk management settings from user_settings if available
    // This ensures risk management is always up-to-date when editing
    if (userSettings?.risk_settings) {
      const riskSettings = userSettings.risk_settings;
      setAdvancedConfig(prev => ({
        ...prev,
        // Map user_settings.risk_settings to strategy_config fields
        daily_loss_limit_pct: prev.daily_loss_limit_pct ?? (riskSettings.maxDailyLoss ? riskSettings.maxDailyLoss / 100 : 3.0),
        max_position_size: prev.max_position_size ?? riskSettings.maxPositionSize ?? 1000,
        stop_loss_percentage: prev.stop_loss_percentage ?? riskSettings.stopLossPercentage ?? 5.0,
        take_profit_percentage: prev.take_profit_percentage ?? riskSettings.takeProfitPercentage ?? 10.0,
        max_concurrent: prev.max_concurrent ?? riskSettings.maxOpenPositions ?? 5,
        risk_per_trade_pct: prev.risk_per_trade_pct ?? (riskSettings.riskPerTrade ?? 1),
        emergency_stop_loss: prev.emergency_stop_loss ?? riskSettings.emergencyStopLoss ?? 20.0
      }));
      console.log('✅ Applied risk management settings from user_settings to edit form');
    }
    
    // Load sound notifications setting
    setSoundNotificationsEnabled(bot.soundNotificationsEnabled || false);
    
    console.log('Edit bot: Form data set:', formData);
  };

  // Track if bot has been loaded to prevent overwriting user edits
  const [botLoaded, setBotLoaded] = useState(false);

  // Load bot data when component mounts (only once)
  useEffect(() => {
    if (!botId || botLoaded) {
      return;
    }

    let isActive = true;

    const loadBot = async () => {
      // Try to get bot from the bots list first (only if bots are available)
      if (bots.length > 0) {
        const botFromList = bots.find(b => b.id === botId);
        console.log('Edit bot: Found bot:', botFromList);

        if (botFromList) {
          applyBotToForm(botFromList);
          setBotLoaded(true);
          const hasStrategyConfig = !!(botFromList.strategyConfig || (botFromList as any).strategy_config);
          if (hasStrategyConfig) {
            return;
          }
        }
      }

      // If not in list or missing strategy config, fetch from API
      try {
        const fetched = await getBotById(botId);
        if (!isActive) return;
        if (fetched) {
          console.log('Edit bot: Fetched bot from API:', fetched);
          applyBotToForm(fetched);
          setBotLoaded(true);
        } else {
          console.log('Edit bot: Bot not found with ID:', botId);
        }
      } catch (error) {
        console.error('Edit bot: Failed to fetch bot by ID:', error);
      }
    };

    void loadBot();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]); // Only reload when botId changes, not when bots list updates

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botId) return;
    
    setIsUpdating(true);
    setError(null);
    
    try {
      const finalizedStrategyConfig: AdvancedStrategyConfig = {
        ...advancedConfig,
        risk_engine: {
          ...normalizeRiskEngine(advancedConfig.risk_engine)
        }
      };

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
        strategyConfig: finalizedStrategyConfig,
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

                {/* Risk Management Section - Prominent at the top */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <i className="ri-shield-line text-blue-600"></i>
                    Risk Management
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Leverage
                      </label>
                      <select
                        value={formData.leverage}
                        onChange={(e) => handleInputChange('leverage', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                        <option value={5}>5x</option>
                        <option value={10}>10x</option>
                        <option value={20}>20x</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Trading leverage multiplier
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        value={formData.stopLoss}
                        onChange={(e) => handleInputChange('stopLoss', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="0.5"
                        max="10"
                        step="0.5"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Maximum loss before closing
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Take Profit (%)
                      </label>
                      <input
                        type="number"
                        value={formData.takeProfit}
                        onChange={(e) => handleInputChange('takeProfit', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="1"
                        max="20"
                        step="0.5"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Target profit before closing
                      </p>
                    </div>
                  </div>
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
                      <option value="mexc">MEXC</option>
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
                      <option value="3m">3 Minutes</option>
                      <option value="5m">5 Minutes</option>
                      <option value="15m">15 Minutes</option>
                      <option value="30m">30 Minutes</option>
                      <option value="45m">45 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="2h">2 Hours</option>
                      <option value="3h">3 Hours</option>
                      <option value="4h">4 Hours</option>
                      <option value="5h">5 Hours</option>
                      <option value="6h">6 Hours</option>
                      <option value="7h">7 Hours</option>
                      <option value="8h">8 Hours</option>
                      <option value="9h">9 Hours</option>
                      <option value="10h">10 Hours</option>
                      <option value="12h">12 Hours</option>
                      <option value="1d">1 Day</option>
                      <option value="1w">1 Week</option>
                      <option value="1M">1 Month</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Chart interval for technical analysis
                    </p>
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
                </div>

                {/* Always Trade Mode */}
                <div className="border-l-4 border-red-500 pl-4 mt-6 bg-red-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-md font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        🚀 Always Trade Mode
                        <HelpTooltip text="When enabled, the bot will trade on EVERY execution cycle regardless of market conditions (RSI, ADX, EMA, etc.). Trade direction is determined by RSI: RSI > 50 = SELL, RSI ≤ 50 = BUY. ⚠️ WARNING: This will generate many trades - use with caution and proper risk management!" />
                      </h3>
                      <p className="text-sm text-gray-600">
                        Bypass all strategy conditions and trade on every cycle. Trade direction based on RSI.
                      </p>
                      {(advancedConfig as any).always_trade && (
                        <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-xs text-yellow-800">
                          <i className="ri-alert-line mr-1"></i>
                          <strong>Warning:</strong> Always Trade mode is enabled. The bot will trade frequently. Ensure you have proper risk limits set (max trades per day, max concurrent positions, etc.).
                        </div>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={(advancedConfig as any).always_trade || false}
                        onChange={(e) => {
                          setAdvancedConfig(prev => ({
                            ...prev,
                            always_trade: e.target.checked,
                            type: e.target.checked ? 'always_trade' : undefined
                          } as any));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>

                {/* Directional Bias */}
                <div className="border-l-4 border-purple-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">🎯 Directional Bias</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.directionalBias} onChange={() => setSectionEnabled(s => ({ ...s, directionalBias: !s.directionalBias }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.directionalBias ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.directionalBias && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Bias Mode
                        <HelpTooltip text="Directional bias for trading. Auto: Follow higher timeframe trend. Long Only: Only buy/long positions. Short Only: Only sell/short positions. Both: Trade in both directions." />
                      </label>
                      <select value={advancedConfig.bias_mode} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, bias_mode: e.target.value as any }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="auto">Auto (Follow HTF Trend)</option>
                        <option value="long-only">Long Only</option>
                        <option value="short-only">Short Only</option>
                        <option value="both">Both Directions</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        HTF Timeframe
                        <HelpTooltip text="Higher Timeframe for trend analysis." />
                      </label>
                      <select value={advancedConfig.htf_timeframe} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, htf_timeframe: e.target.value as typeof prev.htf_timeframe }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        {HTF_TIMEFRAME_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        HTF Trend Indicator
                        <HelpTooltip text="Technical indicator used to determine trend direction on the higher timeframe." />
                      </label>
                      <select value={advancedConfig.htf_trend_indicator} onChange={(e) => {
                        const newIndicator = e.target.value as typeof advancedConfig.htf_trend_indicator;
                        const optimizedSettings = getOptimizedSettingsForIndicator(newIndicator, advancedConfig);
                        setAdvancedConfig(prev => ({ ...prev, htf_trend_indicator: newIndicator, ...optimizedSettings }));
                      }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        {HTF_TREND_INDICATOR_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        ADX Min (HTF): {advancedConfig.adx_min_htf}
                        <HelpTooltip text="Minimum ADX on higher timeframe to confirm trend." />
                      </label>
                      <input type="number" value={advancedConfig.adx_min_htf ?? 23} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, adx_min_htf: parseInt(e.target.value) || 23 }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" min={15} max={35} />
                    </div>
                  </div>
                  )}
                </div>

                {/* Risk Management */}
                <div className="border-l-4 border-red-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">🛡️ Risk Management</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.riskManagement} onChange={() => setSectionEnabled(s => ({ ...s, riskManagement: !s.riskManagement }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.riskManagement ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.riskManagement && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Risk Per Trade: {advancedConfig.risk_per_trade_pct}%
                        <HelpTooltip text="Percentage of account balance to risk on each trade. Lower values (0.25-0.5%) = conservative, safer. Higher values (1-2%) = aggressive, higher risk/reward. This controls position sizing based on stop loss distance." />
                      </label>
                      <input
                        type="range"
                        value={advancedConfig.risk_per_trade_pct}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, risk_per_trade_pct: parseFloat(e.target.value) }))}
                        className="w-full"
                        min="0.25"
                        max="10.0"
                        step="0.25"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Daily Loss Limit: {advancedConfig.daily_loss_limit_pct}%
                        <HelpTooltip text="Maximum percentage loss allowed per day before bot automatically pauses. Lower values (1-2%) = strict protection, higher values (5-10%) = more lenient. Bot will stop trading for the day if this limit is reached. Resets at midnight UTC." />
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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Trades/Day: {advancedConfig.max_trades_per_day}
                        <HelpTooltip text="Maximum number of trades the bot can execute per day. Lower values (3-6) = conservative, prevents overtrading. Higher values (10-50) = more active trading. Helps control trading frequency and reduce risk from excessive trading. Resets at midnight UTC." />
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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Weekly Loss Limit: {advancedConfig.weekly_loss_limit_pct}%
                        <HelpTooltip text="Maximum percentage loss allowed per week before bot automatically pauses. Lower values (2-4%) = strict protection, higher values (8-15%) = more lenient. Bot will stop trading for the week if this limit is reached. Resets weekly on Monday UTC." />
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
                      <p className="text-xs text-gray-500 mt-1">Auto-pause if weekly loss exceeds</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Concurrent Positions: {advancedConfig.max_concurrent}
                        <HelpTooltip text="Maximum number of open positions the bot can have at the same time. Lower values (1-2) = conservative, less capital at risk. Higher values (3-5) = more positions, higher exposure. Prevents over-leveraging and helps manage risk across multiple trades." />
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
                      <p className="text-xs text-gray-500 mt-1">Max open positions simultaneously</p>
                    </div>
                  </div>
                  )}
                </div>

                {/* Adaptive Risk Engine */}
                <div className="border-l-4 border-blue-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">🧠 Adaptive Risk Engine</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.adaptiveRiskEngine} onChange={() => setSectionEnabled(s => ({ ...s, adaptiveRiskEngine: !s.adaptiveRiskEngine }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.adaptiveRiskEngine ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.adaptiveRiskEngine && (
                  <>
                  <p className="text-sm text-gray-600 mb-4">
                    Dynamic sizing based on volatility, liquidity, drawdown, and loss streaks.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Volatility Low (ATR%): {riskEngine.volatility_low}
                        <HelpTooltip text="ATR percentage below which volatility is considered low and sizing can slightly increase." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.volatility_low}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), volatility_low: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Volatility High (ATR%): {riskEngine.volatility_high}
                        <HelpTooltip text="ATR percentage above which volatility is high and sizing is reduced." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.volatility_high}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), volatility_high: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        High Volatility Multiplier: {riskEngine.high_volatility_multiplier}
                        <HelpTooltip text="Sizing multiplier applied when volatility is high." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.high_volatility_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), high_volatility_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Low Volatility Multiplier: {riskEngine.low_volatility_multiplier}
                        <HelpTooltip text="Sizing multiplier applied when volatility is low." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.low_volatility_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), low_volatility_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Spread (bps): {riskEngine.max_spread_bps}
                        <HelpTooltip text="Spread threshold used to penalize sizing when liquidity is poor." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.max_spread_bps}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), max_spread_bps: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Spread Penalty Multiplier: {riskEngine.spread_penalty_multiplier}
                        <HelpTooltip text="Sizing multiplier applied when spread exceeds the max spread threshold." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.spread_penalty_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), spread_penalty_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Low Liquidity Multiplier: {riskEngine.low_liquidity_multiplier}
                        <HelpTooltip text="Sizing multiplier when orderbook depth is thin." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.low_liquidity_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), low_liquidity_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Medium Liquidity Multiplier: {riskEngine.medium_liquidity_multiplier}
                        <HelpTooltip text="Sizing multiplier when liquidity is moderate." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.medium_liquidity_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), medium_liquidity_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Drawdown Moderate (%): {riskEngine.drawdown_moderate}
                        <HelpTooltip text="Drawdown level where sizing starts to reduce." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.drawdown_moderate}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), drawdown_moderate: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Drawdown Severe (%): {riskEngine.drawdown_severe}
                        <HelpTooltip text="Drawdown level where sizing is reduced aggressively." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.drawdown_severe}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), drawdown_severe: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Moderate Drawdown Multiplier: {riskEngine.moderate_drawdown_multiplier}
                        <HelpTooltip text="Sizing multiplier applied at moderate drawdown." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.moderate_drawdown_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), moderate_drawdown_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Severe Drawdown Multiplier: {riskEngine.severe_drawdown_multiplier}
                        <HelpTooltip text="Sizing multiplier applied at severe drawdown." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.severe_drawdown_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), severe_drawdown_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.2"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Loss Streak Threshold: {riskEngine.loss_streak_threshold}
                        <HelpTooltip text="Number of consecutive losses before de-risking starts." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.loss_streak_threshold}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), loss_streak_threshold: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Loss Streak Step: {riskEngine.loss_streak_step}
                        <HelpTooltip text="Multiplier step reduction applied per loss beyond the threshold." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.loss_streak_step}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), loss_streak_step: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.01"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Min Size Multiplier: {riskEngine.min_size_multiplier}
                        <HelpTooltip text="Lower bound for adaptive sizing." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.min_size_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), min_size_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.1"
                        max="2"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Size Multiplier: {riskEngine.max_size_multiplier}
                        <HelpTooltip text="Upper bound for adaptive sizing." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.max_size_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), max_size_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.5"
                        max="3"
                        step="0.05"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Execution Intelligence */}
                <div className="border-l-4 border-indigo-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">⚡ Execution Intelligence</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.executionIntelligence} onChange={() => setSectionEnabled(s => ({ ...s, executionIntelligence: !s.executionIntelligence }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.executionIntelligence ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.executionIntelligence && (
                  <>
                  <p className="text-sm text-gray-600 mb-4">
                    Control slippage-driven sizing and limit/market selection.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Slippage (bps): {riskEngine.max_slippage_bps}
                        <HelpTooltip text="Slippage threshold used to trim size when orderbook impact is high." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.max_slippage_bps}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), max_slippage_bps: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Min Execution Size Multiplier: {riskEngine.min_execution_size_multiplier}
                        <HelpTooltip text="Minimum size multiplier when slippage is high." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.min_execution_size_multiplier}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), min_execution_size_multiplier: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.1"
                        max="1"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Limit Spread (bps): {riskEngine.limit_spread_bps}
                        <HelpTooltip text="When spread is below this value and liquidity is good, limit orders are used." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.limit_spread_bps}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), limit_spread_bps: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="1"
                        step="1"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Signal Learning */}
                <div className="border-l-4 border-teal-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">🧬 Signal Learning</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.signalLearning} onChange={() => setSectionEnabled(s => ({ ...s, signalLearning: !s.signalLearning }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.signalLearning ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.signalLearning && (
                  <>
                  <p className="text-sm text-gray-600 mb-4">
                    Auto-tune signal weights based on recent outcomes.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Learning Rate: {riskEngine.signal_learning_rate}
                        <HelpTooltip text="How quickly signal weights adapt after each closed trade." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.signal_learning_rate}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), signal_learning_rate: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.01"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Min Signal Weight: {riskEngine.min_signal_weight}
                        <HelpTooltip text="Lower bound for signal weights when learning." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.min_signal_weight}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), min_signal_weight: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.1"
                        max="1.5"
                        step="0.05"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        Max Signal Weight: {riskEngine.max_signal_weight}
                        <HelpTooltip text="Upper bound for signal weights when learning." />
                      </label>
                      <input
                        type="number"
                        value={riskEngine.max_signal_weight}
                        onChange={(e) => setAdvancedConfig(prev => ({
                          ...prev,
                          risk_engine: { ...DEFAULT_RISK_ENGINE, ...(prev.risk_engine || {}), max_signal_weight: parseFloat(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0.5"
                        max="2"
                        step="0.05"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                cooldown_bars: e.target.checked ? (prev.cooldown_bars || 5) : 0
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
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, cooldown_bars: parseInt(e.target.value) || 5 }))}
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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-indigo-900 mb-0 flex items-center gap-2">
                      <i className="ri-sliders-line"></i>
                      Indicator Settings
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.indicatorSettings} onChange={() => setSectionEnabled(s => ({ ...s, indicatorSettings: !s.indicatorSettings }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.indicatorSettings ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.indicatorSettings && (
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
                  )}
                </div>

                {/* Exit Strategy */}
                <div className="border-l-4 border-green-500 pl-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-gray-800 mb-0">🎯 Exit Strategy</h3>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={sectionEnabled.exitStrategy} onChange={() => setSectionEnabled(s => ({ ...s, exitStrategy: !s.exitStrategy }))} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      <span className="ml-2 text-sm text-gray-600">{sectionEnabled.exitStrategy ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                  {sectionEnabled.exitStrategy && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        TP1 (R): {advancedConfig.tp1_r}
                        <HelpTooltip text="First take profit target in Risk:Reward ratio (R)." />
                      </label>
                      <input type="range" value={advancedConfig.tp1_r} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp1_r: parseFloat(e.target.value) }))} className="w-full" min="0.5" max="3.0" step="0.25" />
                      <p className="text-xs text-gray-500">First take profit (R = Risk units)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        TP2 (R): {advancedConfig.tp2_r}
                        <HelpTooltip text="Second take profit target for remaining position after TP1." />
                      </label>
                      <input type="range" value={advancedConfig.tp2_r} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp2_r: parseFloat(e.target.value) }))} className="w-full" min="1.0" max="5.0" step="0.25" />
                      <p className="text-xs text-gray-500">Second take profit</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                        TP1 Size: {(advancedConfig.tp1_size * 100).toFixed(0)}%
                        <HelpTooltip text="Percentage of position to close when TP1 is reached." />
                      </label>
                      <input type="range" value={advancedConfig.tp1_size} onChange={(e) => setAdvancedConfig(prev => ({ ...prev, tp1_size: parseFloat(e.target.value) }))} className="w-full" min="0.25" max="0.75" step="0.05" />
                      <p className="text-xs text-gray-500">% to close at TP1</p>
                    </div>
                  </div>
                  )}
                </div>

                {/* Advanced Exit & Trailing Features */}
                <div className="border-l-4 border-purple-500 pl-4 mt-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">🚀 Advanced Exit & Trailing Features</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Advanced profit protection and exit strategies to maximize gains and minimize losses.
                  </p>
                  
                  <div className="space-y-6">
                    {/* Dynamic Upward Trailing */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-line-chart-line text-purple-600"></i>
                            Dynamic Upward Trailing
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Automatically move up the exit point based on the user's historical highest equity
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_dynamic_trailing || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_dynamic_trailing: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_dynamic_trailing && (
                        <div className="mt-3 p-3 bg-white rounded border border-purple-200">
                          <p className="text-xs text-purple-700">
                            <i className="ri-information-line mr-1"></i>
                            The bot will track your account's highest equity and automatically adjust exit points upward as equity reaches new highs.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Trailing Take-Profit */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-money-dollar-circle-line text-green-600"></i>
                            Trailing Take-Profit
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Lock in profits automatically as equity reaches new highs — no hassle, no delays
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_trailing_take_profit || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_trailing_take_profit: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_trailing_take_profit && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Trailing TP Distance (ATR Multiplier): {advancedConfig.trailing_take_profit_atr || 1.0}
                            </label>
                            <input
                              type="range"
                              value={advancedConfig.trailing_take_profit_atr || 1.0}
                              onChange={(e) => setAdvancedConfig(prev => ({ ...prev, trailing_take_profit_atr: parseFloat(e.target.value) } as any))}
                              className="w-full"
                              min="0.5"
                              max="3.0"
                              step="0.1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Distance from highest equity to trailing stop (in ATR multiples)
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded border border-green-200">
                            <p className="text-xs text-green-700">
                              <i className="ri-information-line mr-1"></i>
                              As your equity reaches new highs, the trailing stop will automatically move up to lock in profits.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Take Profit Sooner - close when profit reaches X% (long or short) */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-money-dollar-circle-line text-green-600"></i>
                            Take Profit Sooner
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Close position when unrealized profit reaches this % (locks in profit before retrace)
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Profit target (%): {advancedConfig.early_take_profit_pct ?? 0}% (0 = off)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            value={advancedConfig.early_take_profit_pct ?? 0}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, early_take_profit_pct: parseFloat(e.target.value) || 0 } as any))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="e.g. 5 or 10"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            E.g. 5% or 10%: close when position is up 5% or 10% (long or short). Reduces losses from holding too long.
                          </p>
                        </div>
                        <div className="p-3 bg-white rounded border border-green-200">
                          <p className="text-xs text-green-700">
                            <i className="ri-information-line mr-1"></i>
                            Checked every sync (~1 min). Use with your main TP or alone to lock in gains sooner.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Smart Exit Trigger */}
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-alarm-warning-line text-orange-600"></i>
                            Smart Exit Trigger
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Exit trades instantly if the market retraces beyond your preset percentage
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.smart_exit_enabled || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, smart_exit_enabled: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                      {advancedConfig.smart_exit_enabled && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Retracement Trigger (%): {advancedConfig.smart_exit_retracement_pct || 2.0}%
                            </label>
                            <input
                              type="range"
                              value={advancedConfig.smart_exit_retracement_pct || 2.0}
                              onChange={(e) => setAdvancedConfig(prev => ({ ...prev, smart_exit_retracement_pct: parseFloat(e.target.value) } as any))}
                              className="w-full"
                              min="0.5"
                              max="5.0"
                              step="0.1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Exit position if price retraces this percentage from the highest point
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded border border-orange-200">
                            <p className="text-xs text-orange-700">
                              <i className="ri-information-line mr-1"></i>
                              Protects profits by exiting immediately when market reverses beyond your threshold.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Automatic Execution */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-play-circle-line text-blue-600"></i>
                            Automatic Execution
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Closes all positions at market price once triggered
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_automatic_execution || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_automatic_execution: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_automatic_execution && (
                        <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                          <p className="text-xs text-blue-700">
                            <i className="ri-information-line mr-1"></i>
                            When exit conditions are met, all positions will be closed immediately at current market price.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Slippage Consideration */}
                    <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <i className="ri-alert-line text-gray-600"></i>
                            Slippage Consideration
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            Final account equity may vary from the exit equity due to slippage
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_slippage_consideration || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_slippage_consideration: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_slippage_consideration && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                          <p className="text-xs text-gray-700">
                            <i className="ri-information-line mr-1"></i>
                            The bot will account for slippage when calculating exit prices. Actual execution price may differ from expected price, especially during high volatility.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Flexible Strategy Integration */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          <i className="ri-links-line text-indigo-600"></i>
                          Flexible Strategy Integration
                        </h4>
                        <p className="text-xs text-gray-600">
                          Integrate Spot Grid, Futures Grid, and Futures Combo Bots — trade your way!
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {['spot_grid', 'futures_grid', 'futures_combo'].map((strategy) => (
                          <label key={strategy} className="flex items-center gap-2 p-2 bg-white rounded border border-indigo-200 hover:bg-indigo-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(advancedConfig.flexible_strategy_integration || []).includes(strategy)}
                              onChange={(e) => {
                                const current = advancedConfig.flexible_strategy_integration || [];
                                if (e.target.checked) {
                                  setAdvancedConfig(prev => ({ ...prev, flexible_strategy_integration: [...current, strategy] } as any));
                                } else {
                                  setAdvancedConfig(prev => ({ ...prev, flexible_strategy_integration: current.filter((s: string) => s !== strategy) } as any));
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">
                              {strategy.replace('_', ' ')}
                            </span>
                          </label>
                        ))}
                      </div>
                      {(advancedConfig.flexible_strategy_integration || []).length > 0 && (
                        <div className="mt-3 p-3 bg-white rounded border border-indigo-200">
                          <p className="text-xs text-indigo-700">
                            <i className="ri-information-line mr-1"></i>
                            Selected strategies will be integrated with this bot's trading logic for enhanced flexibility.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Advanced Features */}
                <div className="border-l-4 border-indigo-500 pl-4 mt-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">⚙️ Advanced Features</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Additional advanced features to enhance your trading strategy.
                  </p>
                  
                  <div className="space-y-4">
                    {/* Auto-Rebalancing (Combo) */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-refresh-line text-indigo-600 text-lg"></i>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              Auto-Rebalancing (Combo)
                            </h4>
                            <p className="text-xs text-gray-600">
                              Automatically rebalances your portfolio across multiple positions to maintain optimal risk distribution.
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_auto_rebalancing || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_auto_rebalancing: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_auto_rebalancing && (
                        <div className="mt-3 p-3 bg-white rounded border border-indigo-200">
                          <p className="text-xs text-indigo-700">
                            <i className="ri-information-line mr-1"></i>
                            The bot will automatically rebalance positions to maintain optimal risk distribution across your portfolio.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Funding Rate Filter */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-percent-line text-blue-600 text-lg"></i>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              Funding Rate Filter
                            </h4>
                            <p className="text-xs text-gray-600">
                              Filters trades based on funding rates to avoid unfavorable positions during high funding cost periods.
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_funding_rate_filter || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_funding_rate_filter: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_funding_rate_filter && (
                        <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                          <p className="text-xs text-blue-700">
                            <i className="ri-information-line mr-1"></i>
                            The bot will filter out trades when funding rates are unfavorable, helping to reduce costs and improve profitability.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Volatility Pause */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-pause-circle-line text-amber-600 text-lg"></i>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              Volatility Pause
                            </h4>
                            <p className="text-xs text-gray-600">
                              Automatically pauses trading during extreme volatility to protect your capital from sudden market movements.
                            </p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                          <input
                            type="checkbox"
                            checked={advancedConfig.enable_volatility_pause || false}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_volatility_pause: e.target.checked } as any))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                      </div>
                      {advancedConfig.enable_volatility_pause && (
                        <div className="mt-3 p-3 bg-white rounded border border-amber-200">
                          <p className="text-xs text-amber-700">
                            <i className="ri-information-line mr-1"></i>
                            The bot will automatically pause trading when volatility exceeds safe thresholds, protecting your capital from sudden market movements.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pair-Based Win Rate Calculation */}
                <div className="border-l-4 border-teal-500 pl-4 mt-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">📊 Pair-Based Win Rate Calculation</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Track and calculate win rate separately for each trading pair in real-time.
                  </p>
                  
                  <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <i className="ri-bar-chart-line text-teal-600"></i>
                          Real-Time Pair Win Rate
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Calculate win rate separately for each trading pair and update in real-time
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={advancedConfig.enable_pair_win_rate || false}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, enable_pair_win_rate: e.target.checked } as any))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                    {advancedConfig.enable_pair_win_rate && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Trades Before Display: {(advancedConfig.pair_win_rate_min_trades ?? (advancedConfig as any).min_trades_for_pair_win_rate) || 3}
                          </label>
                          <input
                            type="range"
                            value={(advancedConfig.pair_win_rate_min_trades ?? (advancedConfig as any).min_trades_for_pair_win_rate) || 3}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, pair_win_rate_min_trades: parseInt(e.target.value) } as any))}
                            className="w-full"
                            min="1"
                            max="10"
                            step="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Minimum number of trades per pair before showing win rate (prevents misleading stats with few trades)
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Update Frequency
                          </label>
                          <select
                            value={advancedConfig.pair_win_rate_update_frequency || 'real-time'}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, pair_win_rate_update_frequency: e.target.value } as any))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="real-time">Real-Time (Update on every trade close)</option>
                            <option value="on-close">On Close (Update when position closes)</option>
                            <option value="periodic">Periodic (Update every 5 minutes)</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            How often to recalculate and update pair win rates
                          </p>
                        </div>
                        
                        <div className="p-3 bg-white rounded border border-teal-200">
                          <p className="text-xs text-teal-700">
                            <i className="ri-information-line mr-1"></i>
                            <strong>Real-Time Tracking:</strong> Win rate is calculated separately for each trading pair (e.g., BTCUSDT, ETHUSDT). 
                            This helps identify which pairs perform best and optimize your trading strategy per pair.
                          </p>
                          <p className="text-xs text-teal-700 mt-2">
                            <i className="ri-database-line mr-1"></i>
                            Statistics tracked: Total trades, Winning trades, Losing trades, Win rate %, Total PnL, Average PnL per trade, Best/Worst trade.
                          </p>
                        </div>
                      </div>
                    )}
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
