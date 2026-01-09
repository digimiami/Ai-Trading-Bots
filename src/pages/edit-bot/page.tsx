import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import type { TradingStrategy, TradingBot, AdvancedStrategyConfig } from '../../types/trading';
import { useBots } from '../../hooks/useBots';
import AutoOptimizer from '../../components/bot/AutoOptimizer';
import { STRATEGY_PRESETS, type StrategyPreset } from '../../constants/strategyPresets';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { useEmailNotifications } from '../../hooks/useEmailNotifications';
import { supabase } from '../../lib/supabase';

export default function EditBotPage() {
  const navigate = useNavigate();
  const { botId } = useParams<{ botId: string }>();
  const { bots, updateBot } = useBots();
  const { settings: userSettings } = useEmailNotifications();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx' | 'bitunix' | 'mexc',
    tradingType: 'spot' as 'spot' | 'futures',
    symbol: 'BTCUSDT',
    timeframe: '1h' as '1m' | '3m' | '5m' | '15m' | '30m' | '45m' | '1h' | '2h' | '3h' | '4h' | '5h' | '6h' | '7h' | '8h' | '9h' | '10h' | '12h' | '1d' | '1w' | '1M',
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
    ml_min_samples: 100,
    
    // Advanced Exit & Trailing Features
    enable_dynamic_trailing: false,
    enable_trailing_take_profit: false,
    trailing_take_profit_atr: 1.0,
    smart_exit_enabled: false,
    smart_exit_retracement_pct: 2.0,
    enable_automatic_execution: false,
    enable_slippage_consideration: true,
    flexible_strategy_integration: [],
    
    // Pair-Based Win Rate Calculation
    enable_pair_win_rate: false,
    min_trades_for_pair_win_rate: 3,
    pair_win_rate_update_frequency: 'real-time' as 'real-time' | 'on-close' | 'periodic',
    // Advanced Features
    enable_auto_rebalancing: false,
    enable_funding_rate_filter: false,
    enable_volatility_pause: false
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
            risk_per_trade_pct: prev.risk_per_trade_pct ?? (riskSettings.riskPerTrade ? riskSettings.riskPerTrade / 100 : 0.02),
            emergency_stop_loss: prev.emergency_stop_loss ?? riskSettings.emergencyStopLoss ?? 20.0
          }));
          console.log('✅ Applied risk management settings from user_settings to edit form');
        }
        
        // Load sound notifications setting
        setSoundNotificationsEnabled(bot.soundNotificationsEnabled || false);
        
        console.log('Edit bot: Form data set:', formData);
      } else {
        console.log('Edit bot: Bot not found with ID:', botId);
      }
    }
  }, [botId, bots, userSettings]);

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

                {/* Risk Management */}
                <div className="border-l-4 border-red-500 pl-4 mt-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">🛡️ Risk Management</h3>
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
                            Minimum Trades Before Display: {advancedConfig.min_trades_for_pair_win_rate || 3}
                          </label>
                          <input
                            type="range"
                            value={advancedConfig.min_trades_for_pair_win_rate || 3}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, min_trades_for_pair_win_rate: parseInt(e.target.value) } as any))}
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
