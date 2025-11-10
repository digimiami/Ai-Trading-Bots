import type { AdvancedStrategyConfig, TradingStrategy } from '../types/trading'

export interface StrategyPreset {
  key: string
  label: string
  description: string
  strategy: TradingStrategy
  advanced: AdvancedStrategyConfig
  recommendedTradeAmount?: number
  recommendedStopLoss?: number
  recommendedTakeProfit?: number
  recommendedRiskLevel?: 'low' | 'medium' | 'high'
}

const fullSessionHours = Array.from({ length: 24 }, (_, hour) => hour)

export const AI_COMBO_STRATEGY: TradingStrategy = {
  rsiThreshold: 68,
  adxThreshold: 26,
  bbWidthThreshold: 0.018,
  emaSlope: 0.65,
  atrPercentage: 2.2,
  vwapDistance: 1.05,
  momentumThreshold: 0.9,
  useMLPrediction: true,
  minSamplesForML: 120
}

export const AI_COMBO_ADVANCED: AdvancedStrategyConfig = {
  bias_mode: 'auto',
  htf_timeframe: '4h',
  htf_trend_indicator: 'EMA200',
  ema_fast_period: 34,
  require_price_vs_trend: 'any',
  adx_min_htf: 24,
  require_adx_rising: true,
  regime_mode: 'auto',
  adx_trend_min: 26,
  adx_meanrev_max: 18,
  session_filter_enabled: false,
  allowed_hours_utc: fullSessionHours,
  cooldown_bars: 6,
  atr_percentile_min: 18,
  bb_width_min: 0.012,
  bb_width_max: 0.032,
  min_24h_volume_usd: 400_000_000,
  max_spread_bps: 4,
  risk_per_trade_pct: 0.75,
  daily_loss_limit_pct: 3.0,
  weekly_loss_limit_pct: 6.0,
  max_trades_per_day: 10,
  max_concurrent: 2,
  max_consecutive_losses: 4,
  sl_atr_mult: 1.35,
  tp1_r: 1.0,
  tp2_r: 2.2,
  tp1_size: 0.55,
  breakeven_at_r: 0.9,
  trail_after_tp1_atr: 1.1,
  time_stop_hours: 36,
  rsi_period: 14,
  rsi_oversold: 32,
  rsi_overbought: 68,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  bb_period: 20,
  bb_stddev: 2,
  atr_period: 14,
  atr_tp_multiplier: 3,
  use_ml_prediction: true,
  ml_confidence_threshold: 0.65,
  ml_min_samples: 120
}

export const AI_COMBO_PRESET: StrategyPreset = {
  key: 'ai_combo',
  label: 'AI Combo',
  description: 'Hybrid trend + mean reversion template enhanced with ML confidence filters.',
  strategy: AI_COMBO_STRATEGY,
  advanced: AI_COMBO_ADVANCED,
  recommendedTradeAmount: 150,
  recommendedStopLoss: 2.5,
  recommendedTakeProfit: 5.0,
  recommendedRiskLevel: 'medium'
}

export const STRATEGY_PRESETS: StrategyPreset[] = [AI_COMBO_PRESET]




