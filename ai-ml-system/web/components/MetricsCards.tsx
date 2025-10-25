/**
 * Metrics Cards Component
 * Displays key performance metrics in card format
 */

import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  trend = 'neutral', 
  color = 'blue' 
}) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium opacity-75">{title}</h3>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs opacity-60 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-2xl opacity-60">
          {trendIcons[trend]}
        </div>
      </div>
    </div>
  );
};

interface MetricsCardsProps {
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    liveWinRate?: number;
    avgPnL?: number;
    profitFactor?: number;
    sharpeRatio?: number;
  };
  isLoading?: boolean;
}

const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="p-4 rounded-lg border bg-gray-50 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatRatio = (value: number) => value.toFixed(2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Accuracy"
        value={metrics.accuracy ? formatPercentage(metrics.accuracy) : 'N/A'}
        subtitle="Model accuracy"
        color={metrics.accuracy && metrics.accuracy > 0.7 ? 'green' : 'red'}
        trend={metrics.accuracy && metrics.accuracy > 0.7 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Precision"
        value={metrics.precision ? formatPercentage(metrics.precision) : 'N/A'}
        subtitle="True positive rate"
        color={metrics.precision && metrics.precision > 0.6 ? 'green' : 'yellow'}
        trend={metrics.precision && metrics.precision > 0.6 ? 'up' : 'neutral'}
      />
      
      <MetricCard
        title="Recall"
        value={metrics.recall ? formatPercentage(metrics.recall) : 'N/A'}
        subtitle="Sensitivity"
        color={metrics.recall && metrics.recall > 0.6 ? 'green' : 'yellow'}
        trend={metrics.recall && metrics.recall > 0.6 ? 'up' : 'neutral'}
      />
      
      <MetricCard
        title="F1 Score"
        value={metrics.f1Score ? formatPercentage(metrics.f1Score) : 'N/A'}
        subtitle="Harmonic mean"
        color={metrics.f1Score && metrics.f1Score > 0.6 ? 'green' : 'red'}
        trend={metrics.f1Score && metrics.f1Score > 0.6 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Live Win Rate"
        value={metrics.liveWinRate ? formatPercentage(metrics.liveWinRate) : 'N/A'}
        subtitle="Real trading performance"
        color={metrics.liveWinRate && metrics.liveWinRate > 0.5 ? 'green' : 'red'}
        trend={metrics.liveWinRate && metrics.liveWinRate > 0.5 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Avg PnL"
        value={metrics.avgPnL ? formatCurrency(metrics.avgPnL) : 'N/A'}
        subtitle="Average profit per trade"
        color={metrics.avgPnL && metrics.avgPnL > 0 ? 'green' : 'red'}
        trend={metrics.avgPnL && metrics.avgPnL > 0 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Profit Factor"
        value={metrics.profitFactor ? formatRatio(metrics.profitFactor) : 'N/A'}
        subtitle="Profit/Loss ratio"
        color={metrics.profitFactor && metrics.profitFactor > 1.2 ? 'green' : 'red'}
        trend={metrics.profitFactor && metrics.profitFactor > 1.2 ? 'up' : 'down'}
      />
      
      <MetricCard
        title="Sharpe Ratio"
        value={metrics.sharpeRatio ? formatRatio(metrics.sharpeRatio) : 'N/A'}
        subtitle="Risk-adjusted returns"
        color={metrics.sharpeRatio && metrics.sharpeRatio > 1.0 ? 'green' : 'yellow'}
        trend={metrics.sharpeRatio && metrics.sharpeRatio > 1.0 ? 'up' : 'neutral'}
      />
    </div>
  );
};

export default MetricsCards;
