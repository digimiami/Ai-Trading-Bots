

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useAuth } from '../../hooks/useAuth';
import { useApiKeys, ApiKeyFormData } from '../../hooks/useApiKeys';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { apiKeys, loading: apiKeysLoading, saveApiKey, testApiConnection: testConnection, toggleApiKey, deleteApiKey } = useApiKeys();

  const [notifications, setNotifications] = useState({
    push: true,
    email: false,
    trading: true,
    price: true
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    biometric: true,
    autoLogout: 30
  });

  const [trading, setTrading] = useState({
    defaultLeverage: 5,
    riskLevel: 'medium',
    autoRebalance: true,
    stopLoss: 5
  });

  const [appearance, setAppearance] = useState({
    theme: 'light',
    currency: 'USD',
    language: 'English'
  });

  const [apiSettings, setApiSettings] = useState({
    bybitApiKey: '',
    bybitApiSecret: '',
    bybitTestnet: true,
    okxApiKey: '',
    okxApiSecret: '',
    okxPassphrase: '',
    okxTestnet: true,
    webhookUrl: '',
    webhookSecret: '',
    alertsEnabled: true
  });

  const [alerts, setAlerts] = useState({
    priceThreshold: 5,
    pnlThreshold: 10,
    volumeThreshold: 50,
    rsiOverbought: 70,
    rsiOversold: 30,
    emailAlerts: true,
    pushAlerts: true,
    webhookAlerts: false,
    telegramBot: '',
    discordWebhook: '',
    // New risk management alerts
    lowBalanceAlert: true,
    lowBalanceThreshold: 100,
    liquidationAlert: true,
    liquidationThreshold: 80,
    newTradeAlert: true,
    closePositionAlert: true,
    profitAlert: true,
    profitThreshold: 5,
    lossAlert: true,
    lossThreshold: 5,
    dailyPnlAlert: true,
    weeklyPnlAlert: false,
    monthlyPnlAlert: true
  });

  const [riskManagement, setRiskManagement] = useState({
    maxDailyLoss: 500,
    maxPositionSize: 1000,
    stopLossPercentage: 5,
    takeProfitPercentage: 10,
    maxOpenPositions: 5,
    riskPerTrade: 2,
    autoStopTrading: true,
    emergencyStopLoss: 20
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showAlertsConfig, setShowAlertsConfig] = useState(false);
  const [showRiskConfig, setShowRiskConfig] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'Alex Johnson',
    email: 'alex.johnson@email.com',
    phone: '+1 (555) 123-4567',
    timezone: 'UTC-5 (EST)'
  });

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handleSecurityChange = (key: string, value: any) => {
    setSecurity(prev => ({ ...prev, [key]: value }));
  };

  const handleTradingChange = (key: string, value: any) => {
    setTrading(prev => ({ ...prev, [key]: value }));
  };

  const handleAppearanceChange = (key: string, value: any) => {
    setAppearance(prev => ({ ...prev, [key]: value }));
  };

  const handleApiChange = (key: string, value: any) => {
    setApiSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleAlertsChange = (key: string, value: any) => {
    setAlerts(prev => ({ ...prev, [key]: value }));
  };

  const handleProfileSave = () => {
    // Save profile changes
    setShowEditProfile(false);
  };

  const handleApiSave = async () => {
    try {
      // Save Bybit API key if provided
      if (apiSettings.bybitApiKey && apiSettings.bybitApiSecret) {
        await saveApiKey({
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
          isTestnet: apiSettings.bybitTestnet,
        });
      }

      // Save OKX API key if provided
      if (apiSettings.okxApiKey && apiSettings.okxApiSecret) {
        await saveApiKey({
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
          isTestnet: apiSettings.okxTestnet,
        });
      }

      setShowApiConfig(false);
      alert('API keys saved successfully!');
    } catch (error: any) {
      alert(`Failed to save API keys: ${error.message}`);
    }
  };

  const handleAlertsSave = () => {
    // Save alerts settings
    setShowAlertsConfig(false);
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleTestConnection = async (exchange: 'bybit' | 'okx') => {
    try {
      let formData: ApiKeyFormData;
      
      if (exchange === 'bybit') {
        formData = {
          exchange: 'bybit',
          apiKey: apiSettings.bybitApiKey,
          apiSecret: apiSettings.bybitApiSecret,
          isTestnet: apiSettings.bybitTestnet,
        };
      } else {
        formData = {
          exchange: 'okx',
          apiKey: apiSettings.okxApiKey,
          apiSecret: apiSettings.okxApiSecret,
          passphrase: apiSettings.okxPassphrase,
          isTestnet: apiSettings.okxTestnet,
        };
      }

      const result = await testConnection(formData);
      
      if (result.success) {
        alert(`${exchange.toUpperCase()} API connection successful!`);
      } else {
        alert(`${exchange.toUpperCase()} API connection failed: ${result.message}`);
      }
    } catch (error: any) {
      alert(`Failed to test ${exchange.toUpperCase()} API: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
      } else {
        navigate('/auth');
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleRiskChange = (key: string, value: any) => {
    setRiskManagement(prev => ({ ...prev, [key]: value }));
  };

  const handleRiskSave = () => {
    // Save risk management settings
    setShowRiskConfig(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Settings" />
      
      <div className="pt-20 pb-20 px-4 space-y-6">
        {/* Profile Section */}
        <Card className="p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-2xl text-blue-600"></i>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{profileData.name}</h3>
              <p className="text-gray-500">{profileData.email}</p>
              <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full mt-1">
                Pro Member
              </span>
            </div>
          </div>
          <button 
            onClick={() => setShowEditProfile(true)}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
          >
            <i className="ri-edit-line mr-2"></i>
            Edit Profile
          </button>
        </Card>

        {/* API Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Exchange Connections</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${apiKeys.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`text-sm ${apiKeys.length > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {apiKeys.length > 0 ? `${apiKeys.length} Connected` : 'Not Connected'}
              </span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-4">Configure your exchange API keys to view balances and enable trading</p>
          
          {apiKeysLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading connections...</p>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-exchange-line text-4xl mb-2"></i>
              <p>No exchange connections found</p>
              <p className="text-sm">Connect your exchange API keys to get started</p>
              <button
                onClick={() => setShowApiConfig(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Connect Exchange
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      apiKey.exchange === 'bybit' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                      <i className={`${apiKey.exchange === 'bybit' ? 'ri-currency-line text-orange-600' : 'ri-exchange-line text-blue-600'}`}></i>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{apiKey.exchange.toUpperCase()} API</p>
                      <p className="text-sm text-gray-500">
                        {apiKey.isActive ? 'Active' : 'Inactive'} • {apiKey.isTestnet ? 'Testnet' : 'Live'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleApiKey(apiKey.id, !apiKey.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        apiKey.isActive 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {apiKey.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => deleteApiKey(apiKey.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowApiConfig(true)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg transition-colors"
              >
                <i className="ri-add-line mr-2"></i>
                Add Exchange Connection
              </button>
            </div>
          )}
        </Card>

        {/* Risk Management */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Risk Management</h3>
            <button
              onClick={() => setShowRiskConfig(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">Protect your capital with automated risk controls</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-shield-line text-red-600"></i>
                <span className="text-sm font-medium text-gray-900">Max Daily Loss</span>
              </div>
              <p className="text-xs text-gray-500">${riskManagement.maxDailyLoss}</p>
            </div>
            
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-pie-chart-line text-orange-600"></i>
                <span className="text-sm font-medium text-gray-900">Position Size</span>
              </div>
              <p className="text-xs text-gray-500">Max ${riskManagement.maxPositionSize}</p>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-stop-line text-blue-600"></i>
                <span className="text-sm font-medium text-gray-900">Stop Loss</span>
              </div>
              <p className="text-xs text-gray-500">{riskManagement.stopLossPercentage}%</p>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-trophy-line text-green-600"></i>
                <span className="text-sm font-medium text-gray-900">Take Profit</span>
              </div>
              <p className="text-xs text-gray-500">{riskManagement.takeProfitPercentage}%</p>
            </div>
          </div>
        </Card>

        {/* Alerts Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alert Preferences</h3>
            <button
              onClick={() => setShowAlertsConfig(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">Choose which alerts you want to receive</p>
          
          <div className="space-y-3">
            {[
              { key: 'newTradeAlert', label: 'New Trade Alerts', desc: 'Get notified when bots open new positions', icon: 'ri-add-circle-line', color: 'blue' },
              { key: 'closePositionAlert', label: 'Position Closed', desc: 'Alerts when positions are closed', icon: 'ri-close-circle-line', color: 'green' },
              { key: 'profitAlert', label: 'Profit Alerts', desc: 'Notifications for profitable trades', icon: 'ri-arrow-up-line', color: 'green' },
              { key: 'lossAlert', label: 'Loss Alerts', desc: 'Notifications for losing trades', icon: 'ri-arrow-down-line', color: 'red' },
              { key: 'lowBalanceAlert', label: 'Low Balance Alert', desc: 'Warning when account balance is low', icon: 'ri-wallet-line', color: 'orange' },
              { key: 'liquidationAlert', label: 'Liquidation Risk', desc: 'Alert when positions are at risk', icon: 'ri-alarm-warning-line', color: 'red' }
            ].map(({ key, label, desc, icon, color }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-${color}-100 rounded-full flex items-center justify-center`}>
                    <i className={`${icon} text-${color}-600`}></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAlertsChange(key, !alerts[key as keyof typeof alerts])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    alerts[key as keyof typeof alerts] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      alerts[key as keyof typeof alerts] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-4">
            {[
              { key: 'push', label: 'Push Notifications', desc: 'Receive push notifications on your device' },
              { key: 'email', label: 'Email Alerts', desc: 'Get important updates via email' },
              { key: 'trading', label: 'Trading Alerts', desc: 'Notifications for bot actions and trades' },
              { key: 'price', label: 'Price Alerts', desc: 'Alerts for significant price movements' }
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                <button
                  onClick={() => handleNotificationChange(key, !notifications[key as keyof typeof notifications])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications[key as keyof typeof notifications] ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications[key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Security */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Add an extra layer of security</p>
              </div>
              <button
                onClick={() => handleSecurityChange('twoFactor', !security.twoFactor)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  security.twoFactor ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    security.twoFactor ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Biometric Login</p>
                <p className="text-sm text-gray-500">Use fingerprint or face ID</p>
              </div>
              <button
                onClick={() => handleSecurityChange('biometric', !security.biometric)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  security.biometric ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    security.biometric ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto Logout (minutes)
              </label>
              <select
                value={security.autoLogout}
                onChange={(e) => handleSecurityChange('autoLogout', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Trading Preferences */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Trading Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Leverage
              </label>
              <select
                value={trading.defaultLeverage}
                onChange={(e) => handleTradingChange('defaultLeverage', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={20}>20x</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Risk Level
              </label>
              <select
                value={trading.riskLevel}
                onChange={(e) => handleTradingChange('riskLevel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Auto Rebalance</p>
                <p className="text-sm text-gray-500">Automatically rebalance portfolio</p>
              </div>
              <button
                onClick={() => handleTradingChange('autoRebalance', !trading.autoRebalance)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  trading.autoRebalance ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    trading.autoRebalance ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Stop Loss (%)
              </label>
              <input
                type="number"
                value={trading.stopLoss}
                onChange={(e) => handleTradingChange('stopLoss', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                max="20"
                step="0.5"
              />
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <div className="flex space-x-2">
                {['light', 'dark'].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleAppearanceChange('theme', theme)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      appearance.theme === theme
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={appearance.currency}
                onChange={(e) => handleAppearanceChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={appearance.language}
                onChange={(e) => handleAppearanceChange('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
                <option value="French">Français</option>
                <option value="German">Deutsch</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Account */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>
          <div className="space-y-3">
            <Button variant="secondary" className="w-full justify-start">
              <i className="ri-download-line mr-2"></i>
              Export Data
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <i className="ri-refresh-line mr-2"></i>
              Reset Settings
            </Button>
            <button 
              onClick={handleSignOut}
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 px-4 py-2 text-sm w-full justify-start"
            >
              <i className="ri-logout-box-line mr-2"></i>
              Sign Out
            </button>
          </div>
        </Card>

        {/* App Info */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">App Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-900">1.2.3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Build</span>
              <span className="text-gray-900">2024.01.15</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Status</span>
              <span className="text-green-600 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Connected
              </span>
            </div>
            <Button variant="secondary" className="w-full justify-start mt-4">
              <i className="ri-question-line mr-2"></i>
              Help &amp; Support
            </Button>
          </div>
        </Card>
      </div>

      {/* API Configuration Modal */}
      {showApiConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">API Configuration</h2>
                <button
                  onClick={() => setShowApiConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Bybit API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-currency-line text-orange-600 mr-2"></i>
                    Bybit API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bybitApiKey}
                        onChange={(e) => handleApiChange('bybitApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bybit API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.bybitApiSecret}
                        onChange={(e) => handleApiChange('bybitApiSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Bybit API Secret"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Use Testnet</span>
                      <button
                        onClick={() => handleApiChange('bybitTestnet', !apiSettings.bybitTestnet)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          apiSettings.bybitTestnet ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            apiSettings.bybitTestnet ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <button
                      onClick={() => handleTestConnection('bybit')}
                      className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Test Connection
                    </button>
                  </div>
                </div>

                {/* OKX API */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-exchange-line text-blue-600 mr-2"></i>
                    OKX API
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxApiKey}
                        onChange={(e) => handleApiChange('okxApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxApiSecret}
                        onChange={(e) => handleApiChange('okxApiSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX API Secret"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passphrase
                      </label>
                      <input
                        type="password"
                        value={apiSettings.okxPassphrase}
                        onChange={(e) => handleApiChange('okxPassphrase', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter OKX Passphrase"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Use Testnet</span>
                      <button
                        onClick={() => handleApiChange('okxTestnet', !apiSettings.okxTestnet)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          apiSettings.okxTestnet ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            apiSettings.okxTestnet ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <button
                      onClick={() => handleTestConnection('okx')}
                      className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Test Connection
                    </button>
                  </div>
                </div>

                {/* Webhook Settings */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <i className="ri-webhook-line text-purple-600 mr-2"></i>
                    Webhook Settings
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        value={apiSettings.webhookUrl}
                        onChange={(e) => handleApiChange('webhookUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="https://your-webhook-url.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Webhook Secret
                      </label>
                      <input
                        type="password"
                        value={apiSettings.webhookSecret}
                        onChange={(e) => handleApiChange('webhookSecret', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter webhook secret"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowApiConfig(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApiSave}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Management Configuration Modal */}
      {showRiskConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Risk Management</h2>
                <button
                  onClick={() => setShowRiskConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Daily Limits */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Daily Limits</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Daily Loss ($)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxDailyLoss}
                        onChange={(e) => handleRiskChange('maxDailyLoss', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="50"
                        max="10000"
                        step="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Position Size ($)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxPositionSize}
                        onChange={(e) => handleRiskChange('maxPositionSize', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="100"
                        max="50000"
                        step="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Open Positions
                      </label>
                      <input
                        type="number"
                        value={riskManagement.maxOpenPositions}
                        onChange={(e) => handleRiskChange('maxOpenPositions', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="20"
                        step="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk Percentages */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Percentages</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stop Loss Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.stopLossPercentage}
                        onChange={(e) => handleRiskChange('stopLossPercentage', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="20"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Take Profit Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.takeProfitPercentage}
                        onChange={(e) => handleRiskChange('takeProfitPercentage', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="50"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Risk Per Trade (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.riskPerTrade}
                        onChange={(e) => handleRiskChange('riskPerTrade', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="0.5"
                        max="10"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Emergency Stop Loss (%)
                      </label>
                      <input
                        type="number"
                        value={riskManagement.emergencyStopLoss}
                        onChange={(e) => handleRiskChange('emergencyStopLoss', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="10"
                        max="50"
                        step="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Controls */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Automatic Controls</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Auto Stop Trading</span>
                        <p className="text-xs text-gray-500">Stop all bots when daily loss limit is reached</p>
                      </div>
                      <button
                        onClick={() => handleRiskChange('autoStopTrading', !riskManagement.autoStopTrading)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          riskManagement.autoStopTrading ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            riskManagement.autoStopTrading ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowRiskConfig(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleRiskSave}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Configuration Modal */}
      {showAlertsConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Alert Configuration</h2>
                <button
                  onClick={() => setShowAlertsConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Trading Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Trading Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">New Trade Alerts</span>
                        <p className="text-xs text-gray-500">Notify when bots open new positions</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('newTradeAlert', !alerts.newTradeAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.newTradeAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.newTradeAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Close Position Alerts</span>
                        <p className="text-xs text-gray-500">Notify when positions are closed</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('closePositionAlert', !alerts.closePositionAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.closePositionAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.closePositionAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* P&L Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">P&L Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Profit Alerts</span>
                        <p className="text-xs text-gray-500">Notify for profitable trades</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('profitAlert', !alerts.profitAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.profitAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.profitAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.profitAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Profit Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.profitThreshold}
                          onChange={(e) => handleAlertsChange('profitThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="1"
                          max="50"
                          step="0.5"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Loss Alerts</span>
                        <p className="text-xs text-gray-500">Notify for losing trades</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('lossAlert', !alerts.lossAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.lossAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.lossAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.lossAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loss Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.lossThreshold}
                          onChange={(e) => handleAlertsChange('lossThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="1"
                          max="20"
                          step="0.5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Risk Alerts</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Low Balance Alert</span>
                        <p className="text-xs text-gray-500">Warning when balance is low</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('lowBalanceAlert', !alerts.lowBalanceAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.lowBalanceAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.lowBalanceAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.lowBalanceAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Low Balance Threshold ($)
                        </label>
                        <input
                          type="number"
                          value={alerts.lowBalanceThreshold}
                          onChange={(e) => handleAlertsChange('lowBalanceThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="10"
                          max="1000"
                          step="10"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Liquidation Risk Alert</span>
                        <p className="text-xs text-gray-500">Alert when positions are at risk</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('liquidationAlert', !alerts.liquidationAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.liquidationAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.liquidationAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {alerts.liquidationAlert && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Liquidation Threshold (%)
                        </label>
                        <input
                          type="number"
                          value={alerts.liquidationThreshold}
                          onChange={(e) => handleAlertsChange('liquidationThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          min="50"
                          max="95"
                          step="5"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Reporting Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">P&L Reports</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Daily P&L Report</span>
                        <p className="text-xs text-gray-500">Daily profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('dailyPnlAlert', !alerts.dailyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.dailyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.dailyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Weekly P&L Report</span>
                        <p className="text-xs text-gray-500">Weekly profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('weeklyPnlAlert', !alerts.weeklyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.weeklyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.weeklyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Monthly P&L Report</span>
                        <p className="text-xs text-gray-500">Monthly profit/loss summary</p>
                      </div>
                      <button
                        onClick={() => handleAlertsChange('monthlyPnlAlert', !alerts.monthlyPnlAlert)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.monthlyPnlAlert ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.monthlyPnlAlert ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notification Channels */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Notification Channels</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Email Alerts</span>
                      <button
                        onClick={() => handleAlertsChange('emailAlerts', !alerts.emailAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.emailAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Push Notifications</span>
                      <button
                        onClick={() => handleAlertsChange('pushAlerts', !alerts.pushAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.pushAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.pushAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAlertsConfig(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAlertsSave}
                  className="flex-1"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Edit Profile</h2>
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleProfileChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={profileData.timezone}
                    onChange={(e) => handleProfileChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="UTC-8 (PST)">UTC-8 (PST)</option>
                    <option value="UTC-5 (EST)">UTC-5 (EST)</option>
                    <option value="UTC+0 (GMT)">UTC+0 (GMT)</option>
                    <option value="UTC+1 (CET)">UTC+1 (CET)</option>
                    <option value="UTC+8 (CST)">UTC+8 (CST)</option>
                    <option value="UTC+9 (JST)">UTC+9 (JST)</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowEditProfile(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleProfileSave}
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  );
}

