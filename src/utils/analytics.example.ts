/**
 * Analytics Tracking Examples
 * 
 * This file shows how to use cookie consent and track analytics events
 * throughout your Pablo AI Trading app.
 */

import { hasAcceptedCookies, trackEvent, trackPageView } from './cookieConsent';

// ============================================
// Example 1: Track Bot Actions
// ============================================

export function trackBotStart(botId: string, botName: string, paperTrading: boolean) {
  trackEvent('bot_started', {
    bot_id: botId,
    bot_name: botName,
    paper_trading: paperTrading,
    timestamp: new Date().toISOString()
  });
}

export function trackBotStop(botId: string, botName: string) {
  trackEvent('bot_stopped', {
    bot_id: botId,
    bot_name: botName,
    timestamp: new Date().toISOString()
  });
}

export function trackBotCreated(botType: string, strategy: string) {
  trackEvent('bot_created', {
    bot_type: botType,
    strategy: strategy,
    timestamp: new Date().toISOString()
  });
}

// ============================================
// Example 2: Track Trading Activity
// ============================================

export function trackTradeExecuted(trade: {
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  paperTrading: boolean;
}) {
  trackEvent('trade_executed', {
    symbol: trade.symbol,
    side: trade.side,
    amount: trade.amount,
    price: trade.price,
    paper_trading: trade.paperTrading,
    value: trade.amount * trade.price,
    timestamp: new Date().toISOString()
  });
}

export function trackTradeProfit(profit: number, symbol: string, paperTrading: boolean) {
  trackEvent('trade_profit', {
    profit: profit,
    symbol: symbol,
    paper_trading: paperTrading,
    profit_range: profit > 100 ? 'high' : profit > 50 ? 'medium' : 'low',
    timestamp: new Date().toISOString()
  });
}

// ============================================
// Example 3: Track User Actions
// ============================================

export function trackButtonClick(buttonName: string, page: string) {
  trackEvent('button_click', {
    button_name: buttonName,
    page: page,
    timestamp: new Date().toISOString()
  });
}

export function trackFeatureUsed(featureName: string) {
  trackEvent('feature_used', {
    feature_name: featureName,
    timestamp: new Date().toISOString()
  });
}

export function trackAPIKeyAdded(exchange: string) {
  trackEvent('api_key_added', {
    exchange: exchange,
    timestamp: new Date().toISOString()
  });
}

// ============================================
// Example 4: Track Page Views
// ============================================

export function trackDashboardView() {
  trackPageView('/dashboard');
}

export function trackBotsPageView() {
  trackPageView('/bots');
}

export function trackSettingsView() {
  trackPageView('/settings');
}

// ============================================
// Example 5: Track Errors
// ============================================

export function trackError(errorType: string, errorMessage: string, context?: string) {
  trackEvent('app_error', {
    error_type: errorType,
    error_message: errorMessage,
    context: context,
    timestamp: new Date().toISOString()
  });
}

export function trackBotError(botId: string, errorMessage: string) {
  trackEvent('bot_error', {
    bot_id: botId,
    error_message: errorMessage,
    timestamp: new Date().toISOString()
  });
}

// ============================================
// Example 6: Check Consent Before Custom Tracking
// ============================================

export function customAnalyticsFunction() {
  // Always check consent first!
  if (!hasAcceptedCookies()) {
    console.log('📊 Analytics disabled - user declined cookies');
    return;
  }

  // Your custom tracking logic here
  console.log('📊 Custom analytics tracking...');
  
  // Example: Send to your own analytics backend
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'custom_event',
      data: { /* your data */ }
    })
  });
}

// ============================================
// How to Use in Your Components
// ============================================

/*

// In a React component:

import { trackBotStart, trackButtonClick } from '@/utils/analytics.example';

function BotDashboard() {
  const handleStartBot = (botId: string) => {
    // Your bot start logic...
    
    // Track the action
    trackBotStart(botId, 'BTC Trading Bot', true);
  };

  return (
    <button 
      onClick={() => {
        handleStartBot('bot-123');
        trackButtonClick('start_bot', 'dashboard');
      }}
    >
      Start Bot
    </button>
  );
}

*/

// ============================================
// Google Analytics 4 Events Reference
// ============================================

/*
Common GA4 event parameters:
- engagement_time_msec: Time user spent
- session_id: Unique session identifier
- user_id: Your internal user ID
- items: Array of item objects
- value: Monetary value
- currency: Currency code (e.g., 'USD')

Example custom dimensions you might want:
- user_role: 'free' | 'premium'
- account_age_days: number
- total_bots: number
- paper_trading_mode: boolean
*/

