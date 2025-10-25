/**
 * AI/ML Bot Integration Example
 * Shows how to integrate AI/ML predictions with existing trading bots
 */

import { getAiDecision, trainModel, getLatestModel } from './sdk';
import type { MarketSnapshot } from './server/features';

// Example: Enhanced Bot Executor with AI/ML Integration
export class AiEnhancedBotExecutor {
  private botId: string;
  private symbol: string;
  private aiEnabled: boolean = true;

  constructor(botId: string, symbol: string) {
    this.botId = botId;
    this.symbol = symbol;
  }

  /**
   * Enhanced trade decision with AI/ML analysis
   */
  async makeTradeDecision(marketData: any): Promise<{
    shouldTrade: boolean;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    aiReason: string;
  }> {
    if (!this.aiEnabled) {
      // Fallback to original bot logic
      return this.originalBotLogic(marketData);
    }

    try {
      // Create market snapshot for AI analysis
      const snapshot: MarketSnapshot = {
        symbol: this.symbol,
        timestamp: new Date(),
        price: marketData.price,
        volume: marketData.volume,
        high: marketData.high,
        low: marketData.low,
        open: marketData.open,
        close: marketData.close,
        // Add more market data as needed
      };

      // Get AI prediction
      const aiDecision = await getAiDecision(snapshot);
      
      console.log(`🤖 AI Analysis for ${this.symbol}:`, {
        signal: aiDecision.signal,
        confidence: aiDecision.confidence,
        features: aiDecision.features
      });

      // Apply confidence threshold
      const minConfidence = 0.7; // Only trade if AI is 70%+ confident
      
      if (aiDecision.confidence >= minConfidence) {
        return {
          shouldTrade: true,
          signal: aiDecision.signal,
          confidence: aiDecision.confidence,
          aiReason: `AI predicts ${aiDecision.signal} with ${(aiDecision.confidence * 100).toFixed(1)}% confidence`
        };
      } else {
        return {
          shouldTrade: false,
          signal: 'HOLD',
          confidence: aiDecision.confidence,
          aiReason: `AI confidence too low (${(aiDecision.confidence * 100).toFixed(1)}%), holding position`
        };
      }

    } catch (error) {
      console.error('❌ AI analysis failed, falling back to original logic:', error);
      return this.originalBotLogic(marketData);
    }
  }

  /**
   * Original bot logic (fallback)
   */
  private originalBotLogic(marketData: any): {
    shouldTrade: boolean;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    aiReason: string;
  } {
    // Your existing bot logic here
    return {
      shouldTrade: true,
      signal: 'BUY', // Example
      confidence: 0.5,
      aiReason: 'Using original bot logic (AI unavailable)'
    };
  }

  /**
   * Train AI model with recent trades
   */
  async trainAiModel(): Promise<boolean> {
    try {
      console.log(`🤖 Training AI model for bot ${this.botId}...`);
      const result = await trainModel();
      
      if (result.success) {
        console.log(`✅ AI model trained successfully:`, {
          modelId: result.modelId,
          version: result.version,
          accuracy: result.metrics.accuracy
        });
        return true;
      } else {
        console.log(`❌ AI model training failed:`, result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ AI training error:', error);
      return false;
    }
  }

  /**
   * Get AI model performance metrics
   */
  async getAiMetrics() {
    try {
      const model = await getLatestModel();
      return {
        accuracy: model?.metrics?.accuracy || 0,
        precision: model?.metrics?.precision || 0,
        recall: model?.metrics?.recall || 0,
        f1Score: model?.metrics?.f1Score || 0,
        lastUpdated: model?.created_at || null
      };
    } catch (error) {
      console.error('❌ Failed to get AI metrics:', error);
      return null;
    }
  }
}

// Example: Integration with existing bot executor
export function integrateAiWithBotExecutor(botExecutor: any) {
  const aiEnhanced = new AiEnhancedBotExecutor(
    botExecutor.botId, 
    botExecutor.symbol
  );

  // Override the original executeTrade method
  const originalExecuteTrade = botExecutor.executeTrade.bind(botExecutor);
  
  botExecutor.executeTrade = async function(marketData: any) {
    // Get AI decision first
    const aiDecision = await aiEnhanced.makeTradeDecision(marketData);
    
    console.log(`🤖 Bot ${this.botId} AI Decision:`, aiDecision);
    
    // Only proceed if AI recommends trading
    if (aiDecision.shouldTrade) {
      // Add AI context to the trade
      const enhancedMarketData = {
        ...marketData,
        aiSignal: aiDecision.signal,
        aiConfidence: aiDecision.confidence,
        aiReason: aiDecision.aiReason
      };
      
      // Execute trade with AI-enhanced data
      return originalExecuteTrade(enhancedMarketData);
    } else {
      console.log(`🤖 Bot ${this.botId} skipping trade: ${aiDecision.aiReason}`);
      return { success: false, reason: aiDecision.aiReason };
    }
  };

  return aiEnhanced;
}

// Example usage in your bot executor
export async function exampleUsage() {
  // 1. Train the AI model first
  const aiEnhanced = new AiEnhancedBotExecutor('bot-123', 'BTCUSDT');
  await aiEnhanced.trainAiModel();
  
  // 2. Get AI metrics
  const metrics = await aiEnhanced.getAiMetrics();
  console.log('AI Model Performance:', metrics);
  
  // 3. Make trading decisions
  const marketData = {
    price: 50000,
    volume: 1000000,
    high: 51000,
    low: 49000,
    open: 49500,
    close: 50000
  };
  
  const decision = await aiEnhanced.makeTradeDecision(marketData);
  console.log('Trading Decision:', decision);
}
