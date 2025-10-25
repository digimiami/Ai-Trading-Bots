/**
 * AI/ML Dashboard Route Configuration
 * Only loads when VITE_FEATURE_AI_ML=1
 */

import { lazy } from 'react';
import { Card } from '../../components/base/Card';
import { Header } from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';

// Simple lazy load without conditional logic
const AiMlDashboard = lazy(() => import('../../../ai-ml-system/web/pages/AiMlDashboard'));

// Main component with feature flag check
export default function AiMlDashboardPage() {
  // Check if AI/ML feature is enabled
  const isAiMlEnabled = import.meta.env.VITE_FEATURE_AI_ML === '1'
  
  if (!isAiMlEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="AI/ML Dashboard" />
        <div className="flex items-center justify-center p-4 pt-20">
          <Card title="AI/ML System Disabled" className="max-w-md">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                The AI/ML trading system is currently disabled.
              </p>
              <p className="text-sm text-gray-500">
                To enable it, set <code className="bg-gray-100 px-2 py-1 rounded">VITE_FEATURE_AI_ML=1</code> in your .env file.
              </p>
            </div>
          </Card>
        </div>
        <Navigation />
      </div>
    );
  }
  
  // Load the actual dashboard when feature is enabled
  try {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="AI/ML Dashboard" />
        <div className="pt-20 pb-16">
          <AiMlDashboard />
        </div>
        <Navigation />
      </div>
    );
  } catch (error) {
    console.error('Error loading AI/ML Dashboard:', error);
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="AI/ML Dashboard" />
        <div className="flex items-center justify-center p-4 pt-20">
          <Card title="AI/ML Dashboard Error" className="max-w-md">
            <div className="text-center">
              <p className="text-red-600 mb-4">
                Failed to load the AI/ML Dashboard.
              </p>
              <p className="text-sm text-gray-500">
                Check the console for more details.
              </p>
            </div>
          </Card>
        </div>
        <Navigation />
      </div>
    );
  }
}
