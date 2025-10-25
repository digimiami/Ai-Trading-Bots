/**
 * Prediction Module
 * Loads latest model and makes predictions
 */

import * as tf from '@tensorflow/tfjs-node';
import { AI_ML_CONFIG, SignalType, PredictionResult } from './config';
import { PredictionRequest, PredictionResponse, ModelData } from './schema';
import { normalizeFeatures, featuresToArray, FeatureData } from './features';
import { loadModelFromBuffer } from './train';

export interface PredictionCache {
  model: tf.LayersModel | null;
  modelData: ModelData | null;
  lastLoaded: Date | null;
}

// Global cache to avoid reloading model on every prediction
let predictionCache: PredictionCache = {
  model: null,
  modelData: null,
  lastLoaded: null,
};

/**
 * Load the latest model from storage
 */
export async function loadLatestModel(modelData: ModelData): Promise<tf.LayersModel> {
  // Check if we already have the latest model loaded
  if (predictionCache.model && 
      predictionCache.modelData && 
      predictionCache.modelData.id === modelData.id) {
    return predictionCache.model;
  }
  
  try {
    // Load model from storage (this would integrate with storage.ts)
    const modelBuffer = await loadModelFromStorage(modelData.storage_path);
    const model = await loadModelFromBuffer(modelBuffer);
    
    // Update cache
    predictionCache = {
      model,
      modelData,
      lastLoaded: new Date(),
    };
    
    console.log(`Loaded model ${modelData.version} (${modelData.id})`);
    return model;
  } catch (error) {
    console.error('Failed to load model:', error);
    throw new Error(`Failed to load model: ${error}`);
  }
}

/**
 * Make prediction using loaded model
 */
export async function makePrediction(
  request: PredictionRequest,
  modelData: ModelData
): Promise<PredictionResponse> {
  try {
    // Load model if not cached
    const model = await loadLatestModel(modelData);
    
    // Normalize features
    const normalizedFeatures = normalizeFeatures(request.features);
    const featureArray = featuresToArray(normalizedFeatures);
    
    // Create input tensor
    const inputTensor = tf.tensor2d([featureArray]);
    
    // Make prediction
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const confidence = prediction.dataSync()[0];
    
    // Convert confidence to signal
    const signal = confidenceToSignal(confidence);
    
    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();
    
    const response: PredictionResponse = {
      signal,
      confidence,
      features: request.features,
      modelVersion: modelData.version,
      timestamp: new Date(),
    };
    
    console.log(`Prediction for ${request.symbol}: ${signal} (confidence: ${confidence.toFixed(3)})`);
    
    return response;
  } catch (error) {
    console.error('Prediction failed:', error);
    throw new Error(`Prediction failed: ${error}`);
  }
}

/**
 * Convert confidence score to trading signal
 */
export function confidenceToSignal(confidence: number): SignalType {
  if (confidence >= AI_ML_CONFIG.PREDICTION.BUY_THRESHOLD) {
    return 'BUY';
  } else if (confidence <= AI_ML_CONFIG.PREDICTION.SELL_THRESHOLD) {
    return 'SELL';
  } else {
    return 'HOLD';
  }
}

/**
 * Batch prediction for multiple symbols
 */
export async function makeBatchPredictions(
  requests: PredictionRequest[],
  modelData: ModelData
): Promise<PredictionResponse[]> {
  const model = await loadLatestModel(modelData);
  const responses: PredictionResponse[] = [];
  
  for (const request of requests) {
    try {
      const response = await makePrediction(request, modelData);
      responses.push(response);
    } catch (error) {
      console.error(`Batch prediction failed for ${request.symbol}:`, error);
      // Continue with other predictions
    }
  }
  
  return responses;
}

/**
 * Get prediction confidence distribution
 */
export function getConfidenceDistribution(predictions: PredictionResponse[]): {
  buy: number;
  sell: number;
  hold: number;
  avgConfidence: number;
} {
  let buyCount = 0;
  let sellCount = 0;
  let holdCount = 0;
  let totalConfidence = 0;
  
  for (const pred of predictions) {
    totalConfidence += pred.confidence;
    
    switch (pred.signal) {
      case 'BUY':
        buyCount++;
        break;
      case 'SELL':
        sellCount++;
        break;
      case 'HOLD':
        holdCount++;
        break;
    }
  }
  
  const total = predictions.length;
  
  return {
    buy: total > 0 ? buyCount / total : 0,
    sell: total > 0 ? sellCount / total : 0,
    hold: total > 0 ? holdCount / total : 0,
    avgConfidence: total > 0 ? totalConfidence / total : 0,
  };
}

/**
 * Validate prediction request
 */
export function validatePredictionRequest(request: PredictionRequest): boolean {
  try {
    // Check required fields
    if (!request.symbol || !request.features) {
      return false;
    }
    
    // Validate features
    const { rsi, emaFast, emaSlow, atr, volume, emaDiff } = request.features;
    
    if (rsi < 0 || rsi > 100) return false;
    if (emaFast <= 0 || emaSlow <= 0) return false;
    if (atr < 0 || volume < 0) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear prediction cache (useful for testing or memory management)
 */
export function clearPredictionCache(): void {
  if (predictionCache.model) {
    predictionCache.model.dispose();
  }
  
  predictionCache = {
    model: null,
    modelData: null,
    lastLoaded: null,
  };
  
  console.log('Prediction cache cleared');
}

/**
 * Get cache status
 */
export function getCacheStatus(): {
  hasModel: boolean;
  modelId: string | null;
  lastLoaded: Date | null;
} {
  return {
    hasModel: predictionCache.model !== null,
    modelId: predictionCache.modelData?.id || null,
    lastLoaded: predictionCache.lastLoaded,
  };
}

// Placeholder function - will be implemented in storage.ts
async function loadModelFromStorage(storagePath: string): Promise<Buffer> {
  // This will be implemented in storage.ts
  throw new Error('loadModelFromStorage not implemented yet');
}
