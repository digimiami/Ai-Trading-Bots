/**
 * AI Optimization Logs Component
 * Displays AI/ML optimization history and changes
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../base/Card';

interface OptimizationLog {
  id: string;
  timestamp: string;
  message: string;
  details: {
    type: string;
    confidence: number;
    reasoning: string;
    expectedImprovement: string;
    changes: Array<{
      parameter: string;
      oldValue: any;
      newValue: any;
      reason: string;
    }>;
    changeSummary?: string;
    performanceBefore?: any;
  };
}

interface AiOptimizationLogsProps {
  botId: string;
}

export default function AiOptimizationLogs({ botId }: AiOptimizationLogsProps) {
  const [logs, setLogs] = useState<OptimizationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchOptimizationLogs();
  }, [botId]);

  const fetchOptimizationLogs = async () => {
    try {
      setLoading(true);
      // Ensure authenticated session before querying (prevents RLS/implicit failures)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('AiOptimizationLogs: No active session, skipping fetch');
        setLogs([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('bot_activity_logs')
        .select('*')
        .eq('bot_id', botId)
        .eq('category', 'strategy')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching optimization logs:', error);
        return;
      }

      // Filter for AI/ML optimizations (check if details.type exists or message contains AI/ML)
      const aiLogs = (data || []).filter((log: any) => 
        log.details?.type === 'ai_ml_optimization' || 
        (log.message && log.message.includes('AI/ML'))
      ) as OptimizationLog[];

      setLogs(aiLogs as OptimizationLog[]);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <Card title="AI/ML Optimization History" className="mt-4">
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading optimization history...</p>
        </div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card title="AI/ML Optimization History" className="mt-4">
        <div className="text-center py-6">
          <p className="text-gray-500 dark:text-gray-400">
            No AI/ML optimizations yet. Optimizations will appear here once applied.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="AI/ML Optimization History" className="mt-4">
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    AI/ML Optimized
                  </span>
                  <span className={`text-sm font-semibold ${getConfidenceColor(log.details?.confidence || 0)}`}>
                    {(((log.details?.confidence ?? 0) * 100).toFixed(1))}% Confidence
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>

                <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                  {log.message}
                </p>

                {log.details?.expectedImprovement && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    Expected: {log.details?.expectedImprovement}
                  </p>
                )}

                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Changes:</strong> {(log.details?.changes?.length || 0)} parameter(s) modified
                </div>
              </div>

              <button
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
              >
                {expandedLog === log.id ? 'Hide' : 'View'} Details
              </button>
            </div>

            {expandedLog === log.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {log.details?.reasoning && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      AI Reasoning:
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {log.details?.reasoning}
                    </p>
                  </div>
                )}

                {log.details?.changes && log.details.changes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Parameter Changes:
                    </h4>
                    <div className="space-y-2">
                      {log.details?.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                            {change.parameter}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <span className="line-through text-red-600 dark:text-red-400">
                              {JSON.stringify(change.oldValue)}
                            </span>
                            <span>→</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {JSON.stringify(change.newValue)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {log.details?.performanceBefore && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      Performance Before Optimization:
                    </h4>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Win Rate: {log.details?.performanceBefore?.winRate?.toFixed(2) || 'N/A'}%</div>
                      <div>Total PnL: ${log.details?.performanceBefore?.totalPnL?.toFixed(2) || '0.00'}</div>
                      <div>Profit Factor: {log.details?.performanceBefore?.profitFactor?.toFixed(2) || 'N/A'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

