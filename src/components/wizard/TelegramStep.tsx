import { useState } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import Button from '../base/Button';

interface TelegramStepProps {
  onSkip: () => void;
  onComplete: () => void;
}

export default function TelegramStep({ onSkip, onComplete }: TelegramStepProps) {
  const { saveConfig, sendTestMessage } = useTelegram();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!botToken || !chatId) {
      setError('Please enter both Bot Token and Chat ID');
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      // Save config first to test
      const saveResult = await saveConfig({
        bot_token: botToken,
        chat_id: chatId,
        enabled: true,
        notifications: {
          trade_executed: true,
          bot_started: true,
          bot_stopped: true,
          error_occurred: true,
          daily_summary: true,
          profit_alert: true,
          loss_alert: true
        }
      });

      if (!saveResult.success) {
        throw new Error(saveResult.message || 'Failed to save configuration');
      }

      // Then test the message
      const testResult = await sendTestMessage();
      if (testResult.success) {
        setTestResult({
          success: true,
          message: 'Test message sent! Check your Telegram.'
        });
      } else {
        throw new Error(testResult.message || 'Failed to send test message');
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send test message. Please check your credentials.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!botToken || !chatId) {
      setError('Please enter both Bot Token and Chat ID');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveConfig({
        bot_token: botToken,
        chat_id: chatId,
        enabled: true,
        notifications: {
          trade_executed: true,
          bot_started: true,
          bot_stopped: true,
          error_occurred: true,
          daily_summary: true,
          profit_alert: true,
          loss_alert: true
        }
      });

      if (result.success) {
        onComplete();
      } else {
        throw new Error(result.message || 'Failed to save configuration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Telegram configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = botToken.trim() && chatId.trim();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Setup Telegram Notifications
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Get real-time alerts for trades, bot status, and errors directly on Telegram. This step is optional.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How to get your Bot Token:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Open Telegram and search for <strong>@BotFather</strong></li>
            <li>Send command: <strong>/newbot</strong></li>
            <li>Follow the prompts to create your bot</li>
            <li>Copy the Bot Token you receive</li>
          </ol>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How to get your Chat ID:</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Search for <strong>@userinfobot</strong> on Telegram</li>
            <li>Send <strong>/start</strong></li>
            <li>Copy your ID number</li>
          </ol>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bot Token
        </label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => {
            setBotToken(e.target.value);
            setError(null);
          }}
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
          value={chatId}
          onChange={(e) => {
            setChatId(e.target.value);
            setError(null);
          }}
          placeholder="123456789"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">Your Telegram user ID (get from @userinfobot)</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {testResult && (
        <div className={`p-3 rounded-lg border ${
          testResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm ${
            testResult.success ? 'text-green-600' : 'text-red-600'
          }`}>
            {testResult.message}
          </p>
        </div>
      )}

      <div className="flex space-x-3">
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={!canProceed || isTesting || isSaving}
          className="flex-1"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canProceed || isSaving || isTesting}
          className="flex-1"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

