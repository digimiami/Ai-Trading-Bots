
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string;
}

interface InvitationCode {
  id: string;
  code: string;
  email: string;
  used: boolean;
  created_at: string;
  expires_at: string;
}

interface TradingBot {
  id: string;
  name: string;
  status: string;
  total_trades: number;
  win_rate: number;
  pnl: number;
  users: { email: string };
}

interface SystemStats {
  totalUsers: number;
  totalBots: number;
  totalTrades: number;
  totalAlerts: number;
  platformPnL: number;
  recentTrades: number;
}

interface TradingAnalytics {
  totalTrades: number;
  filledTrades: number;
  failedTrades: number;
  pendingTrades: number;
  totalPnL: number;
  successRate: number;
  exchangeStats: Record<string, { count: number; pnl: number }>;
  trades: any[];
}

interface FinancialOverview {
  totalVolume: number;
  totalFees: number;
  totalPnL: number;
  dailyPnL: Record<string, number>;
  netProfit: number;
}

interface UserActivity {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  trading_bots: any[];
  trades: any[];
}

interface RiskMetrics {
  largeTrades: any[];
  failedTrades: any[];
  riskScore: number;
}

export function useAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callAdminFunction = async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke('admin-management-enhanced', {
        body: { action, ...params }
      });

      if (invokeError) {
        console.error('Edge function invoke error:', invokeError);
        const errorMessage = invokeError.message || 'Unknown error occurred';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Check if response contains an error
      if (data?.error) {
        console.error('Edge function returned error:', data);
        const errorMessage = data.details ? `${data.error}: ${data.details}` : (data.error || 'Unknown error occurred');
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (err: any) {
      console.error('Admin function error:', err);
      const errorMessage = err.message || err.error || err.details || 'Unknown error occurred';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Existing user management functions
  const getUsers = async (): Promise<User[]> => {
    const data = await callAdminFunction('getUsers');
    return data.users || [];
  };

  const createUser = async (email: string, password: string, role: string = 'user') => {
    return await callAdminFunction('createUser', { email, password, role });
  };

  const deleteUser = async (userId: string) => {
    return await callAdminFunction('deleteUser', { userId });
  };

  const updateUserRole = async (userId: string, role: string) => {
    return await callAdminFunction('updateUserRole', { userId, role });
  };

  const sendPasswordResetLink = async (email: string) => {
    return await callAdminFunction('sendPasswordResetLink', { email });
  };

  const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const data = await callAdminFunction('getInvitationCodes');
    return data.codes || [];
  };

  const generateInvitationCode = async (email: string, expiresInDays: number = 7) => {
    return await callAdminFunction('generateInvitationCode', { email, expiresInDays });
  };

  // NEW: Trading Bot Management
  const getAllBots = async (): Promise<TradingBot[]> => {
    const data = await callAdminFunction('getAllBots');
    return data.bots || [];
  };

  const adminControlBot = async (botId: string, action: string) => {
    return await callAdminFunction('adminControlBot', { botId, action });
  };

  const getBotAnalytics = async () => {
    const data = await callAdminFunction('getBotAnalytics');
    return data.analytics || [];
  };

  // NEW: System Monitoring
  const getSystemStats = async (): Promise<SystemStats> => {
    const data = await callAdminFunction('getSystemStats');
    return data.stats;
  };

  const getTradingAnalytics = async (period: string = '7'): Promise<TradingAnalytics> => {
    const data = await callAdminFunction('getTradingAnalytics', { period });
    return data.analytics;
  };

  // NEW: Financial Oversight
  const getFinancialOverview = async (): Promise<FinancialOverview> => {
    const data = await callAdminFunction('getFinancialOverview');
    return data.financial;
  };

  // NEW: User Activity Monitoring
  const getUserActivity = async (): Promise<UserActivity[]> => {
    const data = await callAdminFunction('getUserActivity');
    return data.userActivity || [];
  };

  // NEW: System Logs
  const getSystemLogs = async (limit: number = 100) => {
    const data = await callAdminFunction('getSystemLogs', { limit });
    return data.logs || [];
  };

  // NEW: Risk Monitoring
  const getRiskMetrics = async (): Promise<RiskMetrics> => {
    const data = await callAdminFunction('getRiskMetrics');
    return data.risk;
  };

  // NEW: Data Export
  const exportData = async (type: string, userId?: string) => {
    const data = await callAdminFunction('exportData', { type, userId });
    return data.data;
  };

  return {
    loading,
    error,
    // User Management
    getUsers,
    createUser,
    deleteUser,
    updateUserRole,
    sendPasswordResetLink,
    getInvitationCodes,
    generateInvitationCode,
    // Trading Bot Management
    getAllBots,
    adminControlBot,
    getBotAnalytics,
    // System Monitoring
    getSystemStats,
    getTradingAnalytics,
    // Financial Oversight
    getFinancialOverview,
    // User Activity
    getUserActivity,
    // System Administration
    getSystemLogs,
    // Risk & Security
    getRiskMetrics,
    exportData
  };
}
