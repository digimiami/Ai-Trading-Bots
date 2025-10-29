/**
 * Auto-Optimization Service
 * Continuously learns from trading results and automatically optimizes strategies
 */

import { supabase } from '../lib/supabase';
import { openAIService } from './openai';
import type { TradingStrategy, AdvancedStrategyConfig } from '../types/trading';

interface TradeAnalysis {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  status: 'open' | 'closed';
  timestamp: string;
  indicators?: {
    rsi?: number;
    adx?: number;
    bbWidth?: number;
    emaSlope?: number;
    atrPercentage?: number;
  };
}

interface BotPerformance {
  botId: string;
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnL: number;
  avgWinPnL: number;
  avgLossPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  bestPerformingPair: string;
  worstPerformingPair: string;
  recentTrades: TradeAnalysis[];
  timeRange: string;
  currentStrategy: TradingStrategy;
  currentAdvancedConfig?: AdvancedStrategyConfig;
}

export interface OptimizationResult {
  success: boolean;
  botId: string;
  originalStrategy: TradingStrategy;
  optimizedStrategy: TradingStrategy;
  originalAdvancedConfig?: AdvancedStrategyConfig;
  optimizedAdvancedConfig?: AdvancedStrategyConfig;
  reasoning: string;
  expectedImprovement: string;
  confidence: number;
  changes: {
    parameter: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }[];
}

class AutoOptimizer {
  private optimizationInterval: number = 3600000; // 1 hour default
  private minTradesForOptimization: number = 10;

  /**
   * Analyze bot performance and generate optimization recommendations
   */
  async analyzeBotPerformance(botId: string): Promise<BotPerformance | null> {
    try {
      // Fetch bot details
      const { data: bot, error: botError } = await supabase
        .from('trading_bots')
        .select('*')
        .eq('id', botId)
        .single();

      if (botError || !bot) {
        console.error('Error fetching bot:', botError);
        return null;
      }

      // Fetch recent trades (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('bot_id', botId)
        .gte('timestamp', thirtyDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (tradesError) {
        console.error('Error fetching trades:', tradesError);
        return null;
      }

      if (!trades || trades.length < this.minTradesForOptimization) {
        console.log(`Insufficient trades for optimization. Need ${this.minTradesForOptimization}, have ${trades?.length || 0}`);
        return null;
      }

      // Calculate performance metrics
      const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
      const winningTrades = closedTrades.filter(t => t.pnl! > 0);
      const losingTrades = closedTrades.filter(t => t.pnl! <= 0);

      const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const winRate = closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * 100 
        : 0;

      const avgWinPnL = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length
        : 0;

      const avgLossPnL = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losingTrades.length
        : 0;

      const profitFactor = avgLossPnL !== 0 
        ? Math.abs(avgWinPnL / avgLossPnL) 
        : 0;

      // Calculate max drawdown
      let maxDrawdown = 0;
      let peak = 0;
      let cumulativePnL = 0;
      for (const trade of closedTrades.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )) {
        cumulativePnL += trade.pnl || 0;
        if (cumulativePnL > peak) peak = cumulativePnL;
        const drawdown = peak - cumulativePnL;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      // Group trades by symbol
      const tradesBySymbol = closedTrades.reduce((acc, trade) => {
        if (!acc[trade.symbol]) acc[trade.symbol] = [];
        acc[trade.symbol].push(trade);
        return acc;
      }, {} as Record<string, typeof closedTrades>);

      let bestPair = '';
      let worstPair = '';
      let bestPnL = -Infinity;
      let worstPnL = Infinity;

      for (const [symbol, symbolTrades] of Object.entries(tradesBySymbol)) {
        const symbolPnL = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        if (symbolPnL > bestPnL) {
          bestPnL = symbolPnL;
          bestPair = symbol;
        }
        if (symbolPnL < worstPnL) {
          worstPnL = symbolPnL;
          worstPair = symbol;
        }
      }

      // Calculate Sharpe Ratio (simplified)
      const returns = closedTrades.map(t => (t.pnl || 0) / (t.entry_price || 1));
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const sharpeRatio = variance !== 0 ? avgReturn / Math.sqrt(variance) : 0;

      const strategy = bot.strategy as TradingStrategy;
      const strategyConfig = bot.strategy_config as AdvancedStrategyConfig | undefined;

      return {
        botId,
        totalTrades: trades.length,
        closedTrades: closedTrades.length,
        winRate,
        totalPnL,
        avgWinPnL,
        avgLossPnL,
        maxDrawdown,
        sharpeRatio,
        profitFactor,
        bestPerformingPair: bestPair,
        worstPerformingPair: worstPair,
        recentTrades: trades.slice(0, 50).map(t => ({
          id: t.id,
          symbol: t.symbol,
          side: t.side,
          entryPrice: t.entry_price,
          exitPrice: t.exit_price,
          pnl: t.pnl,
          status: t.status,
          timestamp: t.timestamp
        })),
        timeRange: '30 days',
        currentStrategy: strategy,
        currentAdvancedConfig: strategyConfig
      };
    } catch (error) {
      console.error('Error analyzing bot performance:', error);
      return null;
    }
  }

  /**
   * Optimize strategy using OpenAI
   */
  async optimizeStrategy(botId: string): Promise<OptimizationResult | null> {
    try {
      const performance = await this.analyzeBotPerformance(botId);
      
      if (!performance) {
        return null;
      }

      // Use OpenAI to optimize the strategy
      const optimization = await openAIService.optimizeStrategy(
        {
          strategy: performance.currentStrategy,
          advancedConfig: performance.currentAdvancedConfig
        },
        performance.recentTrades.map(t => ({
          symbol: t.symbol,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice || t.entryPrice,
          pnl: t.pnl || 0,
          indicators: t.indicators || {},
          outcome: (t.pnl || 0) > 0 ? 'win' as const : 'loss' as const,
          timestamp: t.timestamp
        })),
        {
          winRate: performance.winRate,
          totalPnL: performance.totalPnL,
          avgWin: performance.avgWinPnL,
          avgLoss: performance.avgLossPnL,
          profitFactor: performance.profitFactor,
          sharpeRatio: performance.sharpeRatio,
          maxDrawdown: performance.maxDrawdown
        }
      );

      // Extract changes
      const changes: OptimizationResult['changes'] = [];
      
      // Compare strategy parameters
      const originalStrategy = performance.currentStrategy;
      const optimizedStrategy = optimization.strategy || originalStrategy;
      
      Object.keys(optimizedStrategy).forEach(key => {
        const oldValue = (originalStrategy as any)[key];
        const newValue = (optimizedStrategy as any)[key];
        if (oldValue !== newValue) {
          changes.push({
            parameter: `strategy.${key}`,
            oldValue,
            newValue,
            reason: optimization.reasoning || 'AI optimization'
          });
        }
      });

      // Compare advanced config if exists
      if (performance.currentAdvancedConfig && optimization.advancedConfig) {
        Object.keys(optimization.advancedConfig).forEach(key => {
          const oldValue = (performance.currentAdvancedConfig as any)[key];
          const newValue = (optimization.advancedConfig as any)[key];
          if (oldValue !== newValue) {
            changes.push({
              parameter: `advancedConfig.${key}`,
              oldValue,
              newValue,
              reason: optimization.reasoning || 'AI optimization'
            });
          }
        });
      }

      return {
        success: true,
        botId,
        originalStrategy,
        optimizedStrategy,
        originalAdvancedConfig: performance.currentAdvancedConfig,
        optimizedAdvancedConfig: optimization.advancedConfig || performance.currentAdvancedConfig,
        reasoning: optimization.reasoning || 'AI-generated optimization',
        expectedImprovement: optimization.expectedImprovement || 'Unknown',
        confidence: optimization.confidence || 0.7,
        changes
      };
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      return null;
    }
  }

  /**
   * Automatically apply optimization if confidence is high
   */
  async autoApplyOptimization(
    botId: string, 
    minConfidence: number = 0.75
  ): Promise<boolean> {
    try {
      const optimization = await this.optimizeStrategy(botId);
      
      if (!optimization || !optimization.success) {
        return false;
      }

      // Only apply if confidence is high enough
      if (optimization.confidence < minConfidence) {
        console.log(`Optimization confidence ${optimization.confidence} below threshold ${minConfidence}`);
        return false;
      }

      // Store optimization record
      const performanceBefore = await this.getPerformanceSnapshot(botId);
      
      const { error: recordError } = await supabase
        .from('strategy_optimizations')
        .insert({
          bot_id: botId,
          original_strategy: optimization.originalStrategy,
          suggested_changes: {
            strategy: optimization.optimizedStrategy,
            advancedConfig: optimization.optimizedAdvancedConfig
          },
          reasoning: optimization.reasoning,
          expected_improvement: parseFloat(optimization.expectedImprovement.replace(/[^0-9.-]/g, '')) || 0,
          performance_before: performanceBefore,
          status: 'applied'
        });

      if (recordError) {
        console.error('Error recording optimization:', recordError);
      }

      // Log to activity logs with performance snapshot
      await this.logOptimization(botId, {
        ...optimization,
        // Include performance before in details
      });

      // Apply the optimization
      const { error: updateError } = await supabase
        .from('trading_bots')
        .update({
          strategy: optimization.optimizedStrategy,
          strategy_config: optimization.optimizedAdvancedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', botId);

      if (updateError) {
        console.error('Error applying optimization:', updateError);
        return false;
      }

      // Log the optimization to bot activity logs
      await this.logOptimization(botId, optimization);

      console.log(`✅ Successfully optimized bot ${botId}`);
      return true;
    } catch (error) {
      console.error('Error auto-applying optimization:', error);
      return false;
    }
  }

  /**
   * Get performance snapshot for comparison
   */
  private async getPerformanceSnapshot(botId: string) {
    const { data: bot } = await supabase
      .from('trading_bots')
      .select('pnl, pnl_percentage, total_trades, win_rate')
      .eq('id', botId)
      .single();

    return bot || {};
  }

  /**
   * Log optimization to bot activity logs
   */
  private async logOptimization(botId: string, optimization: OptimizationResult): Promise<void> {
    try {
      const changeSummary = optimization.changes.map(change => 
        `${change.parameter}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`
      ).join(', ');

      const logMessage = `AI/ML Optimization Applied (Confidence: ${(optimization.confidence * 100).toFixed(1)}%)`;
      
      const logDetails = {
        type: 'ai_ml_optimization',
        confidence: optimization.confidence,
        reasoning: optimization.reasoning,
        expectedImprovement: optimization.expectedImprovement,
        changes: optimization.changes,
        changeSummary,
        optimizedStrategy: optimization.optimizedStrategy,
        optimizedAdvancedConfig: optimization.optimizedAdvancedConfig,
        originalStrategy: optimization.originalStrategy,
        originalAdvancedConfig: optimization.originalAdvancedConfig
      };

      // Log to bot_activity_logs table
      const { error } = await supabase
        .from('bot_activity_logs')
        .insert({
          bot_id: botId,
          level: 'success',
          category: 'strategy',
          message: logMessage,
          details: logDetails,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging optimization:', error);
      }
    } catch (error) {
      console.error('Error logging optimization:', error);
    }
  }

  /**
   * Learn from a completed trade
   */
  async learnFromTrade(tradeId: string, botId: string): Promise<void> {
    try {
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error || !trade || trade.status !== 'closed') {
        return;
      }

      // Store learning data
      const { error: learnError } = await supabase
        .from('ai_learning_data')
        .insert({
          bot_id: botId,
          trade_id: tradeId,
          symbol: trade.symbol,
          market_conditions: {
            side: trade.side,
            entryPrice: trade.entry_price,
            exitPrice: trade.exit_price
          },
          outcome: (trade.pnl || 0) > 0 ? 'win' : 'loss',
          pnl: trade.pnl || 0
        });

      if (learnError) {
        console.error('Error storing learning data:', learnError);
      }
    } catch (error) {
      console.error('Error learning from trade:', error);
    }
  }

  /**
   * Run optimization for all active bots
   */
  async optimizeAllActiveBots(userId?: string): Promise<void> {
    try {
      let query = supabase
        .from('trading_bots')
        .select('id, user_id, ai_ml_enabled')
        .eq('status', 'running')
        .eq('ai_ml_enabled', true);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: bots, error } = await query;

      if (error || !bots || bots.length === 0) {
        console.log('No active bots with AI/ML enabled for optimization');
        return;
      }

      console.log(`Running optimization for ${bots.length} active bots...`);

      for (const bot of bots) {
        try {
          await this.autoApplyOptimization(bot.id, 0.7); // Lower threshold for automatic
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error optimizing bot ${bot.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error optimizing all bots:', error);
    }
  }
}

export const autoOptimizer = new AutoOptimizer();

