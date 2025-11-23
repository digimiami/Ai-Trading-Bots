
export interface TradingBot {
  id: string;
  name: string;
  exchange: 'bybit' | 'okx' | 'bitunix';
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
    | '15m'
    | '30m'
    | '1h'
    | '2h'
    | '4h'
    | '6h'
    | '12h'
    | '1d'
    | '1w';
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
}

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
  exchange: 'bybit' | 'okx';
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
  testnet: boolean;
  maxPositions: number;
  dailyLossLimit: number;
  slippageThreshold: number;
}
