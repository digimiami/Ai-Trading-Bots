/**
 * AI/ML System Configuration
 * Subsystem: ai-ml-system
 * Model tag: AI_ML_TS_MODEL_V1
 * Data tag: AI_ML_TRADE_DATA
 * Logs tag: AI_ML_LEARNING_LOG
 */

export const AI_ML_CONFIG = {
  // Model Configuration
  MODEL_TAG: 'AI_ML_TS_MODEL_V1',
  DATA_TAG: 'AI_ML_TRADE_DATA',
  LOGS_TAG: 'AI_ML_LEARNING_LOG',
  
  // Feature Engineering
  FEATURES: {
    RSI_PERIOD: 14,
    EMA_FAST_PERIOD: 12,
    EMA_SLOW_PERIOD: 26,
    ATR_PERIOD: 14,
    VOLUME_SMA_PERIOD: 20,
  },
  
  // Model Training
  TRAINING: {
    TRAIN_SPLIT: 0.8,
    VALIDATION_SPLIT: 0.2,
    EPOCHS: 100,
    BATCH_SIZE: 32,
    LEARNING_RATE: 0.001,
    MIN_SAMPLES: 100,
    RETRAIN_THRESHOLD: 50, // Retrain when new data exceeds this
  },
  
  // Prediction Thresholds
  PREDICTION: {
    BUY_THRESHOLD: 0.6,    // Confidence > 0.6 for BUY signal
    SELL_THRESHOLD: 0.4,   // Confidence < 0.4 for SELL signal
    HOLD_RANGE: [0.4, 0.6], // HOLD for confidence in this range
  },
  
  // Storage Configuration
  STORAGE: {
    BUCKET_NAME: 'ai-ml-models',
    MODEL_PREFIX: 'models/',
    METRICS_PREFIX: 'metrics/',
  },
  
  // Database Tables
  TABLES: {
    TRADES: 'ai_ml_trades',
    MODELS: 'ai_ml_models',
    PREDICTIONS: 'ai_ml_predictions',
    METRICS: 'ai_ml_metrics',
  },
  
  // Feature Names (must match feature engineering)
  FEATURE_NAMES: [
    'rsi',
    'emaFast',
    'emaSlow',
    'atr',
    'volume',
    'emaDiff',
  ] as const,
} as const;

export type FeatureName = typeof AI_ML_CONFIG.FEATURE_NAMES[number];
export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
}

export interface PredictionResult {
  signal: SignalType;
  confidence: number;
  features: Record<FeatureName, number>;
  modelVersion: string;
  timestamp: Date;
}
