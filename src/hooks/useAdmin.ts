
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  role: string;
  status?: string;
  status_updated_at?: string;
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

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No active session');
      }

      console.log('🔵 Calling admin function:', { action, params });
      
      const response = await fetch(`${supabaseUrl}/functions/v1/admin-management-enhanced`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, ...params })
      });

      console.log('🔵 Raw response status:', response.status, response.statusText);
      console.log('🔵 Response headers:', Object.fromEntries(response.headers.entries()));

      // Get response text first (we'll try to parse as JSON, but keep text as fallback)
      const responseText = await response.text();
      console.log('🔵 Raw response text:', responseText);
      
      let data: any = null;
      
      try {
        data = JSON.parse(responseText);
        console.log('🔵 Parsed JSON data:', data);
      } catch (parseError) {
        // If not JSON, treat entire response as error message
        console.error('❌ Failed to parse response as JSON:', parseError);
        console.error('❌ Raw response text:', responseText);
        data = { error: responseText || `Request failed (${response.status})` };
      }

      // Log response for debugging
      console.log('🔵 Admin function response:', {
        status: response.status,
        ok: response.ok,
        data
      });

      if (!response.ok) {
        // Build comprehensive error message
        let errorMessage = `Request failed (${response.status})`;
        
        if (data?.error) {
          errorMessage = data.error;
        }
        
        if (data?.details) {
          errorMessage += `: ${data.details}`;
        } else if (data?.message) {
          errorMessage += `: ${data.message}`;
        }
        
        if (data?.code) {
          errorMessage += ` [Code: ${data.code}]`;
        }
        
        if (data?.hint) {
          errorMessage += ` [Hint: ${data.hint}]`;
        }
        
        console.error('Admin function error response:', {
          status: response.status,
          error: data?.error,
          details: data?.details,
          code: data?.code,
          hint: data?.hint,
          fullData: data
        });
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      if (data?.error) {
        console.error('Edge function returned error:', data);
        const errorMessage = data.details 
          ? `${data.error}: ${data.details}${data.code ? ` [Code: ${data.code}]` : ''}`
          : (data.error || 'Unknown error occurred');
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

  const createUser = async (email: string, password: string, role: string = 'user', planId?: string) => {
    return await callAdminFunction('createUser', { email, password, role, planId });
  };

  const deleteUser = async (userId?: string, userEmail?: string) => {
    if (!userId && !userEmail) {
      throw new Error('Either userId or userEmail must be provided');
    }
    return await callAdminFunction('deleteUser', { userId, userEmail });
  };

  const updateUserRole = async (userId: string, role: string) => {
    return await callAdminFunction('updateUserRole', { userId, role });
  };

  const updateUserStatus = async (userId: string, status: string) => {
    return await callAdminFunction('updateUserStatus', { userId, status });
  };

  const sendPasswordResetLink = async (email: string) => {
    return await callAdminFunction('sendPasswordResetLink', { email });
  };

  const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const data = await callAdminFunction('getInvitationCodes');
    return data.codes || [];
  };

  const generateInvitationCode = async (email: string, expiresInDays: number = 7, userLimit?: number) => {
    return await callAdminFunction('generateInvitationCode', { email, expiresInDays, userLimit });
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

  // NEW: Latest Trades (All Users or specific user)
  const getLatestTrades = async (limit: number = 100, userId: string | null = null) => {
    const data = await callAdminFunction('getLatestTrades', { limit, user_id: userId });
    return data.trades || [];
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

  // NEW: Test Period Management
  const getTestPeriodSettings = async () => {
    const data = await callAdminFunction('getTestPeriodSettings');
    return data.settings;
  };

  const updateTestPeriodSettings = async (settings: {
    enabled: boolean;
    start_date?: string;
    end_date?: string;
    message?: string;
  }) => {
    return await callAdminFunction('updateTestPeriodSettings', settings);
  };

  // NEW: Delete Users by Date Range
  const deleteUsersByDateRange = async (start_date: string, end_date: string) => {
    return await callAdminFunction('deleteUsersByDateRange', {
      start_date,
      end_date,
      confirm: 'DELETE'
    });
  };

  const upgradeUserSubscription = async (userId: string, planId: string) => {
    return await callAdminFunction('upgradeUserSubscription', { userId, planId });
  };

  // Email Management Functions
  const sendEmail = async (emailData: {
    from: string;
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke('admin-email', {
        body: emailData
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to send email');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send email';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getMailboxes = async (includeInactive: boolean = true) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${supabaseUrl}/functions/v1/admin-email?action=get-mailboxes${includeInactive ? '&include_inactive=true' : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch mailboxes');
      }

      const data = await response.json();
      return data.mailboxes || [];
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch mailboxes';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getEmails = async (params: {
    mailboxId?: string;
    direction?: 'inbound' | 'outbound' | 'all';
    limit?: number;
    offset?: number;
  } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-email?action=get-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch emails');
      }

      const data = await response.json();
      return data.emails || [];
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch emails';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createMailbox = async (email_address: string, display_name?: string, is_active: boolean = true, forward_to?: string) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-email?action=create-mailbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address, display_name, is_active, forward_to }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create mailbox');
      }

      const data = await response.json();
      return data.mailbox;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create mailbox';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateMailbox = async (id: string, updates: { email_address?: string; display_name?: string; is_active?: boolean; forward_to?: string }) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-email?action=update-mailbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Update mailbox error response:', errorData);
        throw new Error(errorData.error || 'Failed to update mailbox');
      }

      const data = await response.json();
      console.log('Update mailbox success response:', data);
      return data.mailbox;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update mailbox';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteMailbox = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-email?action=delete-mailbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete mailbox');
      }

      return true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete mailbox';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const broadcastEmail = async (emailData: {
    from: string;
    subject: string;
    html?: string;
    text?: string;
    userIds?: string[];
    userEmails?: string[];
    sendToAll?: boolean;
  }) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-email?action=broadcast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to broadcast email');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to broadcast email';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const callPromoAutopost = async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/promo-autopost-manager`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Promo autopost request failed');
      }

      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err: any) {
      const errorMessage = err.message || 'Promo autopost request failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getPromoAutopostSettings = async () => {
    const data = await callPromoAutopost('getSettings');
    return data.settings;
  };

  const savePromoAutopostSettings = async (settings: {
    enabled: boolean;
    min_win_rate: number;
    min_pnl: number;
    lookback_days: number;
    include_bot_settings: boolean;
    include_all_users: boolean;
  }) => {
    const data = await callPromoAutopost('saveSettings', settings);
    return data.settings;
  };

  const listPromoAutopostTargets = async () => {
    const data = await callPromoAutopost('listTargets');
    return data.targets || [];
  };

  const upsertPromoAutopostTarget = async (target: {
    id?: string;
    label: string;
    bot_token: string;
    chat_id: string;
    enabled: boolean;
  }) => {
    const data = await callPromoAutopost('upsertTarget', target);
    return data.target;
  };

  const deletePromoAutopostTarget = async (id: string) => {
    const data = await callPromoAutopost('deleteTarget', { id });
    return data.success;
  };

  const previewPromoAutopostBots = async (settings: {
    enabled?: boolean;
    min_win_rate: number;
    min_pnl: number;
    lookback_days: number;
    include_bot_settings: boolean;
    include_all_users: boolean;
  }) => {
    const data = await callPromoAutopost('previewEligibleBots', settings);
    return data.bots || [];
  };

  const runPromoAutopostNow = async () => {
    const data = await callPromoAutopost('runNow');
    return data;
  };

  return {
    loading,
    error,
    // User Management
    getUsers,
    createUser,
    deleteUser,
    updateUserRole,
    updateUserStatus,
    sendPasswordResetLink,
    getInvitationCodes,
    generateInvitationCode,
    deleteUsersByDateRange,
    upgradeUserSubscription,
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
    // Latest Trades
    getLatestTrades,
    // Risk & Security
    getRiskMetrics,
    exportData,
    // Test Period Management
    getTestPeriodSettings,
    updateTestPeriodSettings,
    // Email Management
    sendEmail,
    broadcastEmail,
    getMailboxes,
    getEmails,
    createMailbox,
    updateMailbox,
    deleteMailbox,
    // Promo auto-post
    getPromoAutopostSettings,
    savePromoAutopostSettings,
    listPromoAutopostTargets,
    upsertPromoAutopostTarget,
    deletePromoAutopostTarget,
    previewPromoAutopostBots,
    runPromoAutopostNow
  };
}
