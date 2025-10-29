/**
 * Hook for auto-optimization features
 */

import { useState, useEffect, useCallback } from 'react';
import { autoOptimizer, type OptimizationResult } from '../services/autoOptimizer';

export function useAutoOptimizer(botId: string | null) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false);

  /**
   * Trigger optimization for a specific bot
   */
  const optimizeBot = useCallback(async () => {
    if (!botId) return;

    try {
      setIsOptimizing(true);
      setError(null);
      const result = await autoOptimizer.optimizeStrategy(botId);
      setOptimizationResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Optimization failed';
      setError(errorMessage);
      console.error('Optimization error:', err);
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [botId]);

  /**
   * Auto-apply optimization if confidence is high
   */
  const autoApplyOptimization = useCallback(async (minConfidence: number = 0.75) => {
    if (!botId) return false;

    try {
      setIsOptimizing(true);
      setError(null);
      const applied = await autoOptimizer.autoApplyOptimization(botId, minConfidence);
      if (applied) {
        // Refresh after applying
        await optimizeBot();
      }
      return applied;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Auto-apply failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsOptimizing(false);
    }
  }, [botId, optimizeBot]);

  /**
   * Setup automatic optimization (runs periodically)
   */
  useEffect(() => {
    if (!autoOptimizeEnabled || !botId) return;

    const interval = setInterval(async () => {
      try {
        await autoOptimizer.autoApplyOptimization(botId, 0.7);
      } catch (err) {
        console.error('Automatic optimization error:', err);
      }
    }, 3600000); // Run every hour

    return () => clearInterval(interval);
  }, [autoOptimizeEnabled, botId]);

  return {
    isOptimizing,
    optimizationResult,
    error,
    optimizeBot,
    autoApplyOptimization,
    autoOptimizeEnabled,
    setAutoOptimizeEnabled
  };
}

