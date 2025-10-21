import { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiCall } from '../lib/supabase';

export interface TimeSyncData {
  time: string;
  offset: number;
}

export interface MarketData {
  symbol: string;
  exchange: string;
  price: number;
  rsi: number;
  adx: number;
  timestamp: string;
}

export function useBotExecutor() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<string | null>(null);
  const [timeSync, setTimeSync] = useState<TimeSyncData | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  // Time synchronization
  const syncTime = async () => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.BOT_EXECUTOR}?action=time`);
      setTimeSync(response);
      console.log('Time synced:', response);
    } catch (error) {
      console.error('Time sync failed:', error);
    }
  };

  // Fetch market data
  const fetchMarketData = async (symbol: string = 'BTCUSDT', exchange: string = 'bybit') => {
    try {
      const response = await apiCall(`${API_ENDPOINTS.BOT_EXECUTOR}?action=market-data&symbol=${symbol}&exchange=${exchange}`);
      setMarketData(response);
      return response;
    } catch (error) {
      console.error('Market data fetch failed:', error);
      return null;
    }
  };

  // Execute single bot
  const executeBot = async (botId: string) => {
    try {
      setIsExecuting(true);
      const response = await apiCall(API_ENDPOINTS.BOT_EXECUTOR, {
        method: 'POST',
        body: JSON.stringify({
          action: 'execute_bot',
          botId
        })
      });
      
      setLastExecution(new Date().toISOString());
      console.log('Bot executed:', response);
      return response;
    } catch (error) {
      console.error('Bot execution failed:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  // Execute all running bots
  const executeAllBots = async () => {
    try {
      setIsExecuting(true);
      const response = await apiCall(API_ENDPOINTS.BOT_EXECUTOR, {
        method: 'POST',
        body: JSON.stringify({
          action: 'execute_all_bots'
        })
      });
      
      setLastExecution(new Date().toISOString());
      console.log('All bots executed:', response);
      return response;
    } catch (error) {
      console.error('All bots execution failed:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  // Auto-execution setup
  useEffect(() => {
    // Initial time sync
    syncTime();
    
    // Set up periodic execution every 5 minutes
    const executionInterval = setInterval(() => {
      executeAllBots().catch(console.error);
    }, 300000); // 5 minutes

    // Set up periodic time sync every 5 minutes
    const timeSyncInterval = setInterval(() => {
      syncTime();
    }, 300000); // 5 minutes

    return () => {
      clearInterval(executionInterval);
      clearInterval(timeSyncInterval);
    };
  }, []);

  return {
    isExecuting,
    lastExecution,
    timeSync,
    marketData,
    syncTime,
    fetchMarketData,
    executeBot,
    executeAllBots
  };
}
