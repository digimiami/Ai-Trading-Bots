
export interface TradingBot {
  id: string;
  name: string;
  exchange: 'bybit' | 'okx' | 'bitunix' | 'btcc';
  tradingType: 'spot' | 'futures';
  symbol: string;
  status: 'active' | 'paused' | 'stopped' | 'running';
  leverage: number;
  pnl: number;
  pnlPercentage: number;
  totalTrades: number;
  winRate: number;
  createdAt: string;
  lastTradeAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
  strategy: TradingStrategy;
  strategyConfig?: AdvancedStrategyConfig;
  aiMlEnabled?: boolean;
  tradeAmount?: number;
  stopLoss?: number;
  takeProfit?: number;
  paperTrading?: boolean; // Paper trading mode toggle
  winTrades?: number;
  lossTrades?: number;
  closedTrades?: number;
  realizedPnl?: number;
  webhookSecret?: string;
  webhookTriggerImmediate?: boolean;
  symbols?: string[]; // Array of trading pairs for multi-pair bots
  customPairs?: string; // Raw user input for custom pairs
  soundNotificationsEnabled?: boolean; // Enable/disable sound notifications for real trades
  timeframe?: string; // Trading timeframe
  /** Set when bot is paused by safety/risk (e.g. daily loss limit, max trades) */
  pauseReason?: string | null;
}

export interface TradingStrategy {
  rsiThreshold: number;
  adxThreshold: number;
  bbWidthThreshold: number;
  emaSlope: number;
  atrPercentage: number;
  vwapDistance: number;
  momentumThreshold: number;
  useMLPrediction: boolean;
  minSamplesForML: number;
}

export interface AdvancedStrategyConfig {
  // Directional Bias
  bias_mode: 'long-only' | 'short-only' | 'both' | 'auto';
  htf_timeframe:
    | '1m'
    | '3m'
    | '5m'
    | '15m'
    | '30m'
    | '45m'
    | '1h'
    | '2h'
    | '3h'
    | '4h'
    | '5h'
    | '6h'
    | '7h'
    | '8h'
    | '9h'
    | '10h'
    | '12h'
    | '1d'
    | '1w'
    | '1M';
  htf_trend_indicator:
    | 'EMA50'
    | 'EMA100'
    | 'EMA200'
    | 'SMA50'
    | 'SMA200'
    | 'MA_CROSSOVER_50_200'
    | 'Supertrend'
    | 'DonchianChannel20'
    | 'KeltnerChannelMidline'
    | 'BollingerBasis20SMA'
    | 'HullMA55'
    | 'HullMA100'
    | 'VWAP'
    | 'GChannelBaseline'
    | 'MACDZeroLine'
    | 'RSI50Baseline'
    | 'HeikinAshiTrend'
    | 'IchimokuKumoTrend';
  ema_fast_period: number;
  require_price_vs_trend: 'above' | 'below' | 'any';
  adx_min_htf: number;
  require_adx_rising: boolean;
  disable_htf_adx_check?: boolean; // Flag to bypass HTF ADX check
  
  // Regime Filter
  regime_mode: 'trend' | 'mean-reversion' | 'auto';
  adx_trend_min: number;
  adx_meanrev_max: number;
  
  // Session/Timing
  session_filter_enabled: boolean;
  allowed_hours_utc: number[];
  cooldown_bars: number;
  
  // Volatility/Liquidity Gates
  atr_percentile_min: number;
  bb_width_min: number;
  bb_width_max: number;
  min_24h_volume_usd: number;
  max_spread_bps: number;
  
  // Risk & Exits
  risk_per_trade_pct: number;
  daily_loss_limit_pct: number;
  weekly_loss_limit_pct: number;
  max_trades_per_day: number;
  max_concurrent: number;
  max_consecutive_losses?: number; // Safety feature: max consecutive losses before auto-pause
  sl_atr_mult: number;
  tp1_r: number;
  tp2_r: number;
  tp1_size: number;
  breakeven_at_r: number;
  trail_after_tp1_atr: number;
  time_stop_hours: number;
  
  // Technical Indicators
  rsi_period?: number;
  rsi_oversold?: number;
  rsi_overbought?: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  bb_period?: number;
  bb_stddev?: number;
  atr_period?: number;
  atr_tp_multiplier?: number;
  
  // ML/AI Settings
  use_ml_prediction?: boolean;
  ml_confidence_threshold?: number;
  ml_min_samples?: number;
  
  // Advanced Exit & Trailing Features
  enable_dynamic_trailing?: boolean; // Dynamic upward trailing based on historical highest equity
  enable_automatic_execution?: boolean; // Close all positions at market price once triggered
  enable_trailing_take_profit?: boolean; // Lock in profits as equity reaches new highs
  trailing_take_profit_atr?: number; // ATR multiplier for trailing TP
  smart_exit_enabled?: boolean; // Exit trades if market retraces beyond preset percentage
  smart_exit_retracement_pct?: number; // Percentage retracement to trigger smart exit (e.g., 2.0 = 2%)
  early_take_profit_pct?: number; // Take profit sooner: close when unrealized profit reaches this % (e.g. 5 or 10). 0 = off.
  enable_slippage_consideration?: boolean; // Show slippage warnings
  strategy_integration?: string[]; // Array of strategy types to integrate (e.g., ['spot_grid', 'futures_grid', 'futures_combo'])
  
  // Pair-Based Win Rate Calculation
  enable_pair_win_rate?: boolean; // Enable real-time win rate calculation per trading pair
  pair_win_rate_min_trades?: number; // Minimum trades required before showing pair win rate (default: 3)
  pair_win_rate_update_frequency?: 'realtime' | 'on_close' | 'periodic'; // How often to update (default: 'realtime')
  
  // Always Trade Mode
  always_trade?: boolean; // Trade on every execution cycle regardless of conditions

  // Adaptive Risk Engine / Execution / Learning
  risk_engine?: {
    volatility_low?: number;
    volatility_high?: number;
    high_volatility_multiplier?: number;
    low_volatility_multiplier?: number;
    max_spread_bps?: number;
    spread_penalty_multiplier?: number;
    low_liquidity_multiplier?: number;
    medium_liquidity_multiplier?: number;
    drawdown_moderate?: number;
    drawdown_severe?: number;
    moderate_drawdown_multiplier?: number;
    severe_drawdown_multiplier?: number;
    loss_streak_threshold?: number;
    loss_streak_step?: number;
    min_size_multiplier?: number;
    max_size_multiplier?: number;
    max_slippage_bps?: number;
    min_execution_size_multiplier?: number;
    limit_spread_bps?: number;
    signal_learning_rate?: number;
    min_signal_weight?: number;
    max_signal_weight?: number;
  };
  signal_weights?: {
    global?: Record<string, number>;
    by_symbol_timeframe?: Record<string, Record<string, number>>;
  };
}

/** Default risk engine parameters used when strategy_config.risk_engine is missing or partial. */
export const DEFAULT_RISK_ENGINE: NonNullable<AdvancedStrategyConfig['risk_engine']> = {
  volatility_low: 0.6,
  volatility_high: 2.5,
  high_volatility_multiplier: 0.75,
  low_volatility_multiplier: 1.05,
  max_spread_bps: 20,
  spread_penalty_multiplier: 0.75,
  low_liquidity_multiplier: 0.6,
  medium_liquidity_multiplier: 0.8,
  drawdown_moderate: 10,
  drawdown_severe: 20,
  moderate_drawdown_multiplier: 0.8,
  severe_drawdown_multiplier: 0.6,
  loss_streak_threshold: 3,
  loss_streak_step: 0.15,
  min_size_multiplier: 0.35,
  max_size_multiplier: 1.5,
  max_slippage_bps: 25,
  min_execution_size_multiplier: 0.35,
  limit_spread_bps: 8,
  signal_learning_rate: 0.05,
  min_signal_weight: 0.6,
  max_signal_weight: 1.4
};

/** Default advanced strategy config for new bots and Pablo Ready merge. */
export const DEFAULT_ADVANCED_STRATEGY_CONFIG: AdvancedStrategyConfig = {
  bias_mode: 'auto',
  regime_mode: 'trend',
  htf_timeframe: '4h',
  htf_trend_indicator: 'EMA200',
  ema_fast_period: 50,
  require_price_vs_trend: 'any',
  adx_min_htf: 23,
  require_adx_rising: true,
  adx_trend_min: 25,
  adx_meanrev_max: 19,
  session_filter_enabled: false,
  allowed_hours_utc: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  cooldown_bars: 8,
  atr_percentile_min: 30,
  bb_width_min: 0.012,
  bb_width_max: 0.03,
  min_24h_volume_usd: 500000000,
  max_spread_bps: 3,
  risk_per_trade_pct: 0.5,
  daily_loss_limit_pct: 1.5,
  weekly_loss_limit_pct: 4.0,
  max_trades_per_day: 4,
  max_concurrent: 1,
  max_consecutive_losses: 2,
  sl_atr_mult: 1.2,
  tp1_r: 1.5,
  tp2_r: 3.0,
  tp1_size: 0.7,
  breakeven_at_r: 0.5,
  trail_after_tp1_atr: 0.6,
  time_stop_hours: 12,
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  atr_period: 14,
  atr_tp_multiplier: 3,
  use_ml_prediction: true,
  ml_confidence_threshold: 0.70,
  ml_min_samples: 100,
  enable_dynamic_trailing: false,
  enable_automatic_execution: false,
  enable_trailing_take_profit: false,
  trailing_take_profit_atr: 1.0,
  smart_exit_enabled: false,
  smart_exit_retracement_pct: 2.0,
  early_take_profit_pct: 0,
  enable_slippage_consideration: true,
  strategy_integration: [],
  enable_pair_win_rate: false,
  pair_win_rate_min_trades: 3,
  pair_win_rate_update_frequency: 'realtime',
  enable_auto_rebalancing: false,
  enable_funding_rate_filter: false,
  enable_volatility_pause: false,
  risk_engine: DEFAULT_RISK_ENGINE
};

export interface ManualTradeSignal {
  id: string;
  bot_id: string;
  user_id?: string;
  mode: 'real' | 'paper';
  side: 'buy' | 'sell' | 'long' | 'short';
  size_multiplier?: number | null;
  reason?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface Trade {
  id: string;
  botId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  status: 'open' | 'closed';
  timestamp: string;
  exchange: 'bybit' | 'okx' | 'btcc';
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  rsi: number;
  adx: number;
  bbWidth: number;
  emaSlope: number;
  atrPercentage: number;
  vwapDistance: number;
  momentum: number;
}

export interface ExchangeConfig {
  apiKey: string;
  apiSecret: string;
  maxPositions: number;
  dailyLossLimit: number;
  slippageThreshold: number;
}
