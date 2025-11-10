/**
 * Strategy Configuration Validator
 * Validates and clamps advanced strategy config values to valid ranges
 */

import type { AdvancedStrategyConfig } from '../types/trading';

interface ValidationRange {
  min: number;
  max: number;
}

const VALIDATION_RANGES: Record<string, ValidationRange> = {
  adx_min_htf: { min: 15, max: 35 },
  adx_trend_min: { min: 15, max: 50 },
  adx_meanrev_max: { min: 10, max: 25 },
  risk_per_trade_pct: { min: 0.1, max: 5.0 },
  daily_loss_limit_pct: { min: 0.5, max: 10.0 },
  weekly_loss_limit_pct: { min: 1.0, max: 20.0 },
  max_trades_per_day: { min: 1, max: 200 },
  max_concurrent: { min: 1, max: 10 },
  sl_atr_mult: { min: 0.5, max: 5.0 },
  tp1_r: { min: 0.5, max: 10.0 },
  tp2_r: { min: 1.0, max: 20.0 },
  tp1_size: { min: 0.1, max: 1.0 },
  breakeven_at_r: { min: 0.1, max: 2.0 },
  trail_after_tp1_atr: { min: 0.1, max: 5.0 },
  time_stop_hours: { min: 1, max: 168 }, // 1 hour to 1 week
  rsi_period: { min: 5, max: 50 },
  rsi_oversold: { min: 0, max: 50 },
  rsi_overbought: { min: 50, max: 100 },
  ema_fast_period: { min: 5, max: 200 },
  atr_percentile_min: { min: 0, max: 100 },
  bb_width_min: { min: 0, max: 0.1 },
  bb_width_max: { min: 0, max: 0.2 },
  max_spread_bps: { min: 0, max: 100 },
  cooldown_bars: { min: 1, max: 100 },
  atr_period: { min: 1, max: 200 },
  atr_tp_multiplier: { min: 0.5, max: 10 },
};

const VALID_ENUMS: Record<string, string[]> = {
  bias_mode: ['long-only', 'short-only', 'both', 'auto'],
  htf_timeframe: ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'],
  htf_trend_indicator: [
    'EMA50',
    'EMA100',
    'EMA200',
    'SMA50',
    'SMA200',
    'MA_CROSSOVER_50_200',
    'Supertrend',
    'DonchianChannel20',
    'KeltnerChannelMidline',
    'BollingerBasis20SMA',
    'HullMA55',
    'HullMA100',
    'VWAP',
    'GChannelBaseline',
    'MACDZeroLine',
    'RSI50Baseline',
    'HeikinAshiTrend',
    'IchimokuKumoTrend'
  ],
  require_price_vs_trend: ['above', 'below', 'any'],
  regime_mode: ['trend', 'mean-reversion', 'auto'],
};

/**
 * Validate and clamp advanced strategy configuration values
 */
export function validateAndClampStrategyConfig(
  config: Partial<AdvancedStrategyConfig>
): Partial<AdvancedStrategyConfig> {
  const validated: any = { ...config };

  // Validate and clamp numeric values
  for (const [key, range] of Object.entries(VALIDATION_RANGES)) {
    if (key in validated && typeof validated[key] === 'number') {
      validated[key] = Math.max(range.min, Math.min(range.max, validated[key]));
    }
  }

  // Validate enum values
  for (const [key, validValues] of Object.entries(VALID_ENUMS)) {
    if (key in validated && !validValues.includes(validated[key])) {
      // Set to first valid value as default
      console.warn(`Invalid ${key}: ${validated[key]}. Setting to default: ${validValues[0]}`);
      validated[key] = validValues[0];
    }
  }

  // Ensure allowed_hours_utc is valid array of numbers 0-23
  if (validated.allowed_hours_utc && Array.isArray(validated.allowed_hours_utc)) {
    validated.allowed_hours_utc = validated.allowed_hours_utc
      .filter((h: any) => typeof h === 'number' && h >= 0 && h <= 23)
      .slice(0, 24); // Max 24 hours
  }

  return validated;
}

/**
 * Validate a single numeric value against its range
 */
export function clampValue(key: string, value: number): number {
  const range = VALIDATION_RANGES[key];
  if (!range) return value;
  return Math.max(range.min, Math.min(range.max, value));
}

