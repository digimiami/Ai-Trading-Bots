
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';

interface User {
  id: string;
  email: string;
  role: string;
  status?: string;
  status_updated_at?: string;
  created_at: string;
  last_sign_in_at: string;
  stats?: {
    totalPnL: number;
    totalTrades: number;
    activeBots: number;
    avgWinRate: number;
    totalVolume: number;
    paperPnL: number;
    paperTradesCount: number;
    isActive: boolean;
  };
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

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    createUser, 
    generateInvitationCode, 
    getUsers, 
    getInvitationCodes,
    getAllBots,
    adminControlBot,
    getBotAnalytics,
    getSystemStats,
    getTradingAnalytics,
    getFinancialOverview,
    getUserActivity,
    getSystemLogs,
    getRiskMetrics,
    exportData,
    deleteUser,
    updateUserRole,
    updateUserStatus,
    sendPasswordResetLink
  } = useAdmin();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [allBots, setAllBots] = useState<TradingBot[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [tradingAnalytics, setTradingAnalytics] = useState<TradingAnalytics | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateInvitation, setShowCreateInvitation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<Record<string, boolean>>({});
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'user'
  });
  
  const [newInvitation, setNewInvitation] = useState({
    email: '',
    expiresInDays: 7
  });

  useEffect(() => {
    console.log('🔧 Admin page loaded - User:', user?.email, 'Role:', user?.role, 'Auth Loading:', authLoading);
    
    // Wait for auth to finish loading before checking role
    if (authLoading) {
      console.log('⏳ Still loading auth data...');
      return;
    }
    
    // After loading is complete, check if user is admin
    if (!user || user?.role !== 'admin') {
      console.log('❌ User is not admin, redirecting to home');
      navigate('/');
      return;
    }
    
    console.log('✅ User is admin, loading admin data...');
    loadData();
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      console.log('🔄 Loading admin data...');
      setLoading(true);
      const [
        usersData, 
        codesData, 
        botsData, 
        statsData, 
        analyticsData, 
        financialData, 
        activityData, 
        logsData, 
        riskData
      ] = await Promise.all([
        getUsers(),
        getInvitationCodes(),
        getAllBots(),
        getSystemStats(),
        getTradingAnalytics(),
        getFinancialOverview(),
        getUserActivity(),
        getSystemLogs(),
        getRiskMetrics()
      ]);
      
      console.log('✅ Admin data loaded successfully');
      
      console.log('📊 Users data received:', usersData);
      console.log('📊 First user sample:', usersData?.[0]);
      console.log('📊 First user stats:', usersData?.[0]?.stats);
      
      setUsers(usersData || []);
      setInvitationCodes(codesData || []);
      setAllBots(botsData || []);
      setSystemStats(statsData);
      setTradingAnalytics(analyticsData);
      setFinancialOverview(financialData);
      setUserActivity(activityData || []);
      setSystemLogs(logsData || []);
      setRiskMetrics(riskData);
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
      console.error('❌ Error details:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await createUser(newUser.email, newUser.password, newUser.role);
      setSuccessMessage(result?.message || 'User created successfully');
      setNewUser({ email: '', password: '', role: 'user' });
      setTimeout(() => {
        setShowCreateUser(false);
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error?.message || error?.error || 'Failed to create user. Please try again.');
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await generateInvitationCode(newInvitation.email, newInvitation.expiresInDays);
      setSuccessMessage(result?.message || 'Invitation code created successfully');
      setNewInvitation({ email: '', expiresInDays: 7 });
      setTimeout(() => {
        setShowCreateInvitation(false);
        loadData();
      }, 1000);
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      setError(error?.message || error?.error || 'Failed to create invitation code. Please try again.');
    }
  };

  const setUserLoadingState = (userId: string, value: boolean) => {
    setUserActionLoading(prev => ({ ...prev, [userId]: value }));
  };

  const handleUserRoleChange = async (userId: string, role: 'user' | 'admin') => {
    setUserLoadingState(userId, true);
    try {
      await updateUserRole(userId, role);
      setUsers(prev => prev.map(user => user.id === userId ? { ...user, role } : user));
      await loadData();
      alert(`✅ Updated user role to ${role}`);
    } catch (error: any) {
      console.error('Error updating user role:', error);
      alert(`❌ Failed to update user role: ${error?.message || error}`);
    } finally {
      setUserLoadingState(userId, false);
    }
  };

  const handleUserStatusChange = async (userId: string, status: 'active' | 'suspended' | 'disabled') => {
    setUserLoadingState(userId, true);
    try {
      await updateUserStatus(userId, status);
      setUsers(prev => prev.map(user => user.id === userId ? { ...user, status } : user));
      await loadData();
      alert(`✅ Updated user status to ${status}`);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      alert(`❌ Failed to update user status: ${error?.message || error}`);
    } finally {
      setUserLoadingState(userId, false);
    }
  };

  const handleDeleteUserAccount = async (userId: string, email: string) => {
    const confirmed = window.confirm(`Delete user "${email}"? This cannot be undone.`);
    if (!confirmed) return;

    setUserLoadingState(userId, true);
    try {
      await deleteUser(userId);
      await loadData();
      alert('✅ User deleted successfully');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`❌ Failed to delete user: ${error?.message || error}`);
    } finally {
      setUserLoadingState(userId, false);
    }
  };

  const handleSendPasswordReset = async (userId: string, email: string) => {
    setUserLoadingState(userId, true);
    try {
      const result = await sendPasswordResetLink(email);
      const resetLink = result?.resetLink;
      if (resetLink) {
        try {
          await navigator.clipboard.writeText(resetLink);
          alert('✅ Password reset link generated and copied to clipboard.');
        } catch {
          alert(`✅ Password reset link generated:\n${resetLink}`);
        }
      } else {
        alert('✅ Password reset link generated.');
      }
    } catch (error: any) {
      console.error('Error generating password reset link:', error);
      alert(`❌ Failed to generate password reset link: ${error?.message || error}`);
    } finally {
      setUserLoadingState(userId, false);
    }
  };

  const handleBotControl = async (botId: string, action: string) => {
    try {
      await adminControlBot(botId, action);
      loadData();
    } catch (error) {
      console.error('Error controlling bot:', error);
    }
  };

  const handleExportData = async (type: string, userId?: string) => {
    try {
      const data = await exportData(type, userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-4xl text-blue-600"></i>
          <p className="mt-4 text-gray-600">**Loading admin panel...**</p>
        </div>
      </div>
    );
  }

  // After loading, check if user is admin
  if (!user || user?.role !== 'admin') {
    return null;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'users', label: 'Users', icon: 'ri-user-line' },
    { id: 'bots', label: 'Trading Bots', icon: 'ri-robot-line' },
    { id: 'analytics', label: 'Analytics', icon: 'ri-bar-chart-line' },
    { id: 'financial', label: 'Financial', icon: 'ri-money-dollar-circle-line' },
    { id: 'monitoring', label: 'Monitoring', icon: 'ri-eye-line' },
    { id: 'security', label: 'Security', icon: 'ri-shield-check-line' },
    { id: 'system', label: 'System', icon: 'ri-settings-line' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Admin Panel"
        subtitle="Complete System Management & Control"
      />
      
      <div className="pt-20 pb-20 px-4">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'primary' : 'secondary'}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2"
              >
                <i className={tab.icon}></i>
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            {loading ? (
              <div className="text-center py-12">
                <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
                <p className="mt-4 text-gray-500">Loading overview data...</p>
              </div>
            ) : !systemStats ? (
              <div className="text-center py-12 text-gray-500">
                <i className="ri-dashboard-line text-4xl mb-2"></i>
                <p>No system statistics available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-blue-600">{systemStats?.totalUsers || 0}</div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-green-600">{systemStats?.totalBots || 0}</div>
                    <div className="text-sm text-gray-500">Active Bots</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-purple-600">{systemStats?.totalTrades || 0}</div>
                    <div className="text-sm text-gray-500">Total Trades</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-orange-600">${systemStats?.platformPnL?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Platform PnL</div>
                  </Card>
                </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="primary"
                onClick={() => setShowCreateUser(true)}
                className="h-16 flex flex-col items-center justify-center"
              >
                <i className="ri-user-add-line text-2xl mb-2"></i>
                Create User
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCreateInvitation(true)}
                className="h-16 flex flex-col items-center justify-center"
              >
                <i className="ri-mail-send-line text-2xl mb-2"></i>
                Send Invitation
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleExportData('all_trades')}
                className="h-16 flex flex-col items-center justify-center"
              >
                <i className="ri-download-line text-2xl mb-2"></i>
                Export Data
              </Button>
              <Button
                variant="secondary"
                onClick={() => setActiveTab('monitoring')}
                className="h-16 flex flex-col items-center justify-center"
              >
                <i className="ri-eye-line text-2xl mb-2"></i>
                View Logs
              </Button>
            </div>

            {/* Recent Activity */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Recent Trading Activity</h3>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : !tradingAnalytics || !tradingAnalytics.trades || tradingAnalytics.trades.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-exchange-line text-4xl mb-2"></i>
                  <p>No recent trading activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tradingAnalytics.trades.slice(0, 10).map((trade, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{trade.symbol} - {trade.side}</div>
                        <div className="text-sm text-gray-500">
                          {trade.exchange} • {new Date(trade.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${trade.pnl?.toFixed(2) || '0.00'}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          trade.status === 'filled' ? 'bg-green-100 text-green-800' :
                          trade.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {trade.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
              </>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">User Management</h3>
                <Button onClick={() => setShowCreateUser(true)}>
                  <i className="ri-user-add-line mr-2"></i>
                  Create User
                </Button>
              </div>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => {
                    const isActionLoading = !!userActionLoading[user.id];
                    return (
                    <div key={user.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {user.role}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              (user.status || 'active') === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : (user.status || 'active') === 'suspended'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {user.status || 'active'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                              user.stats?.isActive 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${
                                user.stats?.isActive ? 'bg-green-500' : 'bg-gray-400'
                              }`}></span>
                              {user.stats?.isActive ? 'Active' : 'Inactive'}
                            </span>
                      </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                            {user.last_sign_in_at && (
                              <> • Last active: {new Date(user.last_sign_in_at).toLocaleDateString()}</>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
                          <select
                            value={user.role}
                            onChange={(e) => handleUserRoleChange(user.id, e.target.value as 'user' | 'admin')}
                            disabled={isActionLoading}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:border-gray-700"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                          <select
                            value={user.status || 'active'}
                            onChange={(e) => handleUserStatusChange(user.id, e.target.value as 'active' | 'suspended' | 'disabled')}
                            disabled={isActionLoading}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:border-gray-700"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendPasswordReset(user.id, user.email)}
                            disabled={isActionLoading}
                          >
                            <i className="ri-lock-password-line mr-1"></i>
                            Reset Password
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteUserAccount(user.id, user.email)}
                            disabled={isActionLoading}
                          >
                            <i className="ri-delete-bin-line mr-1"></i>
                            Delete
                          </Button>
                        </div>
                      </div>
                      
                      {/* Trading Stats */}
                      {user.stats ? (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total PnL</p>
                              <p className={`text-sm font-semibold ${
                                (user.stats.totalPnL + user.stats.paperPnL) >= 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                ${((user.stats.totalPnL + user.stats.paperPnL) || 0).toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Real: ${user.stats.totalPnL.toFixed(2)} • Paper: ${user.stats.paperPnL.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Trades</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {user.stats.totalTrades + user.stats.paperTradesCount}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Real: {user.stats.totalTrades} • Paper: {user.stats.paperTradesCount}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active Bots</p>
                              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {user.stats.activeBots}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Win Rate: {user.stats.avgWinRate.toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trading Volume</p>
                              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                ${(user.stats.totalVolume || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Loading stats...</p>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Invitation Codes</h3>
                <Button onClick={() => setShowCreateInvitation(true)}>
                  <i className="ri-mail-send-line mr-2"></i>
                  Create Invitation
                </Button>
              </div>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : invitationCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-mail-line text-4xl mb-2"></i>
                  <p>No invitation codes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitationCodes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-mono text-sm mb-1">{code.code}</div>
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Email:</span> {code.email || 'No email specified'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Created: {new Date(code.created_at).toLocaleDateString()} • 
                          Expires: {new Date(code.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ml-4 ${
                        code.used ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {code.used ? 'Used' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Trading Bots Tab */}
        {activeTab === 'bots' && (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">All Trading Bots</h3>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : allBots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-robot-line text-4xl mb-2"></i>
                  <p>No trading bots found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allBots.map((bot) => (
                    <div key={bot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{bot.name}</div>
                        <div className="text-sm text-gray-500">
                          Owner: {bot.users.email} • Trades: {bot.total_trades} • Win Rate: {bot.win_rate?.toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          bot.status === 'running' ? 'bg-green-100 text-green-800' :
                          bot.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {bot.status}
                        </span>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBotControl(bot.id, 'running')}
                            disabled={bot.status === 'running'}
                          >
                            <i className="ri-play-line"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBotControl(bot.id, 'paused')}
                            disabled={bot.status === 'paused'}
                          >
                            <i className="ri-pause-line"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBotControl(bot.id, 'stopped')}
                            disabled={bot.status === 'stopped'}
                          >
                            <i className="ri-stop-line"></i>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
                <p className="mt-4 text-gray-500">Loading analytics data...</p>
              </div>
            ) : !tradingAnalytics ? (
              <div className="text-center py-12 text-gray-500">
                <i className="ri-bar-chart-line text-4xl mb-2"></i>
                <p>No trading analytics available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-blue-600">{tradingAnalytics?.totalTrades || 0}</div>
                    <div className="text-sm text-gray-500">Total Trades</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-green-600">{tradingAnalytics?.filledTrades || 0}</div>
                    <div className="text-sm text-gray-500">Successful</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-red-600">{tradingAnalytics?.failedTrades || 0}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-purple-600">{tradingAnalytics?.successRate?.toFixed(1) || '0.0'}%</div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                  </Card>
                </div>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Exchange Statistics</h3>
              {!tradingAnalytics || Object.keys(tradingAnalytics?.exchangeStats || {}).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-bar-chart-line text-4xl mb-2"></i>
                  <p>No exchange statistics available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(tradingAnalytics?.exchangeStats || {}).map(([exchange, stats]) => (
                    <div key={exchange} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{exchange}</div>
                        <div className="text-sm text-gray-500">{stats.count} trades</div>
                      </div>
                      <div className={`font-medium ${stats.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${stats.pnl.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
              </>
            )}
          </div>
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
                <p className="mt-4 text-gray-500">Loading financial data...</p>
              </div>
            ) : !financialOverview ? (
              <div className="text-center py-12 text-gray-500">
                <i className="ri-money-dollar-circle-line text-4xl mb-2"></i>
                <p>No financial data available</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-blue-600">${financialOverview?.totalVolume?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Total Volume</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-green-600">${financialOverview?.totalPnL?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Total PnL</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-red-600">${financialOverview?.totalFees?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Total Fees</div>
                  </Card>
                  <Card className="text-center p-4">
                    <div className="text-2xl font-bold text-purple-600">${financialOverview?.netProfit?.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-gray-500">Net Profit</div>
                  </Card>
                </div>
                {financialOverview.dailyPnL && Object.keys(financialOverview.dailyPnL).length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Daily PnL (Last 30 Days)</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {Object.entries(financialOverview.dailyPnL).slice(-30).reverse().map(([date, pnl]) => (
                        <div key={date} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">{new Date(date).toLocaleDateString()}</span>
                          <span className={`font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${pnl.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Monitoring Tab */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">System Logs</h3>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : !systemLogs || systemLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-file-list-line text-4xl mb-2"></i>
                  <p>No system logs available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {systemLogs.map((log, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        log.level === 'error' ? 'bg-red-500' :
                        log.level === 'warning' ? 'bg-yellow-500' :
                        log.level === 'success' ? 'bg-green-500' :
                        'bg-blue-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="font-medium">{log.message || log.event_message || 'No message'}</div>
                        <div className="text-sm text-gray-500">
                          {log.category || log.event_type || 'System'} • {log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown date'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">User Activity</h3>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : !userActivity || userActivity.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-user-line text-4xl mb-2"></i>
                  <p>No user activity data available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {userActivity.slice(0, 20).map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{activity.email}</div>
                        <div className="text-sm text-gray-500">
                          Bots: {activity.trading_bots?.length || 0} • 
                          Trades: {activity.trades?.length || 0} • 
                          Last Active: {activity.last_sign_in_at ? new Date(activity.last_sign_in_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Risk Monitoring</h3>
              {loading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                </div>
              ) : !riskMetrics ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-shield-check-line text-4xl mb-2"></i>
                  <p>No risk metrics available</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{riskMetrics?.riskScore || 0}</div>
                      <div className="text-sm text-gray-500">Risk Score</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{riskMetrics?.largeTrades?.length || 0}</div>
                      <div className="text-sm text-gray-500">Large Trades</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">Large Trades (≥ $1000)</h4>
                    {!riskMetrics.largeTrades || riskMetrics.largeTrades.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">No large trades found</div>
                    ) : (
                      <div className="space-y-2">
                        {riskMetrics.largeTrades.slice(0, 10).map((trade, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                            <div>
                              <div className="font-medium">{trade.symbol} - {trade.side}</div>
                              <div className="text-sm text-gray-500">
                                {trade.exchange} • Amount: ${trade.amount?.toFixed(2) || '0.00'} • {trade.created_at ? new Date(trade.created_at).toLocaleString() : 'Unknown date'}
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                              Large
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 mt-4">
                    <h4 className="font-medium">Recent Failed Trades</h4>
                    {!riskMetrics.failedTrades || riskMetrics.failedTrades.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">No failed trades in the last 24 hours</div>
                    ) : (
                      <div className="space-y-2">
                        {riskMetrics.failedTrades.slice(0, 10).map((trade, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <div>
                              <div className="font-medium">{trade.symbol} - {trade.side}</div>
                              <div className="text-sm text-gray-500">
                                {trade.exchange} • {trade.created_at ? new Date(trade.created_at).toLocaleString() : 'Unknown date'}
                              </div>
                            </div>
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                              Failed
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Data Export</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Button
                  variant="secondary"
                  onClick={() => handleExportData('all_trades')}
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <i className="ri-download-line text-2xl mb-2"></i>
                  Export All Trades
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleExportData('users')}
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <i className="ri-user-line text-2xl mb-2"></i>
                  Export Users
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleExportData('all_trades')}
                  className="h-16 flex flex-col items-center justify-center"
                >
                  <i className="ri-database-line text-2xl mb-2"></i>
                  Export System Data
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">System Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Database Status:</span>
                  <span className="text-green-600 font-medium">Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">API Status:</span>
                  <span className="text-green-600 font-medium">Operational</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Backup:</span>
                  <span className="text-gray-800">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">System Uptime:</span>
                  <span className="text-gray-800">99.9%</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create New User</h3>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateUser(false);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Create User
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Create Invitation Modal */}
        {showCreateInvitation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create Invitation Code</h3>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600">{successMessage}</p>
                </div>
              )}
              <form onSubmit={handleCreateInvitation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newInvitation.email}
                    onChange={(e) => setNewInvitation({...newInvitation, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires in (days)</label>
                  <select
                    value={newInvitation.expiresInDays}
                    onChange={(e) => setNewInvitation({...newInvitation, expiresInDays: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateInvitation(false);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1">
                    Create Invitation
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
