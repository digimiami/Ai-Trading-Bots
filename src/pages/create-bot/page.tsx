

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';
import { useBots } from '../../hooks/useBots';
import PairRecommendations from '../../components/bot/PairRecommendations';
import type { PairRecommendation } from '../../services/pairRecommendations';

export default function CreateBotPage() {
  const navigate = useNavigate();
  const { createBot } = useBots();
  const [formData, setFormData] = useState({
    name: '',
    exchange: 'bybit' as 'bybit' | 'okx',
    tradingType: 'spot' as 'spot' | 'futures',
    symbol: 'BTCUSDT',
    timeframe: '1h' as '1m' | '5m' | '15m' | '1h' | '2h' | '3h' | '4h' | '1d' | '1w',
    leverage: 5,
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    tradeAmount: 100, // Amount in USD per trade
    stopLoss: 2.0,
    takeProfit: 4.0
  });

  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [customSymbolError, setCustomSymbolError] = useState<string>('');

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
    max_consecutive_losses: 5, // Safety: auto-pause after 5 consecutive losses
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
    
    // ML/AI Settings
    use_ml_prediction: true,
    ml_confidence_threshold: 0.6,
    ml_min_samples: 100,
    
    // Risk Management Features
    daily_loss_guard_enabled: false,
    max_daily_loss_pct: 3.0,
    risk_profile: 'balanced' as 'conservative' | 'balanced' | 'aggressive',
    dynamic_position_sizing_enabled: false,
    min_position_usd: 50,
    max_position_usd: 1000
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentTradeSizePreview, setCurrentTradeSizePreview] = useState<number>(formData.tradeAmount);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const popularSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'DOTUSDT', 'AVAXUSDT',
    'BNBUSDT', 'XRPUSDT', 'MATICUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'
  ];

  // Exchange balance validation removed - will be handled by real API integration

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    
    try {
      // If custom symbol provided, validate and apply
      let finalSymbol = formData.symbol;
      if (customSymbol.trim()) {
        const raw = customSymbol.trim().toUpperCase();
        const isValid = /^[A-Z0-9]{2,20}USDT$/.test(raw);
        if (!isValid) {
          setCustomSymbolError('Symbol must be uppercase and end with USDT (e.g., DOGEUSDT)');
          setIsCreating(false);
          return;
        }
        setCustomSymbolError('');
        finalSymbol = raw;
      }
      // Debug: Log the form data being sent
      const botData = {
        name: formData.name,
        exchange: formData.exchange,
        tradingType: formData.tradingType,
        symbol: finalSymbol,
        timeframe: formData.timeframe,
        leverage: formData.leverage,
        riskLevel: formData.riskLevel,
        tradeAmount: formData.tradeAmount,
        stopLoss: formData.stopLoss,
        takeProfit: formData.takeProfit,
        strategy: strategy,
        strategyConfig: advancedConfig,  // Include advanced configuration
        // Initialize with default values
        status: 'stopped' as const,
        pnl: 0,
        pnlPercentage: 0,
        totalTrades: 0,
        winRate: 0,
        lastTradeAt: undefined
      };
      
      console.log('Frontend: Sending bot data:', botData);
      console.log('Frontend: Exchange value:', formData.exchange, 'Type:', typeof formData.exchange);
      
      // Create bot using the hook
      await createBot(botData);
      
      // Navigate back to bots page with success message
      navigate('/bots', { state: { message: `Bot "${formData.name}" created successfully!` } });
    } catch (error: any) {
      setError(error.message || 'Failed to create bot');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStrategyChange = (field: keyof TradingStrategy, value: any) => {
    setStrategy(prev => ({ ...prev, [field]: value }));
  };

  // Risk Profile Preset Handler
  const handleRiskProfileChange = (profile: 'conservative' | 'balanced' | 'aggressive') => {
    setAdvancedConfig(prev => ({ ...prev, risk_profile: profile }));
    
    switch (profile) {
      case 'conservative':
        setFormData(prev => ({
          ...prev,
          symbol: 'BTCUSDT',
          leverage: 3,
          stopLoss: 2.0,
          takeProfit: 4.0
        }));
        setAdvancedConfig(prev => ({
          ...prev,
          cooldown_bars: 12, // Higher cooldown = fewer trades
          risk_profile: 'conservative'
        }));
        break;
      case 'balanced':
        setFormData(prev => ({
          ...prev,
          symbol: 'ETHUSDT',
          leverage: 5,
          stopLoss: 2.0,
          takeProfit: 4.0
        }));
        setAdvancedConfig(prev => ({
          ...prev,
          cooldown_bars: 8, // Medium cooldown
          risk_profile: 'balanced'
        }));
        break;
      case 'aggressive':
        setFormData(prev => ({
          ...prev,
          symbol: 'SOLUSDT',
          leverage: 5,
          stopLoss: 2.5,
          takeProfit: 5.0
        }));
        setAdvancedConfig(prev => ({
          ...prev,
          cooldown_bars: 4, // Lower cooldown = more trades
          risk_profile: 'aggressive'
        }));
        break;
    }
  };

  // Calculate dynamic position size preview (simulated volatility-based adjustment)
  useEffect(() => {
    if (advancedConfig.dynamic_position_sizing_enabled) {
      // Simulate volatility calculation (in production, this would use real ATR/volatility data)
      const baseSize = formData.tradeAmount;
      // Mock volatility factor: 0.7 (high volatility) to 1.0 (normal volatility)
      const volatilityFactor = 0.85; // Average volatility
      const adjustedSize = baseSize * volatilityFactor;
      
      // Apply min/max constraints
      const minPosition = advancedConfig.min_position_usd || 50;
      const maxPosition = advancedConfig.max_position_usd || 1000;
      const finalSize = Math.max(minPosition, Math.min(maxPosition, adjustedSize));
      
      setCurrentTradeSizePreview(Math.round(finalSize));
    } else {
      setCurrentTradeSizePreview(formData.tradeAmount);
    }
  }, [advancedConfig.dynamic_position_sizing_enabled, advancedConfig.min_position_usd, advancedConfig.max_position_usd, formData.tradeAmount]);

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
    setFormData(prev => ({
      ...prev,
      tradeAmount: recommendation.suggestedTradeAmount,
      leverage: recommendation.suggestedLeverage,
      stopLoss: recommendation.suggestedStopLoss,
      takeProfit: recommendation.suggestedTakeProfit,
      riskLevel: recommendation.riskAssessment as 'low' | 'medium' | 'high'
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

All settings have been applied to your bot configuration.`;
    
    alert(message);
    
    console.log('📋 All Applied Changes:', recommendation.changes);
  };

  // Get the effective symbol (dropdown or custom)
  const effectiveSymbol = customSymbol.trim() ? customSymbol.trim().toUpperCase() : formData.symbol;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Create New Bot" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-6">
            <button
              onClick={() => navigate('/bots')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Create New Bot</h1>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <i className="ri-error-warning-line text-red-500 mr-2"></i>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Basic Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Or enter a custom pair (e.g., DOGEUSDT)
                    </label>
                    <input
                      type="text"
                      value={customSymbol}
                      onChange={(e) => setCustomSymbol(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                      placeholder="e.g., PEPEUSDT"
                    />
                    {customSymbolError && (
                      <p className="text-xs text-red-600 mt-1">{customSymbolError}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Uppercase; must end with USDT. If provided, overrides dropdown.</p>
                  </div>

                  {/* AI Recommendations */}
                  {effectiveSymbol && (
                    <div className="mt-4">
                      <PairRecommendations
                        symbol={effectiveSymbol}
                        tradingType={formData.tradingType}
                        currentStrategy={strategy}
                        currentAdvancedConfig={advancedConfig}
                        currentTradeAmount={formData.tradeAmount}
                        currentLeverage={formData.leverage}
                        currentStopLoss={formData.stopLoss}
                        currentTakeProfit={formData.takeProfit}
                        onApplyRecommendation={handleApplyRecommendation}
                      />
                    </div>
                  )}
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
                    value={(formData as any).stopLoss}
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
                    value={(formData as any).takeProfit}
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

              {/* Risk Management Features */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Management</h3>
                
                {/* Risk Profile Preset */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Risk Profile
                  </label>
                  <select
                    value={advancedConfig.risk_profile || 'balanced'}
                    onChange={(e) => handleRiskProfileChange(e.target.value as 'conservative' | 'balanced' | 'aggressive')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="conservative">Conservative - Lower risk. Slower, more controlled.</option>
                    <option value="balanced">Balanced - Moderate risk. Growth-focused.</option>
                    <option value="aggressive">Aggressive - High risk. High upside.</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose how aggressive this bot should trade. We'll auto-set leverage, stop loss, take profit, and cooldown for you.
                  </p>
                  {advancedConfig.risk_profile === 'conservative' && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-600">
                      <strong>Conservative Settings Applied:</strong> BTCUSDT, 3x leverage, Stop Loss 2%, Take Profit 4%, higher cooldown (fewer trades)
                    </div>
                  )}
                  {advancedConfig.risk_profile === 'balanced' && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs text-gray-600">
                      <strong>Balanced Settings Applied:</strong> ETHUSDT, 5x leverage, Stop Loss 2%, Take Profit 4%, medium cooldown
                    </div>
                  )}
                  {advancedConfig.risk_profile === 'aggressive' && (
                    <div className="mt-2 p-2 bg-orange-50 rounded text-xs text-gray-600">
                      <strong>Aggressive Settings Applied:</strong> SOLUSDT, 5x leverage, Stop Loss 2.5%, Take Profit 5%, lower cooldown (more trades)
                    </div>
                  )}
                </div>

                {/* Daily Loss Guard */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Daily Loss Guard
                      </label>
                      <p className="text-xs text-gray-500">
                        Pause this bot automatically if losses hit your daily limit.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedConfig.daily_loss_guard_enabled || false}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, daily_loss_guard_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {advancedConfig.daily_loss_guard_enabled && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Daily Loss (%)
                      </label>
                      <input
                        type="number"
                        value={advancedConfig.max_daily_loss_pct || 3.0}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, max_daily_loss_pct: parseFloat(e.target.value) || 3.0 }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                        max="10"
                        step="0.5"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bot will pause for 24 hours if today's realized loss reaches this percentage. Open trades can still manage TP/SL.
                      </p>
                    </div>
                  )}
                </div>

                {/* Dynamic Position Sizing */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dynamic Position Sizing
                      </label>
                      <p className="text-xs text-gray-500">
                        Automatically adjust trade size based on market volatility.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedConfig.dynamic_position_sizing_enabled || false}
                        onChange={(e) => setAdvancedConfig(prev => ({ ...prev, dynamic_position_sizing_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {advancedConfig.dynamic_position_sizing_enabled && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Min Position ($)
                          </label>
                          <input
                            type="number"
                            value={advancedConfig.min_position_usd || 50}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, min_position_usd: parseFloat(e.target.value) || 50 }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min="10"
                            max="500"
                            step="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Position ($)
                          </label>
                          <input
                            type="number"
                            value={advancedConfig.max_position_usd || 1000}
                            onChange={(e) => setAdvancedConfig(prev => ({ ...prev, max_position_usd: parseFloat(e.target.value) || 1000 }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min="100"
                            max="10000"
                            step="50"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        The smallest and largest position this bot is allowed to open.
                      </p>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700">
                          Current Est. Trade Size: <span className="text-blue-600 font-semibold">${currentTradeSizePreview}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Preview of what size would be used right now based on current volatility.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cooldown (Bars)
                  </label>
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
              </div>
            </Card>

            {/* Strategy Configuration */}
            <Card className="p-6">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="30"
                    max="90"
                    step="5"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    RSI level that triggers trades (overbought/oversold)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSI Period
                  </label>
                  <input
                    type="number"
                    value={advancedConfig.rsi_period || 14}
                    onChange={(e) => setAdvancedConfig(prev => ({ ...prev, rsi_period: parseInt(e.target.value) || 14 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="7"
                    max="21"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    RSI calculation period (default: 14)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSI Oversold Level
                  </label>
                  <input
                    type="number"
                    value={advancedConfig.rsi_oversold || 30}
                    onChange={(e) => setAdvancedConfig(prev => ({ ...prev, rsi_oversold: parseInt(e.target.value) || 30 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="10"
                    max="40"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    RSI level considered oversold (buy signal)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSI Overbought Level
                  </label>
                  <input
                    type="number"
                    value={advancedConfig.rsi_overbought || 70}
                    onChange={(e) => setAdvancedConfig(prev => ({ ...prev, rsi_overbought: parseInt(e.target.value) || 70 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="60"
                    max="90"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    RSI level considered overbought (sell signal)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ADX Threshold
                  </label>
                  <input
                    type="number"
                    value={strategy.adxThreshold}
                    onChange={(e) => handleStrategyChange('adxThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0.01"
                    max="0.1"
                    step="0.005"
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
                    max="2"
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
                    min="1"
                    max="10"
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
                    max="3"
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
                    min="0.1"
                    max="2"
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
                    max="500"
                    step="25"
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
                    Enable ML Prediction (fallback to rules until min samples)
                  </span>
                </label>
              </div>
            </Card>

            {/* Advanced Configuration - Collapsible */}
            <Card className="p-6">
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
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, htf_timeframe: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="4h">4 Hours</option>
                          <option value="1d">1 Day</option>
                          <option value="1h">1 Hour</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTF Trend Indicator
                        </label>
                        <select
                          value={advancedConfig.htf_trend_indicator}
                          onChange={(e) => setAdvancedConfig(prev => ({ ...prev, htf_trend_indicator: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="EMA200">EMA 200</option>
                          <option value="SMA200">SMA 200</option>
                          <option value="Supertrend">Supertrend</option>
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
                          min="2"
                          max="20"
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

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/bots')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isCreating}
                className="flex-1"
              >
                {isCreating ? 'Creating Bot...' : 'Create Bot'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

