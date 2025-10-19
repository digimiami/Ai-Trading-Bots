
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TradingBot } from '../types/trading';

export const useBots = () => {
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bot-management?action=create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(botData),
      });

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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
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
        throw new Error(`Failed to start bot: ${response.status}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err) {
      console.error('Error starting bot:', err);
      throw err;
    }
  };

  const stopBot = async (botId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
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
        throw new Error(`Failed to stop bot: ${response.status}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err) {
      console.error('Error stopping bot:', err);
      throw err;
    }
  };

  const updateBot = async (botId: string, updates: Partial<TradingBot>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
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
        throw new Error(`Failed to update bot: ${response.status}`);
      }

      const data = await response.json();
      if (data.bot) {
        setBots(prev => prev.map(bot => bot.id === botId ? data.bot : bot));
        return data.bot;
      }
      throw new Error('No bot data returned');
    } catch (err) {
      console.error('Error updating bot:', err);
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

  useEffect(() => {
    fetchBots();
  }, []);

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