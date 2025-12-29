@echo off
echo 🚀 Setting up AI/ML Trading System...

REM Change to workspace directory
set "WORKSPACE_DIR=%~dp0"
cd /d "%WORKSPACE_DIR%"
echo 📂 Changed to workspace directory: %CD%

echo 📝 Creating .env file...
(
echo # Pablo AI Trading - Environment Configuration
echo.
echo # ============================================
echo # SUPABASE CONFIGURATION
echo # ============================================
echo # Your Supabase project URL
echo SUPABASE_URL=https://your-project.supabase.co
echo.
echo # Supabase service role key ^(NEVER expose to browser^)
echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
echo.
echo # Supabase anon key ^(safe for browser^)
echo SUPABASE_ANON_KEY=your_anon_key_here
echo.
echo # ============================================
echo # AI/ML SYSTEM FEATURE FLAG
echo # ============================================
echo # Enable AI/ML system ^(set to 1 to enable^)
echo VITE_FEATURE_AI_ML=1
echo.
echo # ============================================
echo # AI/ML MODEL CONFIGURATION
echo # ============================================
echo # Model training configuration
echo AI_ML_TRAIN_SPLIT=0.8
echo AI_ML_VALIDATION_SPLIT=0.2
echo AI_ML_EPOCHS=100
echo AI_ML_BATCH_SIZE=32
echo AI_ML_LEARNING_RATE=0.001
echo AI_ML_MIN_SAMPLES=100
echo AI_ML_RETRAIN_THRESHOLD=50
echo.
echo # Prediction thresholds
echo AI_ML_BUY_THRESHOLD=0.6
echo AI_ML_SELL_THRESHOLD=0.4
echo.
echo # Feature engineering periods
echo AI_ML_RSI_PERIOD=14
echo AI_ML_EMA_FAST_PERIOD=12
echo AI_ML_EMA_SLOW_PERIOD=26
echo AI_ML_ATR_PERIOD=14
echo AI_ML_VOLUME_SMA_PERIOD=20
echo.
echo # ============================================
echo # STORAGE CONFIGURATION
echo # ============================================
echo # Supabase storage bucket for models
echo AI_ML_STORAGE_BUCKET=ai-ml-models
echo.
echo # ============================================
echo # DEVELOPMENT/DEBUGGING
echo # ============================================
echo # Enable debug logging for AI/ML system
echo AI_ML_DEBUG=false
echo.
echo # Enable detailed TensorFlow logging
echo TF_CPP_MIN_LOG_LEVEL=1
) > .env

echo ✅ .env file created successfully!

echo 📦 Installing AI/ML dependencies...
REM Ensure we're in the workspace directory
cd /d "%WORKSPACE_DIR%"
npm install @tensorflow/tfjs-node zod uuid
npm install --save-dev @types/uuid

echo ✅ Dependencies installed successfully!

echo.
echo 🎯 NEXT STEPS:
echo 1. Update your .env file with actual Supabase credentials
echo 2. Run the SQL schema in Supabase dashboard:
echo    - Copy contents of ai-ml-system/supabase_schema.sql
echo    - Paste in Supabase SQL Editor and execute
echo 3. Restart your development server: npm run dev
echo 4. Access AI/ML dashboard at: http://localhost:5173/ai-ml/dashboard
echo.
echo 🎉 AI/ML System setup completed!
pause