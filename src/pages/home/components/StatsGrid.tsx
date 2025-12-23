import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { useBots } from '../../../hooks/useBots';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

function StatCard({ title, value, change, changeType, icon }: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-300'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className={`text-sm mt-1 ${changeColors[changeType]}`}>
            {change}
          </p>
        </div>
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <i className={`${icon} text-blue-600 dark:text-blue-400 text-xl`}></i>
        </div>
      </div>
    </div>
  );
}

export default function StatsGrid() {
  const { user } = useAuth();
  const { bots } = useBots();
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalPnL: 0,
    totalFees: 0,
    winRate: 0,
    totalWins: 0,
    totalLosses: 0,
    maxDrawdown: 0,
    maxDrawdownPercentage: 0,
    todayTrades: 0,
    todayPnL: 0,
    loading: true
  });

  const fetchRealTimeStats = useCallback(async () => {
    if (!user?.id) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Get bot IDs for current user
      const botIds = bots.map(bot => bot.id);
      if (botIds.length === 0) {
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      // Fetch real trades (all statuses, we'll filter later)
      const { data: realTrades, error: realTradesError } = await supabase
        .from('trades')
        .select('id, status, pnl, fee, executed_at, created_at')
        .eq('user_id', user.id)
        .in('bot_id', botIds);

      // Fetch paper trades (all statuses, we'll filter later)
      const { data: paperTrades, error: paperTradesError } = await supabase
        .from('paper_trading_trades')
        .select('id, status, pnl, fee, executed_at, created_at')
        .eq('user_id', user.id)
        .in('bot_id', botIds);

      if (realTradesError) console.error('Error fetching real trades:', realTradesError);
      if (paperTradesError) console.error('Error fetching paper trades:', paperTradesError);

      const allTrades = [
        ...(realTrades || []),
        ...(paperTrades || [])
      ];

      // Calculate stats from trades
      const closedTrades = allTrades.filter(t => 
        ['completed', 'closed', 'stopped', 'taken_profit'].includes(t.status?.toLowerCase() || '')
      );

      const totalTrades = allTrades.length;
      const totalPnL = closedTrades.reduce((sum, t) => sum + (parseFloat(t.pnl || 0) || 0), 0);
      const totalFees = allTrades.reduce((sum, t) => sum + (parseFloat(t.fee || 0) || 0), 0);
      
      const winningTrades = closedTrades.filter(t => (parseFloat(t.pnl || 0) || 0) > 0);
      const losingTrades = closedTrades.filter(t => (parseFloat(t.pnl || 0) || 0) < 0);
      const totalWins = winningTrades.length;
      const totalLosses = losingTrades.length;
      const winRate = closedTrades.length > 0 ? (totalWins / closedTrades.length) * 100 : 0;

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTrades = allTrades.filter(t => {
        const tradeDate = new Date(t.executed_at || t.created_at || 0);
        return tradeDate >= today;
      });
      const todayPnL = todayTrades
        .filter(t => ['completed', 'closed', 'stopped', 'taken_profit'].includes(t.status?.toLowerCase() || ''))
        .reduce((sum, t) => sum + (parseFloat(t.pnl || 0) || 0), 0);

      // Calculate max drawdown
      let maxDrawdown = 0;
      let maxDrawdownPercentage = 0;
      let peakPnL = 0;
      let runningPnL = 0;

      // Sort trades by time and calculate drawdown
      const sortedTrades = [...closedTrades].sort((a, b) => {
        const dateA = new Date(a.executed_at || a.created_at || 0).getTime();
        const dateB = new Date(b.executed_at || b.created_at || 0).getTime();
        return dateA - dateB;
      });

      sortedTrades.forEach(trade => {
        const tradePnL = parseFloat(trade.pnl || 0) || 0;
        runningPnL += tradePnL;
        if (runningPnL > peakPnL) {
          peakPnL = runningPnL;
        }
        const drawdown = peakPnL - runningPnL;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercentage = peakPnL > 0 ? (drawdown / peakPnL) * 100 : 0;
        }
      });

      setStats({
        totalTrades,
        totalPnL,
        totalFees,
        winRate,
        totalWins,
        totalLosses,
        maxDrawdown,
        maxDrawdownPercentage,
        todayTrades: todayTrades.length,
        todayPnL,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching real-time stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, bots]);

  useEffect(() => {
    if (!user?.id || bots.length === 0) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    // Fetch stats initially
    fetchRealTimeStats();

    // Set up real-time subscription to trades
    const tradesChannel = supabase
      .channel('trades_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Trade updated, refreshing stats...');
          fetchRealTimeStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paper_trading_trades',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('🔄 Paper trade updated, refreshing stats...');
          fetchRealTimeStats();
        }
      )
      .subscribe();

    // Auto-refresh every 10 seconds as backup
    const refreshInterval = setInterval(fetchRealTimeStats, 10000);

    return () => {
      supabase.removeChannel(tradesChannel);
      clearInterval(refreshInterval);
    };
  }, [user?.id, bots, fetchRealTimeStats]);

  // Calculate today's change
  const pnlChange = stats.todayPnL >= 0 ? `+${stats.todayPnL.toFixed(2)}` : stats.todayPnL.toFixed(2);

  const statsData = [
    {
      title: 'Total PnL',
      value: stats.loading ? '...' : `$${stats.totalPnL.toFixed(2)}`,
      change: stats.loading ? '...' : `${pnlChange} today`,
      changeType: stats.totalPnL >= 0 ? 'positive' as const : 'negative' as const,
      icon: 'ri-money-dollar-circle-line'
    },
    {
      title: 'Win Rate',
      value: stats.loading ? '...' : `${stats.winRate.toFixed(1)}%`,
      change: stats.loading ? '...' : `${stats.totalWins}W / ${stats.totalLosses}L`,
      changeType: stats.winRate >= 60 ? 'positive' as const : stats.winRate >= 50 ? 'neutral' as const : 'negative' as const,
      icon: 'ri-trophy-line'
    },
    {
      title: 'Total Trades',
      value: stats.loading ? '...' : stats.totalTrades.toLocaleString(),
      change: stats.loading ? '...' : `${stats.todayTrades} today`,
      changeType: 'neutral' as const,
      icon: 'ri-exchange-line'
    },
    {
      title: 'Win/Loss',
      value: stats.loading ? '...' : `${stats.totalWins}/${stats.totalLosses}`,
      change: stats.loading ? '...' : `${stats.totalWins > 0 ? '+' : ''}${stats.totalWins - stats.totalLosses} net`,
      changeType: stats.totalWins >= stats.totalLosses ? 'positive' as const : 'negative' as const,
      icon: 'ri-bar-chart-box-line'
    },
    {
      title: 'Total Fees',
      value: stats.loading ? '...' : `$${Math.abs(stats.totalFees).toFixed(2)}`,
      change: stats.loading ? '...' : 'Real-time',
      changeType: 'negative' as const,
      icon: 'ri-hand-coin-line'
    },
    {
      title: 'Max Drawdown',
      value: stats.loading ? '...' : `$${stats.maxDrawdown.toFixed(2)}`,
      change: stats.loading ? '...' : `${stats.maxDrawdownPercentage.toFixed(1)}%`,
      changeType: stats.maxDrawdown > 0 ? 'negative' as const : 'neutral' as const,
      icon: 'ri-arrow-down-line'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {statsData.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
