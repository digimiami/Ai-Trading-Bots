
import { useState, useEffect } from 'react';
import { supabase, getAuthTokenFast } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TradingBot } from '../types/trading';

export const useBots = () => {
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const requireAccessToken = async (): Promise<string> => {
    let token = await getAuthTokenFast();

    if (!token) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      } catch (error) {
        console.warn('useBots: getSession fallback failed', error);
      }
    }

    if (!token) {
      throw new Error('No active session');
    }

    return token;
  };

  const fetchBots = async () => {
    try {
      console.log('useBots: Fetching bots');
      setLoading(true);
      setError(null);
      
      const accessToken = await requireAccessToken();

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch bots: ${response.status}`);
      }

      const data = await response.json();
      setBots(Array.isArray(data.bots) ? data.bots : []);
    } catch (err) {
      console.error('Error fetching bots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bots');
      setBots([]);
    } finally {
      setLoading(false);
    }
  };

  const getBotById = async (botId: string): Promise<TradingBot | null> => {
    try {
      const accessToken = await requireAccessToken();

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=get-by-id&botId=${botId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch bot: ${response.status}`);
      }

      const data = await response.json();
      if (data.bot) {
        return data.bot;
      }
      return null;
    } catch (err) {
      console.error('Error fetching bot by ID:', err);
      throw err;
    }
  };

  const createBot = async (botData: Omit<TradingBot, 'id' | 'createdAt'>) => {
    try {
      const accessToken = await requireAccessToken();

      console.log('useBots: About to send bot data:', botData);
      console.log('useBots: Exchange value:', botData.exchange, 'Type:', typeof botData.exchange);

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(botData),
      });

      console.log('useBots: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot creation error:', response.status, errorText);
        throw new Error(`Failed to create bot: ${response.status}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => [data.bot, ...prev]);
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err) {
      // Provide more helpful error messages for network issues
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        const networkError = new Error('Network connection failed. Please check your internet connection and try again.');
        networkError.name = 'NetworkError';
        console.error('Network error creating bot:', err);
        throw networkError;
      }
      console.error('Error creating bot:', err);
      throw err;
    }
  };

  const startBot = async (botId: string) => {
    try {
      const accessToken = await requireAccessToken();

      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=start`;
      console.log('🚀 Starting bot:', { botId, url, origin: window.location.origin });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: botId }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bot start error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Check for CORS errors
        if (response.status === 0 || errorText.includes('CORS') || errorText.includes('cors')) {
          throw new Error(`CORS error: Failed to connect to server. This might be a domain configuration issue.`);
        }
        
        throw new Error(`Failed to start bot: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Bot started successfully:', data);
      
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('❌ Error starting bot:', {
        error: err,
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      throw err;
    }
  };

  const stopBot = async (botId: string) => {
    try {
      const accessToken = await requireAccessToken();

      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=stop`;
      console.log('🛑 Stopping bot:', { botId, url, origin: window.location.origin });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: botId }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bot stop error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Check for CORS errors
        if (response.status === 0 || errorText.includes('CORS') || errorText.includes('cors')) {
          throw new Error(`CORS error: Failed to connect to server. This might be a domain configuration issue.`);
        }
        
        throw new Error(`Failed to stop bot: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Bot stopped successfully:', data);
      
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('❌ Error stopping bot:', {
        error: err,
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      throw err;
    }
  };

  const pauseBot = async (botId: string) => {
    try {
      const accessToken = await requireAccessToken();

      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=pause`;
      console.log('⏸️ Pausing bot:', { botId, url, origin: window.location.origin });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: botId }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bot pause error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (response.status === 0 || errorText.includes('CORS') || errorText.includes('cors')) {
          throw new Error(`CORS error: Failed to connect to server. This might be a domain configuration issue.`);
        }

        throw new Error(`Failed to pause bot: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Bot paused successfully:', data);

      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('❌ Error pausing bot:', {
        error: err,
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      throw err;
    }
  };

  const updateBot = async (botId: string, updates: Partial<TradingBot>) => {
    try {
      const accessToken = await requireAccessToken();

      const url = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=update`;
      console.log('📝 Updating bot:', { botId, url, origin: window.location.origin, updates });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: botId,
          ...updates
        }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bot update error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        // Check for CORS errors
        if (response.status === 0 || errorText.includes('CORS') || errorText.includes('cors')) {
          throw new Error(`CORS error: Failed to connect to server. This might be a domain configuration issue.`);
        }
        
        throw new Error(`Failed to update bot: ${response.status} - ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Bot updated successfully:', data);
      
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('❌ Error updating bot:', {
        error: err,
        message: err?.message,
        name: err?.name,
        stack: err?.stack
      });
      throw err;
    }
  };

  const deleteBot = async (botId: string) => {
    try {
      const accessToken = await requireAccessToken();

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: botId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot deletion error:', response.status, errorText);
        throw new Error(`Failed to delete bot: ${response.status}`);
      }

      setBots(prev => prev.filter(bot => bot.id !== botId));
    } catch (err) {
      console.error('Error deleting bot:', err);
      throw err;
    }
  };

  // Fetch when auth state is ready; avoid firing before session exists
  useEffect(() => {
    console.log('useBots: authLoading:', authLoading);
    console.log('useBots: user:', user);
    if (authLoading) {
      // Still determining auth; keep loading true for bots
      setLoading(true);
      return;
    }
    if (!user) {
      // Not authenticated; clear data and stop loading
      setBots([]);
      setLoading(false);
      return;
    }
    fetchBots();
    
    // Set up real-time subscription to refresh bots when they're updated
    const channel = supabase
      .channel('trading_bots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trading_bots',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Bot updated in real-time:', payload.eventType, payload.new);
          // Refresh bots when any bot is updated (INSERT, UPDATE, DELETE)
          fetchBots();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
    // Re-fetch when the signed-in user changes
  }, [authLoading, user?.id]);

  return {
    bots,
    loading,
    error,
    fetchBots,
    createBot,
    getBotById,
    startBot,
    stopBot,
    pauseBot,
    updateBot,
    deleteBot,
  };
};