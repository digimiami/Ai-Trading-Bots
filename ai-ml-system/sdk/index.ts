/**
 * AI/ML SDK - Main Interface
 * Provides high-level functions for model training, prediction, and management
 */

import { AI_ML_CONFIG, SignalType, PredictionResult } from '../server/config';
import { 
  PredictionRequest, 
  PredictionResponse, 
  TrainModelResponse, 
  GetMetricsResponse,
  TradeData,
  ModelData 
} from '../server/schema';
import { extractFeatures, FeatureData, MarketSnapshot, HistoricalData } from '../server/features';
import { trainModel } from '../server/train';
import { makePrediction, makeBatchPredictions } from '../server/predict';
import { 
  getLatestModel, 
  getModelMetrics, 
  getRecentPredictions, 
  getTrainingData,
  savePrediction,
  ensureStorageBucket 
} from '../server/storage';
import { calculateComprehensiveMetrics, generateMetricsSummary } from '../server/metrics';
import { retrainModel, shouldRetrain, forceRetrain } from '../server/retrain';
import { v4 as uuidv4 } from 'uuid';

/**
 * Train a new model with available trade data
 */
export async function trainModel(): Promise<TrainModelResponse> {
  try {
    console.log('Starting model training...');
    
    // Ensure storage bucket exists
    await ensureStorageBucket();
    
    // Get training data
    const trades = await getTrainingData();
    
    if (trades.length < AI_ML_CONFIG.TRAINING.MIN_SAMPLES) {
      return {
        success: false,
        modelId: '',
        version: '',
        metrics: {
          accuracy: 0,
          precision: 0,
          recall: 0,
          f1Score: 0,
          auc: 0,
          confusionMatrix: {
            truePositives: 0,
            falsePositives: 0,
            trueNegatives: 0,
            falseNegatives: 0,
          },
        },
        message: `Insufficient training data: ${trades.length} < ${AI_ML_CONFIG.TRAINING.MIN_SAMPLES}`,
      };
    }
    
    // Train model
    const trainingResult = await trainModel(trades);
    
    // Generate model metadata
    const modelId = uuidv4();
    const version = '1.0.0';
    
    // Save model (this would integrate with storage.ts)
    // const modelBuffer = await saveModelToBuffer(trainingResult.model);
    // const storagePath = await saveModelToStorage(modelBuffer, modelData);
    
    console.log(`Model training completed: ${modelId} v${version}`);
    
    return {
      success: true,
      modelId,
      version,
      metrics: trainingResult.metrics,
      message: `Model trained successfully with ${trades.length} samples`,
    };
  } catch (error) {
    console.error('Model training failed:', error);
    return {
      success: false,
      modelId: '',
      version: '',
      metrics: {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        auc: 0,
        confusionMatrix: {
          truePositives: 0,
          falsePositives: 0,
          falseNegatives: 0,
          trueNegatives: 0,
        },
      },
      message: `Training failed: ${error}`,
    };
  }
}

/**
 * Get AI decision for a market snapshot
 */
export async function getAiDecision(snapshot: MarketSnapshot): Promise<PredictionResult> {
  try {
    // Get latest model
    const latestModel = await getLatestModel();
    if (!latestModel) {
      throw new Error('No trained model available');
    }
    
    // Extract features from snapshot
    // Note: This requires historical data context
    const historicalData: HistoricalData = {
      symbol: snapshot.symbol,
      data: [], // This would be populated with historical data
    };
    
    const features = extractFeaturesFromSnapshot(snapshot, historicalData);
    
    // Make prediction
    const predictionRequest: PredictionRequest = {
      symbol: snapshot.symbol,
      features,
      modelTag: AI_ML_CONFIG.MODEL_TAG,
    };
    
    const prediction = await makePrediction(predictionRequest, latestModel);
    
    // Log prediction
    await savePrediction({
      id: uuidv4(),
      model_id: latestModel.id,
      symbol: snapshot.symbol,
      ts: snapshot.timestamp,
      features,
      signal: prediction.signal,
      confidence: prediction.confidence,
      outcome: undefined,
      pnl: undefined,
      meta: {},
      created_at: new Date(),
    });
    
    return {
      signal: prediction.signal,
      confidence: prediction.confidence,
      features,
      modelVersion: prediction.modelVersion,
      timestamp: prediction.timestamp,
    };
  } catch (error) {
    console.error('AI decision failed:', error);
    throw new Error(`AI decision failed: ${error}`);
  }
}

/**
 * Get latest model information
 */
export async function getLatestModel(): Promise<ModelData | null> {
  try {
    return await getLatestModel();
  } catch (error) {
    console.error('Failed to get latest model:', error);
    return null;
  }
}

/**
 * Get comprehensive metrics for the AI/ML system
 */
export async function getMetrics(): Promise<GetMetricsResponse> {
  try {
    const latestModel = await getLatestModel();
    const metrics = latestModel ? await getModelMetrics(latestModel.id) : [];
    const recentPredictions = await getRecentPredictions(100);
    
    return {
      latestModel,
      metrics,
      recentPredictions,
    };
  } catch (error) {
    console.error('Failed to get metrics:', error);
    return {
      latestModel: null,
      metrics: [],
      recentPredictions: [],
    };
  }
}

/**
 * Batch prediction for multiple symbols
 */
export async function batchPredict(symbols: string[], features: FeatureData[]): Promise<PredictionResponse[]> {
  try {
    const latestModel = await getLatestModel();
    if (!latestModel) {
      throw new Error('No trained model available');
    }
    
    const requests: PredictionRequest[] = symbols.map((symbol, index) => ({
      symbol,
      features: features[index],
      modelTag: AI_ML_CONFIG.MODEL_TAG,
    }));
    
    return await makeBatchPredictions(requests, latestModel);
  } catch (error) {
    console.error('Batch prediction failed:', error);
    throw new Error(`Batch prediction failed: ${error}`);
  }
}

/**
 * Check if retraining is needed
 */
export async function checkRetrainStatus(): Promise<{
  shouldRetrain: boolean;
  reason: string;
  newDataCount: number;
}> {
  return await shouldRetrain();
}

/**
 * Trigger model retraining
 */
export async function triggerRetrain(): Promise<{
  success: boolean;
  message: string;
  newModelId?: string;
  newVersion?: string;
}> {
  const result = await retrainModel();
  return {
    success: result.success,
    message: result.message,
    newModelId: result.newModelId,
    newVersion: result.newVersion,
  };
}

/**
 * Force retrain model (ignores thresholds)
 */
export async function forceRetrainModel(): Promise<{
  success: boolean;
  message: string;
  newModelId?: string;
  newVersion?: string;
}> {
  const result = await forceRetrain();
  return {
    success: result.success,
    message: result.message,
    newModelId: result.newModelId,
    newVersion: result.newVersion,
  };
}

/**
 * Get model performance summary
 */
export async function getModelSummary(): Promise<{
  summary: string;
  keyMetrics: Record<string, number>;
}> {
  try {
    const latestModel = await getLatestModel();
    if (!latestModel) {
      return {
        summary: 'No model available',
        keyMetrics: {},
      };
    }
    
    const metrics = await getModelMetrics(latestModel.id);
    const comprehensiveMetrics = calculateComprehensiveMetrics([], latestModel);
    
    return generateMetricsSummary(comprehensiveMetrics);
  } catch (error) {
    console.error('Failed to get model summary:', error);
    return {
      summary: 'Error generating summary',
      keyMetrics: {},
    };
  }
}

/**
 * Validate model performance
 */
export async function validateModel(): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  try {
    const latestModel = await getLatestModel();
    if (!latestModel) {
      return {
        isValid: false,
        issues: ['No model available'],
        recommendations: ['Train a new model'],
      };
    }
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check model metrics
    const { accuracy, precision, recall, f1Score } = latestModel.metrics;
    
    if (accuracy < 0.6) {
      issues.push(`Low accuracy: ${(accuracy * 100).toFixed(1)}%`);
      recommendations.push('Consider retraining with more data or different features');
    }
    
    if (precision < 0.5) {
      issues.push(`Low precision: ${(precision * 100).toFixed(1)}%`);
      recommendations.push('Model has high false positive rate');
    }
    
    if (recall < 0.5) {
      issues.push(`Low recall: ${(recall * 100).toFixed(1)}%`);
      recommendations.push('Model misses many profitable trades');
    }
    
    if (f1Score < 0.5) {
      issues.push(`Low F1 score: ${(f1Score * 100).toFixed(1)}%`);
      recommendations.push('Overall model performance is poor');
    }
    
    // Check model age
    const daysSinceCreation = (Date.now() - new Date(latestModel.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      issues.push(`Model is ${daysSinceCreation.toFixed(1)} days old`);
      recommendations.push('Consider retraining with recent data');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  } catch (error) {
    console.error('Model validation failed:', error);
    return {
      isValid: false,
      issues: [`Validation error: ${error}`],
      recommendations: ['Check system configuration'],
    };
  }
}

// Helper function (placeholder - would need historical data integration)
function extractFeaturesFromSnapshot(snapshot: MarketSnapshot, historicalData: HistoricalData): FeatureData {
  // This is a simplified version - in production, you'd need proper historical data
  return {
    rsi: 50, // Default neutral RSI
    emaFast: snapshot.price,
    emaSlow: snapshot.price,
    atr: snapshot.high - snapshot.low,
    volume: snapshot.volume,
    emaDiff: 0,
  };
}
