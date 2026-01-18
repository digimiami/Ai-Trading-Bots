import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ExchangePosition } from '../../hooks/usePositions';

interface PortfolioPnLChartProps {
  positions: ExchangePosition[];
}

const COLORS = {
  profit: '#10b981',
  loss: '#ef4444',
  neutral: '#6b7280'
};

export default function PortfolioPnLChart({ positions }: PortfolioPnLChartProps) {
  // Prepare data for bar chart (PnL by symbol)
  const barChartData = useMemo(() => {
    return positions
      .map(pos => ({
        symbol: pos.symbol,
        exchange: pos.exchange,
        pnl: pos.unrealizedPnL,
        size: pos.size
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [positions]);

  // Prepare data for pie chart (PnL distribution by exchange)
  const pieChartData = useMemo(() => {
    const exchangeMap = new Map<string, number>();
    
    positions.forEach(pos => {
      const current = exchangeMap.get(pos.exchange) || 0;
      exchangeMap.set(pos.exchange, current + pos.unrealizedPnL);
    });

    return Array.from(exchangeMap.entries()).map(([exchange, totalPnL]) => ({
      name: exchange.toUpperCase(),
      value: Math.abs(totalPnL),
      pnl: totalPnL,
      color: totalPnL >= 0 ? COLORS.profit : COLORS.loss
    }));
  }, [positions]);

  const totalPnL = useMemo(() => {
    return positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <i className="ri-bar-chart-line text-4xl mb-2"></i>
        <p>No positions to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Portfolio PnL Distribution</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Unrealized PnL: <span className={`font-semibold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
          </p>
        </div>
      </div>

      {/* Bar Chart - PnL by Symbol */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">PnL by Position</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="symbol" 
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip 
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Unrealized PnL']}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#374151' }}
            />
            <Legend />
            <Bar 
              dataKey="pnl" 
              fill={(entry: any) => entry.pnl >= 0 ? COLORS.profit : COLORS.loss}
              radius={[4, 4, 0, 0]}
            >
              {barChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? COLORS.profit : COLORS.loss} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart - Distribution by Exchange */}
      {pieChartData.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">PnL Distribution by Exchange</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, pnl }) => `${name}: $${pnl.toFixed(2)}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  `$${props.payload.pnl.toFixed(2)}`,
                  'Total PnL'
                ]}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#374151' }}
              />
              <Legend 
                formatter={(value: string, entry: any) => (
                  <span style={{ color: entry.payload.color }}>
                    {value}: ${entry.payload.pnl.toFixed(2)}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
