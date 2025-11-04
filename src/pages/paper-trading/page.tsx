import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import PaperTradingPerformance from '../../components/paper/PaperTradingPerformance';
import PaperTradingBalance from '../../components/paper/PaperTradingBalance';

export default function PaperTradingDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="📝 Paper Trading Dashboard" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Paper Trading Balance */}
        <PaperTradingBalance />
        
        {/* Paper Trading Performance */}
        <PaperTradingPerformance />
      </div>
      
      <Navigation />
    </div>
  );
}

