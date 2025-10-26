import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  notifications: {
    trade_executed: boolean;
    bot_started: boolean;
    bot_stopped: boolean;
    error_occurred: boolean;
    daily_summary: boolean;
    profit_alert: boolean;
    loss_alert: boolean;
  };
}

export function useTelegram() {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=get_config`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Telegram configuration');
      }

      const result = await response.json();
      if (result.success) {
        setConfig(result.config);
      }
    } catch (err: any) {
      console.error('Error fetching Telegram config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configData: Partial<TelegramConfig>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=save_config`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(configData)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save Telegram configuration');
      }

      const result = await response.json();
      if (result.success) {
        setConfig(result.config);
        return { success: true, message: result.message };
      }
      throw new Error('Failed to save configuration');
    } catch (err: any) {
      console.error('Error saving Telegram config:', err);
      return { success: false, message: err.message };
    }
  };

  const sendTestMessage = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test message');
      }

      const result = await response.json();
      if (result.success) {
        return { success: true, message: result.message };
      }
      throw new Error('Failed to send test message');
    } catch (err: any) {
      console.error('Error sending test message:', err);
      return { success: false, message: err.message };
    }
  };

  const sendNotification = async (type: string, data: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/telegram-notifier?action=send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notification_type: type,
            data: data
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      const result = await response.json();
      return result.success;
    } catch (err: any) {
      console.error('Error sending notification:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    saveConfig,
    sendTestMessage,
    sendNotification,
    refreshConfig: fetchConfig
  };
}

