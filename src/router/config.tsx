
import type { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

// Lazy load components
const Home = lazy(() => import('../pages/home/page'));
const Auth = lazy(() => import('../pages/auth/page'));
const Bots = lazy(() => import('../pages/bots/page'));
const CreateBot = lazy(() => import('../pages/create-bot/page'));
const EditBot = lazy(() => import('../pages/edit-bot/page'));
const BotActivity = lazy(() => import('../pages/bot-activity/page'));
const Trades = lazy(() => import('../pages/trades/page'));
const Reports = lazy(() => import('../pages/reports/page'));
const Settings = lazy(() => import('../pages/settings/page'));
const Admin = lazy(() => import('../pages/admin/page'));
const Onboarding = lazy(() => import('../pages/onboarding/page'));
const Help = lazy(() => import('../pages/help/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />
  },
  {
    path: '/auth',
    element: <Auth />
  },
  {
    path: '/onboarding',
    element: <Onboarding />
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
    path: '/trades',
    element: <Trades />
  },
  {
    path: '/reports',
    element: <Reports />
  },
  {
    path: '/settings',
    element: <Settings />
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
    path: '*',
    element: <NotFound />
  }
];

export default routes;
