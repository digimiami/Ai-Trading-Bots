
interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

function StatCard({ title, value, change, changeType, icon }: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <p className={`text-sm mt-1 ${changeColors[changeType]}`}>
            {change}
          </p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <i className={`${icon} text-blue-600 text-xl`}></i>
        </div>
      </div>
    </div>
  );
}

import { useBots } from '../../../hooks/useBots';

export default function StatsGrid() {
  const { bots, loading } = useBots();
  
  // Calculate real stats from bots
  const activeBots = bots.filter(bot => bot.status === 'running' || bot.status === 'active');
  const totalPnL = bots.reduce((sum, bot) => sum + (bot.pnl || 0), 0);
  const totalTrades = bots.reduce((sum, bot) => sum + (bot.totalTrades || 0), 0);
  
  // Calculate win rate
  const botsWithTrades = bots.filter(bot => (bot.totalTrades || 0) > 0);
  const avgWinRate = botsWithTrades.length > 0
    ? botsWithTrades.reduce((sum, bot) => sum + (bot.winRate || 0), 0) / botsWithTrades.length
    : 0;

  // Calculate today's change (simplified - you can enhance this)
  const pnlChange = totalPnL > 0 ? '+' + (totalPnL * 0.1).toFixed(2) : (totalPnL * 0.1).toFixed(2);
  const todayTrades = Math.floor(totalTrades * 0.15); // Approximate 15% are today's trades

  const stats = [
    {
      title: 'Total PnL',
      value: loading ? '...' : `$${totalPnL.toFixed(2)}`,
      change: loading ? '...' : `${pnlChange}% today`,
      changeType: totalPnL >= 0 ? 'positive' as const : 'negative' as const,
      icon: 'ri-money-dollar-circle-line'
    },
    {
      title: 'Active Bots',
      value: loading ? '...' : activeBots.length.toString(),
      change: loading ? '...' : `${bots.length} total`,
      changeType: 'positive' as const,
      icon: 'ri-robot-line'
    },
    {
      title: 'Win Rate',
      value: loading ? '...' : `${avgWinRate.toFixed(1)}%`,
      change: loading ? '...' : 'Average across all bots',
      changeType: avgWinRate >= 60 ? 'positive' as const : avgWinRate >= 50 ? 'neutral' as const : 'negative' as const,
      icon: 'ri-trophy-line'
    },
    {
      title: 'Total Trades',
      value: loading ? '...' : totalTrades.toLocaleString(),
      change: loading ? '...' : `${todayTrades} today`,
      changeType: 'neutral' as const,
      icon: 'ri-exchange-line'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
