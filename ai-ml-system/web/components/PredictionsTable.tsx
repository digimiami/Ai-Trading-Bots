/**
 * Predictions Table Component
 * Displays recent predictions in a table format
 */

import React, { useState } from 'react';

interface Prediction {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: Date;
  outcome?: boolean;
  pnl?: number;
  price?: number;
  volume?: number;
  features?: {
    rsi?: number;
    emaFast?: number;
    emaSlow?: number;
    atr?: number;
    volume?: number;
    emaDiff?: number;
  };
}

interface PredictionsTableProps {
  predictions: Prediction[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const PredictionsTable: React.FC<PredictionsTableProps> = ({ 
  predictions, 
  isLoading = false, 
  onRefresh 
}) => {
  const [sortBy, setSortBy] = useState<'timestamp' | 'confidence' | 'symbol'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSignal, setFilterSignal] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const formatPnL = (pnl?: number) => {
    if (pnl === undefined) return 'N/A';
    return `$${pnl.toFixed(2)}`;
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'text-green-600 bg-green-50';
      case 'SELL':
        return 'text-red-600 bg-red-50';
      case 'HOLD':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getOutcomeColor = (outcome?: boolean) => {
    if (outcome === undefined) return 'text-gray-500';
    return outcome ? 'text-green-600' : 'text-red-600';
  };

  const getOutcomeIcon = (outcome?: boolean) => {
    if (outcome === undefined) return '❓';
    return outcome ? '✅' : '❌';
  };

  // Sort and filter predictions
  const sortedAndFilteredPredictions = predictions
    .filter(pred => filterSignal === 'ALL' || pred.signal === filterSignal)
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSort = (column: 'timestamp' | 'confidence' | 'symbol') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortButton: React.FC<{ column: 'timestamp' | 'confidence' | 'symbol'; children: React.ReactNode }> = ({ 
    column, 
    children 
  }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center space-x-1 hover:text-blue-600"
    >
      <span>{children}</span>
      {sortBy === column && (
        <span className="text-xs">
          {sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Predictions</h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Signal:</label>
            <select
              value={filterSignal}
              onChange={(e) => setFilterSignal(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="ALL">All</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="HOLD">Hold</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-600">
            Showing {sortedAndFilteredPredictions.length} of {predictions.length} predictions
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton column="timestamp">Timestamp</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton column="symbol">Symbol</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Signal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortButton column="confidence">Confidence</SortButton>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PnL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RSI
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAndFilteredPredictions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                  No predictions found
                </td>
              </tr>
            ) : (
              sortedAndFilteredPredictions.map((prediction) => (
                <tr key={prediction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTimestamp(prediction.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {prediction.symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSignalColor(prediction.signal)}`}>
                      {prediction.signal}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatConfidence(prediction.confidence)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`flex items-center ${getOutcomeColor(prediction.outcome)}`}>
                      <span className="mr-1">{getOutcomeIcon(prediction.outcome)}</span>
                      {prediction.outcome !== undefined ? (prediction.outcome ? 'Profitable' : 'Loss') : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={prediction.pnl && prediction.pnl > 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatPnL(prediction.pnl)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prediction.price ? `$${prediction.price.toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prediction.volume ? prediction.volume.toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prediction.features?.rsi ? prediction.features.rsi.toFixed(2) : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PredictionsTable;
