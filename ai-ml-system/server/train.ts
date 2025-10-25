/**
 * TensorFlow Training Module
 * Trains binary classifier for profitable trade prediction
 */

import * as tf from '@tensorflow/tfjs-node';
import { AI_ML_CONFIG, ModelMetrics } from './config';
import { TrainingData, TradeData, ModelData } from './schema';
import { normalizeFeatures, featuresToArray } from './features';

export interface TrainingResult {
  model: tf.LayersModel;
  metrics: ModelMetrics;
  trainingHistory: tf.History;
}

/**
 * Create a small dense neural network for binary classification
 */
export function createModel(): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      // Input layer
      tf.layers.dense({
        inputShape: [AI_ML_CONFIG.FEATURE_NAMES.length],
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      }),
      
      // Dropout for regularization
      tf.layers.dropout({ rate: 0.3 }),
      
      // Hidden layer
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      }),
      
      // Dropout for regularization
      tf.layers.dropout({ rate: 0.2 }),
      
      // Output layer (binary classification)
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
      }),
    ],
  });
  
  // Compile model
  model.compile({
    optimizer: tf.train.adam(AI_ML_CONFIG.TRAINING.LEARNING_RATE),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });
  
  return model;
}

/**
 * Prepare training data from trade records
 */
export function prepareTrainingData(trades: TradeData[]): TrainingData {
  if (trades.length < AI_ML_CONFIG.TRAINING.MIN_SAMPLES) {
    throw new Error(`Insufficient training data: ${trades.length} < ${AI_ML_CONFIG.TRAINING.MIN_SAMPLES}`);
  }
  
  const features: number[][] = [];
  const labels: boolean[] = [];
  const symbols: string[] = [];
  const timestamps: Date[] = [];
  
  for (const trade of trades) {
    try {
      // Normalize features
      const normalizedFeatures = normalizeFeatures({
        rsi: trade.rsi,
        emaFast: trade.ema_fast,
        emaSlow: trade.ema_slow,
        atr: trade.atr,
        volume: trade.volume,
        emaDiff: trade.ema_fast - trade.ema_slow,
      });
      
      features.push(featuresToArray(normalizedFeatures));
      labels.push(trade.label);
      symbols.push(trade.symbol);
      timestamps.push(trade.ts);
    } catch (error) {
      console.warn(`Skipping invalid trade data: ${error}`);
      continue;
    }
  }
  
  return {
    features,
    labels,
    symbols,
    timestamps,
  };
}

/**
 * Split data into training and validation sets
 */
export function splitData(data: TrainingData): {
  trainFeatures: tf.Tensor2D;
  trainLabels: tf.Tensor2D;
  valFeatures: tf.Tensor2D;
  valLabels: tf.Tensor2D;
} {
  const splitIndex = Math.floor(data.features.length * AI_ML_CONFIG.TRAINING.TRAIN_SPLIT);
  
  // Shuffle data first
  const shuffledIndices = tf.util.shuffle(Array.from({ length: data.features.length }, (_, i) => i));
  
  const trainIndices = shuffledIndices.slice(0, splitIndex);
  const valIndices = shuffledIndices.slice(splitIndex);
  
  // Extract training data
  const trainFeatures = tf.tensor2d(
    trainIndices.map(i => data.features[i])
  );
  const trainLabels = tf.tensor2d(
    trainIndices.map(i => [data.labels[i] ? 1 : 0])
  );
  
  // Extract validation data
  const valFeatures = tf.tensor2d(
    valIndices.map(i => data.features[i])
  );
  const valLabels = tf.tensor2d(
    valIndices.map(i => [data.labels[i] ? 1 : 0])
  );
  
  return {
    trainFeatures,
    trainLabels,
    valFeatures,
    valLabels,
  };
}

/**
 * Calculate model metrics
 */
export function calculateMetrics(
  predictions: tf.Tensor,
  labels: tf.Tensor,
  threshold: number = 0.5
): ModelMetrics {
  const predArray = predictions.dataSync();
  const labelArray = labels.dataSync();
  
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  
  for (let i = 0; i < predArray.length; i++) {
    const pred = predArray[i] > threshold ? 1 : 0;
    const actual = labelArray[i];
    
    if (pred === 1 && actual === 1) truePositives++;
    else if (pred === 1 && actual === 0) falsePositives++;
    else if (pred === 0 && actual === 0) trueNegatives++;
    else if (pred === 0 && actual === 1) falseNegatives++;
  }
  
  const accuracy = (truePositives + trueNegatives) / predArray.length;
  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  
  // Simple AUC approximation (area under ROC curve)
  const auc = calculateAUC(predArray, labelArray);
  
  return {
    accuracy,
    precision,
    recall,
    f1Score,
    auc,
    confusionMatrix: {
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
    },
  };
}

/**
 * Calculate AUC (Area Under Curve) approximation
 */
function calculateAUC(predictions: Float32Array, labels: Float32Array): number {
  const sortedIndices = Array.from({ length: predictions.length }, (_, i) => i)
    .sort((a, b) => predictions[b] - predictions[a]);
  
  let auc = 0;
  let truePositives = 0;
  let falsePositives = 0;
  const totalPositives = labels.reduce((sum, label) => sum + label, 0);
  const totalNegatives = labels.length - totalPositives;
  
  for (const index of sortedIndices) {
    if (labels[index] === 1) {
      truePositives++;
    } else {
      falsePositives++;
      auc += truePositives;
    }
  }
  
  return auc / (totalPositives * totalNegatives);
}

/**
 * Train the model
 */
export async function trainModel(trades: TradeData[]): Promise<TrainingResult> {
  console.log(`Starting model training with ${trades.length} trades...`);
  
  // Prepare data
  const trainingData = prepareTrainingData(trades);
  const { trainFeatures, trainLabels, valFeatures, valLabels } = splitData(trainingData);
  
  // Create model
  const model = createModel();
  
  console.log('Model architecture:');
  model.summary();
  
  // Train model
  const history = await model.fit(trainFeatures, trainLabels, {
    epochs: AI_ML_CONFIG.TRAINING.EPOCHS,
    batchSize: AI_ML_CONFIG.TRAINING.BATCH_SIZE,
    validationData: [valFeatures, valLabels],
    validationSplit: AI_ML_CONFIG.TRAINING.VALIDATION_SPLIT,
    verbose: 1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`);
      },
    },
  });
  
  // Calculate metrics on validation set
  const valPredictions = model.predict(valFeatures) as tf.Tensor;
  const metrics = calculateMetrics(valPredictions, valLabels);
  
  console.log('Training completed. Metrics:', metrics);
  
  // Clean up tensors
  trainFeatures.dispose();
  trainLabels.dispose();
  valFeatures.dispose();
  valLabels.dispose();
  valPredictions.dispose();
  
  return {
    model,
    metrics,
    trainingHistory: history,
  };
}

/**
 * Save model to memory buffer
 */
export async function saveModelToBuffer(model: tf.LayersModel): Promise<Buffer> {
  const modelArtifacts = await model.save(tf.io.withSaveHandler(async (artifacts) => {
    return artifacts;
  }));
  
  // Convert to buffer (simplified - in production you'd want proper serialization)
  const modelJson = JSON.stringify(modelArtifacts);
  return Buffer.from(modelJson, 'utf-8');
}

/**
 * Load model from buffer
 */
export async function loadModelFromBuffer(buffer: Buffer): Promise<tf.LayersModel> {
  const modelJson = buffer.toString('utf-8');
  const modelArtifacts = JSON.parse(modelJson);
  
  return tf.loadLayersModel(tf.io.fromMemory(modelArtifacts));
}
