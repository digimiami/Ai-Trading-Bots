/**
 * Zod Schemas for AI/ML System
 * Provides type-safe validation for all data structures
 */

import { z } from 'zod';
import { AI_ML_CONFIG, FeatureName, SignalType } from './config';

// Feature Schema
export const FeatureSchema = z.object({
  rsi: z.number().min(0).max(100),
  emaFast: z.number().positive(),
  emaSlow: z.number().positive(),
  atr: z.number().nonnegative(),
  volume: z.number().nonnegative(),
  emaDiff: z.number(),
});

export type FeatureData = z.infer<typeof FeatureSchema>;

// Trade Data Schema (for training)
export const TradeDataSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  ts: z.date(),
  rsi: z.number().min(0).max(100),
  ema_fast: z.number().positive(),
  ema_slow: z.number().positive(),
  atr: z.number().nonnegative(),
  volume: z.number().nonnegative(),
  pnl: z.number(),
  label: z.boolean(), // true if profitable trade
  meta: z.record(z.any()).optional(),
  inserted_at: z.date(),
});

export type TradeData = z.infer<typeof TradeDataSchema>;

// Model Schema
export const ModelSchema = z.object({
  id: z.string().uuid(),
  tag: z.string(),
  version: z.string(),
  storage_path: z.string(),
  metrics: z.object({
    accuracy: z.number().min(0).max(1),
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    f1Score: z.number().min(0).max(1),
    auc: z.number().min(0).max(1),
    confusionMatrix: z.object({
      truePositives: z.number().nonnegative(),
      falsePositives: z.number().nonnegative(),
      trueNegatives: z.number().nonnegative(),
      falseNegatives: z.number().nonnegative(),
    }),
  }),
  created_at: z.date(),
  created_by: z.string().uuid(),
});

export type ModelData = z.infer<typeof ModelSchema>;

// Prediction Schema
export const PredictionSchema = z.object({
  id: z.string().uuid(),
  model_id: z.string().uuid(),
  symbol: z.string(),
  ts: z.date(),
  features: FeatureSchema,
  signal: z.enum(['BUY', 'SELL', 'HOLD']),
  confidence: z.number().min(0).max(1),
  outcome: z.boolean().optional(), // filled after trade completion
  pnl: z.number().optional(), // filled after trade completion
  meta: z.record(z.any()).optional(),
  created_at: z.date(),
});

export type PredictionData = z.infer<typeof PredictionSchema>;

// Metrics Schema
export const MetricsSchema = z.object({
  id: z.string().uuid(),
  model_id: z.string().uuid(),
  metric_name: z.string(),
  metric_value: z.number(),
  ts: z.date(),
});

export type MetricsData = z.infer<typeof MetricsSchema>;

// Training Data Schema
export const TrainingDataSchema = z.object({
  features: z.array(FeatureSchema),
  labels: z.array(z.boolean()),
  symbols: z.array(z.string()),
  timestamps: z.array(z.date()),
});

export type TrainingData = z.infer<typeof TrainingDataSchema>;

// Prediction Request Schema
export const PredictionRequestSchema = z.object({
  symbol: z.string(),
  features: FeatureSchema,
  modelTag: z.string().optional().default(AI_ML_CONFIG.MODEL_TAG),
});

export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;

// Prediction Response Schema
export const PredictionResponseSchema = z.object({
  signal: z.enum(['BUY', 'SELL', 'HOLD']),
  confidence: z.number().min(0).max(1),
  features: FeatureSchema,
  modelVersion: z.string(),
  timestamp: z.date(),
});

export type PredictionResponse = z.infer<typeof PredictionResponseSchema>;

// SDK Response Schemas
export const TrainModelResponseSchema = z.object({
  success: z.boolean(),
  modelId: z.string().uuid(),
  version: z.string(),
  metrics: ModelSchema.shape.metrics,
  message: z.string(),
});

export type TrainModelResponse = z.infer<typeof TrainModelResponseSchema>;

export const GetMetricsResponseSchema = z.object({
  latestModel: ModelSchema.nullable(),
  metrics: z.array(MetricsSchema),
  recentPredictions: z.array(PredictionSchema),
});

export type GetMetricsResponse = z.infer<typeof GetMetricsResponseSchema>;
