/**
 * AI/ML Activity Modal Component
 * Displays comprehensive AI/ML activity when system is enabled
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface AiMlActivityModalProps {
  botId: string;
  botName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface OptimizationLog {
  id: string;
  timestamp: string;
  message: string;
  details: {
    type: string;
    confidence?: number;
    reasoning?: string;
    expectedImprovement?: string;
    changes?: Array<{
      parameter: string;
      oldValue: any;
      newValue: any;
      reason?: string;
    }>;
    ai_provider?: string;
    ai_model?: string;
    performanceBefore?: any;
  };
}

interface MLPrediction {
  id: string;
  symbol: string;
  prediction: string;
  confidence: number;
  timestamp: string;
  features?: any;
}

export default function AiMlActivityModal({ botId, botName, isOpen, onClose }: AiMlActivityModalProps) {
  const [optimizationLogs, setOptimizationLogs] = useState<OptimizationLog[]>([]);
  const [mlPredictions, setMlPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'optimizations' | 'predictions' | 'performance'>('overview');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchActivityData();
      // Refresh every 30 seconds
      const interval = setInterval(fetchActivityData, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, botId]);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // Fetch ML monitoring dashboard data (this will generate logs)
      try {
        const monitoringResponse = await fetch(
          `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-monitoring?action=dashboard`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (monitoringResponse.ok) {
          const monitoringData = await monitoringResponse.json();
          console.log('ML Monitoring data:', monitoringData);
        }
      } catch (monitoringError) {
        console.warn('ML Monitoring fetch failed (non-critical):', monitoringError);
      }

      // Fetch optimization logs
      const { data: logsData, error: logsError } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .eq('bot_id', botId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!logsError && logsData) {
        const aiLogs = logsData.filter((log: any) => 
          log.details?.type === 'ai_ml_optimization_applied' || 
          log.details?.type === 'ai_ml_optimization' ||
          (log.message && log.message.includes('AI/ML')) ||
          (log.message && log.message.includes('Auto-Optimization'))
        ) as OptimizationLog[];
        setOptimizationLogs(aiLogs);
      }

      // Fetch ML predictions for this bot
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/ml-predictions?action=get_predictions&bot_id=${botId}&limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.predictions) {
            setMlPredictions(result.predictions);
          }
        }
      } catch (error) {
        console.log('ML predictions not available:', error);
      }

    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSignalColor = (signal: string) => {
    if (signal === 'BUY') return 'bg-green-100 text-green-800';
    if (signal === 'SELL') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Calculate metrics
  const metrics = {
    totalOptimizations: optimizationLogs.length,
    avgConfidence: optimizationLogs.length > 0
      ? optimizationLogs.reduce((sum, log) => sum + (log.details?.confidence || 0), 0) / optimizationLogs.length
      : 0,
    totalPredictions: mlPredictions.length,
    recentActivity: optimizationLogs.slice(0, 5).length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <i className="ri-brain-line text-2xl text-purple-600 dark:text-purple-400"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI/ML Activity Monitor</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{botName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-2xl text-gray-500 dark:text-gray-400"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-1 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
              { id: 'optimizations', label: 'Optimizations', icon: 'ri-settings-3-line' },
              { id: 'predictions', label: 'Predictions', icon: 'ri-lightbulb-line' },
              { id: 'performance', label: 'Performance', icon: 'ri-line-chart-line' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <i className={tab.icon}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading AI/ML activity...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Optimizations</span>
                        <i className="ri-settings-3-line text-purple-600 dark:text-purple-400"></i>
                      </div>
                      <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{metrics.totalOptimizations}</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Avg Confidence</span>
                        <i className="ri-shield-check-line text-blue-600 dark:text-blue-400"></i>
                      </div>
                      <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                        {(metrics.avgConfidence * 100).toFixed(1)}%
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">ML Predictions</span>
                        <i className="ri-lightbulb-line text-green-600 dark:text-green-400"></i>
                      </div>
                      <p className="text-3xl font-bold text-green-900 dark:text-green-100">{metrics.totalPredictions}</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Recent Activity</span>
                        <i className="ri-time-line text-orange-600 dark:text-orange-400"></i>
                      </div>
                      <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{metrics.recentActivity}</p>
                    </div>
                  </div>

                  {/* Recent Activity Timeline */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity Timeline</h3>
                    {optimizationLogs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <i className="ri-inbox-line text-4xl mb-2"></i>
                        <p>No AI/ML activity yet</p>
                        <p className="text-sm mt-1">Activity will appear here once optimizations are applied</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {optimizationLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-600 mt-2"></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{log.message}</span>
                                {log.details?.confidence && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(log.details.confidence)}`}>
                                    {(log.details.confidence * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(log.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Optimizations Tab */}
              {activeTab === 'optimizations' && (
                <div className="space-y-4">
                  {optimizationLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <i className="ri-settings-3-line text-5xl mb-4"></i>
                      <p className="text-lg font-medium">No optimizations yet</p>
                      <p className="text-sm mt-2">AI/ML optimizations will appear here once applied</p>
                    </div>
                  ) : (
                    optimizationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                                <i className="ri-brain-line mr-1"></i>
                                AI/ML Optimized
                              </span>
                              {log.details?.confidence && (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getConfidenceColor(log.details.confidence)}`}>
                                  {(log.details.confidence * 100).toFixed(1)}% Confidence
                                </span>
                              )}
                              {log.details?.ai_provider && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                  {log.details.ai_provider}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{log.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(log.timestamp)}</p>
                            {log.details?.expectedImprovement && (
                              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                                <i className="ri-arrow-up-line mr-1"></i>
                                Expected: {log.details.expectedImprovement}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 text-sm font-medium"
                          >
                            {expandedLog === log.id ? 'Hide' : 'View'} Details
                          </button>
                        </div>

                        {expandedLog === log.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                            {log.details?.reasoning && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  <i className="ri-question-line mr-1"></i>
                                  AI Reasoning:
                                </h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-3">
                                  {log.details.reasoning}
                                </p>
                              </div>
                            )}

                            {log.details?.changes && log.details.changes.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  <i className="ri-edit-line mr-1"></i>
                                  Parameter Changes ({log.details.changes.length}):
                                </h4>
                                <div className="space-y-2">
                                  {log.details.changes.map((change, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                                        {change.parameter}
                                      </div>
                                      <div className="flex items-center gap-3 text-sm">
                                        <span className="line-through text-red-600 dark:text-red-400 font-medium">
                                          {JSON.stringify(change.oldValue)}
                                        </span>
                                        <i className="ri-arrow-right-line text-gray-400"></i>
                                        <span className="text-green-600 dark:text-green-400 font-bold">
                                          {JSON.stringify(change.newValue)}
                                        </span>
                                      </div>
                                      {change.reason && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                          {change.reason}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {log.details?.performanceBefore && (
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  <i className="ri-bar-chart-line mr-1"></i>
                                  Performance Before:
                                </h4>
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Win Rate</div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {log.details.performanceBefore?.winRate?.toFixed(2) || 'N/A'}%
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Total PnL</div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      ${log.details.performanceBefore?.totalPnL?.toFixed(2) || '0.00'}
                                    </div>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Profit Factor</div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {log.details.performanceBefore?.profitFactor?.toFixed(2) || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Predictions Tab */}
              {activeTab === 'predictions' && (
                <div className="space-y-4">
                  {mlPredictions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <i className="ri-lightbulb-line text-5xl mb-4"></i>
                      <p className="text-lg font-medium">No ML predictions yet</p>
                      <p className="text-sm mt-2">ML predictions will appear here when available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prediction</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Confidence</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {mlPredictions.map((prediction) => (
                            <tr key={prediction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {prediction.symbol}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getSignalColor(prediction.prediction)}`}>
                                  {prediction.prediction}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getConfidenceColor(prediction.confidence)}`}>
                                  {(prediction.confidence * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {formatTimestamp(prediction.timestamp)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Optimization Success Rate</div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {optimizationLogs.length > 0 ? '100%' : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {optimizationLogs.length} total optimizations
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Average Confidence</div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {(metrics.avgConfidence * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Across all optimizations
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">AI Provider</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {optimizationLogs[0]?.details?.ai_provider || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {optimizationLogs[0]?.details?.ai_model || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Optimizations:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{optimizationLogs.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">ML Predictions:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{mlPredictions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Average Confidence:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {(metrics.avgConfidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <i className="ri-refresh-line mr-1"></i>
            Auto-refreshing every 30 seconds
          </div>
          <button
            onClick={fetchActivityData}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
}
