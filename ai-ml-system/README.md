# AI/ML Trading System

A comprehensive AI/ML module for the Pablo AI Trading system that provides machine learning-powered trading predictions without modifying existing trading logic.

## 🎯 Overview

This AI/ML system is designed as an **independent, optional module** that can be enabled via feature flag. It provides:

- **Binary Classification Model**: Predicts profitable trades using technical indicators
- **Feature Engineering**: RSI, EMA, ATR, Volume analysis
- **TensorFlow Integration**: Neural network training and prediction
- **Real-time Predictions**: Live trading signal generation
- **Performance Monitoring**: Comprehensive metrics and dashboard
- **Auto-retraining**: Automatic model updates with new data

## 🏗️ Architecture

```
ai-ml-system/
├── server/                 # Server-side ML logic
│   ├── config.ts          # Configuration and constants
│   ├── schema.ts          # Zod validation schemas
│   ├── features.ts        # Feature engineering
│   ├── train.ts           # TensorFlow model training
│   ├── predict.ts         # Model prediction logic
│   ├── storage.ts         # Supabase storage integration
│   ├── metrics.ts         # Performance metrics calculation
│   └── retrain.ts         # Model retraining logic
├── sdk/                   # SDK interface
│   ├── supabaseClient.ts  # Server-only Supabase client
│   └── index.ts           # Main SDK exports
├── web/                   # Web dashboard components
│   ├── pages/
│   │   └── AiMlDashboard.tsx
│   └── components/
│       ├── MetricsCards.tsx
│       └── PredictionsTable.tsx
├── supabase_schema.sql    # Database schema
├── env.example           # Environment configuration
└── README.md             # This file
```

## 🚀 Quick Start

### 1. Environment Setup

Add to your `.env` file:

```bash
# Enable AI/ML system
VITE_FEATURE_AI_ML=1

# Supabase configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

### 2. Database Setup

Run the SQL schema in your Supabase dashboard:

```sql
-- Execute ai-ml-system/supabase_schema.sql
```

This creates:
- `ai_ml_trades` - Training data
- `ai_ml_models` - Model metadata
- `ai_ml_predictions` - Prediction logs
- `ai_ml_metrics` - Performance metrics
- `ai-ml-models` storage bucket

### 3. Install Dependencies

```bash
npm install @tensorflow/tfjs-node zod uuid
npm install --save-dev @types/uuid
```

### 4. Enable Feature Flag

The AI/ML dashboard will only be accessible when `VITE_FEATURE_AI_ML=1`.

## 📊 Features

### Technical Indicators

The system extracts 6 key features:

1. **RSI (Relative Strength Index)** - Momentum oscillator
2. **EMA Fast** - 12-period exponential moving average
3. **EMA Slow** - 26-period exponential moving average
4. **ATR (Average True Range)** - Volatility measure
5. **Volume SMA** - 20-period volume moving average
6. **EMA Diff** - Difference between fast and slow EMA

### Model Architecture

- **Type**: Binary classifier (profitable vs unprofitable)
- **Architecture**: Dense neural network (64 → 32 → 1)
- **Activation**: ReLU hidden layers, Sigmoid output
- **Regularization**: L2 regularization + Dropout
- **Optimizer**: Adam with learning rate 0.001

### Prediction Signals

- **BUY**: Confidence > 0.6
- **SELL**: Confidence < 0.4
- **HOLD**: Confidence 0.4-0.6

## 🔧 SDK Usage

### Basic Prediction

```typescript
import { getAiDecision } from './ai-ml-system/sdk';

const snapshot = {
  symbol: 'BTCUSDT',
  timestamp: new Date(),
  price: 45000,
  volume: 1000000,
  high: 46000,
  low: 44000,
  close: 45000,
  open: 44500,
};

const decision = await getAiDecision(snapshot);
console.log(decision);
// { signal: 'BUY', confidence: 0.78, features: {...}, modelVersion: '1.2.3', timestamp: ... }
```

### Model Training

```typescript
import { trainModel } from './ai-ml-system/sdk';

const result = await trainModel();
console.log(result);
// { success: true, modelId: 'uuid', version: '1.0.0', metrics: {...}, message: '...' }
```

### Metrics Monitoring

```typescript
import { getMetrics } from './ai-ml-system/sdk';

const metrics = await getMetrics();
console.log(metrics);
// { latestModel: {...}, metrics: [...], recentPredictions: [...] }
```

## 📈 Dashboard

Access the AI/ML dashboard at `/ai-ml/dashboard` (when feature flag is enabled).

### Dashboard Features

- **Performance Metrics**: Accuracy, Precision, Recall, F1 Score
- **Live Performance**: Win rate, Average PnL, Profit Factor
- **Recent Predictions**: Table with filtering and sorting
- **Model Status**: Current model version and age
- **System Status**: Real-time system health indicators

### Metrics Cards

- 🟢 **Accuracy**: Overall model correctness
- 🔵 **Precision**: True positive rate
- 🟡 **Recall**: Sensitivity to profitable trades
- 🔴 **F1 Score**: Harmonic mean of precision/recall
- 💰 **Live Win Rate**: Real trading performance
- 📊 **Average PnL**: Profit per trade
- ⚖️ **Profit Factor**: Profit/Loss ratio
- 📈 **Sharpe Ratio**: Risk-adjusted returns

## 🔄 Auto-retraining

The system automatically retrains when:

- **New Data Threshold**: 50+ new trades since last model
- **Model Age**: Model older than 7 days
- **Performance Degradation**: Metrics below thresholds

### Manual Retraining

```typescript
import { triggerRetrain, forceRetrain } from './ai-ml-system/sdk';

// Check if retraining is needed
const status = await checkRetrainStatus();
console.log(status);
// { shouldRetrain: true, reason: 'New data threshold exceeded', newDataCount: 75 }

// Trigger retraining
const result = await triggerRetrain();
console.log(result);
// { success: true, message: 'Model retrained successfully', newModelId: 'uuid', newVersion: '1.1.0' }
```

## 🛡️ Security & Privacy

### Row Level Security (RLS)

- **Users**: Can only access their own trade data
- **Models**: Public read access for all users
- **Predictions**: Public read access for all users
- **Metrics**: Public read access for all users
- **Service Role**: Full access for server operations

### Data Protection

- **Service Role Key**: Never exposed to browser
- **Model Storage**: Private bucket with service role access
- **Feature Data**: Normalized and validated with Zod
- **Prediction Logging**: All predictions logged for audit

## 📊 Database Schema

### Tables

1. **ai_ml_trades**: Training data with technical indicators
2. **ai_ml_models**: Model metadata and performance metrics
3. **ai_ml_predictions**: Prediction logs and outcomes
4. **ai_ml_metrics**: Detailed metrics over time

### Views

- **latest_model_metrics**: Current model performance
- **recent_predictions_with_outcomes**: Recent predictions with results
- **model_performance_summary**: Aggregated performance data

## 🔧 Configuration

### Model Parameters

```typescript
// ai-ml-system/server/config.ts
export const AI_ML_CONFIG = {
  TRAINING: {
    TRAIN_SPLIT: 0.8,        // 80% training, 20% validation
    EPOCHS: 100,             // Training epochs
    BATCH_SIZE: 32,          // Batch size
    LEARNING_RATE: 0.001,   // Adam learning rate
    MIN_SAMPLES: 100,       // Minimum samples for training
    RETRAIN_THRESHOLD: 50,  // New data threshold for retraining
  },
  PREDICTION: {
    BUY_THRESHOLD: 0.6,     // Confidence threshold for BUY
    SELL_THRESHOLD: 0.4,    // Confidence threshold for SELL
  },
  FEATURES: {
    RSI_PERIOD: 14,         // RSI calculation period
    EMA_FAST_PERIOD: 12,    // Fast EMA period
    EMA_SLOW_PERIOD: 26,    // Slow EMA period
    ATR_PERIOD: 14,         // ATR calculation period
    VOLUME_SMA_PERIOD: 20,  // Volume SMA period
  },
};
```

## 🚨 Error Handling

### Common Issues

1. **Insufficient Training Data**
   - Error: "Insufficient training data: 50 < 100"
   - Solution: Collect more trade data before training

2. **Model Loading Failed**
   - Error: "Failed to load model: Storage error"
   - Solution: Check Supabase storage permissions

3. **Feature Extraction Failed**
   - Error: "Insufficient historical data"
   - Solution: Ensure adequate price history

### Debugging

Enable debug logging:

```bash
AI_ML_DEBUG=true
TF_CPP_MIN_LOG_LEVEL=1
```

## 📚 API Reference

### SDK Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `getAiDecision(snapshot)` | Get trading signal for market snapshot | `PredictionResult` |
| `trainModel()` | Train new model with available data | `TrainModelResponse` |
| `getLatestModel()` | Get current model information | `ModelData \| null` |
| `getMetrics()` | Get comprehensive metrics | `GetMetricsResponse` |
| `batchPredict(symbols, features)` | Batch prediction for multiple symbols | `PredictionResponse[]` |
| `checkRetrainStatus()` | Check if retraining is needed | `RetrainStatus` |
| `triggerRetrain()` | Trigger model retraining | `RetrainResult` |
| `forceRetrain()` | Force retrain (ignore thresholds) | `RetrainResult` |
| `getModelSummary()` | Get performance summary | `ModelSummary` |
| `validateModel()` | Validate model performance | `ValidationResult` |

## 🔮 Future Enhancements

- **Multi-symbol Models**: Separate models per trading pair
- **Ensemble Methods**: Combine multiple models
- **Feature Selection**: Automatic feature importance
- **Hyperparameter Tuning**: Automated parameter optimization
- **Real-time Learning**: Online learning capabilities
- **Advanced Metrics**: More sophisticated performance measures

## 📝 License

This AI/ML system is part of the Pablo AI Trading project and follows the same license terms.

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests
3. Update documentation
4. Ensure backward compatibility
5. Test with feature flag disabled

---

**Note**: This AI/ML system is designed to be completely independent and optional. It does not modify any existing trading logic and can be safely enabled/disabled via the feature flag.
