
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Navigation from '../../components/feature/Navigation';
import Button from '../../components/base/Button';
import Card from '../../components/base/Card';
import { useAuth } from '../../hooks/useAuth';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
    discordWebhook: ''
  });

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showAlertsConfig, setShowAlertsConfig] = useState(false);
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

  const handleApiSave = () => {
    // Save API settings
    setShowApiConfig(false);
  };

  const handleAlertsSave = () => {
    // Save alerts settings
    setShowAlertsConfig(false);
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const testApiConnection = (exchange: 'bybit' | 'okx') => {
    // Test API connection
    alert(`Testing ${exchange.toUpperCase()} API connection...`);
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
            <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600">Connected</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-4">Configure your exchange API keys for automated trading</p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <i className="ri-currency-line text-orange-600"></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Bybit API</p>
                  <p className="text-sm text-gray-500">
                    {apiSettings.bybitApiKey ? 'Configured' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {apiSettings.bybitTestnet && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Testnet
                  </span>
                )}
                <button
                  onClick={() => setShowApiConfig(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Configure
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="ri-exchange-line text-blue-600"></i>
                </div>
                <div>
                  <p className="font-medium text-gray-900">OKX API</p>
                  <p className="text-sm text-gray-500">
                    {apiSettings.okxApiKey ? 'Configured' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {apiSettings.okxTestnet && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Testnet
                  </span>
                )}
                <button
                  onClick={() => setShowApiConfig(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Configure
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Alerts Configuration */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alert Settings</h3>
            <button
              onClick={() => setShowAlertsConfig(true)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure
            </button>
          </div>
          <p className="text-gray-500 text-sm mb-4">Set up price alerts and trading notifications</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-line-chart-line text-blue-600"></i>
                <span className="text-sm font-medium text-gray-900">Price Alerts</span>
              </div>
              <p className="text-xs text-gray-500">±{alerts.priceThreshold}% threshold</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-funds-line text-green-600"></i>
                <span className="text-sm font-medium text-gray-900">P&amp;L Alerts</span>
              </div>
              <p className="text-xs text-gray-500">±{alerts.pnlThreshold}% threshold</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-bar-chart-line text-purple-600"></i>
                <span className="text-sm font-medium text-gray-900">RSI Alerts</span>
              </div>
              <p className="text-xs text-gray-500">&lt;{alerts.rsiOversold} | &gt;{alerts.rsiOverbought}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-volume-up-line text-orange-600"></i>
                <span className="text-sm font-medium text-gray-900">Volume Alerts</span>
              </div>
              <p className="text-xs text-gray-500">&gt;{alerts.volumeThreshold}% spike</p>
            </div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      onClick={() => testApiConnection('bybit')}
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
                      onClick={() => testApiConnection('okx')}
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

      {/* Alerts Configuration Modal */}
      {showAlertsConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Alert Settings</h2>
                <button
                  onClick={() => setShowAlertsConfig(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="ri-close-line text-xl text-gray-500"></i>
                </button>
              </div>

              <div className="space-y-6">
                {/* Price Alerts */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Price Alerts</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price Change Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={alerts.priceThreshold}
                        onChange={(e) => handleAlertsChange('priceThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="50"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        P&amp;L Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={alerts.pnlThreshold}
                        onChange={(e) => handleAlertsChange('pnlThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="1"
                        max="100"
                        step="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Volume Spike Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={alerts.volumeThreshold}
                        onChange={(e) => handleAlertsChange('volumeThreshold', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="10"
                        max="500"
                        step="10"
                      />
                    </div>
                  </div>
                </div>

                {/* Technical Indicators */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Technical Indicators</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        RSI Overbought Level
                      </label>
                      <input
                        type="number"
                        value={alerts.rsiOverbought}
                        onChange={(e) => handleAlertsChange('rsiOverbought', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        min="50"
                        max="90"
                        step="5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        RSI Oversold Level
                      </label>
                      <input
                        type="number"
                        value={alerts.rsiOversold}
                        onChange={(e) => handleAlertsChange('rsiOversold', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-5 0 focus:border-transparent text-sm"
                        min="10"
                        max="50"
                        step="5"
                      />
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Webhook Alerts</span>
                      <button
                        onClick={() => handleAlertsChange('webhookAlerts', !alerts.webhookAlerts)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          alerts.webhookAlerts ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alerts.webhookAlerts ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* External Integrations */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">External Integrations</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telegram Bot Token
                      </label>
                      <input
                        type="text"
                        value={alerts.telegramBot}
                        onChange={(e) => handleAlertsChange('telegramBot', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Enter Telegram bot token"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discord Webhook URL
                      </label>
                      <input
                        type="url"
                        value={alerts.discordWebhook}
                        onChange={(e) => handleAlertsChange('discordWebhook', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="https://discord.com/api/webhooks/..."
                      />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus-ring-2 focus:ring-blue-500 focus:border-transparent"
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
