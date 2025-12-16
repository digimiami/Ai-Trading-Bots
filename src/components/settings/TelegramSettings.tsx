import { useState, useEffect } from 'react';
import Card from '../base/Card';
import { useTelegram } from '../../hooks/useTelegram';

export default function TelegramSettings() {
  const { config: telegramConfig, loading, saveConfig, sendTestMessage } = useTelegram();
  const [showConfig, setShowConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [settings, setSettings] = useState({
    bot_token: '',
    chat_id: '',
    enabled: true,
    notifications: {
      trade_executed: true,
      bot_started: true,
      bot_stopped: true,
      error_occurred: true,
      daily_summary: true,
      profit_alert: true,
      loss_alert: true,
      paper_trade_notifications: true
    }
  });

  useEffect(() => {
    if (telegramConfig) {
      setSettings({
        bot_token: telegramConfig.bot_token || '',
        chat_id: telegramConfig.chat_id || '',
        enabled: telegramConfig.enabled,
        notifications: telegramConfig.notifications || settings.notifications
      });
    }
  }, [telegramConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveConfig(settings);
    setIsSaving(false);
    
    if (result.success) {
      alert('✅ Telegram configuration saved successfully!');
      setShowConfig(false);
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    const result = await sendTestMessage();
    setIsTesting(false);
    
    if (result.success) {
      alert('✅ Test message sent! Check your Telegram.');
    } else {
      alert(`❌ Error: ${result.message}`);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <i className="ri-telegram-line text-xl mr-2 text-blue-500"></i>
          Telegram Notifications
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${settings.enabled && telegramConfig ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          <span className={`text-sm ${settings.enabled && telegramConfig ? 'text-green-600' : 'text-gray-600'}`}>
            {settings.enabled && telegramConfig ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <p className="text-gray-500 text-sm mb-4">
        Get real-time alerts for trades, bot status, and errors directly on Telegram
      </p>

      {!showConfig ? (
        <button
          onClick={() => setShowConfig(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium"
        >
          <i className="ri-settings-line mr-2"></i>
          {telegramConfig ? 'Edit Configuration' : 'Setup Telegram Notifications'}
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bot Token
            </label>
            <input
              type="password"
              value={settings.bot_token}
              onChange={(e) => setSettings(prev => ({ ...prev, bot_token: e.target.value }))}
              placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Get from @BotFather on Telegram</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chat ID
            </label>
            <input
              type="text"
              value={settings.chat_id}
              onChange={(e) => setSettings(prev => ({ ...prev, chat_id: e.target.value }))}
              placeholder="123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Your Telegram user ID (get from @userinfobot)</p>
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Notification Types
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.trade_executed}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, trade_executed: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">💰 Trade Executed</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.bot_started}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, bot_started: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">🚀 Bot Started</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.bot_stopped}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, bot_stopped: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">🛑 Bot Stopped</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.error_occurred}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, error_occurred: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">❌ Errors</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.profit_alert}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, profit_alert: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">🎉 Profit Alert</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.loss_alert}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, loss_alert: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">⚠️ Loss Alert</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.daily_summary}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, daily_summary: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">📊 Daily Summary</span>
              </label>

              <label className="flex items-center p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={settings.notifications.paper_trade_notifications ?? true}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, paper_trade_notifications: e.target.checked }
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">📄 Paper Trade Notifications</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !settings.bot_token || !settings.chat_id}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSaving ? 'Saving...' : '💾 Save Configuration'}
            </button>
            
            <button
              onClick={handleTest}
              disabled={isTesting || !telegramConfig}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isTesting ? 'Testing...' : '📨 Test'}
            </button>

            <button
              onClick={() => setShowConfig(false)}
              className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-blue-900 text-sm mb-2 flex items-center">
              <i className="ri-information-line mr-2"></i>
              How to Setup Telegram Bot
            </h4>
            <ol className="text-xs text-blue-800 space-y-1.5 ml-1 list-decimal list-inside">
              <li>Open Telegram and search for <strong className="font-bold">@BotFather</strong></li>
              <li>Send command <code className="bg-blue-100 px-1 py-0.5 rounded">/newbot</code> and follow instructions</li>
              <li>Copy the <strong className="font-bold">Bot Token</strong> you receive</li>
              <li>Search for <strong className="font-bold">@userinfobot</strong> to get your Chat ID</li>
              <li>Paste both values above and click <strong className="font-bold">Save</strong></li>
              <li>Click <strong className="font-bold">Test</strong> to verify notifications work!</li>
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}

