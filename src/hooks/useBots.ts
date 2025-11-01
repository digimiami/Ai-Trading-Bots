
import { useState, useEffect } from 'react';
import { supabase, getAuthTokenFast } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { TradingBot } from '../types/trading';

export const useBots = () => {
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const fetchBots = async () => {
    try {
      console.log('useBots: Fetching bots');
      setLoading(true);
      setError(null);
      
      // Default to localStorage, fallback to 1s getSession race
      let accessToken = await getAuthTokenFast();
      
      if (!accessToken) {
        // Retry once shortly after to allow auth to finish restoring
        await new Promise(resolve => setTimeout(resolve, 300));
        accessToken = await getAuthTokenFast();
      }
      
      if (!accessToken) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
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

  const createBot = async (botData: Omit<TradingBot, 'id' | 'createdAt'>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      console.log('useBots: About to send bot data:', botData);
      console.log('useBots: Exchange value:', botData.exchange, 'Type:', typeof botData.exchange);

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
      console.error('Error creating bot:', err);
      throw err;
    }
  };

  const startBot = async (botId: string) => {
    try {
      // Get session with better error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session || !session.access_token) {
        console.error('No active session or token. Attempting to refresh...');
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error('Session refresh failed:', refreshError);
          throw new Error('No active session. Please log in again.');
        }
        
        // Use the refreshed session
        const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: botId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Bot start error:', response.status, errorText);
          throw new Error(`Failed to start bot: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.bot) {
          setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
          return data.bot;
        }
        throw new Error('No bot data returned');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: botId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot start error:', response.status, errorText);
        throw new Error(`Failed to start bot: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('Error starting bot:', err);
      // Check if it's a network/CORS error
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CORS')) {
        throw new Error('Network error: Please check your connection and try again. If using a custom domain, ensure CORS is configured correctly.');
      }
      throw err;
    }
  };

  const stopBot = async (botId: string) => {
    try {
      // Get session with better error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session || !session.access_token) {
        console.error('No active session or token. Attempting to refresh...');
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error('Session refresh failed:', refreshError);
          throw new Error('No active session. Please log in again.');
        }
        
        // Use the refreshed session
        const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=stop`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: botId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Bot stop error:', response.status, errorText);
          throw new Error(`Failed to stop bot: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.bot) {
          setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
          return data.bot;
        }
        throw new Error('No bot data returned');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: botId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot stop error:', response.status, errorText);
        throw new Error(`Failed to stop bot: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('Error stopping bot:', err);
      // Check if it's a network/CORS error
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CORS')) {
        throw new Error('Network error: Please check your connection and try again. If using a custom domain, ensure CORS is configured correctly.');
      }
      throw err;
    }
  };

  const updateBot = async (botId: string, updates: Partial<TradingBot>) => {
    try {
      // Get session with better error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session || !session.access_token) {
        console.error('No active session or token. Attempting to refresh...');
        // Try to refresh the session
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error('Session refresh failed:', refreshError);
          throw new Error('No active session. Please log in again.');
        }
        
        // Use the refreshed session
        const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=update`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${newSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: botId,
            ...updates
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Bot update error:', response.status, errorText);
          throw new Error(`Failed to update bot: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (data.bot) {
          setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
          return data.bot;
        }
        throw new Error('No bot data returned');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: botId,
          ...updates
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Bot update error:', response.status, errorText);
        throw new Error(`Failed to update bot: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err: any) {
      console.error('Error updating bot:', err);
      // Check if it's a network/CORS error
      if (err.message?.includes('Failed to fetch') || err.message?.includes('CORS')) {
        throw new Error('Network error: Please check your connection and try again. If using a custom domain, ensure CORS is configured correctly.');
      }
      throw err;
    }
  };

  const deleteBot = async (botId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
    // Re-fetch when the signed-in user changes
  }, [authLoading, user?.id]);

  return {
    bots,
    loading,
    error,
    fetchBots,
    createBot,
    startBot,
    stopBot,
    updateBot,
    deleteBot,
  };
};