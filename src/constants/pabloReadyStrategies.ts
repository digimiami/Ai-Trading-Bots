/**
 * Built-in Pablo Ready strategies: activate and trade on the same page.
 * User picks: pair, leverage, trade amount, TP/SL, timeframe → Activate.
 */
import type { AdvancedStrategyConfig, TradingStrategy } from '../types/trading';
import { DEFAULT_ADVANCED_STRATEGY_CONFIG } from '../types/trading';

const fullSessionHours = Array.from({ length: 24 }, (_, i) => i);

function baseAdvanced(): AdvancedStrategyConfig {
  return { ...DEFAULT_ADVANCED_STRATEGY_CONFIG };
}

const baseStrategy: TradingStrategy = {
  rsiThreshold: 65,
  adxThreshold: 24,
  bbWidthThreshold: 0.02,
  emaSlope: 0.6,
  atrPercentage: 2,
  vwapDistance: 1,
  momentumThreshold: 0.85,
  useMLPrediction: true,
  minSamplesForML: 100
};

export interface PabloReadyStrategyPreset {
  key: string;
  label: string;
  description: string;
  strategy: TradingStrategy;
  advanced: AdvancedStrategyConfig;
  defaultTimeframe: string;
  defaultLeverage: number;
  defaultTradeAmount: number;
  defaultStopLoss: number;
  defaultTakeProfit: number;
}

/** Mean Reversion: trade reversals in range; lower ADX, RSI extremes */
export const MEAN_REVERSION: PabloReadyStrategyPreset = {
  key: 'mean_reversion',
  label: 'Mean Reversion',
  description: 'Fade extremes in range-bound markets. Enters on RSI oversold/overbought with low ADX.',
  strategy: { ...baseStrategy, rsiThreshold: 70, adxThreshold: 22 },
  advanced: (() => {
    const a = baseAdvanced();
    a.regime_mode = 'mean-reversion';
    a.adx_trend_min = 22;
    a.adx_meanrev_max = 25;
    a.cooldown_bars = 4;
    a.sl_atr_mult = 1.1;
    a.tp1_r = 1.2;
    a.tp2_r = 2.0;
    a.time_stop_hours = 24;
    a.rsi_oversold = 28;
    a.rsi_overbought = 72;
    return a;
  })(),
  defaultTimeframe: '15m',
  defaultLeverage: 5,
  defaultTradeAmount: 100,
  defaultStopLoss: 1.5,
  defaultTakeProfit: 3
};

/** Momentum: trend-following; higher ADX, trend alignment */
export const MOMENTUM: PabloReadyStrategyPreset = {
  key: 'momentum',
  label: 'Momentum',
  description: 'Follow strong trends. Enters when ADX is high and price aligns with HTF trend.',
  strategy: { ...baseStrategy, rsiThreshold: 60, adxThreshold: 28 },
  advanced: (() => {
    const a = baseAdvanced();
    a.regime_mode = 'trend';
    a.adx_trend_min = 28;
    a.adx_meanrev_max = 18;
    a.cooldown_bars = 6;
    a.sl_atr_mult = 1.3;
    a.tp1_r = 1.8;
    a.tp2_r = 3.5;
    a.time_stop_hours = 48;
    return a;
  })(),
  defaultTimeframe: '1h',
  defaultLeverage: 5,
  defaultTradeAmount: 100,
  defaultStopLoss: 2,
  defaultTakeProfit: 5
};

/** Scalping: short timeframes, quick exits, lower cooldown */
export const SCALPING: PabloReadyStrategyPreset = {
  key: 'scalping',
  label: 'Scalping',
  description: 'Quick in-and-out trades on lower timeframes. Tighter SL/TP and faster cooldown.',
  strategy: { ...baseStrategy, rsiThreshold: 68, adxThreshold: 20 },
  advanced: (() => {
    const a = baseAdvanced();
    a.regime_mode = 'auto';
    a.htf_timeframe = '15m';
    a.cooldown_bars = 2;
    a.sl_atr_mult = 0.9;
    a.tp1_r = 0.8;
    a.tp2_r = 1.5;
    a.tp1_size = 0.8;
    a.time_stop_hours = 4;
    a.max_trades_per_day = 12;
    return a;
  })(),
  defaultTimeframe: '5m',
  defaultLeverage: 5,
  defaultTradeAmount: 80,
  defaultStopLoss: 1,
  defaultTakeProfit: 1.5
};

/** Grid Trading: layered entries; can use strategy_integration or neutral bias */
export const GRID_TRADING: PabloReadyStrategyPreset = {
  key: 'grid_trading',
  label: 'Grid Trading',
  description: 'Place orders at intervals to profit from range. Suited for sideways markets.',
  strategy: { ...baseStrategy, rsiThreshold: 55, adxThreshold: 18 },
  advanced: (() => {
    const a = baseAdvanced();
    a.regime_mode = 'mean-reversion';
    a.bias_mode = 'both';
    a.adx_meanrev_max = 22;
    a.cooldown_bars = 3;
    a.sl_atr_mult = 1.4;
    a.tp1_r = 1.0;
    a.tp2_r = 2.0;
    a.max_concurrent = 3;
    a.time_stop_hours = 72;
    if (a.strategy_integration) a.strategy_integration = ['futures_combo'];
    return a;
  })(),
  defaultTimeframe: '15m',
  defaultLeverage: 3,
  defaultTradeAmount: 100,
  defaultStopLoss: 2,
  defaultTakeProfit: 2.5
};

/** Funding Arbitrage: capture funding rate; both directions, funding filter */
export const FUNDING_ARBITRAGE: PabloReadyStrategyPreset = {
  key: 'funding_arbitrage',
  label: 'Funding Arbitrage',
  description: 'Exploit funding rate differentials. Long when funding is negative, short when positive.',
  strategy: { ...baseStrategy, rsiThreshold: 52, adxThreshold: 20 },
  advanced: (() => {
    const a = baseAdvanced();
    a.regime_mode = 'auto';
    a.bias_mode = 'both';
    a.enable_funding_rate_filter = true;
    a.cooldown_bars = 4;
    a.sl_atr_mult = 1.2;
    a.tp1_r = 1.2;
    a.tp2_r = 2.2;
    a.time_stop_hours = 24;
    return a;
  })(),
  defaultTimeframe: '1h',
  defaultLeverage: 3,
  defaultTradeAmount: 100,
  defaultStopLoss: 1.5,
  defaultTakeProfit: 3
};

export const PABLO_READY_STRATEGIES: PabloReadyStrategyPreset[] = [
  MEAN_REVERSION,
  MOMENTUM,
  SCALPING,
  GRID_TRADING,
  FUNDING_ARBITRAGE
];

export const PABLO_READY_STRATEGY_KEYS = PABLO_READY_STRATEGIES.map(s => s.key);
/** Prefix for bot names created from Pablo Ready (to show activity on same page) */
export const PABLO_READY_BOT_NAME_PREFIXES = PABLO_READY_STRATEGIES.map(s => `${s.label} - `);
