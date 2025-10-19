
import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import Trades from '../pages/trades/page';
import AdminPage from '../pages/admin/page';

const Home = lazy(() => import('../pages/home/page'));
const Bots = lazy(() => import('../pages/bots/page'));
const CreateBot = lazy(() => import('../pages/create-bot/page'));
const Settings = lazy(() => import('../pages/settings/page'));
const Auth = lazy(() => import('../pages/auth/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/bots',
    element: <Bots />,
  },
  {
    path: '/create-bot',
    element: <CreateBot />,
  },
  {
    path: '/settings',
    element: <Settings />,
  },
  {
    path: '/trades',
    element: <Trades />,
  },
  {
    path: '/auth',
    element: <Auth />,
  },
  {
    path: '/admin',
    element: <AdminPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
