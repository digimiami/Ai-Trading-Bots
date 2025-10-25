/**
 * Retrain Module
 * Handles model retraining based on new data and performance metrics
 */

import { AI_ML_CONFIG } from './config';
import { TradeData, ModelData, MetricsData } from './schema';
import { trainModel, saveModelToBuffer } from './train';
import { saveModelToStorage, saveModelMetadata, getLatestModel, getTrainingData, saveMetrics } from './storage';
import { calculateComprehensiveMetrics, compareModels } from './metrics';
import { v4 as uuidv4 } from 'uuid';

export interface RetrainResult {
  success: boolean;
  newModelId: string;
  newVersion: string;
  metrics: any;
  message: string;
  shouldReplace: boolean;
}

/**
 * Check if retraining is needed
 */
export async function shouldRetrain(): Promise<{
  shouldRetrain: boolean;
  reason: string;
  newDataCount: number;
}> {
  try {
    // Get latest model
    const latestModel = await getLatestModel();
    if (!latestModel) {
      return {
        shouldRetrain: true,
        reason: 'No existing model found',
        newDataCount: 0,
      };
    }
    
    // Get all training data
    const allTrainingData = await getTrainingData();
    
    // Count new data since last model
    const newDataCount = allTrainingData.filter(
      trade => new Date(trade.inserted_at) > new Date(latestModel.created_at)
    ).length;
    
    // Check if we have enough new data
    if (newDataCount >= AI_ML_CONFIG.TRAINING.RETRAIN_THRESHOLD) {
      return {
        shouldRetrain: true,
        reason: `New data threshold exceeded: ${newDataCount} >= ${AI_ML_CONFIG.TRAINING.RETRAIN_THRESHOLD}`,
        newDataCount,
      };
    }
    
    // Check if model is too old (e.g., older than 7 days)
    const daysSinceCreation = (Date.now() - new Date(latestModel.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      return {
        shouldRetrain: true,
        reason: `Model is too old: ${daysSinceCreation.toFixed(1)} days`,
        newDataCount,
      };
    }
    
    return {
      shouldRetrain: false,
      reason: `No retraining needed. New data: ${newDataCount}, Age: ${daysSinceCreation.toFixed(1)} days`,
      newDataCount,
    };
  } catch (error) {
    console.error('Error checking retrain status:', error);
    return {
      shouldRetrain: false,
      reason: `Error checking retrain status: ${error}`,
      newDataCount: 0,
    };
  }
}

/**
 * Retrain model with new data
 */
export async function retrainModel(): Promise<RetrainResult> {
  try {
    console.log('Starting model retraining...');
    
    // Check if retraining is needed
    const retrainCheck = await shouldRetrain();
    if (!retrainCheck.shouldRetrain) {
      return {
        success: false,
        newModelId: '',
        newVersion: '',
        metrics: null,
        message: retrainCheck.reason,
        shouldReplace: false,
      };
    }
    
    // Get training data
    const trainingData = await getTrainingData();
    if (trainingData.length < AI_ML_CONFIG.TRAINING.MIN_SAMPLES) {
      return {
        success: false,
        newModelId: '',
        newVersion: '',
        metrics: null,
        message: `Insufficient training data: ${trainingData.length} < ${AI_ML_CONFIG.TRAINING.MIN_SAMPLES}`,
        shouldReplace: false,
      };
    }
    
    // Train new model
    const trainingResult = await trainModel(trainingData);
    
    // Generate new model ID and version
    const newModelId = uuidv4();
    const latestModel = await getLatestModel();
    const newVersion = latestModel 
      ? incrementVersion(latestModel.version)
      : '1.0.0';
    
    // Save model to storage
    const modelBuffer = await saveModelToBuffer(trainingResult.model);
    const storagePath = await saveModelToStorage(modelBuffer, {
      id: newModelId,
      tag: AI_ML_CONFIG.MODEL_TAG,
      version: newVersion,
      storage_path: '', // Will be set by saveModelToStorage
      metrics: trainingResult.metrics,
      created_at: new Date(),
      created_by: 'system', // In production, this would be the user ID
    });
    
    // Update model data with storage path
    const newModelData: ModelData = {
      id: newModelId,
      tag: AI_ML_CONFIG.MODEL_TAG,
      version: newVersion,
      storage_path: storagePath,
      metrics: trainingResult.metrics,
      created_at: new Date(),
      created_by: 'system',
    };
    
    // Save model metadata
    await saveModelMetadata(newModelData);
    
    // Calculate comprehensive metrics
    const comprehensiveMetrics = calculateComprehensiveMetrics([], newModelData);
    const metricsData: MetricsData[] = comprehensiveMetrics.map(metric => ({
      id: uuidv4(),
      model_id: newModelId,
      metric_name: metric.metricName,
      metric_value: metric.value,
      ts: metric.timestamp,
    }));
    
    // Save metrics
    await saveMetrics(metricsData);
    
    // Check if new model should replace current model
    let shouldReplace = true;
    let comparisonMessage = '';
    
    if (latestModel) {
      const comparison = compareModels(trainingResult.metrics, latestModel.metrics);
      shouldReplace = comparison.betterModel === 'model1';
      comparisonMessage = `Model comparison: ${comparison.betterModel} (accuracy: ${comparison.accuracyImprovement.toFixed(3)}, F1: ${comparison.f1Improvement.toFixed(3)})`;
    }
    
    console.log(`Model retraining completed. New model: ${newModelId} v${newVersion}`);
    
    return {
      success: true,
      newModelId,
      newVersion,
      metrics: trainingResult.metrics,
      message: `Model retrained successfully. ${comparisonMessage}`,
      shouldReplace,
    };
  } catch (error) {
    console.error('Error during model retraining:', error);
    return {
      success: false,
      newModelId: '',
      newVersion: '',
      metrics: null,
      message: `Retraining failed: ${error}`,
      shouldReplace: false,
    };
  }
}

/**
 * Increment version number
 */
function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.').map(Number);
  
  // Increment patch version
  parts[2] = (parts[2] || 0) + 1;
  
  return parts.join('.');
}

/**
 * Schedule automatic retraining
 */
export function scheduleRetraining(intervalHours: number = 24): void {
  console.log(`Scheduling automatic retraining every ${intervalHours} hours`);
  
  setInterval(async () => {
    try {
      console.log('Running scheduled retraining check...');
      const result = await retrainModel();
      
      if (result.success) {
        console.log(`Scheduled retraining completed: ${result.message}`);
      } else {
        console.log(`Scheduled retraining skipped: ${result.message}`);
      }
    } catch (error) {
      console.error('Scheduled retraining failed:', error);
    }
  }, intervalHours * 60 * 60 * 1000);
}

/**
 * Force retrain (ignores thresholds)
 */
export async function forceRetrain(): Promise<RetrainResult> {
  console.log('Force retraining model...');
  
  try {
    // Get training data
    const trainingData = await getTrainingData();
    if (trainingData.length < AI_ML_CONFIG.TRAINING.MIN_SAMPLES) {
      return {
        success: false,
        newModelId: '',
        newVersion: '',
        metrics: null,
        message: `Insufficient training data: ${trainingData.length} < ${AI_ML_CONFIG.TRAINING.MIN_SAMPLES}`,
        shouldReplace: false,
      };
    }
    
    // Train new model
    const trainingResult = await trainModel(trainingData);
    
    // Generate new model ID and version
    const newModelId = uuidv4();
    const latestModel = await getLatestModel();
    const newVersion = latestModel 
      ? incrementVersion(latestModel.version)
      : '1.0.0';
    
    // Save model to storage
    const modelBuffer = await saveModelToBuffer(trainingResult.model);
    const storagePath = await saveModelToStorage(modelBuffer, {
      id: newModelId,
      tag: AI_ML_CONFIG.MODEL_TAG,
      version: newVersion,
      storage_path: '',
      metrics: trainingResult.metrics,
      created_at: new Date(),
      created_by: 'system',
    });
    
    // Update model data with storage path
    const newModelData: ModelData = {
      id: newModelId,
      tag: AI_ML_CONFIG.MODEL_TAG,
      version: newVersion,
      storage_path: storagePath,
      metrics: trainingResult.metrics,
      created_at: new Date(),
      created_by: 'system',
    };
    
    // Save model metadata
    await saveModelMetadata(newModelData);
    
    // Calculate comprehensive metrics
    const comprehensiveMetrics = calculateComprehensiveMetrics([], newModelData);
    const metricsData: MetricsData[] = comprehensiveMetrics.map(metric => ({
      id: uuidv4(),
      model_id: newModelId,
      metric_name: metric.metricName,
      metric_value: metric.value,
      ts: metric.timestamp,
    }));
    
    // Save metrics
    await saveMetrics(metricsData);
    
    console.log(`Force retraining completed. New model: ${newModelId} v${newVersion}`);
    
    return {
      success: true,
      newModelId,
      newVersion,
      metrics: trainingResult.metrics,
      message: 'Model force retrained successfully',
      shouldReplace: true,
    };
  } catch (error) {
    console.error('Error during force retraining:', error);
    return {
      success: false,
      newModelId: '',
      newVersion: '',
      metrics: null,
      message: `Force retraining failed: ${error}`,
      shouldReplace: false,
    };
  }
}
