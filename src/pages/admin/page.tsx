
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { useBotExecutor } from '../../hooks/useBotExecutor';
import { useBots } from '../../hooks/useBots';
import { useCryptoNews, type CryptoNewsArticle } from '../../hooks/useCryptoNews';
import { supabase } from '../../lib/supabase';
import WebhookTestPage from '../webhook-test/page';
import CryptoNewsManager from './components/CryptoNewsManager';
import ContactMessages from './components/ContactMessages';
import SubscriptionManagement from './components/SubscriptionManagement';
import PopupManager from './components/PopupManager';
import EmailCenter from './components/EmailCenter';
import FunnelManager from './components/FunnelManager';
import ManualTrading from './components/ManualTrading';
import AdminNotifications from './components/AdminNotifications';
import TrackingScripts from './components/TrackingScripts';
import TrackingUrlGenerator from './components/TrackingUrlGenerator';
import PromoAutoPoster from './components/PromoAutoPoster';

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
  user_limit?: number | null;
  users_created?: number;
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
  const { executeBot } = useBotExecutor();
  const { getBotById } = useBots();
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
    getLatestTrades,
    getRiskMetrics,
    exportData,
    deleteUser,
    updateUserRole,
    updateUserStatus,
    sendPasswordResetLink,
    getTestPeriodSettings,
    updateTestPeriodSettings,
    deleteUsersByDateRange,
    upgradeUserSubscription
  } = useAdmin();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [allBots, setAllBots] = useState<TradingBot[]>([]);
  const [pabloReadyBots, setPabloReadyBots] = useState<any[]>([]);
  const [pabloReadyLoading, setPabloReadyLoading] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneBotIdInput, setCloneBotIdInput] = useState('');
  const [cloningBot, setCloningBot] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editingBotName, setEditingBotName] = useState<string>('');
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);
  const [testingBotId, setTestingBotId] = useState<Record<string, 'real' | 'paper' | null>>({});
  const [editingPabloBot, setEditingPabloBot] = useState<any | null>(null);
  const [testingPabloBotId, setTestingPabloBotId] = useState<string | null>(null);
  const [orphanedBots, setOrphanedBots] = useState<any[]>([]);
  const [loadingOrphanedBots, setLoadingOrphanedBots] = useState(false);
  const [deletingOrphanedBotId, setDeletingOrphanedBotId] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [tradingAnalytics, setTradingAnalytics] = useState<TradingAnalytics | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [latestTrades, setLatestTrades] = useState<any[]>([]);
  const [latestTradesLoading, setLatestTradesLoading] = useState(false);
  const [latestTradesFilter, setLatestTradesFilter] = useState<'all' | 'real' | 'paper'>('all');
  const [latestTradesUserFilter, setLatestTradesUserFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateInvitation, setShowCreateInvitation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<Record<string, boolean>>({});
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'user',
    planId: '' as string | null
  });
  
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<Record<string, any>>({});
  const [upgradingSubscriptionUserId, setUpgradingSubscriptionUserId] = useState<string | null>(null);
  
  const [newInvitation, setNewInvitation] = useState({
    email: '',
    expiresInDays: 7,
    userLimit: null as number | null
  });

  // Test Period Management
  const [testPeriodSettings, setTestPeriodSettings] = useState<any>(null);
  const [showTestPeriodModal, setShowTestPeriodModal] = useState(false);
  const [testPeriodForm, setTestPeriodForm] = useState({
    enabled: false,
    start_date: '',
    end_date: '',
    message: 'The website is currently in test mode. Some features may be limited.'
  });

  // Bulk Delete Users
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteForm, setBulkDeleteForm] = useState({
    start_date: '',
    end_date: '',
    confirm: ''
  });

  // Crypto News Management
  const {
    loading: cryptoNewsLoading,
    error: cryptoNewsError,
    generateArticle,
    getArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    publishArticle
  } = useCryptoNews();

  const [cryptoNewsArticles, setCryptoNewsArticles] = useState<CryptoNewsArticle[]>([]);
  const [showCreateArticle, setShowCreateArticle] = useState(false);
  const [editingArticle, setEditingArticle] = useState<CryptoNewsArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    keywords: [] as string[],
    keywordInput: '',
    category: 'general',
    status: 'draft' as 'draft' | 'published' | 'archived',
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    meta_keywordInput: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    twitter_card: 'summary_large_image',
    twitter_title: '',
    twitter_description: '',
    canonical_url: '',
    featured_image_url: '',
    tags: [] as string[],
    tagInput: ''
  });
  const [generatingArticle, setGeneratingArticle] = useState(false);

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
      navigate('/dashboard');
      return;
    }
    
    console.log('✅ User is admin, loading admin data...');
    loadData();
  }, [user, authLoading, navigate]);

  // Ensure users are loaded when Latest Trades tab is active
  useEffect(() => {
    if (activeTab === 'latest-trades' && users.length === 0) {
      console.log('🔄 Latest Trades tab active but no users, loading users...');
      const loadUsersForDropdown = async () => {
        try {
          const usersData = await getUsers();
          console.log('✅ Users loaded in useEffect:', usersData?.length || 0, 'users');
          console.log('📋 Users data sample:', usersData?.[0]);
          if (usersData && usersData.length > 0) {
            setUsers(usersData);
            console.log('✅ Users state updated with', usersData.length, 'users');
          } else {
            console.warn('⚠️ getUsers() returned empty array or null');
          }
        } catch (error) {
          console.error('❌ Failed to load users in useEffect:', error);
        }
      };
      loadUsersForDropdown();
    }
  }, [activeTab]); // Only depend on activeTab to avoid infinite loops

  const fetchPabloReadyBots = async () => {
    try {
      setPabloReadyLoading(true);
      const { data, error } = await supabase
        .from('pablo_ready_bots')
        .select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPabloReadyBots(data || []);
    } catch (error: any) {
      console.error('Error fetching Pablo Ready bots:', error);
      alert(`Failed to load Pablo Ready bots: ${error?.message || error}`);
    } finally {
      setPabloReadyLoading(false);
    }
  };

  const fetchOrphanedBots = async () => {
    try {
      setLoadingOrphanedBots(true);
      const { data, error } = await supabase
        .from('trading_bots')
        .select('*')
        .is('user_id', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrphanedBots(data || []);
    } catch (error: any) {
      console.error('Error fetching orphaned bots:', error);
      alert(`Failed to load orphaned bots: ${error?.message || error}`);
    } finally {
      setLoadingOrphanedBots(false);
    }
  };

  const deleteOrphanedBot = async (botId: string, botName: string) => {
    if (!confirm(`⚠️ Delete bot "${botName}"?\n\nThis bot has no user and cannot trade. This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingOrphanedBotId(botId);
      const { error } = await supabase
        .from('trading_bots')
        .delete()
        .eq('id', botId);
      
      if (error) throw error;
      alert(`✅ Bot "${botName}" deleted successfully`);
      await fetchOrphanedBots();
    } catch (error: any) {
      console.error('Error deleting orphaned bot:', error);
      alert(`❌ Failed to delete bot: ${error?.message || error}`);
    } finally {
      setDeletingOrphanedBotId(null);
    }
  };

  const togglePabloReadyBot = async (botId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('pablo_ready_bots')
        .update({ enabled: !enabled })
        .eq('id', botId);
      
      if (error) throw error;
      await fetchPabloReadyBots();
      alert(`✅ Bot ${enabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error: any) {
      console.error('Error toggling Pablo Ready bot:', error);
      alert(`❌ Failed to ${enabled ? 'disable' : 'enable'} bot: ${error?.message || error}`);
    }
  };

  const startEditingBotName = (bot: any) => {
    setEditingBotId(bot.id);
    setEditingBotName(bot.name);
  };

  const cancelEditingBotName = () => {
    setEditingBotId(null);
    setEditingBotName('');
  };

  const saveBotName = async (botId: string) => {
    if (!editingBotName.trim()) {
      alert('❌ Bot name cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('pablo_ready_bots')
        .update({ name: editingBotName.trim() })
        .eq('id', botId);
      
      if (error) throw error;
      await fetchPabloReadyBots();
      setEditingBotId(null);
      setEditingBotName('');
      alert('✅ Bot name updated successfully');
    } catch (error: any) {
      console.error('Error updating bot name:', error);
      alert(`❌ Failed to update bot name: ${error?.message || error}`);
    }
  };

  const deletePabloReadyBot = async (botId: string, botName: string) => {
    if (!confirm(`⚠️ Are you sure you want to delete "${botName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingBotId(botId);
      const { error } = await supabase
        .from('pablo_ready_bots')
        .delete()
        .eq('id', botId);
      
      if (error) throw error;
      await fetchPabloReadyBots();
      alert(`✅ Bot "${botName}" deleted successfully`);
    } catch (error: any) {
      console.error('Error deleting Pablo Ready bot:', error);
      alert(`❌ Failed to delete bot: ${error?.message || error}`);
    } finally {
      setDeletingBotId(null);
    }
  };

  const editPabloReadyBot = (bot: any) => {
    setEditingPabloBot(bot);
  };

  const savePabloReadyBot = async (updatedBot: any) => {
    try {
      const { error } = await supabase
        .from('pablo_ready_bots')
        .update(updatedBot)
        .eq('id', updatedBot.id);
      
      if (error) throw error;
      await fetchPabloReadyBots();
      setEditingPabloBot(null);
      alert('✅ Bot updated successfully');
    } catch (error: any) {
      console.error('Error updating Pablo Ready bot:', error);
      alert(`❌ Failed to update bot: ${error?.message || error}`);
    }
  };

  const testPabloReadyBot = async (bot: any, mode: 'paper' | 'real' = 'paper') => {
    if (!confirm(`🧪 Test "${bot.name}" in ${mode.toUpperCase()} mode?\n\nThis will create a temporary bot and execute it.`)) {
      return;
    }

    try {
      setTestingPabloBotId(bot.id);
      
      // Create a temporary bot from the template
      const tempBotData = {
        name: `[TEST] ${bot.name}`,
        exchange: bot.exchange,
        trading_type: bot.trading_type,
        symbol: bot.symbol,
        timeframe: bot.timeframe,
        leverage: bot.leverage || 1,
        risk_level: bot.risk_level || 'medium',
        trade_amount: bot.trade_amount || 100,
        stop_loss: bot.stop_loss || 2.0,
        take_profit: bot.take_profit || 4.0,
        paper_trading: mode === 'paper',
        strategy: bot.strategy || {},
        strategy_config: bot.strategy_config || {},
        status: 'running' as const
      };

      // Create the bot
      const { data: newBot, error: createError } = await supabase
        .from('trading_bots')
        .insert(tempBotData)
        .select()
        .single();

      if (createError) throw createError;

      // Execute the bot
      await executeBot(newBot.id);

      // Delete the temporary bot after a delay
      setTimeout(async () => {
        await supabase
          .from('trading_bots')
          .delete()
          .eq('id', newBot.id);
      }, 5000);

      alert(`✅ Test bot created and executed successfully!\n\nBot ID: ${newBot.id}\nMode: ${mode.toUpperCase()}\n\nThe temporary bot will be deleted in 5 seconds.`);
    } catch (error: any) {
      console.error('Error testing Pablo Ready bot:', error);
      alert(`❌ Failed to test bot: ${error?.message || error}`);
    } finally {
      setTestingPabloBotId(null);
    }
  };

  const cloneBotToPabloReady = async () => {
    if (!cloneBotIdInput.trim()) {
      setCloneError('Please enter a bot ID');
      return;
    }

    try {
      setCloningBot(true);
      setCloneError(null);

      // Fetch the bot from trading_bots
      const bot = await getBotById(cloneBotIdInput.trim());

      if (!bot) {
        setCloneError('Bot not found. Please check the bot ID.');
        setCloningBot(false);
        return;
      }

      // Map trading_bot fields to pablo_ready_bots fields
      const pabloReadyBot = {
        name: `${bot.name} (Clone)`,
        description: `Cloned from bot ${bot.id}`,
        exchange: bot.exchange || 'bybit',
        symbol: bot.symbol || (bot.symbols && bot.symbols.length > 0 ? bot.symbols[0] : 'BTCUSDT'),
        trading_type: bot.tradingType || 'futures',
        leverage: bot.leverage || 1,
        risk_level: bot.riskLevel || 'medium',
        strategy: bot.strategy || {},
        strategy_config: bot.strategyConfig || {},
        trade_amount: bot.tradeAmount || 100,
        stop_loss: bot.stopLoss || 2.0,
        take_profit: bot.takeProfit || 4.0,
        timeframe: bot.timeframe || '1h',
        enabled: true,
        featured: false,
        order_index: 0,
        created_by: user?.id || null
      };

      // Insert into pablo_ready_bots
      const { error: insertError } = await supabase
        .from('pablo_ready_bots')
        .insert(pabloReadyBot);

      if (insertError) {
        throw insertError;
      }

      alert(`✅ Bot cloned successfully! "${pabloReadyBot.name}" has been added to Pablo Ready bots.`);
      setShowCloneModal(false);
      setCloneBotIdInput('');
      await fetchPabloReadyBots();
    } catch (err: any) {
      console.error('Error cloning bot:', err);
      setCloneError(err.message || 'Failed to clone bot. Please check the bot ID.');
    } finally {
      setCloningBot(false);
    }
  };

  const fetchLatestTrades = async () => {
    try {
      setLatestTradesLoading(true);
      
      // Use admin Edge Function which uses service role key to bypass RLS
      // Pass user_id filter if a specific user is selected
      const userId = latestTradesUserFilter === 'all' ? null : latestTradesUserFilter;
      const trades = await getLatestTrades(100, userId);
      setLatestTrades(trades);
    } catch (error: any) {
      console.error('Error fetching latest trades:', error);
      alert(`Failed to load latest trades: ${error?.message || error}`);
      setLatestTrades([]);
    } finally {
      setLatestTradesLoading(false);
    }
  };

  const fetchUserSubscriptions = async () => {
    try {
      // Fetch all subscriptions (not just active) to show current plan
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          plan_id,
          status,
          expires_at,
          subscription_plans!user_subscriptions_plan_id_fkey(id, name, display_name, price_monthly_usd, max_bots)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching subscriptions:', error);
        return;
      }

      const subscriptionsMap: Record<string, any> = {};
      // Get the most recent subscription for each user
      (data || []).forEach((sub: any) => {
        if (!subscriptionsMap[sub.user_id]) {
          subscriptionsMap[sub.user_id] = sub;
        }
      });
      setUserSubscriptions(subscriptionsMap);
      console.log('✅ Loaded user subscriptions:', Object.keys(subscriptionsMap).length);
    } catch (err) {
      console.error('Error fetching user subscriptions:', err);
    }
  };

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
        riskData,
        testPeriodData
      ] = await Promise.all([
        getUsers(),
        getInvitationCodes(),
        getAllBots(),
        getSystemStats(),
        getTradingAnalytics(),
        getFinancialOverview(),
        getUserActivity(),
        getSystemLogs(),
        getRiskMetrics(),
        getTestPeriodSettings().catch(() => null)
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
      
      // Set test period settings
      if (testPeriodData) {
        setTestPeriodSettings(testPeriodData);
        setTestPeriodForm({
          enabled: testPeriodData.enabled || false,
          start_date: testPeriodData.start_date ? new Date(testPeriodData.start_date).toISOString().split('T')[0] : '',
          end_date: testPeriodData.end_date ? new Date(testPeriodData.end_date).toISOString().split('T')[0] : '',
          message: testPeriodData.message || 'The website is currently in test mode. Some features may be limited.'
        });
      }
      
      // Load Pablo Ready bots if on that tab
      if (activeTab === 'pablo-ready') {
        await fetchPabloReadyBots();
      }
      
      // Fetch user subscriptions if on users tab
      if (activeTab === 'users') {
        await fetchUserSubscriptions();
      }
    } catch (error) {
      console.error('❌ Error loading admin data:', error);
      console.error('❌ Error details:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, price_monthly_usd, max_bots')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      
      if (error) {
        console.error('Error fetching plans:', error)
        return
      }
      console.log('✅ Fetched plans:', data?.length || 0, 'plans')
      setAvailablePlans(data || [])
    } catch (err) {
      console.error('Error fetching plans:', err)
    }
  };

  // Fetch plans when create user modal opens or when users tab is active
  useEffect(() => {
    if (showCreateUser || activeTab === 'users') {
      fetchAvailablePlans();
    }
  }, [showCreateUser, activeTab]);

  // Fetch user subscriptions when users tab is active
  useEffect(() => {
    if (activeTab === 'users') {
      if (users.length > 0) {
        fetchUserSubscriptions();
      }
      // Always fetch plans when users tab is active
      fetchAvailablePlans();
    }
  }, [activeTab, users.length]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await createUser(newUser.email, newUser.password, newUser.role, newUser.planId || undefined);
      setSuccessMessage(result?.message || 'User created successfully');
      setNewUser({ email: '', password: '', role: 'user', planId: '' });
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
      const result = await generateInvitationCode(
        newInvitation.email, 
        newInvitation.expiresInDays,
        newInvitation.userLimit || undefined
      );
      setSuccessMessage(result?.message || 'Invitation code created successfully');
      setNewInvitation({ email: '', expiresInDays: 7, userLimit: null });
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
      // Try with userId first, fallback to email if needed
      await deleteUser(userId, email);
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

  const handleUpgradeSubscription = async (userId: string, planId: string) => {
    if (!planId) {
      alert('❌ Please select a plan');
      return;
    }

    const plan = availablePlans.find(p => p.id === planId);
    const currentSub = userSubscriptions[userId];
    const currentPlan = currentSub?.subscription_plans;
    
    const confirmMessage = currentSub
      ? `Upgrade subscription from "${currentPlan?.display_name || 'Unknown'}" to "${plan?.display_name || 'Unknown'}"?`
      : `Create subscription "${plan?.display_name || 'Unknown'}" for this user?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUpgradingSubscriptionUserId(userId);
    setUserLoadingState(userId, true);
    try {
      const result = await upgradeUserSubscription(userId, planId);
      const action = result?.action || 'upgraded';
      alert(`✅ User subscription ${action} successfully!`);
      await fetchUserSubscriptions(); // Refresh subscriptions
      await fetchAvailablePlans(); // Refresh plans
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      alert(`❌ Failed to upgrade subscription: ${error?.message || error}`);
    } finally {
      setUserLoadingState(userId, false);
      setUpgradingSubscriptionUserId(null);
    }
  };

  // Test Period Management Handlers
  const handleSaveTestPeriod = async () => {
    if (testPeriodForm.enabled && (!testPeriodForm.start_date || !testPeriodForm.end_date)) {
      alert('❌ Start date and end date are required when enabling test period');
      return;
    }

    if (testPeriodForm.enabled && new Date(testPeriodForm.start_date) >= new Date(testPeriodForm.end_date)) {
      alert('❌ End date must be after start date');
      return;
    }

    try {
      const result = await updateTestPeriodSettings({
        enabled: testPeriodForm.enabled,
        start_date: testPeriodForm.enabled ? new Date(testPeriodForm.start_date).toISOString() : undefined,
        end_date: testPeriodForm.enabled ? new Date(testPeriodForm.end_date).toISOString() : undefined,
        message: testPeriodForm.message
      });

      setTestPeriodSettings(result.settings);
      setShowTestPeriodModal(false);
      alert(`✅ Test period ${testPeriodForm.enabled ? 'enabled' : 'disabled'} successfully`);
      await loadData();
    } catch (error: any) {
      console.error('Error saving test period:', error);
      alert(`❌ Failed to save test period: ${error?.message || error}`);
    }
  };

  // Bulk Delete Users Handler
  const handleBulkDeleteUsers = async () => {
    if (!bulkDeleteForm.start_date || !bulkDeleteForm.end_date) {
      alert('❌ Start date and end date are required');
      return;
    }

    if (bulkDeleteForm.confirm !== 'DELETE') {
      alert('❌ Please type "DELETE" in the confirmation field to proceed');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will delete ALL users created between ${bulkDeleteForm.start_date} and ${bulkDeleteForm.end_date} (excluding admins).\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`
    );

    if (!confirmed) return;

    try {
      const result = await deleteUsersByDateRange(
        new Date(bulkDeleteForm.start_date).toISOString(),
        new Date(bulkDeleteForm.end_date).toISOString()
      );

      alert(`✅ ${result.deleted_count} user(s) deleted successfully${result.errors ? `\n\nErrors: ${result.errors.join(', ')}` : ''}`);
      setShowBulkDeleteModal(false);
      setBulkDeleteForm({ start_date: '', end_date: '', confirm: '' });
      await loadData();
    } catch (error: any) {
      console.error('Error bulk deleting users:', error);
      alert(`❌ Failed to delete users: ${error?.message || error}`);
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

  const handleTestTrade = async (botId: string, mode: 'real' | 'paper') => {
    if (!user) {
      alert('❌ You must be logged in to test trades');
      return;
    }

    const confirmMessage = mode === 'real' 
      ? `⚠️ WARNING: This will execute a REAL trade using live funds!\n\nBot: ${allBots.find(b => b.id === botId)?.name || botId}\n\nAre you sure you want to proceed?`
      : `Test PAPER trade for bot: ${allBots.find(b => b.id === botId)?.name || botId}\n\nThis will execute a paper trade (no real funds).`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setTestingBotId(prev => ({ ...prev, [botId]: mode }));

      // Get bot details
      const { data: botData, error: botError } = await supabase
        .from('trading_bots')
        .select('id, user_id, name, symbol, exchange, trading_type, status')
        .eq('id', botId)
        .single();

      if (botError || !botData) {
        throw new Error(`Failed to fetch bot: ${botError?.message || 'Bot not found'}`);
      }

      if (botData.status !== 'running') {
        throw new Error(`Bot is not running. Current status: ${botData.status}`);
      }

      // Create manual trade signal
      const { data: signalData, error: signalError } = await supabase
        .from('manual_trade_signals')
        .insert({
          bot_id: botId,
          user_id: botData.user_id,
          mode: mode,
          side: 'buy',
          size_multiplier: 1.0,
          reason: `Admin test trade (${mode.toUpperCase()})`,
          status: 'pending'
        })
        .select()
        .single();

      if (signalError || !signalData) {
        throw new Error(`Failed to create test signal: ${signalError?.message || 'Unknown error'}`);
      }

      console.log(`✅ Test signal created: ${signalData.id}`);

      // Trigger bot executor immediately
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      const requestUrl = `${supabaseUrl}/functions/v1/bot-executor`;
      const requestBody = {
        action: 'execute_bot',
        bot_id: botId
      };
      
      console.log(`🚀 Triggering bot executor:`, {
        url: requestUrl,
        method: 'POST',
        botId: botId,
        action: 'execute_bot',
        mode: mode
      });

      try {
        const triggerResponse = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'x-cron-secret': import.meta.env.VITE_CRON_SECRET || ''
          },
          body: JSON.stringify(requestBody)
        });

        const triggerText = await triggerResponse.text();
        
        console.log(`📥 Bot executor response:`, {
          status: triggerResponse.status,
          statusText: triggerResponse.statusText,
          ok: triggerResponse.ok,
          body: triggerText.substring(0, 200)
        });
        
        if (!triggerResponse.ok) {
          console.error(`❌ Bot executor trigger failed:`, {
            status: triggerResponse.status,
            statusText: triggerResponse.statusText,
            body: triggerText
          });
          // Don't fail the test - the signal is created and will be processed by the next cron run
        } else {
          console.log(`✅ Bot executor triggered successfully`);
        }
      } catch (fetchError: any) {
        console.error(`❌ Failed to trigger bot executor:`, {
          error: fetchError.message,
          stack: fetchError.stack,
          name: fetchError.name
        });
        // Don't fail the test - the signal is created and will be processed by the next cron run
      }

      alert(`✅ Test ${mode.toUpperCase()} trade signal created!\n\nSignal ID: ${signalData.id}\n\nThe bot executor will process this trade shortly. Check the bot logs for execution details.`);
      
      // Refresh data after a short delay
      setTimeout(() => {
        loadData();
      }, 2000);

    } catch (error: any) {
      console.error('Error creating test trade:', error);
      alert(`❌ Failed to create test trade: ${error?.message || 'Unknown error'}`);
    } finally {
      setTestingBotId(prev => ({ ...prev, [botId]: null }));
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
    { id: 'email-center', label: 'Email Center', icon: 'ri-mail-send-line' },
    { id: 'notifications', label: 'Admin Notifications', icon: 'ri-notification-badge-line' },
    { id: 'tracking', label: 'Tracking Codes', icon: 'ri-code-line' },
    { id: 'tracking-urls', label: 'Tracking URLs', icon: 'ri-link' },
    { id: 'contact-messages', label: 'Contact Messages', icon: 'ri-mail-line' },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'ri-wallet-line' },
    { id: 'popups', label: 'Popup Manager', icon: 'ri-notification-line' },
    { id: 'funnels', label: 'Funnel Manager', icon: 'ri-stack-line' },
    { id: 'manual-trading', label: 'Manual Trading', icon: 'ri-exchange-funds-line' },
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'users', label: 'Users', icon: 'ri-user-line' },
    { id: 'bots', label: 'Trading Bots', icon: 'ri-robot-line' },
    { id: 'pablo-ready', label: 'Pablo Ready', icon: 'ri-star-line' },
    { id: 'crypto-news', label: 'Crypto News', icon: 'ri-newspaper-line' },
    { id: 'promo-autopost', label: 'Promo Auto-Posting', icon: 'ri-megaphone-line' },
    { id: 'latest-trades', label: 'Latest Trades', icon: 'ri-exchange-line' },
    { id: 'webhook-test', label: 'Webhook Test', icon: 'ri-send-plane-line' },
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
        subtitle="Complete System Management & Control (v1.0.1)"
      />
      
      <div className="pt-20 pb-20 px-4">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'primary' : 'secondary'}
                onClick={async () => {
                  setActiveTab(tab.id);
                  if (tab.id === 'pablo-ready') {
                    fetchPabloReadyBots();
                    fetchOrphanedBots();
                  } else if (tab.id === 'latest-trades') {
                    // Ensure users are loaded before showing dropdown
                    console.log('🔍 Latest Trades tab clicked. Current users count:', users.length);
                    if (users.length === 0) {
                      console.log('⚠️ Users not loaded yet, loading users first...');
                      // Load users directly to ensure they're available
                      try {
                        const usersData = await getUsers();
                        console.log('✅ Users loaded from getUsers():', usersData?.length || 0, 'users');
                        console.log('📋 Users data:', usersData);
                        if (usersData && usersData.length > 0) {
                          setUsers(usersData);
                          console.log('✅ Users state updated');
                        } else {
                          console.warn('⚠️ No users returned from getUsers()');
                        }
                      } catch (error) {
                        console.error('❌ Failed to load users:', error);
                      }
                    } else {
                      console.log('✅ Users already loaded:', users.length, 'users');
                    }
                    fetchLatestTrades();
                  }
                }}
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
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowBulkDeleteModal(true)}>
                    <i className="ri-delete-bin-7-line mr-2"></i>
                    Bulk Delete
                  </Button>
                  <Button variant="secondary" onClick={() => setShowTestPeriodModal(true)}>
                    <i className="ri-timer-line mr-2"></i>
                    Test Period
                  </Button>
                <Button onClick={() => setShowCreateUser(true)}>
                  <i className="ri-user-add-line mr-2"></i>
                  Create User
                </Button>
                </div>
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
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Subscription</label>
                          <div className="flex gap-2 items-center">
                            {userSubscriptions[user.id] ? (
                              <span className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                {userSubscriptions[user.id]?.subscription_plans?.display_name || 'Unknown Plan'}
                              </span>
                            ) : (
                              <span className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex-shrink-0">
                                No Subscription
                              </span>
                            )}
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleUpgradeSubscription(user.id, e.target.value);
                                  e.target.value = ''; // Reset select
                                }
                              }}
                              disabled={isActionLoading || upgradingSubscriptionUserId === user.id || availablePlans.length === 0}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-900 dark:border-gray-700 min-w-[180px]"
                              defaultValue=""
                              title={availablePlans.length === 0 ? "Loading plans..." : "Select a plan to upgrade"}
                            >
                              <option value="">
                                {availablePlans.length === 0 ? "Loading plans..." : "Upgrade to..."}
                              </option>
                              {availablePlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.display_name} {plan.price_monthly_usd ? `($${plan.price_monthly_usd}/mo)` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
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
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-mono text-sm">{code.code}</div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            code.used ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {code.used ? 'Used' : 'Active'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Email:</span> {code.email || 'No email specified'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Created: {new Date(code.created_at).toLocaleDateString()} • 
                          Expires: {new Date(code.expires_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Users:</span> {code.users_created || 0}
                          {code.user_limit !== null && code.user_limit !== undefined && (
                            <> / {code.user_limit} {code.users_created >= code.user_limit && <span className="text-red-600">(Limit Reached)</span>}</>
                          )}
                          {(!code.user_limit || code.user_limit === null) && <span className="text-gray-400"> (Unlimited)</span>}
                      </div>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          if (confirm(`Delete invitation code "${code.code}"?`)) {
                            try {
                              const { error } = await supabase
                                .from('invitation_codes')
                                .delete()
                                .eq('id', code.id);
                              if (error) throw error;
                              await loadData();
                              alert('✅ Invitation code deleted');
                            } catch (error: any) {
                              alert(`❌ Failed to delete: ${error?.message || error}`);
                            }
                          }
                        }}
                      >
                        <i className="ri-delete-bin-line"></i>
                      </Button>
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
                            title="Start bot"
                          >
                            <i className="ri-play-line"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBotControl(bot.id, 'paused')}
                            disabled={bot.status === 'paused'}
                            title="Pause bot"
                          >
                            <i className="ri-pause-line"></i>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBotControl(bot.id, 'stopped')}
                            disabled={bot.status === 'stopped'}
                            title="Stop bot"
                          >
                            <i className="ri-stop-line"></i>
                          </Button>
                          <div className="ml-2 border-l border-gray-300 pl-2 flex space-x-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleTestTrade(bot.id, 'paper')}
                              disabled={bot.status !== 'running' || testingBotId[bot.id] === 'paper'}
                              title="Test Paper Trade"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {testingBotId[bot.id] === 'paper' ? (
                                <>
                                  <i className="ri-loader-4-line animate-spin mr-1"></i>
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <i className="ri-file-paper-line mr-1"></i>
                                  Paper
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleTestTrade(bot.id, 'real')}
                              disabled={bot.status !== 'running' || testingBotId[bot.id] === 'real'}
                              title="Test Real Trade (WARNING: Uses Live Funds!)"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {testingBotId[bot.id] === 'real' ? (
                                <>
                                  <i className="ri-loader-4-line animate-spin mr-1"></i>
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <i className="ri-money-dollar-circle-line mr-1"></i>
                                  Real
                                </>
                              )}
                          </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Pablo Ready Tab */}
        {activeTab === 'pablo-ready' && (
          <div className="space-y-6">
            {/* Orphaned Bots Section - Bots with null user_id */}
            <Card className="p-6 border-2 border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                    <i className="ri-error-warning-line"></i>
                    Orphaned Bots (No User)
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    These bots have no user_id and cannot trade. Delete them or they will cause errors.
                  </p>
                </div>
                <Button
                  onClick={fetchOrphanedBots}
                  variant="secondary"
                  size="sm"
                  disabled={loadingOrphanedBots}
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Refresh
                </Button>
              </div>

              {loadingOrphanedBots ? (
                <div className="text-center py-4">
                  <i className="ri-loader-4-line animate-spin text-xl text-red-400"></i>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">Loading orphaned bots...</p>
                </div>
              ) : orphanedBots.length === 0 ? (
                <div className="text-center py-4 text-green-700 dark:text-green-400">
                  <i className="ri-checkbox-circle-line text-2xl mb-2"></i>
                  <p className="text-sm">✅ No orphaned bots found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orphanedBots.map((bot) => (
                    <div
                      key={bot.id}
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-300 dark:border-red-800"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {bot.name}
                            </h4>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                              <i className="ri-error-warning-line mr-1"></i>
                              No User
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              bot.status === 'running' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {bot.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Symbol</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {bot.symbols && bot.symbols.length > 1 
                                  ? `${bot.symbols.join(', ')} (${bot.symbols.length} pairs)` 
                                  : bot.symbol}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Exchange</span>
                              <span className="font-medium text-gray-900 dark:text-white capitalize">{bot.exchange}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Type</span>
                              <span className="font-medium text-gray-900 dark:text-white capitalize">{bot.trading_type}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Created</span>
                              <span className="font-medium text-gray-900 dark:text-white text-xs">
                                {new Date(bot.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button
                            onClick={() => deleteOrphanedBot(bot.id, bot.name)}
                            variant="danger"
                            size="sm"
                            disabled={deletingOrphanedBotId === bot.id}
                          >
                            {deletingOrphanedBotId === bot.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <i className="ri-delete-bin-line mr-2"></i>
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pablo Ready Bots</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage pre-configured bots available to all users
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowCloneModal(true)}
                    variant="primary"
                    size="sm"
                  >
                    <i className="ri-file-copy-line mr-2"></i>
                    Clone by ID
                  </Button>
                <Button
                  onClick={fetchPabloReadyBots}
                  variant="secondary"
                  size="sm"
                  disabled={pabloReadyLoading}
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Refresh
                </Button>
                </div>
              </div>

              {pabloReadyLoading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                  <p className="text-sm text-gray-500 mt-2">Loading bots...</p>
                </div>
              ) : pabloReadyBots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-robot-line text-4xl mb-2"></i>
                  <p>No Pablo Ready bots found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pabloReadyBots.map((bot) => (
                    <Card
                      key={bot.id}
                      className={`p-4 border-2 ${
                        bot.enabled
                          ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-900/10'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {editingBotId === bot.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingBotName}
                                  onChange={(e) => setEditingBotName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      saveBotName(bot.id);
                                    } else if (e.key === 'Escape') {
                                      cancelEditingBotName();
                                    }
                                  }}
                                  className="flex-1 px-3 py-1 border border-blue-500 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-gray-800 dark:text-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveBotName(bot.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                                  title="Save (Enter)"
                                >
                                  <i className="ri-check-line"></i>
                                </button>
                                <button
                                  onClick={cancelEditingBotName}
                                  className="px-3 py-1 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                                  title="Cancel (Esc)"
                                >
                                  <i className="ri-close-line"></i>
                                </button>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {bot.name}
                                </h4>
                                <button
                                  onClick={() => startEditingBotName(bot)}
                                  className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                  title="Edit name"
                                >
                                  <i className="ri-edit-line text-sm"></i>
                                </button>
                              </>
                            )}
                            {bot.featured && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                                <i className="ri-star-fill mr-1"></i>
                                Featured
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                bot.enabled
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {bot.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          {bot.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              {bot.description}
                            </p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Exchange</span>
                              <span className="font-medium text-gray-900 dark:text-white capitalize">
                                {bot.exchange}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Symbol</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {bot.symbols && bot.symbols.length > 1 
                                  ? `${bot.symbols.join(', ')} (${bot.symbols.length} pairs)` 
                                  : bot.symbol}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Timeframe</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {bot.timeframe || '1h'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Type</span>
                              <span className="font-medium text-gray-900 dark:text-white capitalize">
                                {bot.trading_type}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">Leverage</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {bot.leverage}x
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <Button
                            onClick={() => editPabloReadyBot(bot)}
                            variant="secondary"
                            size="sm"
                          >
                            <i className="ri-edit-line mr-2"></i>
                            Edit
                          </Button>
                          <Button
                            onClick={() => testPabloReadyBot(bot, 'paper')}
                            variant="primary"
                            size="sm"
                            disabled={testingPabloBotId === bot.id}
                          >
                            {testingPabloBotId === bot.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Testing...
                              </>
                            ) : (
                              <>
                                <i className="ri-flask-line mr-2"></i>
                                Test (Paper)
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => testPabloReadyBot(bot, 'real')}
                            variant="warning"
                            size="sm"
                            disabled={testingPabloBotId === bot.id}
                          >
                            {testingPabloBotId === bot.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Testing...
                              </>
                            ) : (
                              <>
                                <i className="ri-flask-line mr-2"></i>
                                Test (Real)
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => togglePabloReadyBot(bot.id, bot.enabled)}
                            variant={bot.enabled ? 'danger' : 'primary'}
                            size="sm"
                          >
                            <i className={`mr-2 ${bot.enabled ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                            {bot.enabled ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            onClick={() => deletePabloReadyBot(bot.id, bot.name)}
                            variant="danger"
                            size="sm"
                            disabled={deletingBotId === bot.id}
                          >
                            {deletingBotId === bot.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin mr-2"></i>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <i className="ri-delete-bin-line mr-2"></i>
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Edit Bot Modal */}
        {editingPabloBot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Edit Bot: {editingPabloBot.name}
                  </h3>
                  <button
                    onClick={() => setEditingPabloBot(null)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <i className="ri-close-line text-2xl"></i>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editingPabloBot.name}
                      onChange={(e) => setEditingPabloBot({ ...editingPabloBot, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editingPabloBot.description || ''}
                      onChange={(e) => setEditingPabloBot({ ...editingPabloBot, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Exchange
                      </label>
                      <select
                        value={editingPabloBot.exchange}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, exchange: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      >
                        <option value="bybit">Bybit</option>
                        <option value="okx">OKX</option>
                        <option value="bitunix">Bitunix</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trading Type
                      </label>
                      <select
                        value={editingPabloBot.trading_type}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, trading_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      >
                        <option value="spot">Spot</option>
                        <option value="futures">Futures</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Symbol
                      </label>
                      <input
                        type="text"
                        value={editingPabloBot.symbol}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, symbol: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                        placeholder="BTCUSDT"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Timeframe
                      </label>
                      <select
                        value={editingPabloBot.timeframe || '1h'}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, timeframe: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      >
                        <option value="1m">1 Minute</option>
                        <option value="3m">3 Minutes</option>
                        <option value="5m">5 Minutes</option>
                        <option value="15m">15 Minutes</option>
                        <option value="30m">30 Minutes</option>
                        <option value="45m">45 Minutes</option>
                        <option value="1h">1 Hour</option>
                        <option value="2h">2 Hours</option>
                        <option value="3h">3 Hours</option>
                        <option value="4h">4 Hours</option>
                        <option value="5h">5 Hours</option>
                        <option value="6h">6 Hours</option>
                        <option value="7h">7 Hours</option>
                        <option value="8h">8 Hours</option>
                        <option value="9h">9 Hours</option>
                        <option value="10h">10 Hours</option>
                        <option value="12h">12 Hours</option>
                        <option value="1d">1 Day</option>
                        <option value="1w">1 Week</option>
                        <option value="1M">1 Month</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Leverage
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingPabloBot.leverage || 1}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, leverage: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Risk Level
                      </label>
                      <select
                        value={editingPabloBot.risk_level || 'medium'}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, risk_level: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trade Amount ($)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingPabloBot.trade_amount || 100}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, trade_amount: parseFloat(e.target.value) || 100 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editingPabloBot.stop_loss || 2.0}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, stop_loss: parseFloat(e.target.value) || 2.0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Take Profit (%)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editingPabloBot.take_profit || 4.0}
                        onChange={(e) => setEditingPabloBot({ ...editingPabloBot, take_profit: parseFloat(e.target.value) || 4.0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      onClick={() => setEditingPabloBot(null)}
                      variant="secondary"
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => savePabloReadyBot(editingPabloBot)}
                      variant="primary"
                      size="sm"
                    >
                      <i className="ri-save-line mr-2"></i>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Clone Bot Modal */}
        {showCloneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md m-4">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Clone Bot to Pablo Ready
                  </h3>
                  <button
                    onClick={() => {
                      setShowCloneModal(false);
                      setCloneBotIdInput('');
                      setCloneError(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <i className="ri-close-line text-2xl"></i>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bot ID
                    </label>
                    <input
                      type="text"
                      value={cloneBotIdInput}
                      onChange={(e) => {
                        setCloneBotIdInput(e.target.value);
                        setCloneError(null);
                      }}
                      placeholder="Enter bot ID to clone..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      disabled={cloningBot}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !cloningBot) {
                          cloneBotToPabloReady();
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter the ID of a bot from the trading_bots table to clone it to Pablo Ready
                    </p>
                  </div>

                  {cloneError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        <i className="ri-error-warning-line mr-2"></i>
                        {cloneError}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={cloneBotToPabloReady}
                      disabled={cloningBot || !cloneBotIdInput.trim()}
                      className="flex-1"
                    >
                      {cloningBot ? (
                        <>
                          <i className="ri-loader-4-line animate-spin mr-2"></i>
                          Cloning...
                        </>
                      ) : (
                        <>
                          <i className="ri-file-copy-line mr-2"></i>
                          Clone Bot
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowCloneModal(false);
                        setCloneBotIdInput('');
                        setCloneError(null);
                      }}
                      variant="secondary"
                      disabled={cloningBot}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Latest Trades Tab */}
        {activeTab === 'latest-trades' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Latest Trades</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    View the 100 most recent trades {latestTradesUserFilter === 'all' ? 'from all users' : `from ${users.find(u => u.id === latestTradesUserFilter)?.email || 'selected user'}`} across the platform
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={latestTradesUserFilter}
                    onChange={(e) => {
                      console.log('📋 User filter changed:', e.target.value);
                      setLatestTradesUserFilter(e.target.value);
                      // Auto-refresh when user filter changes
                      setTimeout(() => fetchLatestTrades(), 100);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white min-w-[200px]"
                  >
                    <option value="all">All Users</option>
                    {users.length === 0 ? (
                      <option value="" disabled>Loading users...</option>
                    ) : (
                      users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.email || `User ${user.id.substring(0, 8)}...`}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    value={latestTradesFilter}
                    onChange={(e) => setLatestTradesFilter(e.target.value as 'all' | 'real' | 'paper')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="all">All Trades</option>
                    <option value="real">Real Trades Only</option>
                    <option value="paper">Paper Trades Only</option>
                  </select>
                  <Button
                    onClick={fetchLatestTrades}
                    variant="secondary"
                    size="sm"
                    disabled={latestTradesLoading}
                  >
                    <i className="ri-refresh-line mr-2"></i>
                    Refresh
                  </Button>
                </div>
              </div>

              {latestTradesLoading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
                  <p className="text-sm text-gray-500 mt-2">Loading trades...</p>
                </div>
              ) : latestTrades.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="ri-exchange-line text-4xl mb-2"></i>
                  <p>No trades found</p>
                  <p className="text-sm mt-1">Trades will appear here once users start trading</p>
                </div>
              ) : (() => {
                // Filter trades based on selected filter
                const filteredTrades = latestTrades.filter(trade => {
                  if (latestTradesFilter === 'all') return true;
                  if (latestTradesFilter === 'real') return trade.trade_type === 'REAL';
                  if (latestTradesFilter === 'paper') return trade.trade_type === 'PAPER';
                  return true;
                });

                if (filteredTrades.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <i className="ri-exchange-line text-4xl mb-2"></i>
                      <p>No {latestTradesFilter === 'real' ? 'real' : latestTradesFilter === 'paper' ? 'paper' : ''} trades found</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Type</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">User</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Bot</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Symbol</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Side</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Price</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">PnL</th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Fee</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredTrades.map((trade) => (
                        <tr key={`${trade.trade_type}-${trade.trade_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.trade_type === 'REAL'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {trade.trade_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {trade.user_email}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {trade.bot_name}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {trade.symbol}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.side === 'buy'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            }`}>
                              {trade.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            {typeof trade.amount === 'number' ? trade.amount.toFixed(4) : trade.amount}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            ${typeof trade.price === 'number' ? trade.price.toFixed(2) : trade.price}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${
                              trade.pnl >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              ${typeof trade.pnl === 'number' ? trade.pnl.toFixed(2) : '0.00'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            ${typeof trade.fee === 'number' ? trade.fee.toFixed(2) : '0.00'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.status === 'filled' || trade.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                : trade.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            }`}>
                              {trade.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                            {trade.minutes_ago !== null ? (
                              trade.minutes_ago < 60
                                ? `${trade.minutes_ago}m ago`
                                : trade.minutes_ago < 1440
                                  ? `${Math.floor(trade.minutes_ago / 60)}h ago`
                                  : `${Math.floor(trade.minutes_ago / 1440)}d ago`
                            ) : trade.executed_at ? (
                              new Date(trade.executed_at).toLocaleString()
                            ) : (
                              'N/A'
                            )}
                          </td>
                        </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

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

        {/* Crypto News Tab */}
        {activeTab === 'crypto-news' && (
          <CryptoNewsManager />
        )}

        {/* Promo Auto-Posting Tab */}
        {activeTab === 'promo-autopost' && (
          <PromoAutoPoster />
        )}

        {/* Email Center Tab */}
        {activeTab === 'email-center' && (
          <EmailCenter />
        )}

        {/* Contact Messages Tab */}
        {activeTab === 'contact-messages' && (
          <ContactMessages />
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <SubscriptionManagement />
        )}

        {/* Popup Manager Tab */}
        {activeTab === 'popups' && (
          <PopupManager />
        )}

        {/* Funnel Manager Tab */}
        {activeTab === 'funnels' && (
          <FunnelManager />
        )}

        {/* Webhook Test Tab */}
        {activeTab === 'webhook-test' && (
          <WebhookTestPage />
        )}

        {/* Manual Trading Tab */}
        {activeTab === 'manual-trading' && (
          <ManualTrading />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <AdminNotifications />
        )}

        {/* Tracking Scripts Tab */}
        {activeTab === 'tracking' && (
          <TrackingScripts />
        )}

        {/* Tracking URLs Tab */}
        {activeTab === 'tracking-urls' && (
          <TrackingUrlGenerator />
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Plan <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <select
                    value={newUser.planId || ''}
                    onChange={(e) => setNewUser({...newUser, planId: e.target.value || null})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No Subscription</option>
                    {availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.display_name} (${plan.price_monthly_usd}/mo - {plan.max_bots === null ? 'Unlimited' : plan.max_bots} bots)
                      </option>
                    ))}
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
                      setNewUser({ email: '', password: '', role: 'user', planId: '' });
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Account Limit (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newInvitation.userLimit || ''}
                    onChange={(e) => setNewInvitation({
                      ...newInvitation, 
                      userLimit: e.target.value ? parseInt(e.target.value) : null
                    })}
                    placeholder="Unlimited (leave empty)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum number of users that can be created with this invitation code. Leave empty for unlimited.
                  </p>
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

        {/* Test Period Settings Modal */}
        {showTestPeriodModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Test Period Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="testPeriodEnabled"
                    checked={testPeriodForm.enabled}
                    onChange={(e) => setTestPeriodForm({...testPeriodForm, enabled: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <label htmlFor="testPeriodEnabled" className="text-sm font-medium">
                    Enable Test Period
                  </label>
                </div>

                {testPeriodForm.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="datetime-local"
                        value={testPeriodForm.start_date}
                        onChange={(e) => setTestPeriodForm({...testPeriodForm, start_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={testPeriodForm.enabled}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="datetime-local"
                        value={testPeriodForm.end_date}
                        onChange={(e) => setTestPeriodForm({...testPeriodForm, end_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={testPeriodForm.enabled}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea
                        value={testPeriodForm.message}
                        onChange={(e) => setTestPeriodForm({...testPeriodForm, message: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Message to display during test period"
                      />
                    </div>
                  </>
                )}

                {testPeriodSettings && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <strong>Current Status:</strong> {testPeriodSettings.enabled ? 'Enabled' : 'Disabled'}
                      {testPeriodSettings.enabled && testPeriodSettings.start_date && (
                        <>
                          <br />
                          <strong>Period:</strong> {new Date(testPeriodSettings.start_date).toLocaleString()} - {new Date(testPeriodSettings.end_date).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowTestPeriodModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSaveTestPeriod}
                    className="flex-1"
                  >
                    Save Settings
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Bulk Delete Users Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-red-600">⚠️ Bulk Delete Users</h3>
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  <strong>Warning:</strong> This will permanently delete all users (except admins) created within the specified date range. This action cannot be undone!
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={bulkDeleteForm.start_date}
                    onChange={(e) => setBulkDeleteForm({...bulkDeleteForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={bulkDeleteForm.end_date}
                    onChange={(e) => setBulkDeleteForm({...bulkDeleteForm, end_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type "DELETE" to confirm
                  </label>
                  <input
                    type="text"
                    value={bulkDeleteForm.confirm}
                    onChange={(e) => setBulkDeleteForm({...bulkDeleteForm, confirm: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="DELETE"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowBulkDeleteModal(false);
                      setBulkDeleteForm({ start_date: '', end_date: '', confirm: '' });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleBulkDeleteUsers}
                    className="flex-1"
                    disabled={bulkDeleteForm.confirm !== 'DELETE'}
                  >
                    <i className="ri-delete-bin-7-line mr-2"></i>
                    Delete Users
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
