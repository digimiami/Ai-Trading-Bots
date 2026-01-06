import { useState } from 'react';
import { useApiKeys, type ApiKeyFormData } from '../../hooks/useApiKeys';
import Button from '../base/Button';

interface ApiKeyStepProps {
  onSkip: () => void;
  onComplete: () => void;
}

export default function ApiKeyStep({ onSkip, onComplete }: ApiKeyStepProps) {
  const { saveApiKey, testApiConnection } = useApiKeys();
  const [exchange, setExchange] = useState<'bybit' | 'okx' | 'bitunix'>('bybit');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!apiKey || !apiSecret) {
      setError('Please enter both API Key and Secret');
      return;
    }

    if (exchange === 'okx' && !passphrase) {
      setError('OKX requires a passphrase');
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const formData: ApiKeyFormData = {
        exchange,
        apiKey,
        apiSecret,
        ...(exchange === 'okx' && { passphrase })
      };

      const result = await testApiConnection(formData);
      setTestResult({
        success: true,
        message: 'Connection successful! API credentials are valid.'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed. Please check your credentials.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      setError('Please enter both API Key and Secret');
      return;
    }

    if (exchange === 'okx' && !passphrase) {
      setError('OKX requires a passphrase');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formData: ApiKeyFormData = {
        exchange,
        apiKey,
        apiSecret,
        ...(exchange === 'okx' && { passphrase })
      };

      await saveApiKey(formData);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = apiKey.trim() && apiSecret.trim() && (exchange !== 'okx' || passphrase.trim());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Connect Exchange API
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect your exchange account to enable automated trading. You can skip this step and set it up later in Settings.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exchange
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'bybit', label: 'Bybit' },
            { value: 'okx', label: 'OKX' },
            { value: 'bitunix', label: 'Bitunix' }
          ].map((ex) => (
            <button
              key={ex.value}
              onClick={() => {
                setExchange(ex.value as 'bybit' | 'okx' | 'bitunix');
                setError(null);
                setTestResult(null);
              }}
              className={`p-3 rounded-lg border-2 text-center transition-colors ${
                exchange === ex.value
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{ex.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Key
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setError(null);
          }}
          placeholder="Enter your API key"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          API Secret
        </label>
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => {
            setApiSecret(e.target.value);
            setError(null);
          }}
          placeholder="Enter your API secret"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {exchange === 'okx' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Passphrase (Required for OKX)
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value);
              setError(null);
            }}
            placeholder="Enter your passphrase"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

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

