
import type { RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { ONBOARDING_ENABLED } from '../constants/featureFlags';

// Lazy load components
const Landing = lazy(() => import('../pages/landing/page'));
const Home = lazy(() => import('../pages/home/page'));
const Academy = lazy(() => import('../pages/academy/page'));
const AcademyModule = lazy(() => import('../pages/academy/module'));
const Auth = lazy(() => import('../pages/auth/page'));
const Bots = lazy(() => import('../pages/bots/page'));
const CreateBot = lazy(() => import('../pages/create-bot/page'));
const EditBot = lazy(() => import('../pages/edit-bot/page'));
const BotActivity = lazy(() => import('../pages/bot-activity/page'));
const Backtest = lazy(() => import('../pages/backtest/page'));
const Trades = lazy(() => import('../pages/trades/page'));
const Reports = lazy(() => import('../pages/reports/page'));
const Performance = lazy(() => import('../pages/performance/page'));
const TransactionLog = lazy(() => import('../pages/transaction-log/page'));
const Settings = lazy(() => import('../pages/settings/page'));
const PaperTrading = lazy(() => import('../pages/paper-trading/page'));
const WebhookTest = lazy(() => import('../pages/webhook-test/page'));
const FuturesPairsFinder = lazy(() => import('../pages/futures-pairs-finder/page'));
const Admin = lazy(() => import('../pages/admin/page'));
const Onboarding = lazy(() => import('../pages/onboarding/page'));
const Help = lazy(() => import('../pages/help/page'));
const PabloReady = lazy(() => import('../pages/pablo-ready/page'));
const MarketDashboard = lazy(() => import('../pages/market-dashboard/page'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Privacy = lazy(() => import('../pages/legal/privacy'));
const Terms = lazy(() => import('../pages/legal/terms'));
const Risk = lazy(() => import('../pages/legal/risk'));

// AI/ML Dashboard - only loads when feature flag is enabled
const AiMlDashboard = lazy(() => import('../pages/ai-ml-dashboard/page'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Landing />
  },
  {
    path: '/dashboard',
    element: <Home />
  },
  {
    path: '/academy',
    element: <Academy />
  },
  {
    path: '/academy/:moduleSlug',
    element: <AcademyModule />
  },
  {
    path: '/auth',
    element: <Auth />
  },
  {
    path: '/onboarding',
    element: ONBOARDING_ENABLED ? <Onboarding /> : <Navigate to="/" replace />
  },
  {
    path: '/bots',
    element: <Bots />
  },
  {
    path: '/create-bot',
    element: <CreateBot />
  },
  {
    path: '/edit-bot/:botId',
    element: <EditBot />
  },
  {
    path: '/bot-activity',
    element: <BotActivity />
  },
  {
    path: '/backtest',
    element: <Backtest />
  },
  {
    path: '/trades',
    element: <Trades />
  },
  {
    path: '/transaction-log',
    element: <TransactionLog />
  },
  {
    path: '/reports',
    element: <Reports />
  },
  {
    path: '/performance',
    element: <Performance />
  },
  {
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/paper-trading',
    element: <PaperTrading />
  },
  {
    path: '/webhook-test',
    element: <WebhookTest />
  },
  {
    path: '/futures-pairs-finder',
    element: <FuturesPairsFinder />
  },
  {
    path: '/help',
    element: <Help />
  },
  {
    path: '/admin',
    element: <Admin />
  },
  {
    path: '/pablo-ready',
    element: <PabloReady />
  },
  {
    path: '/market-dashboard',
    element: <MarketDashboard />
  },
  {
    path: '/ai-ml/dashboard',
    element: <AiMlDashboard />
  },
  {
    path: '/privacy',
    element: <Privacy />
  },
  {
    path: '/terms',
    element: <Terms />
  },
  {
    path: '/risk',
    element: <Risk />
  },
  {
    path: '*',
    element: <NotFound />
  }
];

export default routes;
