import type { AdvancedStrategyConfig } from '../types/trading';

export const HTF_TIMEFRAME_OPTIONS: Array<{
  value: AdvancedStrategyConfig['htf_timeframe'];
  label: string;
}> = [
  { value: '1m', label: '1 Minute (Ultra Aggressive)' },
  { value: '3m', label: '3 Minutes (Very Aggressive)' },
  { value: '5m', label: '5 Minutes (Aggressive)' },
  { value: '15m', label: '15 Minutes (Fast)' },
  { value: '30m', label: '30 Minutes (Fast HTF)' },
  { value: '45m', label: '45 Minutes (Quick)' },
  { value: '1h', label: '1 Hour (Short-Term Bias)' },
  { value: '2h', label: '2 Hours (Balanced)' },
  { value: '3h', label: '3 Hours (Medium)' },
  { value: '4h', label: '4 Hours (Swing Standard)' },
  { value: '5h', label: '5 Hours (Extended)' },
  { value: '6h', label: '6 Hours (Smoother Swing)' },
  { value: '7h', label: '7 Hours (Extended Swing)' },
  { value: '8h', label: '8 Hours (Long Swing)' },
  { value: '9h', label: '9 Hours (Very Long Swing)' },
  { value: '10h', label: '10 Hours (Extended Long)' },
  { value: '12h', label: '12 Hours (Daily Proxy)' },
  { value: '1d', label: '1 Day (Macro Bias)' },
  { value: '1w', label: '1 Week (Long-Term)' },
  { value: '1M', label: '1 Month (Ultra Long-Term)' }
];

export const HTF_TREND_INDICATOR_OPTIONS: Array<{
  value: AdvancedStrategyConfig['htf_trend_indicator'];
  label: string;
}> = [
  { value: 'EMA50', label: 'EMA 50 (Fast, reacts quickly to reversals)' },
  { value: 'EMA100', label: 'EMA 100 (Medium-term trend)' },
  { value: 'EMA200', label: 'EMA 200 (Long-term macro trend)' },
  { value: 'SMA50', label: 'SMA 50 (Smoother EMA 50 alternative)' },
  { value: 'SMA200', label: 'SMA 200 (Classic bull/bear filter)' },
  { value: 'MA_CROSSOVER_50_200', label: 'MA Crossover 50/200 (Golden Cross)' },
  { value: 'Supertrend', label: 'Supertrend (10,3)' },
  { value: 'DonchianChannel20', label: 'Donchian Channel (20 High/Low)' },
  { value: 'KeltnerChannelMidline', label: 'Keltner Channel Midline' },
  { value: 'BollingerBasis20SMA', label: 'Bollinger Band Basis (20 SMA)' },
  { value: 'HullMA55', label: 'Hull MA (HMA 55)' },
  { value: 'HullMA100', label: 'Hull MA (HMA 100)' },
  { value: 'VWAP', label: 'VWAP (Session/Daily)' },
  { value: 'GChannelBaseline', label: 'G-Channel Baseline' },
  { value: 'MACDZeroLine', label: 'MACD Zero-Line' },
  { value: 'RSI50Baseline', label: 'RSI Baseline (50)' },
  { value: 'HeikinAshiTrend', label: 'Heikin-Ashi Trend' },
  { value: 'IchimokuKumoTrend', label: 'Ichimoku Kumo Trend' }
];

