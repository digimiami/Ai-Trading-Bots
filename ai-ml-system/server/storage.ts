/**
 * Storage Module
 * Handles model storage and retrieval from Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import { AI_ML_CONFIG } from './config';
import { ModelData, MetricsData } from './schema';

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Save model to Supabase Storage
 */
export async function saveModelToStorage(
  modelBuffer: Buffer,
  modelData: ModelData
): Promise<string> {
  try {
    const fileName = `${AI_ML_CONFIG.STORAGE.MODEL_PREFIX}${modelData.tag}_v${modelData.version}.json`;
    
    const { data, error } = await supabase.storage
      .from(AI_ML_CONFIG.STORAGE.BUCKET_NAME)
      .upload(fileName, modelBuffer, {
        contentType: 'application/json',
        upsert: true,
      });
    
    if (error) {
      throw new Error(`Failed to upload model: ${error.message}`);
    }
    
    console.log(`Model saved to storage: ${fileName}`);
    return data.path;
  } catch (error) {
    console.error('Error saving model to storage:', error);
    throw error;
  }
}

/**
 * Load model from Supabase Storage
 */
export async function loadModelFromStorage(storagePath: string): Promise<Buffer> {
  try {
    const { data, error } = await supabase.storage
      .from(AI_ML_CONFIG.STORAGE.BUCKET_NAME)
      .download(storagePath);
    
    if (error) {
      throw new Error(`Failed to download model: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No model data received from storage');
    }
    
    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error loading model from storage:', error);
    throw error;
  }
}

/**
 * Save model metadata to database
 */
export async function saveModelMetadata(modelData: ModelData): Promise<void> {
  try {
    const { error } = await supabase
      .from(AI_ML_CONFIG.TABLES.MODELS)
      .upsert({
        id: modelData.id,
        tag: modelData.tag,
        version: modelData.version,
        storage_path: modelData.storage_path,
        metrics: modelData.metrics,
        created_at: modelData.created_at.toISOString(),
        created_by: modelData.created_by,
      });
    
    if (error) {
      throw new Error(`Failed to save model metadata: ${error.message}`);
    }
    
    console.log(`Model metadata saved: ${modelData.id}`);
  } catch (error) {
    console.error('Error saving model metadata:', error);
    throw error;
  }
}

/**
 * Get latest model by tag
 */
export async function getLatestModel(tag: string = AI_ML_CONFIG.MODEL_TAG): Promise<ModelData | null> {
  try {
    const { data, error } = await supabase
      .from(AI_ML_CONFIG.TABLES.MODELS)
      .select('*')
      .eq('tag', tag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw new Error(`Failed to get latest model: ${error.message}`);
    }
    
    return {
      ...data,
      created_at: new Date(data.created_at),
    };
  } catch (error) {
    console.error('Error getting latest model:', error);
    throw error;
  }
}

/**
 * Save metrics to database
 */
export async function saveMetrics(metrics: MetricsData[]): Promise<void> {
  try {
    const metricsData = metrics.map(metric => ({
      id: metric.id,
      model_id: metric.model_id,
      metric_name: metric.metric_name,
      metric_value: metric.metric_value,
      ts: metric.ts.toISOString(),
    }));
    
    const { error } = await supabase
      .from(AI_ML_CONFIG.TABLES.METRICS)
      .upsert(metricsData);
    
    if (error) {
      throw new Error(`Failed to save metrics: ${error.message}`);
    }
    
    console.log(`Saved ${metrics.length} metrics`);
  } catch (error) {
    console.error('Error saving metrics:', error);
    throw error;
  }
}

/**
 * Get metrics for a model
 */
export async function getModelMetrics(modelId: string): Promise<MetricsData[]> {
  try {
    const { data, error } = await supabase
      .from(AI_ML_CONFIG.TABLES.METRICS)
      .select('*')
      .eq('model_id', modelId)
      .order('ts', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
    
    return data.map(metric => ({
      ...metric,
      ts: new Date(metric.ts),
    }));
  } catch (error) {
    console.error('Error getting model metrics:', error);
    throw error;
  }
}

/**
 * Save prediction to database
 */
export async function savePrediction(prediction: any): Promise<void> {
  try {
    const { error } = await supabase
      .from(AI_ML_CONFIG.TABLES.PREDICTIONS)
      .insert({
        id: prediction.id,
        model_id: prediction.model_id,
        symbol: prediction.symbol,
        ts: prediction.ts.toISOString(),
        features: prediction.features,
        signal: prediction.signal,
        confidence: prediction.confidence,
        outcome: prediction.outcome,
        pnl: prediction.pnl,
        meta: prediction.meta,
        created_at: prediction.created_at.toISOString(),
      });
    
    if (error) {
      throw new Error(`Failed to save prediction: ${error.message}`);
    }
    
    console.log(`Prediction saved: ${prediction.id}`);
  } catch (error) {
    console.error('Error saving prediction:', error);
    throw error;
  }
}

/**
 * Get recent predictions
 */
export async function getRecentPredictions(limit: number = 100): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from(AI_ML_CONFIG.TABLES.PREDICTIONS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get predictions: ${error.message}`);
    }
    
    return data.map(prediction => ({
      ...prediction,
      ts: new Date(prediction.ts),
      created_at: new Date(prediction.created_at),
    }));
  } catch (error) {
    console.error('Error getting recent predictions:', error);
    throw error;
  }
}

/**
 * Get trade data for training
 */
export async function getTrainingData(limit?: number): Promise<any[]> {
  try {
    let query = supabase
      .from(AI_ML_CONFIG.TABLES.TRADES)
      .select('*')
      .order('inserted_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get training data: ${error.message}`);
    }
    
    return data.map(trade => ({
      ...trade,
      ts: new Date(trade.ts),
      inserted_at: new Date(trade.inserted_at),
    }));
  } catch (error) {
    console.error('Error getting training data:', error);
    throw error;
  }
}

/**
 * Save trade data for training
 */
export async function saveTrainingData(tradeData: any): Promise<void> {
  try {
    const { error } = await supabase
      .from(AI_ML_CONFIG.TABLES.TRADES)
      .insert({
        id: tradeData.id,
        user_id: tradeData.user_id,
        symbol: tradeData.symbol,
        side: tradeData.side,
        ts: tradeData.ts.toISOString(),
        rsi: tradeData.rsi,
        ema_fast: tradeData.ema_fast,
        ema_slow: tradeData.ema_slow,
        atr: tradeData.atr,
        volume: tradeData.volume,
        pnl: tradeData.pnl,
        label: tradeData.label,
        meta: tradeData.meta,
        inserted_at: tradeData.inserted_at.toISOString(),
      });
    
    if (error) {
      throw new Error(`Failed to save training data: ${error.message}`);
    }
    
    console.log(`Training data saved: ${tradeData.id}`);
  } catch (error) {
    console.error('Error saving training data:', error);
    throw error;
  }
}

/**
 * Check if storage bucket exists, create if not
 */
export async function ensureStorageBucket(): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .getBucket(AI_ML_CONFIG.STORAGE.BUCKET_NAME);
    
    if (error && error.message.includes('not found')) {
      // Create bucket
      const { error: createError } = await supabase.storage
        .createBucket(AI_ML_CONFIG.STORAGE.BUCKET_NAME, {
          public: false,
        });
      
      if (createError) {
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
      
      console.log(`Created storage bucket: ${AI_ML_CONFIG.STORAGE.BUCKET_NAME}`);
    } else if (error) {
      throw new Error(`Failed to check storage bucket: ${error.message}`);
    } else {
      console.log(`Storage bucket exists: ${AI_ML_CONFIG.STORAGE.BUCKET_NAME}`);
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
    throw error;
  }
}
