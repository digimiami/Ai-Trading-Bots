
export interface TradingBot {
  id: string;
  name: string;
  exchange: 'bybit' | 'okx';
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
  htf_timeframe: '4h' | '1d' | '1h' | '15m';
  htf_trend_indicator: 'EMA200' | 'SMA200' | 'Supertrend';
  ema_fast_period: number;
  require_price_vs_trend: 'above' | 'below' | 'any';
  adx_min_htf: number;
  require_adx_rising: boolean;
  
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
  
  // ML/AI Settings
  use_ml_prediction?: boolean;
  ml_confidence_threshold?: number;
  ml_min_samples?: number;
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
