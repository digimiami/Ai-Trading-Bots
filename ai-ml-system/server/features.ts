/**
 * Feature Engineering Module
 * Computes technical indicators for ML model training and prediction
 */

import { AI_ML_CONFIG, FeatureData } from './config';
import { FeatureSchema } from './schema';

export interface MarketSnapshot {
  symbol: string;
  timestamp: Date;
  price: number;
  volume: number;
  high: number;
  low: number;
  close: number;
  open: number;
}

export interface HistoricalData {
  symbol: string;
  data: Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = AI_ML_CONFIG.FEATURES.RSI_PERIOD): number {
  if (prices.length < period + 1) return 50; // Default neutral RSI
  
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
  const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length === 1) return prices[0];
  
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }
  
  return ema;
}

/**
 * Calculate ATR (Average True Range)
 */
export function calculateATR(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  period: number = AI_ML_CONFIG.FEATURES.ATR_PERIOD
): number {
  if (highs.length < 2) return 0;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  if (trueRanges.length < period) {
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }
  
  return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
}

/**
 * Calculate Volume SMA (Simple Moving Average)
 */
export function calculateVolumeSMA(volumes: number[], period: number = AI_ML_CONFIG.FEATURES.VOLUME_SMA_PERIOD): number {
  if (volumes.length === 0) return 0;
  
  const recentVolumes = volumes.slice(-period);
  return recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
}

/**
 * Extract features from historical market data
 */
export function extractFeatures(historicalData: HistoricalData): FeatureData {
  const { data } = historicalData;
  
  if (data.length < Math.max(
    AI_ML_CONFIG.FEATURES.RSI_PERIOD,
    AI_ML_CONFIG.FEATURES.EMA_SLOW_PERIOD,
    AI_ML_CONFIG.FEATURES.ATR_PERIOD,
    AI_ML_CONFIG.FEATURES.VOLUME_SMA_PERIOD
  )) {
    throw new Error('Insufficient historical data for feature extraction');
  }
  
  // Extract price arrays
  const prices = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  
  // Calculate technical indicators
  const rsi = calculateRSI(prices);
  const emaFast = calculateEMA(prices, AI_ML_CONFIG.FEATURES.EMA_FAST_PERIOD);
  const emaSlow = calculateEMA(prices, AI_ML_CONFIG.FEATURES.EMA_SLOW_PERIOD);
  const atr = calculateATR(highs, lows, prices);
  const volumeSMA = calculateVolumeSMA(volumes);
  const emaDiff = emaFast - emaSlow;
  
  const features: FeatureData = {
    rsi,
    emaFast,
    emaSlow,
    atr,
    volume: volumeSMA,
    emaDiff,
  };
  
  // Validate features
  return FeatureSchema.parse(features);
}

/**
 * Extract features from a single market snapshot (for real-time prediction)
 * Requires historical context for proper calculation
 */
export function extractFeaturesFromSnapshot(
  snapshot: MarketSnapshot,
  historicalData: HistoricalData
): FeatureData {
  // Add current snapshot to historical data
  const updatedData: HistoricalData = {
    symbol: snapshot.symbol,
    data: [
      ...historicalData.data,
      {
        timestamp: snapshot.timestamp,
        open: snapshot.open,
        high: snapshot.high,
        low: snapshot.low,
        close: snapshot.close,
        volume: snapshot.volume,
      }
    ]
  };
  
  return extractFeatures(updatedData);
}

/**
 * Normalize features for ML model input
 * Scales features to [0, 1] range for better training
 */
export function normalizeFeatures(features: FeatureData): FeatureData {
  return {
    rsi: features.rsi / 100, // RSI is already 0-100
    emaFast: Math.min(features.emaFast / 100000, 1), // Cap at 100k for normalization
    emaSlow: Math.min(features.emaSlow / 100000, 1),
    atr: Math.min(features.atr / 1000, 1), // Cap at 1000 for normalization
    volume: Math.min(features.volume / 1000000, 1), // Cap at 1M for normalization
    emaDiff: Math.max(-1, Math.min(1, features.emaDiff / 1000)), // Clamp to [-1, 1]
  };
}

/**
 * Denormalize features back to original scale
 */
export function denormalizeFeatures(normalizedFeatures: FeatureData): FeatureData {
  return {
    rsi: normalizedFeatures.rsi * 100,
    emaFast: normalizedFeatures.emaFast * 100000,
    emaSlow: normalizedFeatures.emaSlow * 100000,
    atr: normalizedFeatures.atr * 1000,
    volume: normalizedFeatures.volume * 1000000,
    emaDiff: normalizedFeatures.emaDiff * 1000,
  };
}

/**
 * Convert features to array format for TensorFlow
 */
export function featuresToArray(features: FeatureData): number[] {
  return AI_ML_CONFIG.FEATURE_NAMES.map(name => features[name]);
}

/**
 * Convert array back to features object
 */
export function arrayToFeatures(featureArray: number[]): FeatureData {
  const features: Partial<FeatureData> = {};
  
  AI_ML_CONFIG.FEATURE_NAMES.forEach((name, index) => {
    features[name] = featureArray[index];
  });
  
  return features as FeatureData;
}
