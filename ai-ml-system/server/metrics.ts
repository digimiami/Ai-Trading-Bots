/**
 * Metrics Module
 * Computes accuracy, precision, recall, F1 score, and other ML metrics
 */

import { ModelMetrics } from './config';
import { PredictionData, ModelData } from './schema';

export interface MetricCalculation {
  metricName: string;
  value: number;
  timestamp: Date;
}

/**
 * Calculate comprehensive metrics for a model
 */
export function calculateComprehensiveMetrics(
  predictions: PredictionData[],
  modelData: ModelData
): MetricCalculation[] {
  const metrics: MetricCalculation[] = [];
  const timestamp = new Date();
  
  // Filter predictions with outcomes (completed trades)
  const completedPredictions = predictions.filter(p => p.outcome !== undefined);
  
  if (completedPredictions.length === 0) {
    console.warn('No completed predictions found for metrics calculation');
    return metrics;
  }
  
  // Basic metrics from model data
  metrics.push({
    metricName: 'accuracy',
    value: modelData.metrics.accuracy,
    timestamp,
  });
  
  metrics.push({
    metricName: 'precision',
    value: modelData.metrics.precision,
    timestamp,
  });
  
  metrics.push({
    metricName: 'recall',
    value: modelData.metrics.recall,
    timestamp,
  });
  
  metrics.push({
    metricName: 'f1_score',
    value: modelData.metrics.f1Score,
    timestamp,
  });
  
  metrics.push({
    metricName: 'auc',
    value: modelData.metrics.auc,
    timestamp,
  });
  
  // Live performance metrics
  const liveMetrics = calculateLivePerformanceMetrics(completedPredictions);
  metrics.push(...liveMetrics.map(metric => ({ ...metric, timestamp })));
  
  // Signal-specific metrics
  const signalMetrics = calculateSignalSpecificMetrics(completedPredictions);
  metrics.push(...signalMetrics.map(metric => ({ ...metric, timestamp })));
  
  // Confidence-based metrics
  const confidenceMetrics = calculateConfidenceMetrics(completedPredictions);
  metrics.push(...confidenceMetrics.map(metric => ({ ...metric, timestamp })));
  
  return metrics;
}

/**
 * Calculate live performance metrics
 */
function calculateLivePerformanceMetrics(predictions: PredictionData[]): Omit<MetricCalculation, 'timestamp'>[] {
  const metrics: Omit<MetricCalculation, 'timestamp'>[] = [];
  
  // Overall win rate
  const profitableTrades = predictions.filter(p => p.outcome === true).length;
  const winRate = predictions.length > 0 ? profitableTrades / predictions.length : 0;
  metrics.push({ metricName: 'live_win_rate', value: winRate });
  
  // Average PnL
  const totalPnL = predictions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const avgPnL = predictions.length > 0 ? totalPnL / predictions.length : 0;
  metrics.push({ metricName: 'avg_pnl', value: avgPnL });
  
  // Total PnL
  metrics.push({ metricName: 'total_pnl', value: totalPnL });
  
  // Profit factor
  const totalProfit = predictions
    .filter(p => (p.pnl || 0) > 0)
    .reduce((sum, p) => sum + (p.pnl || 0), 0);
  const totalLoss = Math.abs(predictions
    .filter(p => (p.pnl || 0) < 0)
    .reduce((sum, p) => sum + (p.pnl || 0), 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  metrics.push({ metricName: 'profit_factor', value: profitFactor });
  
  // Sharpe ratio (simplified)
  const returns = predictions.map(p => p.pnl || 0);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;
  metrics.push({ metricName: 'sharpe_ratio', value: sharpeRatio });
  
  return metrics;
}

/**
 * Calculate signal-specific metrics
 */
function calculateSignalSpecificMetrics(predictions: PredictionData[]): Omit<MetricCalculation, 'timestamp'>[] {
  const metrics: Omit<MetricCalculation, 'timestamp'>[] = [];
  
  const signals = ['BUY', 'SELL', 'HOLD'] as const;
  
  for (const signal of signals) {
    const signalPredictions = predictions.filter(p => p.signal === signal);
    
    if (signalPredictions.length === 0) continue;
    
    // Signal accuracy
    const correctPredictions = signalPredictions.filter(p => p.outcome === true).length;
    const signalAccuracy = correctPredictions / signalPredictions.length;
    metrics.push({ metricName: `${signal.toLowerCase()}_accuracy`, value: signalAccuracy });
    
    // Signal win rate
    const profitableTrades = signalPredictions.filter(p => p.outcome === true).length;
    const signalWinRate = profitableTrades / signalPredictions.length;
    metrics.push({ metricName: `${signal.toLowerCase()}_win_rate`, value: signalWinRate });
    
    // Average PnL for signal
    const totalPnL = signalPredictions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const avgPnL = totalPnL / signalPredictions.length;
    metrics.push({ metricName: `${signal.toLowerCase()}_avg_pnl`, value: avgPnL });
    
    // Signal frequency
    const signalFrequency = signalPredictions.length / predictions.length;
    metrics.push({ metricName: `${signal.toLowerCase()}_frequency`, value: signalFrequency });
  }
  
  return metrics;
}

/**
 * Calculate confidence-based metrics
 */
function calculateConfidenceMetrics(predictions: PredictionData[]): Omit<MetricCalculation, 'timestamp'>[] {
  const metrics: Omit<MetricCalculation, 'timestamp'>[] = [];
  
  // Group predictions by confidence ranges
  const confidenceRanges = [
    { min: 0.0, max: 0.3, name: 'low' },
    { min: 0.3, max: 0.7, name: 'medium' },
    { min: 0.7, max: 1.0, name: 'high' },
  ];
  
  for (const range of confidenceRanges) {
    const rangePredictions = predictions.filter(
      p => p.confidence >= range.min && p.confidence < range.max
    );
    
    if (rangePredictions.length === 0) continue;
    
    // Win rate for confidence range
    const profitableTrades = rangePredictions.filter(p => p.outcome === true).length;
    const winRate = profitableTrades / rangePredictions.length;
    metrics.push({ metricName: `${range.name}_confidence_win_rate`, value: winRate });
    
    // Average confidence for range
    const avgConfidence = rangePredictions.reduce((sum, p) => sum + p.confidence, 0) / rangePredictions.length;
    metrics.push({ metricName: `${range.name}_confidence_avg`, value: avgConfidence });
    
    // Frequency of predictions in range
    const frequency = rangePredictions.length / predictions.length;
    metrics.push({ metricName: `${range.name}_confidence_frequency`, value: frequency });
  }
  
  // Overall confidence calibration
  const calibrationError = calculateCalibrationError(predictions);
  metrics.push({ metricName: 'calibration_error', value: calibrationError });
  
  return metrics;
}

/**
 * Calculate calibration error (how well confidence matches actual accuracy)
 */
function calculateCalibrationError(predictions: PredictionData[]): number {
  const bins = 10;
  const binSize = 1.0 / bins;
  let totalError = 0;
  let validBins = 0;
  
  for (let i = 0; i < bins; i++) {
    const minConf = i * binSize;
    const maxConf = (i + 1) * binSize;
    
    const binPredictions = predictions.filter(
      p => p.confidence >= minConf && p.confidence < maxConf
    );
    
    if (binPredictions.length === 0) continue;
    
    const binAccuracy = binPredictions.filter(p => p.outcome === true).length / binPredictions.length;
    const binConfidence = binPredictions.reduce((sum, p) => sum + p.confidence, 0) / binPredictions.length;
    
    totalError += Math.abs(binAccuracy - binConfidence);
    validBins++;
  }
  
  return validBins > 0 ? totalError / validBins : 0;
}

/**
 * Calculate model comparison metrics
 */
export function compareModels(
  model1Metrics: ModelMetrics,
  model2Metrics: ModelMetrics
): {
  accuracyImprovement: number;
  f1Improvement: number;
  betterModel: 'model1' | 'model2' | 'tie';
} {
  const accuracyImprovement = model1Metrics.accuracy - model2Metrics.accuracy;
  const f1Improvement = model1Metrics.f1Score - model2Metrics.f1Score;
  
  let betterModel: 'model1' | 'model2' | 'tie';
  if (accuracyImprovement > 0.01) {
    betterModel = 'model1';
  } else if (accuracyImprovement < -0.01) {
    betterModel = 'model2';
  } else {
    betterModel = 'tie';
  }
  
  return {
    accuracyImprovement,
    f1Improvement,
    betterModel,
  };
}

/**
 * Generate metrics summary
 */
export function generateMetricsSummary(metrics: MetricCalculation[]): {
  summary: string;
  keyMetrics: Record<string, number>;
} {
  const keyMetrics: Record<string, number> = {};
  
  // Extract key metrics
  const importantMetrics = [
    'accuracy', 'precision', 'recall', 'f1_score', 'auc',
    'live_win_rate', 'avg_pnl', 'profit_factor', 'sharpe_ratio'
  ];
  
  for (const metric of metrics) {
    if (importantMetrics.includes(metric.metricName)) {
      keyMetrics[metric.metricName] = metric.value;
    }
  }
  
  // Generate summary
  const summary = `
Model Performance Summary:
- Accuracy: ${(keyMetrics.accuracy * 100).toFixed(1)}%
- Precision: ${(keyMetrics.precision * 100).toFixed(1)}%
- Recall: ${(keyMetrics.recall * 100).toFixed(1)}%
- F1 Score: ${(keyMetrics.f1_score * 100).toFixed(1)}%
- Live Win Rate: ${(keyMetrics.live_win_rate * 100).toFixed(1)}%
- Average PnL: $${keyMetrics.avg_pnl.toFixed(2)}
- Profit Factor: ${keyMetrics.profit_factor.toFixed(2)}
- Sharpe Ratio: ${keyMetrics.sharpe_ratio.toFixed(2)}
  `.trim();
  
  return { summary, keyMetrics };
}
