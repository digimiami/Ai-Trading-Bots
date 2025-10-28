import { useState } from 'react';
import Button from '../base/Button';
import Card from '../base/Card';
import { useAiLearning } from '../../hooks/useAiLearning';

interface AiRecommendationsProps {
  botId: string;
}

export default function AiRecommendations({ botId }: AiRecommendationsProps) {
  const { analysis, isAnalyzing, analyzeBot, applyOptimization } = useAiLearning(botId);

  if (!analysis) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <i className="ri-brain-line mr-2 text-blue-600"></i>
              AI Self-Learning
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              No analysis available. Start AI learning to get recommendations.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={analyzeBot}
            loading={isAnalyzing}
            size="sm"
          >
            <i className="ri-brain-line mr-2"></i>
            Analyze Bot
          </Button>
        </div>
      </Card>
    );
  }

  const confidence = analysis.ai_confidence * 100;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <i className="ri-brain-line mr-2 text-blue-600"></i>
            AI Recommendations
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Analysis from {new Date(analysis.analysis_date).toLocaleDateString()}
          </p>
        </div>
        {!analysis.applied && (
          <Button
            variant="primary"
            size="sm"
            onClick={applyOptimization}
          >
            Apply Changes
          </Button>
        )}
        {analysis.applied && (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            ✓ Applied
          </span>
        )}
      </div>

      {/* Confidence Indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">AI Confidence</span>
          <span className="text-sm font-medium text-blue-600">{confidence.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations && (
        <div className="space-y-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
              <i className="ri-lightbulb-line mr-2 text-yellow-600"></i>
              AI Insights
            </h4>
            <p className="text-sm text-gray-700">{analysis.recommendations.reasoning || 'No specific recommendations'}</p>
          </div>

          {analysis.expected_improvement && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                <i className="ri-line-chart-line mr-2 text-green-600"></i>
                Expected Improvement
              </h4>
              <p className="text-sm text-green-700">{analysis.expected_improvement}</p>
            </div>
          )}

          {analysis.risk_assessment && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-2 flex items-center">
                <i className="ri-shield-cross-line mr-2 text-orange-600"></i>
                Risk Assessment
              </h4>
              <p className="text-sm text-orange-700">{analysis.risk_assessment}</p>
            </div>
          )}
        </div>
      )}

      {/* Suggested Parameters */}
      {analysis.suggested_parameters && Object.keys(analysis.suggested_parameters).length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="font-semibold text-gray-900 mb-3">Suggested Optimizations</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(analysis.suggested_parameters).map(([key, value]) => (
              <div key={key} className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-500">{key}</div>
                <div className="text-lg font-bold text-gray-900">{value as string}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

