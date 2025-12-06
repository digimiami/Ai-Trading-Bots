/**
 * Hook for auto-optimization features
 */

import { useState, useEffect, useCallback } from 'react';
import { autoOptimizer, type OptimizationResult } from '../services/autoOptimizer';
import { supabase } from '../lib/supabase';

export function useAutoOptimizer(botId: string | null) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizationInterval, setOptimizationInterval] = useState<number>(6); // Default 6 hours
  
  // Persist auto-pilot mode in localStorage
  const storageKey = botId ? `auto-pilot-enabled-${botId}` : null;
  const [autoOptimizeEnabled, setAutoOptimizeEnabledState] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      return saved === 'true';
    }
    return false;
  });

  // Fetch bot's optimization interval
  useEffect(() => {
    if (!botId) return;
    
    const fetchBotInterval = async () => {
      try {
        const { data, error } = await supabase
          .from('trading_bots')
          .select('optimization_interval_hours')
          .eq('id', botId)
          .single();
        
        if (!error && data?.optimization_interval_hours) {
          setOptimizationInterval(data.optimization_interval_hours);
        }
      } catch (err) {
        console.error('Error fetching optimization interval:', err);
      }
    };
    
    fetchBotInterval();
  }, [botId]);

  const setAutoOptimizeEnabled = (value: boolean) => {
    setAutoOptimizeEnabledState(value);
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, value.toString());
    }
  };

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
   * Setup automatic optimization (runs periodically based on bot's configured interval)
   */
  useEffect(() => {
    if (!autoOptimizeEnabled || !botId) return;

    // Convert hours to milliseconds
    const intervalMs = optimizationInterval * 60 * 60 * 1000;

    const interval = setInterval(async () => {
      try {
        await autoOptimizer.autoApplyOptimization(botId, 0.7);
      } catch (err) {
        console.error('Automatic optimization error:', err);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoOptimizeEnabled, botId, optimizationInterval]);

  return {
    isOptimizing,
    optimizationResult,
    error,
    optimizeBot,
    autoApplyOptimization,
    autoOptimizeEnabled,
    setAutoOptimizeEnabled,
    optimizationInterval,
    setOptimizationInterval
  };
}

