/**
 * Auto-Optimizer Component
 * Displays optimization status and allows manual triggering
 */

import { useState } from 'react';
import { useAutoOptimizer } from '../../hooks/useAutoOptimizer';
import { Card } from '../base/Card';
import Button from '../base/Button';
import AiOptimizationLogs from './AiOptimizationLogs';
import type { TradingBot } from '../../types/trading';

interface AutoOptimizerProps {
  bot: TradingBot;
}

export default function AutoOptimizer({ bot }: AutoOptimizerProps) {
  const {
    isOptimizing,
    optimizationResult,
    error,
    optimizeBot,
    autoApplyOptimization,
    autoOptimizeEnabled,
    setAutoOptimizeEnabled
  } = useAutoOptimizer(bot.id);

  const [showDetails, setShowDetails] = useState(false);

  const handleOptimize = async () => {
    const result = await optimizeBot();
    if (result) {
      setShowDetails(true);
    }
  };

  const handleAutoApply = async () => {
    try {
      // Use a lower threshold for manual apply (0.65 instead of 0.75)
      const applied = await autoApplyOptimization(0.65);
      if (applied) {
        alert('✅ Optimization applied successfully! The bot will now use the optimized parameters.');
        // Refresh the optimization result
        await optimizeBot();
      } else {
        // Get more specific error message
        if (optimizationResult) {
          const confidencePercent = (optimizationResult.confidence * 100).toFixed(1);
          if (optimizationResult.confidence < 0.65) {
            alert(`⚠️ Optimization not applied - confidence too low (${confidencePercent}%). Minimum required: 65%. Please review the optimization details before applying.`);
          } else {
            alert('⚠️ Optimization not applied - failed to update bot. Please check console for details.');
          }
        } else {
          alert('⚠️ Optimization not applied - no optimization result available. Please run "Analyze & Optimize" first.');
        }
      }
    } catch (error) {
      console.error('Error applying optimization:', error);
      alert(`❌ Error applying optimization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Card title="AI Auto-Optimization" className="mt-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {bot.aiMlEnabled 
                ? 'AI/ML learning enabled - bot will analyze trades and optimize strategies'
                : 'Enable AI/ML in bot settings to use auto-optimization'}
            </p>
            {optimizationResult && (
              <p className="text-sm mt-2">
                <span className="font-semibold">Confidence:</span>{' '}
                <span className={optimizationResult.confidence > 0.7 ? 'text-green-600' : 'text-yellow-600'}>
                  {(optimizationResult.confidence * 100).toFixed(1)}%
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleOptimize}
              disabled={isOptimizing || !bot.aiMlEnabled}
              loading={isOptimizing}
              variant="primary"
            >
              Analyze & Optimize
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {optimizationResult && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Optimization Available
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                {optimizationResult.reasoning}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Expected Improvement:</strong> {optimizationResult.expectedImprovement}
              </p>
            </div>

            {showDetails && optimizationResult.changes.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h5 className="font-semibold mb-2">Suggested Changes:</h5>
                <ul className="space-y-2">
                  {optimizationResult.changes.map((change, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{change.parameter}:</span>{' '}
                      <span className="text-red-600 dark:text-red-400">{String(change.oldValue)}</span>
                      {' → '}
                      <span className="text-green-600 dark:text-green-400">{String(change.newValue)}</span>
                      {change.reason && (
                        <span className="text-gray-600 dark:text-gray-400 block ml-4">
                          {change.reason}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="secondary"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
              <Button
                onClick={handleAutoApply}
                variant="primary"
                disabled={optimizationResult.confidence < 0.5}
                title={optimizationResult.confidence < 0.65 
                  ? `Confidence too low (${(optimizationResult.confidence * 100).toFixed(1)}%). Minimum: 65%` 
                  : 'Apply optimization'}
              >
                Apply Optimization {(optimizationResult.confidence * 100).toFixed(0)}%
              </Button>
            </div>
          </div>
        )}

        {!bot.aiMlEnabled && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Enable AI/ML learning in bot settings to use auto-optimization features.
            </p>
          </div>
        )}
      </div>

      {/* AI Optimization History */}
      <AiOptimizationLogs botId={bot.id} />
    </Card>
  );
}

