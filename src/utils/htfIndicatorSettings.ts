import type { AdvancedStrategyConfig } from '../types/trading';

/**
 * Auto-adjusts strategy settings based on the selected HTF Trend Indicator
 * Different indicators work optimally with different timeframes, ADX thresholds, and other settings
 */
export function getOptimizedSettingsForIndicator(
  indicator: AdvancedStrategyConfig['htf_trend_indicator'],
  currentConfig: Partial<AdvancedStrategyConfig>
): Partial<AdvancedStrategyConfig> {
  const optimized: Partial<AdvancedStrategyConfig> = {};

  switch (indicator) {
    case 'Supertrend':
      // Supertrend works well for scalping and swing trading
      // Use shorter HTF for scalping, longer for swing
      optimized.htf_timeframe = currentConfig.htf_timeframe === '30m' || currentConfig.htf_timeframe === '1h' 
        ? '30m' 
        : '4h';
      optimized.adx_min_htf = 20; // Lower threshold for Supertrend (it's already a trend filter)
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'EMA50':
    case 'SMA50':
      // Fast moving averages - more responsive, need lower ADX
      optimized.htf_timeframe = '2h'; // Shorter timeframe for faster indicators
      optimized.adx_min_htf = 20; // Lower threshold for faster indicators
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'EMA100':
    case 'HullMA55':
      // Medium-term indicators
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 22;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'EMA200':
    case 'SMA200':
      // Standard long-term trend indicators - default settings
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 23;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'MA_CROSSOVER_50_200':
      // Golden Cross - needs both EMAs
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 23;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50; // Fast EMA for crossover
      optimized.require_price_vs_trend = 'any';
      break;

    case 'VWAP':
      // VWAP is session-based, works better with daily timeframe
      optimized.htf_timeframe = '1d';
      optimized.adx_min_htf = 20; // VWAP itself provides trend, lower ADX needed
      optimized.require_adx_rising = false; // VWAP doesn't need rising ADX
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'DonchianChannel20':
    case 'KeltnerChannelMidline':
    case 'BollingerBasis20SMA':
    case 'GChannelBaseline':
      // Channel-based indicators - work well with standard settings
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 22;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'HullMA100':
      // Longer-term Hull MA
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 23;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'MACDZeroLine':
      // MACD - momentum-based, can work with lower ADX
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 20;
      optimized.require_adx_rising = false; // MACD provides momentum, ADX rising less critical
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'RSI50Baseline':
      // RSI-based - momentum indicator
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 20;
      optimized.require_adx_rising = false;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    case 'HeikinAshiTrend':
    case 'IchimokuKumoTrend':
      // Advanced trend indicators - use standard settings
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 23;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
      break;

    default:
      // Default settings for unknown indicators
      optimized.htf_timeframe = '4h';
      optimized.adx_min_htf = 23;
      optimized.require_adx_rising = true;
      optimized.ema_fast_period = 50;
      optimized.require_price_vs_trend = 'any';
  }

  return optimized;
}
