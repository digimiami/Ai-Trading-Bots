import { supabase } from '../lib/supabase';

export interface ActivityReport {
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
  overview: {
    total_bots: number;
    active_bots: number;
    total_logs: number;
    errors: number;
    warnings: number;
    successes: number;
    info_logs: number;
  };
  bot_activity: Array<{
    bot_id: string;
    bot_name: string;
    status: string;
    total_logs: number;
    errors: number;
    warnings: number;
    successes: number;
    last_activity: string;
    recent_logs: Array<{
      timestamp: string;
      level: string;
      category: string;
      message: string;
      details?: any;
    }>;
  }>;
  performance_summary: {
    total_trades: number;
    total_pnl: number;
    win_rate: number;
    profitable_bots: number;
  };
  errors_summary: Array<{
    bot_name: string;
    error_count: number;
    last_error: string;
    common_errors: string[];
  }>;
}

export async function generateActivityReport(
  startDate?: Date,
  endDate?: Date
): Promise<ActivityReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const end = endDate || new Date();
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

  // Fetch bots
  const { data: bots, error: botsError } = await supabase
    .from('trading_bots')
    .select('id, name, status')
    .eq('user_id', user.id);

  if (botsError) throw botsError;

  // Fetch activity logs for all bots
  const botIds = bots?.map(b => b.id) || [];
  
  let activityLogs: any[] = [];
  if (botIds.length > 0) {
    const { data: logs, error: logsError } = await supabase
      .from('bot_activity_logs')
      .select('*')
      .in('bot_id', botIds)
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10000);

    if (logsError) throw logsError;
    activityLogs = logs || [];
  }

  // Fetch trades for performance summary
  const { data: trades, error: tradesError } = await supabase
    .from('trades')
    .select('pnl, status, created_at')
    .eq('user_id', user.id)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (tradesError) throw tradesError;

  // Calculate overview
  const totalBots = bots?.length || 0;
  const activeBots = bots?.filter(b => b.status === 'running').length || 0;
  const total_logs = activityLogs.length;
  const errors = activityLogs.filter(l => l.level === 'error').length;
  const warnings = activityLogs.filter(l => l.level === 'warning').length;
  const successes = activityLogs.filter(l => l.level === 'success').length;
  const info_logs = activityLogs.filter(l => l.level === 'info').length;

  // Calculate performance summary
  const filledTrades = trades?.filter(t => t.status === 'filled' || t.status === 'closed') || [];
  const totalTrades = filledTrades.length;
  const totalPnL = filledTrades.reduce((sum, t) => sum + (parseFloat(t.pnl || '0') || 0), 0);
  const winningTrades = filledTrades.filter(t => (parseFloat(t.pnl || '0') || 0) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Group logs by bot
  const botActivityMap = new Map<string, any>();
  
  bots?.forEach(bot => {
    botActivityMap.set(bot.id, {
      bot_id: bot.id,
      bot_name: bot.name,
      status: bot.status,
      total_logs: 0,
      errors: 0,
      warnings: 0,
      successes: 0,
      last_activity: '',
      recent_logs: []
    });
  });

  activityLogs.forEach(log => {
    const botData = botActivityMap.get(log.bot_id);
    if (botData) {
      botData.total_logs++;
      if (log.level === 'error') botData.errors++;
      if (log.level === 'warning') botData.warnings++;
      if (log.level === 'success') botData.successes++;
      
      if (!botData.last_activity || log.timestamp > botData.last_activity) {
        botData.last_activity = log.timestamp;
      }

      // Keep last 10 logs per bot
      if (botData.recent_logs.length < 10) {
        botData.recent_logs.push({
          timestamp: log.timestamp,
          level: log.level,
          category: log.category,
          message: log.message,
          details: log.details
        });
      }
    }
  });

  // Calculate errors summary
  const errorsSummary: any[] = [];
  botActivityMap.forEach((botData, botId) => {
    if (botData.errors > 0) {
      const botErrorLogs = activityLogs.filter(
        l => l.bot_id === botId && l.level === 'error'
      );
      const errorMessages = botErrorLogs.map(l => l.message);
      const commonErrors = Array.from(
        new Set(errorMessages.slice(0, 5))
      );

      errorsSummary.push({
        bot_name: botData.bot_name,
        error_count: botData.errors,
        last_error: botErrorLogs[0]?.timestamp || '',
        common_errors: commonErrors
      });
    }
  });

  // Calculate profitable bots
  const { data: botPnL } = await supabase
    .from('trading_bots')
    .select('id, pnl')
    .eq('user_id', user.id)
    .in('id', botIds);

  const profitableBots = botPnL?.filter(b => (parseFloat(b.pnl || '0') || 0) > 0).length || 0;

  return {
    generated_at: new Date().toISOString(),
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    overview: {
      total_bots: totalBots,
      active_bots: activeBots,
      total_logs: total_logs,
      errors: errors,
      warnings: warnings,
      successes: successes,
      info_logs: info_logs
    },
    bot_activity: Array.from(botActivityMap.values()),
    performance_summary: {
      total_trades: totalTrades,
      total_pnl,
      win_rate: winRate,
      profitable_bots: profitableBots
    },
    errors_summary: errorsSummary
  };
}

