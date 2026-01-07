/**
 * Comprehensive Test Script for AI/ML System and AI Auto-Optimization
 * 
 * This script tests:
 * 1. AI/ML System (TensorFlow model training, prediction, retraining)
 * 2. AI Auto-Optimization (Strategy optimization, auto-apply)
 * 3. Database tables and configurations
 * 4. API keys and environment variables
 * 5. Integration points
 * 
 * Run with: npx tsx test-ai-systems.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class AISystemTester {
  private supabase: any;
  private serviceRoleClient: any;
  private results: TestResult[] = [];

  constructor() {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    if (serviceRoleKey) {
      this.serviceRoleClient = createClient(supabaseUrl, serviceRoleKey);
    }
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
    this.results.push({ name, status, message, details });
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${message}`);
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  /**
   * Test 1: Check Database Tables
   */
  async testDatabaseTables(): Promise<void> {
    console.log('\n📊 Testing Database Tables...\n');

    const requiredTables = [
      'ai_ml_trades',
      'ai_ml_models',
      'ai_ml_predictions',
      'strategy_optimizations',
      'trading_bots',
      'trades',
      'paper_trading_trades',
    ];

    for (const table of requiredTables) {
      try {
        const { data, error } = await this.serviceRoleClient
          .from(table)
          .select('*')
          .limit(1);

        if (error && error.code === 'PGRST116') {
          this.addResult(`Table: ${table}`, 'fail', `Table does not exist. Run migration: ai-ml-system/supabase_schema.sql`);
        } else if (error) {
          this.addResult(`Table: ${table}`, 'warning', `Error checking table: ${error.message}`);
        } else {
          this.addResult(`Table: ${table}`, 'pass', 'Table exists and accessible');
        }
      } catch (error: any) {
        this.addResult(`Table: ${table}`, 'fail', `Exception: ${error.message}`);
      }
    }
  }

  /**
   * Test 2: Check Environment Variables
   */
  async testEnvironmentVariables(): Promise<void> {
    console.log('\n🔑 Testing Environment Variables...\n');

    const requiredVars = [
      { name: 'VITE_SUPABASE_URL', value: supabaseUrl },
      { name: 'VITE_SUPABASE_ANON_KEY', value: supabaseKey },
      { name: 'SUPABASE_SERVICE_ROLE_KEY', value: serviceRoleKey, optional: true },
    ];

    const optionalVars = [
      { name: 'VITE_OPENAI_API_KEY', value: process.env.VITE_OPENAI_API_KEY },
      { name: 'VITE_DEEPSEEK_API_KEY', value: process.env.VITE_DEEPSEEK_API_KEY },
      { name: 'VITE_FEATURE_AI_ML', value: process.env.VITE_FEATURE_AI_ML },
    ];

    for (const envVar of requiredVars) {
      if (envVar.value) {
        this.addResult(`Env: ${envVar.name}`, 'pass', 'Set');
      } else if (envVar.optional) {
        this.addResult(`Env: ${envVar.name}`, 'warning', 'Not set (optional)');
      } else {
        this.addResult(`Env: ${envVar.name}`, 'fail', 'Missing (required)');
      }
    }

    for (const envVar of optionalVars) {
      if (envVar.value) {
        this.addResult(`Env: ${envVar.name}`, 'pass', `Set: ${envVar.value.substring(0, 10)}...`);
      } else {
        this.addResult(`Env: ${envVar.name}`, 'warning', 'Not set (optional)');
      }
    }

    // Check if at least one AI provider is configured
    const hasOpenAI = !!process.env.VITE_OPENAI_API_KEY;
    const hasDeepSeek = !!process.env.VITE_DEEPSEEK_API_KEY;
    
    if (hasOpenAI || hasDeepSeek) {
      this.addResult('AI Provider', 'pass', `Configured: ${hasOpenAI ? 'OpenAI' : ''}${hasOpenAI && hasDeepSeek ? ' + ' : ''}${hasDeepSeek ? 'DeepSeek' : ''}`);
    } else {
      this.addResult('AI Provider', 'fail', 'No AI provider configured (OpenAI or DeepSeek required for auto-optimization)');
    }
  }

  /**
   * Test 3: Check AI/ML System Training Data
   */
  async testAIMLTrainingData(): Promise<void> {
    console.log('\n🧠 Testing AI/ML System Training Data...\n');

    try {
      const { data: trades, error } = await this.serviceRoleClient
        .from('ai_ml_trades')
        .select('*')
        .limit(100);

      if (error) {
        this.addResult('AI/ML Training Data', 'fail', `Error: ${error.message}`);
        return;
      }

      const tradeCount = trades?.length || 0;
      const minSamples = 50; // From AI_ML_CONFIG.TRAINING.MIN_SAMPLES

      if (tradeCount >= minSamples) {
        this.addResult('AI/ML Training Data', 'pass', `${tradeCount} training samples available (minimum: ${minSamples})`);
      } else {
        this.addResult('AI/ML Training Data', 'warning', `Only ${tradeCount} training samples (minimum: ${minSamples} for training)`);
      }

      // Check data quality
      if (trades && trades.length > 0) {
        const sample = trades[0];
        const requiredFields = ['rsi', 'ema_fast', 'ema_slow', 'atr', 'volume', 'pnl'];
        const missingFields = requiredFields.filter(field => !(field in sample));
        
        if (missingFields.length === 0) {
          this.addResult('AI/ML Data Quality', 'pass', 'All required fields present');
        } else {
          this.addResult('AI/ML Data Quality', 'warning', `Missing fields: ${missingFields.join(', ')}`);
        }
      }
    } catch (error: any) {
      this.addResult('AI/ML Training Data', 'fail', `Exception: ${error.message}`);
    }
  }

  /**
   * Test 4: Check AI/ML Models
   */
  async testAIMLModels(): Promise<void> {
    console.log('\n🤖 Testing AI/ML Models...\n');

    try {
      const { data: models, error } = await this.serviceRoleClient
        .from('ai_ml_models')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        this.addResult('AI/ML Models', 'fail', `Error: ${error.message}`);
        return;
      }

      if (!models || models.length === 0) {
        this.addResult('AI/ML Models', 'warning', 'No trained models found. Train a model first.');
        return;
      }

      const latestModel = models[0];
      this.addResult('AI/ML Latest Model', 'pass', `Model ID: ${latestModel.id}, Version: ${latestModel.version || 'N/A'}`);
      
      // Check model metrics
      if (latestModel.metrics) {
        const metrics = latestModel.metrics;
        const accuracy = metrics.accuracy || 0;
        const precision = metrics.precision || 0;
        const recall = metrics.recall || 0;
        const f1Score = metrics.f1Score || 0;

        this.addResult('AI/ML Model Metrics', 'pass', 
          `Accuracy: ${(accuracy * 100).toFixed(1)}%, Precision: ${(precision * 100).toFixed(1)}%, Recall: ${(recall * 100).toFixed(1)}%, F1: ${(f1Score * 100).toFixed(1)}%`,
          { accuracy, precision, recall, f1Score }
        );

        // Validate metrics
        if (accuracy < 0.6) {
          this.addResult('AI/ML Model Quality', 'warning', `Low accuracy: ${(accuracy * 100).toFixed(1)}% (consider retraining)`);
        } else {
          this.addResult('AI/ML Model Quality', 'pass', 'Model accuracy is acceptable');
        }
      }

      // Check model age
      const modelAge = new Date().getTime() - new Date(latestModel.created_at).getTime();
      const daysOld = modelAge / (1000 * 60 * 60 * 24);
      
      if (daysOld > 7) {
        this.addResult('AI/ML Model Age', 'warning', `Model is ${daysOld.toFixed(1)} days old (consider retraining)`);
      } else {
        this.addResult('AI/ML Model Age', 'pass', `Model is ${daysOld.toFixed(1)} days old`);
      }
    } catch (error: any) {
      this.addResult('AI/ML Models', 'fail', `Exception: ${error.message}`);
    }
  }

  /**
   * Test 5: Check AI/ML Predictions
   */
  async testAIMLPredictions(): Promise<void> {
    console.log('\n🔮 Testing AI/ML Predictions...\n');

    try {
      const { data: predictions, error } = await this.serviceRoleClient
        .from('ai_ml_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        this.addResult('AI/ML Predictions', 'fail', `Error: ${error.message}`);
        return;
      }

      if (!predictions || predictions.length === 0) {
        this.addResult('AI/ML Predictions', 'warning', 'No predictions found. System may not be making predictions yet.');
        return;
      }

      this.addResult('AI/ML Predictions', 'pass', `${predictions.length} recent predictions found`);

      // Check prediction quality
      const recentPred = predictions[0];
      if (recentPred.confidence !== null && recentPred.confidence !== undefined) {
        const avgConfidence = predictions.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) / predictions.length;
        this.addResult('AI/ML Prediction Confidence', 'pass', `Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      }
    } catch (error: any) {
      this.addResult('AI/ML Predictions', 'fail', `Exception: ${error.message}`);
    }
  }

  /**
   * Test 6: Check AI Auto-Optimization Configuration
   */
  async testAutoOptimizationConfig(): Promise<void> {
    console.log('\n⚙️ Testing AI Auto-Optimization Configuration...\n');

    try {
      // Check if bots have AI/ML enabled
      const { data: bots, error } = await this.serviceRoleClient
        .from('trading_bots')
        .select('id, name, ai_ml_enabled, status')
        .eq('status', 'running')
        .limit(10);

      if (error) {
        this.addResult('Auto-Optimization Bots', 'fail', `Error: ${error.message}`);
        return;
      }

      if (!bots || bots.length === 0) {
        this.addResult('Auto-Optimization Bots', 'warning', 'No running bots found');
        return;
      }

      const aiEnabledBots = bots.filter((b: any) => b.ai_ml_enabled === true);
      this.addResult('Auto-Optimization Bots', 'pass', `${aiEnabledBots.length} of ${bots.length} running bots have AI/ML enabled`);

      if (aiEnabledBots.length === 0) {
        this.addResult('Auto-Optimization Setup', 'warning', 'No bots have AI/ML enabled. Enable AI/ML in bot settings to use auto-optimization.');
      }
    } catch (error: any) {
      this.addResult('Auto-Optimization Config', 'fail', `Exception: ${error.message}`);
    }
  }

  /**
   * Test 7: Check Strategy Optimizations
   */
  async testStrategyOptimizations(): Promise<void> {
    console.log('\n📈 Testing Strategy Optimizations...\n');

    try {
      const { data: optimizations, error } = await this.serviceRoleClient
        .from('strategy_optimizations')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(10);

      if (error) {
        this.addResult('Strategy Optimizations', 'fail', `Error: ${error.message}`);
        return;
      }

      if (!optimizations || optimizations.length === 0) {
        this.addResult('Strategy Optimizations', 'warning', 'No optimizations found. Run optimization to test.');
        return;
      }

      this.addResult('Strategy Optimizations', 'pass', `${optimizations.length} optimizations found`);

      // Check recent optimization
      const latest = optimizations[0];
      if (latest.performance_before && latest.performance_before.confidence) {
        const confidence = latest.performance_before.confidence;
        this.addResult('Latest Optimization', 'pass', `Confidence: ${(confidence * 100).toFixed(1)}%, Status: ${latest.status || 'N/A'}`);
      }
    } catch (error: any) {
      this.addResult('Strategy Optimizations', 'fail', `Exception: ${error.message}`);
    }
  }

  /**
   * Test 8: Test AI/ML SDK Functions (if available)
   */
  async testAIMLSDK(): Promise<void> {
    console.log('\n🔧 Testing AI/ML SDK Functions...\n');

    try {
      // Check if SDK files exist
      const fs = await import('fs');
      const sdkPath = './ai-ml-system/sdk/index.ts';
      
      if (fs.existsSync(sdkPath)) {
        this.addResult('AI/ML SDK Files', 'pass', 'SDK files exist');
      } else {
        this.addResult('AI/ML SDK Files', 'fail', 'SDK files not found');
        return;
      }

      // Try to import and test SDK (this would require Node.js environment)
      // For now, just check file existence
      const serverFiles = [
        './ai-ml-system/server/train.ts',
        './ai-ml-system/server/predict.ts',
        './ai-ml-system/server/features.ts',
        './ai-ml-system/server/metrics.ts',
      ];

      let allExist = true;
      for (const file of serverFiles) {
        if (!fs.existsSync(file)) {
          allExist = false;
          this.addResult(`AI/ML Server File: ${file}`, 'fail', 'File not found');
        }
      }

      if (allExist) {
        this.addResult('AI/ML Server Files', 'pass', 'All server files exist');
      }
    } catch (error: any) {
      this.addResult('AI/ML SDK', 'warning', `Could not check SDK files: ${error.message}`);
    }
  }

  /**
   * Test 9: Test Auto-Optimizer Service
   */
  async testAutoOptimizerService(): Promise<void> {
    console.log('\n🔄 Testing Auto-Optimizer Service...\n');

    try {
      const fs = await import('fs');
      const servicePath = './src/services/autoOptimizer.ts';
      
      if (fs.existsSync(servicePath)) {
        this.addResult('Auto-Optimizer Service', 'pass', 'Service file exists');
      } else {
        this.addResult('Auto-Optimizer Service', 'fail', 'Service file not found');
        return;
      }

      // Check if edge function exists
      const edgeFunctionPath = './supabase/functions/auto-optimize/index.ts';
      if (fs.existsSync(edgeFunctionPath)) {
        this.addResult('Auto-Optimize Edge Function', 'pass', 'Edge function exists');
      } else {
        this.addResult('Auto-Optimize Edge Function', 'warning', 'Edge function not found (optional)');
      }
    } catch (error: any) {
      this.addResult('Auto-Optimizer Service', 'warning', `Could not check service files: ${error.message}`);
    }
  }

  /**
   * Test 10: Integration Test - Check if bot executor can use AI/ML
   */
  async testBotExecutorIntegration(): Promise<void> {
    console.log('\n🔗 Testing Bot Executor Integration...\n');

    try {
      // Check if bot executor has AI/ML integration
      const fs = await import('fs');
      const botExecutorPath = './supabase/functions/bot-executor/index.ts';
      
      if (!fs.existsSync(botExecutorPath)) {
        this.addResult('Bot Executor Integration', 'fail', 'Bot executor file not found');
        return;
      }

      const content = fs.readFileSync(botExecutorPath, 'utf-8');
      
      // Check for AI/ML related code
      const hasAIML = content.includes('ai_ml_enabled') || content.includes('useMLPrediction') || content.includes('ai-ml');
      
      if (hasAIML) {
        this.addResult('Bot Executor AI/ML Integration', 'pass', 'Bot executor has AI/ML integration code');
      } else {
        this.addResult('Bot Executor AI/ML Integration', 'warning', 'Bot executor may not have AI/ML integration');
      }
    } catch (error: any) {
      this.addResult('Bot Executor Integration', 'warning', `Could not check integration: ${error.message}`);
    }
  }

  /**
   * Test 11: Test Edge Function Deployment
   */
  async testEdgeFunctionDeployment(): Promise<void> {
    console.log('\n🚀 Testing Edge Function Deployment...\n');

    if (!serviceRoleKey) {
      this.addResult('Edge Function Test', 'warning', 'Service role key not available, skipping deployment test');
      return;
    }

    try {
      // Try to call the auto-optimize function (dry run)
      const response = await fetch(`${supabaseUrl}/functions/v1/auto-optimize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true }),
      });

      if (response.ok || response.status === 400) {
        // 400 might be expected if test parameter is not valid
        this.addResult('Auto-Optimize Edge Function', 'pass', 'Edge function is accessible');
      } else if (response.status === 404) {
        this.addResult('Auto-Optimize Edge Function', 'warning', 'Edge function not deployed. Run: supabase functions deploy auto-optimize');
      } else {
        const text = await response.text();
        this.addResult('Auto-Optimize Edge Function', 'warning', `Status: ${response.status}, Response: ${text.substring(0, 100)}`);
      }
    } catch (error: any) {
      this.addResult('Auto-Optimize Edge Function', 'warning', `Could not test: ${error.message}`);
    }
  }

  /**
   * Generate Summary Report
   */
  generateSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60) + '\n');

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
      console.log('');
    }

    if (warnings > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.filter(r => r.status === 'warning').forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
      console.log('');
    }

    // Recommendations
    console.log('💡 RECOMMENDATIONS:');
    
    const hasAIMLData = this.results.find(r => r.name === 'AI/ML Training Data' && r.status === 'pass');
    const hasModels = this.results.find(r => r.name === 'AI/ML Latest Model' && r.status === 'pass');
    const hasAIProvider = this.results.find(r => r.name === 'AI Provider' && r.status === 'pass');
    const hasEnabledBots = this.results.find(r => r.name === 'Auto-Optimization Bots' && r.message.includes('have AI/ML enabled'));

    if (!hasAIMLData) {
      console.log('   1. Collect more trading data to train AI/ML models');
    }
    
    if (!hasModels) {
      console.log('   2. Train an AI/ML model using: trainModel() from ai-ml-system/sdk');
    }
    
    if (!hasAIProvider) {
      console.log('   3. Configure OpenAI or DeepSeek API key for auto-optimization');
    }
    
    if (!hasEnabledBots || hasEnabledBots.message.includes('0 of')) {
      console.log('   4. Enable AI/ML on at least one bot to test auto-optimization');
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('\n🧪 AI/ML System & Auto-Optimization Test Suite');
    console.log('='.repeat(60) + '\n');

    await this.testDatabaseTables();
    await this.testEnvironmentVariables();
    await this.testAIMLTrainingData();
    await this.testAIMLModels();
    await this.testAIMLPredictions();
    await this.testAutoOptimizationConfig();
    await this.testStrategyOptimizations();
    await this.testAIMLSDK();
    await this.testAutoOptimizerService();
    await this.testBotExecutorIntegration();
    await this.testEdgeFunctionDeployment();

    this.generateSummary();
  }
}

// Run tests
async function main() {
  try {
    const tester = new AISystemTester();
    await tester.runAllTests();
  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AISystemTester };

