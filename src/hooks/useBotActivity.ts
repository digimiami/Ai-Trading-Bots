import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface BotActivityLog {
  id: string;
  botId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'market' | 'trade' | 'strategy' | 'system' | 'error';
  message: string;
  details?: any;
  data?: any;
}

export interface BotActivity {
  botId: string;
  botName: string;
  status: string;
  lastActivity: string;
  logs: BotActivityLog[];
  isActive: boolean;
  currentAction?: string;
  waitingFor?: string;
  errorCount: number;
  successCount: number;
}

export function useBotActivity(bots?: any[]) {
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addLog = async (botId: string, log: Omit<BotActivityLog, 'id' | 'timestamp'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      const newLog = {
        bot_id: botId,
        level: log.level,
        category: log.category,
        message: log.message,
        details: log.details,
        timestamp: new Date().toISOString(),
      };

      // Save to database
      const { error } = await supabase
        .from('bot_activity_logs')
        .insert(newLog);

      if (error) {
        console.error('Error saving log to database:', error);
        // Fallback to localStorage
        const existingLogs = JSON.parse(localStorage.getItem(`bot_logs_${botId}`) || '[]');
        const updatedLogs = [...existingLogs, { ...log, id: Date.now().toString(), botId, timestamp: new Date().toISOString() }];
        localStorage.setItem(`bot_logs_${botId}`, JSON.stringify(updatedLogs));
      }

      // Update activities state
      setActivities(prev => prev.map(activity => 
        activity.botId === botId 
          ? {
              ...activity,
              logs: [{ ...log, id: Date.now().toString(), botId, timestamp: new Date().toISOString() }, ...activity.logs.slice(0, 49)],
              lastActivity: new Date().toISOString(),
              errorCount: log.level === 'error' ? activity.errorCount + 1 : activity.errorCount,
              successCount: log.level === 'success' ? activity.successCount + 1 : activity.successCount,
            }
          : activity
      ));

      return newLog;
    } catch (err) {
      console.error('Error adding bot log:', err);
      throw err;
    }
  };

  const fetchBotLogs = async (botId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session');

      const { data: logs, error } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .eq('bot_id', botId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching bot logs from database:', error);
        // Fallback to localStorage if database fails
        const fallbackLogs = JSON.parse(localStorage.getItem(`bot_logs_${botId}`) || '[]');
        return fallbackLogs.sort((a: BotActivityLog, b: BotActivityLog) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }

      return logs || [];
    } catch (err) {
      console.error('Error fetching bot logs:', err);
      // Fallback to localStorage
      const fallbackLogs = JSON.parse(localStorage.getItem(`bot_logs_${botId}`) || '[]');
      return fallbackLogs.sort((a: BotActivityLog, b: BotActivityLog) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
  };

  const fetchAllActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use passed bots or return empty if no bots provided
      if (!bots || bots.length === 0) {
        setActivities([]);
        return;
      }

      // Fetch logs for each bot
      const activities: BotActivity[] = await Promise.all(
        bots.map(async (bot: any) => {
          const logs = await fetchBotLogs(bot.id);
          const errorCount = logs.filter((log: BotActivityLog) => log.level === 'error').length;
          const successCount = logs.filter((log: BotActivityLog) => log.level === 'success').length;
          
          return {
            botId: bot.id,
            botName: bot.name,
            status: bot.status,
            lastActivity: logs.length > 0 ? logs[0].timestamp : bot.createdAt,
            logs: logs.slice(0, 50), // Keep only last 50 logs
            isActive: bot.status === 'running',
            currentAction: logs.length > 0 ? logs[0].message : 'Initializing...',
            waitingFor: bot.status === 'running' ? 'Market conditions' : undefined,
            errorCount,
            successCount,
          };
        })
      );

      setActivities(activities);
    } catch (err) {
      console.error('Error fetching bot activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
      // Don't set empty activities on error, keep existing ones
    } finally {
      setLoading(false);
    }
  };

  const clearBotLogs = async (botId: string) => {
    try {
      localStorage.removeItem(`bot_logs_${botId}`);
      await fetchAllActivities();
    } catch (err) {
      console.error('Error clearing bot logs:', err);
    }
  };

  const simulateBotActivity = async (botId: string) => {
    const activities = [
      { level: 'info' as const, category: 'system' as const, message: 'Bot initialized successfully' },
      { level: 'info' as const, category: 'market' as const, message: 'Analyzing market conditions...' },
      { level: 'info' as const, category: 'strategy' as const, message: 'RSI: 45, ADX: 28 - Market trending' },
      { level: 'success' as const, category: 'trade' as const, message: 'Long position opened at $45,250' },
      { level: 'info' as const, category: 'market' as const, message: 'Monitoring position...' },
      { level: 'warning' as const, category: 'market' as const, message: 'Price approaching stop loss' },
      { level: 'success' as const, category: 'trade' as const, message: 'Position closed with +2.5% profit' },
    ];

    for (const activity of activities) {
      await addLog(botId, activity);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  };

  useEffect(() => {
    fetchAllActivities();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchAllActivities, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [bots]); // Depend on bots parameter

  return {
    activities,
    loading,
    error,
    addLog,
    fetchBotLogs,
    clearBotLogs,
    simulateBotActivity,
    refetch: fetchAllActivities,
  };
}
