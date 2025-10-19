
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

export default function StatsGrid() {
  const stats = [
    {
      title: 'Total PnL',
      value: '$12,847',
      change: '+8.2% today',
      changeType: 'positive' as const,
      icon: 'ri-money-dollar-circle-line'
    },
    {
      title: 'Active Bots',
      value: '24',
      change: '3 new today',
      changeType: 'positive' as const,
      icon: 'ri-robot-line'
    },
    {
      title: 'Win Rate',
      value: '73.5%',
      change: '+2.1% this week',
      changeType: 'positive' as const,
      icon: 'ri-trophy-line'
    },
    {
      title: 'Total Trades',
      value: '1,247',
      change: '89 today',
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
