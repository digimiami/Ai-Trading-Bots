import { useState, useEffect } from 'react';
import { API_ENDPOINTS, apiCall } from '../lib/supabase';
import { useAuth } from './useAuth';

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
  const { user } = useAuth();

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
      console.log('🚀 Starting execution of all running bots...');
      setIsExecuting(true);
      const response = await apiCall(API_ENDPOINTS.BOT_EXECUTOR, {
        method: 'POST',
        body: JSON.stringify({
          action: 'execute_all_bots'
        })
      });
      
      setLastExecution(new Date().toISOString());
      console.log('✅ All bots executed successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ All bots execution failed:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  // Auto-execution setup - DISABLED for client-side
  // Bots are now executed by server-side cron job (see CRON_SETUP_GUIDE.md)
  // This ensures 24/7 execution even when browser is closed
  useEffect(() => {
    if (!user) return; // Don't run if user is not authenticated
    
    console.log('🤖 Bot executor hook initialized for user:', user.email);
    console.log('ℹ️ Note: Bots are executed by server-side cron job, not from browser');
    console.log('ℹ️ Server-side execution runs 24/7 even when browser is closed');
    
    // Initial time sync (still useful for UI)
    syncTime();
    
    // DISABLED: Client-side auto-execution
    // This was causing bots to stop when browser closes
    // Server-side cron job handles execution now (see scripts/call-bot-scheduler.sh)
    /*
    const executionInterval = setInterval(() => {
      console.log('🔄 Executing all bots automatically...');
      executeAllBots().catch(console.error);
    }, 300000); // 5 minutes
    */

    // Optional: Time sync for UI display (doesn't affect trading)
    const timeSyncInterval = setInterval(() => {
      syncTime();
    }, 300000); // 5 minutes

    return () => {
      // clearInterval(executionInterval); // Disabled
      clearInterval(timeSyncInterval);
    };
  }, [user]);

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
