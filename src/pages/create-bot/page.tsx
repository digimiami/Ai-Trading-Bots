

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import Header from '../../components/feature/Header';
import type { TradingStrategy, AdvancedStrategyConfig } from '../../types/trading';
import { useBots } from '../../hooks/useBots';
import { useSubscription } from '../../hooks/useSubscription';
import { useApiKeys } from '../../hooks/useApiKeys';
import { supabase } from '../../lib/supabase';
import PairRecommendations from '../../components/bot/PairRecommendations';
import type { PairRecommendation } from '../../services/pairRecommendations';
import { STRATEGY_PRESETS, type StrategyPreset } from '../../constants/strategyPresets';
import {
  HTF_TIMEFRAME_OPTIONS,
  HTF_TREND_INDICATOR_OPTIONS
} from '../../constants/strategyOptions';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { getOptimizedSettingsForIndicator } from '../../utils/htfIndicatorSettings';

export default function CreateBotPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { createBot, getBotById } = useBots();
  const { canCreateBot, subscription } = useSubscription();
  const { apiKeys, loading: apiKeysLoading } = useApiKeys();
  
  // Check if coming from backtest
  const backtestData = location.state as any;
  const isFromBacktest = backtestData?.fromBacktest === true;
  
  // Check if coming from Pablo Ready template
  const isFromPabloReady = searchParams.get('template') === 'pablo-ready';
  const pabloReadyBotId = searchParams.get('botId');
  
  // Check if coming from AI prediction
  const isFromAiPrediction = searchParams.get('fromAiPrediction') === 'true';
  const aiPredictionId = searchParams.get('predictionId');
  const aiConfidence = searchParams.get('confidence');
  
  // Check if cloning from bot ID
  const cloneBotId = searchParams.get('cloneBotId');
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneBotIdInput, setCloneBotIdInput] = useState('');
  const [isLoadingClone, setIsLoadingClone] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  
  // Get initial values from URL params (for navigation from Futures Pairs Finder or Pablo Ready)
  const urlSymbol = searchParams.get('symbol') || 'BTCUSDT';
  const urlExchangeParam = searchParams.get('exchange') || 'bybit';
  // Allow all exchanges including Bitunix
  const urlExchange = urlExchangeParam as 'bybit' | 'okx' | 'bitunix';
  const urlTradingType = (searchParams.get('tradingType') || 'spot') as 'spot' | 'futures';
  const urlLeverage = searchParams.get('leverage') ? parseInt(searchParams.get('leverage')!) : 5;
  const urlRiskLevel = (searchParams.get('riskLevel') || 'medium') as 'low' | 'medium' | 'high';
  const urlTradeAmount = searchParams.get('tradeAmount') ? parseFloat(searchParams.get('tradeAmount')!) : 100;
  const urlStopLoss = searchParams.get('stopLoss') ? parseFloat(searchParams.get('stopLoss')!) : 2.0;
  const urlTakeProfit = searchParams.get('takeProfit') ? parseFloat(searchParams.get('takeProfit')!) : 4.0;
  const urlTimeframe = (searchParams.get('timeframe') || '1h') as '1m' | '3m' | '5m' | '15m' | '30m' | '45m' | '1h' | '2h' | '3h' | '4h' | '5h' | '6h' | '7h' | '8h' | '9h' | '10h' | '12h' | '1d' | '1w' | '1M';
  const urlStrategy = searchParams.get('strategy');
  const urlStrategyConfig = searchParams.get('strategyConfig');
  const urlRsiThreshold = searchParams.get('rsiThreshold');
  const urlAdxThreshold = searchParams.get('adxThreshold');
  const urlBiasMode = searchParams.get('biasMode');
  const urlRegimeMode = searchParams.get('regimeMode');
  
  const [formData, setFormData] = useState({
    name: isFromBacktest && backtestData?.botName ? backtestData.botName : (isFromPabloReady && searchParams.get('name') ? searchParams.get('name')! : (isFromAiPrediction && searchParams.get('name') ? searchParams.get('name')! : '')),
    exchange: isFromBacktest && backtestData?.backtestConfig?.exchange ? backtestData.backtestConfig.exchange : urlExchange,
    tradingType: isFromBacktest && backtestData?.backtestConfig?.tradingType ? backtestData.backtestConfig.tradingType : urlTradingType,
    symbol: isFromBacktest && backtestData?.backtestConfig?.symbols?.[0] ? backtestData.backtestConfig.symbols[0] : urlSymbol,
    timeframe: isFromBacktest && backtestData?.backtestConfig?.timeframe ? backtestData.backtestConfig.timeframe : urlTimeframe,
    leverage: isFromBacktest && backtestData?.backtestConfig?.leverage ? backtestData.backtestConfig.leverage : urlLeverage,
    riskLevel: isFromBacktest && backtestData?.backtestConfig?.riskLevel ? backtestData.backtestConfig.riskLevel : urlRiskLevel,
    tradeAmount: isFromBacktest && backtestData?.backtestConfig?.tradeAmount ? backtestData.backtestConfig.tradeAmount : urlTradeAmount,
    stopLoss: isFromBacktest && backtestData?.backtestConfig?.stopLoss ? backtestData.backtestConfig.stopLoss : urlStopLoss,
    takeProfit: isFromBacktest && backtestData?.backtestConfig?.takeProfit ? backtestData.backtestConfig.takeProfit : urlTakeProfit,
    paperTrading: false, // Paper trading mode toggle
    soundNotificationsEnabled: false // Sound notifications for real trades
  });

  // Update form data when URL params change
  useEffect(() => {
    if (urlSymbol) {
      setFormData(prev => ({
        ...prev,
        symbol: urlSymbol,
        exchange: urlExchange,
        tradingType: urlTradingType,
        timeframe: urlTimeframe,
        leverage: urlLeverage,
        riskLevel: urlRiskLevel,
        tradeAmount: urlTradeAmount,
        stopLoss: urlStopLoss,
        takeProfit: urlTakeProfit
      }));
    }
  }, [urlSymbol, urlExchange, urlTradingType, urlTimeframe, urlLeverage, urlRiskLevel, urlTradeAmount, urlStopLoss, urlTakeProfit]);

  const [customSymbol, setCustomSymbol] = useState<string>('');
  const [customSymbolError, setCustomSymbolError] = useState<string>('');
  const [useMultiplePairs, setUseMultiplePairs] = useState<boolean>(false);
  const [customPairs, setCustomPairs] = useState<string>('');

  // Load bot to clone if cloneBotId is provided
  useEffect(() => {
    if (cloneBotId) {
      const loadBotToClone = async () => {
        try {
          setIsLoadingClone(true);
          setCloneError(null);
          
          const bot = await getBotById(cloneBotId);
          
          if (!bot) {
            setCloneError('Bot not found. Please check the bot ID.');
            setIsLoadingClone(false);
            return;
          }

          // Populate form with cloned bot data
          setFormData(prev => ({
            ...prev,
            name: `${bot.name} (Clone)`,
            exchange: bot.exchange,
            tradingType: bot.tradingType || 'spot',
            symbol: bot.symbol || '',
            timeframe: bot.timeframe || '1h',
            leverage: bot.leverage || 5,
            riskLevel: bot.riskLevel || 'medium',
            tradeAmount: bot.tradeAmount || 100,
            stopLoss: bot.stopLoss || 2.0,
            takeProfit: bot.takeProfit || 4.0,
            paperTrading: bot.paperTrading || false,
            soundNotificationsEnabled: bot.soundNotificationsEnabled || false
          }));

          // Set strategy if available
          if (bot.strategy) {
            setStrategy(bot.strategy as TradingStrategy);
          }

          // Set advanced config if available
          if (bot.strategyConfig) {
            setAdvancedConfig(bot.strategyConfig as AdvancedStrategyConfig);
          }

          // Handle multiple pairs
          if (bot.symbols && Array.isArray(bot.symbols) && bot.symbols.length > 1) {
            setUseMultiplePairs(true);
            setCustomPairs(bot.symbols.join(', '));
          } else if (bot.customPairs) {
            setUseMultiplePairs(true);
            setCustomPairs(bot.customPairs);
          }

          setIsLoadingClone(false);
        } catch (err: any) {
          console.error('Error loading bot to clone:', err);
          setCloneError(err.message || 'Failed to load bot. Please check the bot ID.');
          setIsLoadingClone(false);
        }
      };

      loadBotToClone();
    }
  }, [cloneBotId, getBotById]);

  // Load Pablo Ready bot data if template is provided
  useEffect(() => {
    if (isFromPabloReady && pabloReadyBotId) {
      const loadPabloReadyBot = async () => {
        try {
          const { data, error } = await supabase
            .from('pablo_ready_bots')
            .select('*')
            .eq('id', pabloReadyBotId)
            .eq('enabled', true)
            .single();

          if (error) throw error;

          if (data) {
            // Parse strategy and config from URL params or database
            let parsedStrategy = data.strategy || {};
            let parsedConfig = data.strategy_config || {};

            if (urlStrategy) {
              try {
                parsedStrategy = JSON.parse(urlStrategy);
              } catch (e) {
                console.warn('Failed to parse strategy from URL');
              }
            }

            if (urlStrategyConfig) {
              try {
                parsedConfig = JSON.parse(urlStrategyConfig);
              } catch (e) {
                console.warn('Failed to parse strategy config from URL');
              }
            }

            setFormData(prev => {
              const exchangeParam = searchParams.get('exchange') || data.exchange || prev.exchange;
              // Force bybit if okx or bitunix is passed (they're disabled)
              const finalExchange = (exchangeParam === 'okx' || exchangeParam === 'bitunix') ? 'bybit' : (exchangeParam as 'bybit' | 'okx');
              return {
                ...prev,
                name: searchParams.get('name') || data.name || prev.name,
                exchange: finalExchange,
                tradingType: (searchParams.get('tradingType') || data.trading_type || prev.tradingType) as 'spot' | 'futures',
                symbol: searchParams.get('symbol') || data.symbol || prev.symbol,
                timeframe: (searchParams.get('timeframe') || data.timeframe || prev.timeframe) as any,
                leverage: searchParams.get('leverage') ? parseInt(searchParams.get('leverage')!) : (data.leverage || prev.leverage),
                riskLevel: (searchParams.get('riskLevel') || data.risk_level || prev.riskLevel) as 'low' | 'medium' | 'high',
                tradeAmount: searchParams.get('tradeAmount') ? parseFloat(searchParams.get('tradeAmount')!) : (data.trade_amount || prev.tradeAmount),
                stopLoss: searchParams.get('stopLoss') ? parseFloat(searchParams.get('stopLoss')!) : (data.stop_loss || prev.stopLoss),
                takeProfit: searchParams.get('takeProfit') ? parseFloat(searchParams.get('takeProfit')!) : (data.take_profit || prev.takeProfit),
              };
            });

            // Set strategy and config - merge with defaults to ensure all required fields are present
            if (parsedStrategy && Object.keys(parsedStrategy).length > 0) {
              setStrategy(parsedStrategy as TradingStrategy);
            }
            if (parsedConfig && Object.keys(parsedConfig).length > 0) {
              // Merge with default config to ensure all required fields are present
              const defaultConfig: AdvancedStrategyConfig = {
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
                max_consecutive_losses: 5,
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
                ml_min_samples: 100,
                // Advanced Exit & Trailing Features
                enable_dynamic_trailing: false,
                enable_automatic_execution: false,
                enable_trailing_take_profit: false,
                trailing_take_profit_atr: 1.0,
                smart_exit_enabled: false,
                smart_exit_retracement_pct: 2.0,
                enable_slippage_consideration: true,
                strategy_integration: [],
                // Pair-Based Win Rate Calculation
                enable_pair_win_rate: false,
                pair_win_rate_min_trades: 3,
                pair_win_rate_update_frequency: 'realtime'
              };
              setAdvancedConfig({ ...defaultConfig, ...parsedConfig } as AdvancedStrategyConfig);
            }
          }
        } catch (error: any) {
          console.error('Failed to load Pablo Ready bot:', error);
        }
      };

      loadPabloReadyBot();
    }
  }, [isFromPabloReady, pabloReadyBotId]);

  const [strategy, setStrategy] = useState<TradingStrategy>(
    isFromBacktest && backtestData?.backtestStrategy
      ? backtestData.backtestStrategy
      : {
          rsiThreshold: urlRsiThreshold ? parseFloat(urlRsiThreshold) : 70,
          adxThreshold: urlAdxThreshold ? parseFloat(urlAdxThreshold) : 25,
          bbWidthThreshold: 0.02,
          emaSlope: 0.5,
          atrPercentage: 2.5,
          vwapDistance: 1.2,
          momentumThreshold: 0.8,
          useMLPrediction: true,
          minSamplesForML: 100
        }
  );

  const [advancedConfig, setAdvancedConfig] = useState<AdvancedStrategyConfig>(
    isFromBacktest && backtestData?.backtestAdvancedConfig
      ? backtestData.backtestAdvancedConfig
      : {
          // Directional Bias
          bias_mode: (urlBiasMode as any) || 'auto',
          htf_timeframe: '4h',
          htf_trend_indicator: 'EMA200',
          ema_fast_period: 50,
          require_price_vs_trend: 'any',
          adx_min_htf: 23,
          require_adx_rising: true,
          
          // Regime Filter
          regime_mode: (urlRegimeMode as any) || 'auto',
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
          atr_period: 14,
          atr_tp_multiplier: 3,
          
          // ML/AI Settings
          use_ml_prediction: true,
          ml_confidence_threshold: 0.6,
          ml_min_samples: 100,
          
          // Advanced Exit & Trailing Features
          enable_dynamic_trailing: false,
          enable_automatic_execution: false,
          enable_trailing_take_profit: false,
          trailing_take_profit_atr: 1.0,
          smart_exit_enabled: false,
          smart_exit_retracement_pct: 2.0,
          enable_slippage_consideration: true,
          strategy_integration: [],
          // Pair-Based Win Rate Calculation
          enable_pair_win_rate: false,
          pair_win_rate_min_trades: 3,
          pair_win_rate_update_frequency: 'realtime'
        }
  );
  
  // Handle multiple pairs from backtest
  useEffect(() => {
    if (isFromBacktest && backtestData?.backtestConfig?.symbols) {
      const symbols = backtestData.backtestConfig.symbols;
      if (symbols.length > 1) {
        setUseMultiplePairs(true);
        setCustomPairs(symbols.join(', '));
      }
    }
  }, [isFromBacktest, backtestData]);

  const [showAdvanced, setShowAdvanced] = useState(false);
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
      // Check if user has API keys configured
      if (!apiKeysLoading && (!apiKeys || apiKeys.length === 0)) {
        const hasApiKeys = apiKeys && apiKeys.length > 0;
        if (!hasApiKeys) {
          const bybitLink = 'https://www.bybit.com/invite?ref=LJXQEA';
          const message = `⚠️ Exchange API Keys Required\n\nTo create a trading bot, you need to add API keys from your exchange first.\n\nSteps:\n1. Sign up for Bybit (if you don't have an account)\n2. Generate API keys from your Bybit account\n3. Add the API keys in Settings\n\nClick OK to go to Settings, or Cancel to sign up for Bybit.`;
          
          if (window.confirm(message)) {
            navigate('/settings');
          } else {
            // Open Bybit signup in new tab
            window.open(bybitLink, '_blank');
            // Still navigate to settings so they can add keys after signing up
            setTimeout(() => {
              navigate('/settings');
            }, 1000);
          }
          setIsCreating(false);
          return;
        }
      }
      
      // Check subscription limits before creating bot
      const subscriptionCheck = await canCreateBot();
      if (!subscriptionCheck.allowed) {
        const reason = subscriptionCheck.reason || 'You have reached your bot creation limit. Please upgrade your plan.';
        setError(reason);
        setIsCreating(false);
        // Show upgrade prompt after a short delay
        setTimeout(() => {
          if (window.confirm(`${reason}\n\nWould you like to upgrade your plan to create more bots?`)) {
            navigate('/pricing');
          }
        }, 1500);
        return;
      }
      
      // Validate exchange is enabled (Bitunix is now enabled)
      if (formData.exchange === 'okx') {
        setError('OKX exchange is coming soon. Please use Bybit or Bitunix for now.');
        setIsCreating(false);
        return;
      }
      // Handle multiple pairs or single pair
      let finalSymbol = formData.symbol;
      let symbols: string[] = [];
      let customPairsInput = '';
      
      if (useMultiplePairs) {
        // Multiple pairs mode
        if (!customPairs.trim()) {
          setError('Please enter at least one trading pair');
          setIsCreating(false);
          return;
        }
        
        // Parse pairs (comma or newline separated)
        const parsedPairs = customPairs
          .split(/[\n,]/)
          .map(pair => pair.trim().toUpperCase())
          .filter(pair => pair.length > 0);
        
        if (parsedPairs.length === 0) {
          setError('Please enter at least one valid trading pair');
          setIsCreating(false);
          return;
        }
        
        // Validate each pair
        const invalidPairs = parsedPairs.filter(pair => !/^[A-Z0-9]{2,20}USDT$/.test(pair));
        if (invalidPairs.length > 0) {
          setError(`Invalid pair format: ${invalidPairs.join(', ')}. Must be uppercase and end with USDT`);
          setIsCreating(false);
          return;
        }
        
        symbols = parsedPairs;
        finalSymbol = parsedPairs[0]; // Use first pair as primary symbol
        customPairsInput = customPairs.trim();
      } else {
        // Single pair mode (existing logic)
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
        symbols = [finalSymbol];
      }
      
      // Debug: Log the form data being sent
      // Ensure slippage consideration is always enabled (automatic)
      const finalAdvancedConfig = {
        ...advancedConfig,
        enable_slippage_consideration: true,
        strategy_integration: [] // Remove strategy integration feature
      };
      
      const botData = {
        name: formData.name,
        exchange: formData.exchange,
        tradingType: formData.tradingType,
        symbol: finalSymbol,
        symbols: symbols.length > 1 ? symbols : undefined, // Only include if multiple pairs
        customPairs: customPairsInput || undefined,
        timeframe: formData.timeframe,
        leverage: formData.leverage,
        riskLevel: formData.riskLevel,
        tradeAmount: formData.tradeAmount,
        stopLoss: formData.stopLoss,
        takeProfit: formData.takeProfit,
        paperTrading: formData.paperTrading,
        soundNotificationsEnabled: formData.soundNotificationsEnabled,
        strategy: strategy,
        strategyConfig: finalAdvancedConfig,  // Include advanced configuration with enforced settings
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

  const handleCloneBot = async () => {
    if (!cloneBotIdInput.trim()) {
      setCloneError('Please enter a bot ID');
      return;
    }

    try {
      setIsLoadingClone(true);
      setCloneError(null);
      
      const bot = await getBotById(cloneBotIdInput.trim());
      
      if (!bot) {
        setCloneError('Bot not found. Please check the bot ID.');
        setIsLoadingClone(false);
        return;
      }

      // Populate form with cloned bot data
      setFormData(prev => ({
        ...prev,
        name: `${bot.name} (Clone)`,
        exchange: bot.exchange,
        tradingType: bot.tradingType || 'spot',
        symbol: bot.symbol || '',
        timeframe: bot.timeframe || '1h',
        leverage: bot.leverage || 5,
        riskLevel: bot.riskLevel || 'medium',
        tradeAmount: bot.tradeAmount || 100,
        stopLoss: bot.stopLoss || 2.0,
        takeProfit: bot.takeProfit || 4.0,
        paperTrading: bot.paperTrading || false,
        soundNotificationsEnabled: bot.soundNotificationsEnabled || false
      }));

      // Set strategy if available
      if (bot.strategy) {
        setStrategy(bot.strategy as TradingStrategy);
      }

      // Set advanced config if available
      if (bot.strategyConfig) {
        setAdvancedConfig(bot.strategyConfig as AdvancedStrategyConfig);
      }

      // Handle multiple pairs
      if (bot.symbols && Array.isArray(bot.symbols) && bot.symbols.length > 1) {
        setUseMultiplePairs(true);
        setCustomPairs(bot.symbols.join(', '));
      } else if (bot.customPairs) {
        setUseMultiplePairs(true);
        setCustomPairs(bot.customPairs);
      }

      setShowCloneModal(false);
      setCloneBotIdInput('');
      setIsLoadingClone(false);
    } catch (err: any) {
      console.error('Error cloning bot:', err);
      setCloneError(err.message || 'Failed to load bot. Please check the bot ID.');
      setIsLoadingClone(false);
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
    setShowAdvanced(true);
    setFormData(prev => ({
      ...prev,
      tradeAmount: preset.recommendedTradeAmount ?? prev.tradeAmount,
      stopLoss: preset.recommendedStopLoss ?? prev.stopLoss,
      takeProfit: preset.recommendedTakeProfit ?? prev.takeProfit,
      riskLevel: preset.recommendedRiskLevel ?? prev.riskLevel
    }));
    console.log('Applied strategy preset:', preset.key);
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
  const effectiveSymbol = useMultiplePairs 
    ? (customPairs.trim() ? customPairs.split(/[\n,]/).map(p => p.trim().toUpperCase()).filter(p => p.length > 0)[0] : formData.symbol)
    : (customSymbol.trim() ? customSymbol.trim().toUpperCase() : formData.symbol);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Create New Bot" />
      
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/bots')}
                className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <i className="ri-arrow-left-line text-xl"></i>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Create New Bot</h1>
            </div>
            <button
              onClick={() => setShowCloneModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i className="ri-file-copy-line"></i>
              Clone Bot
            </button>
          </div>

          {/* Clone Bot Modal */}
          {showCloneModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Clone Bot by ID</h2>
                  <button
                    onClick={() => {
                      setShowCloneModal(false);
                      setCloneBotIdInput('');
                      setCloneError(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Enter a bot ID to clone its configuration. You can clone bots from any user.
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bot ID
                  </label>
                  <input
                    type="text"
                    value={cloneBotIdInput}
                    onChange={(e) => setCloneBotIdInput(e.target.value)}
                    placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoadingClone}
                  />
                </div>
                
                {cloneError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{cloneError}</p>
                  </div>
                )}
                
                {isLoadingClone && (
                  <div className="mb-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600 mt-2">Loading bot configuration...</p>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCloneModal(false);
                      setCloneBotIdInput('');
                      setCloneError(null);
                    }}
                    className="flex-1"
                    disabled={isLoadingClone}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCloneBot}
                    loading={isLoadingClone}
                    className="flex-1"
                  >
                    Clone Bot
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <i className="ri-error-warning-line text-red-500 mr-2"></i>
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {/* Notification when coming from backtest */}
          {isFromBacktest && backtestData && (
            <Card className="p-4 mb-6 bg-green-50 border-2 border-green-300">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <i className="ri-checkbox-circle-line text-2xl text-green-600"></i>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-green-900 mb-1">
                    ✅ Form Pre-filled from Backtest
                  </h3>
                  <p className="text-sm text-green-700 mb-2">
                    Your bot settings have been automatically filled from the backtest results. Review and adjust as needed, then click "Create Bot" to create your trading bot.
                  </p>
                  {backtestData?.backtestResults && (
                    <div className="text-xs text-green-600 mt-2">
                      <span className="font-semibold">Backtest Performance:</span> {backtestData.backtestResults.win_rate?.toFixed(1) || 0}% win rate, 
                      ${(backtestData.backtestResults.net_profit || backtestData.backtestResults.total_pnl || 0).toFixed(2)} net profit
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Notification when coming from AI prediction */}
          {isFromAiPrediction && (
            <Card className="p-4 mb-6 bg-purple-50 border-2 border-purple-300">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <i className="ri-brain-line text-2xl text-purple-600"></i>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-purple-900 mb-1">
                    🤖 Form Pre-filled from AI Prediction
                  </h3>
                  <p className="text-sm text-purple-700 mb-2">
                    Your bot settings have been automatically configured based on the AI/ML prediction. The bot is optimized for the predicted signal ({formData.symbol}). Review and adjust as needed, then click "Create Bot" to create your trading bot.
                  </p>
                  {aiConfidence && (
                    <div className="text-xs text-purple-600 mt-2">
                      <span className="font-semibold">AI Confidence:</span> {aiConfidence}% | 
                      <span className="font-semibold ml-2">Prediction ID:</span> {aiPredictionId || 'N/A'}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Basic Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Bot Name
                    <HelpTooltip text="A unique name to identify your trading bot. This helps you distinguish between multiple bots." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Exchange
                    <HelpTooltip text="Select the cryptocurrency exchange where your bot will trade. Currently supports Bybit and Bitunix. OKX is coming soon." />
                  </label>
                  <select
                    value={formData.exchange}
                    onChange={(e) => handleInputChange('exchange', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="bybit">Bybit</option>
                    <option value="bitunix">Bitunix</option>
                    <option value="okx" disabled>OKX (Coming Soon)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Trading Type
                    <HelpTooltip text="Spot Trading: Buy/sell actual cryptocurrencies. Futures Trading: Trade with leverage using contracts." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Trading Pair
                    <HelpTooltip text="The cryptocurrency pair to trade (e.g., BTCUSDT = Bitcoin/USDT). You can select a single pair or multiple pairs for the bot to trade." />
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
                    <div className="flex items-center space-x-4 mb-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pairMode"
                          checked={!useMultiplePairs}
                          onChange={() => setUseMultiplePairs(false)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Single Pair</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="pairMode"
                          checked={useMultiplePairs}
                          onChange={() => setUseMultiplePairs(true)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Multiple Pairs</span>
                      </label>
                    </div>
                    
                    {!useMultiplePairs ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Enter multiple trading pairs
                        </label>
                        <textarea
                          value={customPairs}
                          onChange={(e) => setCustomPairs(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono text-sm"
                          placeholder="BTCUSDT&#10;ETHUSDT&#10;SOLUSDT&#10;&#10;Or comma-separated: BTCUSDT, ETHUSDT, SOLUSDT"
                          rows={6}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Enter pairs separated by commas or new lines. Each pair must be uppercase and end with USDT.
                          <br />
                          Example: <code className="bg-gray-100 px-1 rounded">BTCUSDT, ETHUSDT, SOLUSDT</code> or one per line
                        </p>
                        {customPairs.trim() && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs font-medium text-blue-900 mb-1">
                              {customPairs.split(/[\n,]/).filter(p => p.trim().length > 0).length} pair(s) detected:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {customPairs
                                .split(/[\n,]/)
                                .map(p => p.trim().toUpperCase())
                                .filter(p => p.length > 0)
                                .map((pair, idx) => (
                                  <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-blue-300 text-blue-700">
                                    {pair}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Time Frame
                    <HelpTooltip text="The chart interval used for technical analysis. Shorter timeframes (1m-15m) are more volatile, longer timeframes (1h-1d) are more stable. The bot analyzes price action on this timeframe." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Leverage
                    <HelpTooltip text="Multiplier for your trading position. Higher leverage = higher potential profit but also higher risk. Only applies to futures trading. Use lower leverage (1x-5x) for safer trading." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Risk Level
                    <HelpTooltip text="Controls how aggressive the bot's trading strategy is. Low = conservative (fewer trades, safer), Medium = balanced, High = aggressive (more trades, higher risk/reward)." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Trade Amount (USD)
                    <HelpTooltip text="Base amount in USD for each trade. This will be multiplied by leverage (for futures) and adjusted by risk level. Minimum: $10, Maximum: $10,000." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Stop Loss (%)
                    <HelpTooltip text="Maximum loss percentage before the bot automatically closes the position. Protects against large losses. Recommended: 1-3% for conservative, 2-5% for moderate risk." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Take Profit (%)
                    <HelpTooltip text="Target profit percentage before the bot automatically closes the position to secure gains. Recommended: 2-4% for conservative, 4-8% for moderate risk." />
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

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 flex items-center">
                      Cooldown (Bars)
                      <HelpTooltip text="Number of bars (candles) to wait between trades. Prevents overtrading and reduces risk. Higher values = fewer trades but more selective entries." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Allowed Trading Hours (EST)
                    <HelpTooltip text="Select specific hours when the bot is allowed to trade. Useful for avoiding low-liquidity periods or specific market sessions. Times are displayed in EST but stored in UTC." />
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-48 overflow-y-auto">
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={(advancedConfig.allowed_hours_utc || []).length === 24}
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
                        const isSelected = (advancedConfig.allowed_hours_utc || []).includes(i);
                        return (
                          <label key={i} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAdvancedConfig(prev => ({
                                    ...prev,
                                    allowed_hours_utc: [...(prev.allowed_hours_utc || []), i].sort((a, b) => a - b),
                                    session_filter_enabled: true
                                  }));
                                } else {
                                  setAdvancedConfig(prev => ({
                                    ...prev,
                                    allowed_hours_utc: (prev.allowed_hours_utc || []).filter(h => h !== i),
                                    session_filter_enabled: (prev.allowed_hours_utc || []).filter(h => h !== i).length > 0
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

            {/* Paper Trading Toggle */}
            <Card className="p-6 bg-yellow-50 border-2 border-yellow-200">
              <div className="flex items-start mb-2">
                <input
                  type="checkbox"
                  id="paperTrading"
                  checked={formData.paperTrading}
                  onChange={(e) => setFormData(prev => ({ ...prev, paperTrading: e.target.checked }))}
                  className="mr-3 h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded mt-1"
                />
                <div className="flex-1">
                  <label htmlFor="paperTrading" className="text-lg font-semibold text-gray-900 cursor-pointer">
                    📝 Enable Paper Trading (Simulation Mode)
                  </label>
                  <p className="text-sm text-gray-700 mt-1">
                    Uses REAL mainnet market data but simulates all trades. Perfect for testing strategies risk-free.
                    No real orders will be placed when this is enabled.
                  </p>
                  {formData.paperTrading && (
                    <div className="mt-3 p-3 bg-white rounded border border-yellow-300">
                      <p className="text-xs text-green-600 font-medium mb-2">
                        ✅ Paper Trading Enabled - All trades will be simulated
                      </p>
                      <p className="text-xs text-gray-600">
                        • Uses real mainnet market data for accuracy<br/>
                        • Virtual balance: $10,000 (can be adjusted in settings)<br/>
                        • No real API orders will be placed<br/>
                        • Perfect for strategy testing
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Strategy Configuration */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Strategy Parameters</h2>
              <div className="mb-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2 text-sm md:text-base">
                      <i className="ri-brain-line"></i>
                      AI Strategy Presets
                    </h3>
                    <span className="hidden md:block text-xs text-purple-700">
                      Apply vetted AI configurations in one click
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
                    Presets automatically tune core indicators, risk controls, and recommended trade sizing.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    RSI Threshold
                    <HelpTooltip text="Relative Strength Index threshold for overbought/oversold conditions. Higher values (70-90) = more conservative entries, lower values (30-50) = more aggressive." />
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    ADX Threshold
                    <HelpTooltip text="Average Directional Index threshold for trend strength. Higher values (25-50) = only trade in strong trends, lower values (10-20) = trade in weaker trends too." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    BB Width Threshold
                    <HelpTooltip text="Bollinger Bands width threshold for volatility. Lower values (0.01-0.02) = trade in low volatility, higher values (0.03-0.1) = trade in high volatility." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    EMA Slope
                    <HelpTooltip text="Exponential Moving Average slope threshold. Higher values = require steeper trend slope for entry. Controls trend strength requirement." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    ATR Percentage
                    <HelpTooltip text="Average True Range percentage for stop loss and position sizing. Higher values = wider stops (safer but less precise), lower values = tighter stops (riskier but more precise)." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    VWAP Distance
                    <HelpTooltip text="Volume Weighted Average Price distance threshold. How far price must be from VWAP to trigger a trade. Higher values = require larger price deviation." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Momentum Threshold
                    <HelpTooltip text="Momentum indicator threshold for entry signals. Higher values = require stronger momentum, lower values = trade on weaker momentum. Controls entry aggressiveness." />
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
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    Min Samples for ML
                    <HelpTooltip text="Minimum number of data samples required before Machine Learning predictions are used. Until this threshold is met, the bot uses rule-based strategy. Higher values = more conservative ML usage." />
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
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    Enable ML Prediction (fallback to rules until min samples)
                    <HelpTooltip text="Enable Machine Learning predictions for trade signals. The bot will use rule-based strategy until it collects enough data samples, then switch to ML predictions for better accuracy." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          Bias Mode
                          <HelpTooltip text="Directional bias for trading. Auto: Follow higher timeframe trend. Long Only: Only buy/long positions. Short Only: Only sell/short positions. Both: Trade in both directions." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          HTF Timeframe
                          <HelpTooltip text="Higher Timeframe for trend analysis. The bot uses this timeframe to determine the overall market trend direction. Higher timeframes (4h, 1d) show stronger trends, lower timeframes (1h, 2h) are more sensitive." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          HTF Trend Indicator
                          <HelpTooltip text="Technical indicator used to determine trend direction on the higher timeframe. EMA: Exponential Moving Average (smooth trend). SMA: Simple Moving Average (classic trend). ADX: Average Directional Index (trend strength)." />
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
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700 flex items-center">
                            ADX Min (HTF): {advancedConfig.adx_min_htf}
                            <HelpTooltip text="Minimum ADX (Average Directional Index) value required on the higher timeframe to confirm a strong trend. Higher values (28-35) = only very strong trends, lower values (15-20) = weaker trends allowed. ADX measures trend strength, not direction." />
                          </label>
                          <div className="flex items-center">
                            <span className={`text-xs mr-2 ${(advancedConfig as any).disable_htf_adx_check ? 'text-green-600' : 'text-gray-400'}`}>
                              {(advancedConfig as any).disable_htf_adx_check ? 'DISABLED' : 'ENABLED'}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(advancedConfig as any).disable_htf_adx_check || false}
                                onChange={(e) => {
                                  setAdvancedConfig(prev => ({
                                    ...prev,
                                    disable_htf_adx_check: e.target.checked
                                  } as any));
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            </label>
                          </div>
                        </div>
                        {!(advancedConfig as any).disable_htf_adx_check && (
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
                        {(advancedConfig as any).disable_htf_adx_check && (
                          <p className="text-xs text-red-600 italic mt-1">
                            HTF ADX check disabled - bot will trade regardless of HTF ADX value
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Indicator Settings */}
                  <div className="border-l-4 border-indigo-500 pl-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">📐 Indicator Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          EMA Length
                          <HelpTooltip text="Exponential Moving Average period length. Lower values (20-50) = more sensitive to price changes, higher values (100-200) = smoother, less reactive. Used to identify trend direction and momentum." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          ATR Length
                          <HelpTooltip text="Average True Range period for volatility calculation. Lower values (7-14) = more sensitive to recent volatility, higher values (20-30) = smoother volatility measure. ATR is used for dynamic stop loss and position sizing." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          ATR TP Multiplier
                          <HelpTooltip text="ATR multiplier for take profit distance. Higher values (3-5) = wider take profit targets (more room for price movement), lower values (1-2) = tighter targets (quicker exits). Multiplied by ATR to set dynamic take profit levels." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          ATR SL Multiplier
                          <HelpTooltip text="ATR multiplier for stop loss distance. Higher values (1.5-2.5) = wider stops (less likely to be hit by noise), lower values (0.8-1.2) = tighter stops (more precise but riskier). Multiplied by ATR to set dynamic stop loss levels." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          RSI Length
                          <HelpTooltip text="RSI (Relative Strength Index) calculation period. Lower values (7-10) = more sensitive, reacts faster to price changes. Higher values (20-30) = smoother, less reactive. Standard is 14. Used to identify overbought/oversold conditions." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          RSI Overbought
                          <HelpTooltip text="RSI threshold for overbought condition. When RSI exceeds this value, the asset is considered overbought (potentially overvalued). Higher values (75-90) = more conservative, lower values (60-70) = more aggressive. Standard is 70." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          RSI Oversold
                          <HelpTooltip text="RSI threshold for oversold condition. When RSI falls below this value, the asset is considered oversold (potentially undervalued). Lower values (20-25) = more conservative, higher values (30-40) = more aggressive. Standard is 30." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          Regime Mode
                          <HelpTooltip text="Market regime filter. Auto Detect: Trade in both trending and ranging markets. Trend Only: Only trade when market is trending (strong directional movement). Mean Reversion Only: Only trade when market is ranging (price bouncing between levels)." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          ADX Trend Min: {advancedConfig.adx_trend_min}
                          <HelpTooltip text="Minimum ADX value to consider market as trending. When ADX is above this value, the market is in a trending regime. Higher values (28-35) = only very strong trends, lower values (20-25) = weaker trends allowed. Used with Regime Mode." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          ADX Mean Rev Max: {advancedConfig.adx_meanrev_max}
                          <HelpTooltip text="Maximum ADX value to consider market as ranging (mean reversion). When ADX is below this value, the market is in a ranging regime. Lower values (12-15) = stricter ranging filter, higher values (18-25) = more lenient. Used with Regime Mode." />
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
                          max="2.0"
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
                        <p className="text-xs text-gray-500">Auto-pause if weekly loss exceeds</p>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          Max Consecutive Losses: {advancedConfig.max_consecutive_losses || 5}
                          <HelpTooltip text="Maximum number of consecutive losing trades before bot automatically pauses. Lower values (2-3) = strict protection, stops quickly after losses. Higher values (5-10) = more lenient, allows more losses before stopping. Helps prevent extended losing streaks." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          TP1 (R): {advancedConfig.tp1_r}
                          <HelpTooltip text="First take profit target in Risk:Reward ratio (R). If R = 1.5, profit target is 1.5x the stop loss distance. Higher values (2-3R) = better risk:reward but harder to reach, lower values (0.5-1R) = easier to hit but lower reward. Example: If stop loss is $10, TP1 at 1.5R = $15 profit target." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          TP2 (R): {advancedConfig.tp2_r}
                          <HelpTooltip text="Second take profit target in Risk:Reward ratio (R). This is the extended profit target for the remaining position after TP1 is hit. Higher values (3-5R) = maximize profits on strong trends, lower values (1.5-2R) = more conservative. Only applies to the portion of position not closed at TP1." />
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
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                          TP1 Size: {(advancedConfig.tp1_size * 100).toFixed(0)}%
                          <HelpTooltip text="Percentage of position to close when first take profit (TP1) is reached. Higher values (60-75%) = lock in more profits early, lower values (25-40%) = let more position ride to TP2. Example: 70% means close 70% of position at TP1, let remaining 30% go to TP2." />
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
                              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                Trailing TP Distance (ATR Multiplier): {advancedConfig.trailing_take_profit_atr || 1.0}
                                <HelpTooltip text="Distance from the highest equity point to the trailing stop, measured in ATR multiples. Higher values (2-3) = wider trailing stop (less likely to be hit), lower values (0.5-1) = tighter trailing stop (protects profits faster). As equity reaches new highs, the trailing stop moves up automatically." />
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
                              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                Retracement Trigger (%): {advancedConfig.smart_exit_retracement_pct || 2.0}%
                                <HelpTooltip text="Percentage retracement from the highest equity point that triggers an immediate exit. Lower values (0.5-1%) = exit quickly on small reversals, higher values (3-5%) = allow more retracement before exiting. Protects profits by exiting when market reverses beyond your threshold." />
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
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                              Minimum Trades Before Display: {advancedConfig.pair_win_rate_min_trades || 3}
                              <HelpTooltip text="Minimum number of trades required per trading pair before displaying win rate statistics. Prevents misleading statistics when there are too few trades. Higher values (5-10) = more reliable stats, lower values (1-3) = show stats earlier but may be less accurate." />
                            </label>
                            <input
                              type="range"
                              value={advancedConfig.pair_win_rate_min_trades || 3}
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
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                              Update Frequency
                              <HelpTooltip text="How often to recalculate and update win rate statistics for each trading pair. Real-Time: Updates immediately when each trade closes (most accurate). On Close: Updates when position closes. Periodic: Updates every 5 minutes (less frequent, saves resources)." />
                            </label>
                            <select
                              value={advancedConfig.pair_win_rate_update_frequency || 'realtime'}
                              onChange={(e) => setAdvancedConfig(prev => ({ ...prev, pair_win_rate_update_frequency: e.target.value } as any))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            >
                              <option value="realtime">Real-Time (Update on every trade close)</option>
                              <option value="on_close">On Close (Update when position closes)</option>
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

