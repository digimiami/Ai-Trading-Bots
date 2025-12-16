import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BotTradeLimit {
  botId: string;
  tradesToday: number;
  maxTradesPerDay: number;
  isLimitReached: boolean;
  remainingTrades: number;
}

export const useBotTradeLimits = (botIds: string[]) => {
  const [limits, setLimits] = useState<Map<string, BotTradeLimit>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTradeLimits = async () => {
    if (botIds.length === 0) {
      setLimits(new Map());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get today's start time in UTC
      const now = new Date();
      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      // Fetch bot configurations with max_trades_per_day from strategyConfig
      const { data: botsData, error: botsError } = await supabase
        .from('trading_bots')
        .select('id, strategy_config')
        .in('id', botIds);

      if (botsError) throw botsError;

      // Fetch today's trade counts
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('bot_id, id')
        .in('bot_id', botIds)
        .gte('executed_at', todayStart.toISOString())
        .lte('executed_at', todayEnd.toISOString())
        .in('status', ['filled', 'completed', 'closed']); // Only count executed trades

      if (tradesError) throw tradesError;

      // Count trades per bot
      const tradesByBot = new Map<string, number>();
      if (tradesData) {
        tradesData.forEach(trade => {
          const count = tradesByBot.get(trade.bot_id) || 0;
          tradesByBot.set(trade.bot_id, count + 1);
        });
      }

      // Build limits map
      const limitsMap = new Map<string, BotTradeLimit>();
      
      if (botsData) {
        botsData.forEach(bot => {
          // Extract max_trades_per_day from strategyConfig
          let maxTradesPerDay = 8; // Default
          try {
            const strategyConfig = typeof bot.strategy_config === 'string' 
              ? JSON.parse(bot.strategy_config) 
              : bot.strategy_config;
            
            if (strategyConfig && typeof strategyConfig.max_trades_per_day === 'number') {
              maxTradesPerDay = strategyConfig.max_trades_per_day;
            }
          } catch (e) {
            console.warn('Failed to parse strategy_config for bot:', bot.id);
          }

          const tradesToday = tradesByBot.get(bot.id) || 0;
          const remainingTrades = Math.max(0, maxTradesPerDay - tradesToday);
          const isLimitReached = tradesToday >= maxTradesPerDay;

          limitsMap.set(bot.id, {
            botId: bot.id,
            tradesToday,
            maxTradesPerDay,
            isLimitReached,
            remainingTrades
          });
        });
      }

      setLimits(limitsMap);
    } catch (err: any) {
      // Don't log AbortError - it's just a cancelled request
      if (err?.name !== 'AbortError' && err?.message !== 'The user aborted a request.') {
        console.error('Error fetching trade limits:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch trade limits');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradeLimits();
    
    // Refresh every 60 seconds (reduced from 30s to 60s to save egress)
    const interval = setInterval(fetchTradeLimits, 60000);
    return () => clearInterval(interval);
  }, [botIds.join(',')]); // Re-fetch when bot IDs change

  return {
    limits,
    getLimit: (botId: string) => limits.get(botId),
    loading,
    error,
    refresh: fetchTradeLimits
  };
};

