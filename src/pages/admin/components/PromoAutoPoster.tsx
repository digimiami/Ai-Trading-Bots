import { useEffect, useState } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import { useAdmin } from '../../../hooks/useAdmin';

interface PromoSettings {
  enabled: boolean;
  min_win_rate: number;
  min_pnl: number;
  lookback_days: number;
  include_bot_settings: boolean;
  include_all_users: boolean;
}

interface PromoTarget {
  id: string;
  label: string;
  platform: string;
  bot_token: string;
  chat_id: string;
  enabled: boolean;
}

const defaultSettings: PromoSettings = {
  enabled: false,
  min_win_rate: 60,
  min_pnl: 100,
  lookback_days: 7,
  include_bot_settings: true,
  include_all_users: true
};

export default function PromoAutoPoster() {
  const {
    loading,
    error,
    getPromoAutopostSettings,
    savePromoAutopostSettings,
    listPromoAutopostTargets,
    upsertPromoAutopostTarget,
    deletePromoAutopostTarget,
    previewPromoAutopostBots,
    runPromoAutopostNow
  } = useAdmin();

  const [settings, setSettings] = useState<PromoSettings>(defaultSettings);
  const [targets, setTargets] = useState<PromoTarget[]>([]);
  const [saving, setSaving] = useState(false);
  const [targetForm, setTargetForm] = useState({
    id: '',
    label: '',
    bot_token: '',
    chat_id: '',
    enabled: true
  });
  const [previewBots, setPreviewBots] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [settingsData, targetsData] = await Promise.all([
        getPromoAutopostSettings(),
        listPromoAutopostTargets()
      ]);
      if (settingsData) {
        setSettings({
          enabled: settingsData.enabled ?? false,
          min_win_rate: Number(settingsData.min_win_rate ?? 60),
          min_pnl: Number(settingsData.min_pnl ?? 100),
          lookback_days: Number(settingsData.lookback_days ?? 7),
          include_bot_settings: settingsData.include_bot_settings ?? true,
          include_all_users: settingsData.include_all_users ?? true
        });
      }
      setTargets(targetsData || []);
    } catch (loadError) {
      console.error('Failed to load promo auto-post settings:', loadError);
    }
  };

  const handleSettingChange = (key: keyof PromoSettings, value: boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await savePromoAutopostSettings(settings);
      setSettings({
        enabled: updated.enabled ?? false,
        min_win_rate: Number(updated.min_win_rate ?? 60),
        min_pnl: Number(updated.min_pnl ?? 100),
        lookback_days: Number(updated.lookback_days ?? 7),
        include_bot_settings: updated.include_bot_settings ?? true,
        include_all_users: updated.include_all_users ?? true
      });
      setMessage('Settings saved successfully.');
    } catch (saveError) {
      console.error('Failed to save promo auto-post settings:', saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleTargetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const target = await upsertPromoAutopostTarget({
        id: targetForm.id || undefined,
        label: targetForm.label,
        bot_token: targetForm.bot_token,
        chat_id: targetForm.chat_id,
        enabled: targetForm.enabled
      });
      setTargets(prev => {
        const existing = prev.find(item => item.id === target.id);
        if (existing) {
          return prev.map(item => (item.id === target.id ? target : item));
        }
        return [...prev, target];
      });
      setTargetForm({ id: '', label: '', bot_token: '', chat_id: '', enabled: true });
      setMessage('Target saved.');
    } catch (targetError) {
      console.error('Failed to save target:', targetError);
    }
  };

  const handleEditTarget = (target: PromoTarget) => {
    setTargetForm({
      id: target.id,
      label: target.label,
      bot_token: target.bot_token,
      chat_id: target.chat_id,
      enabled: target.enabled
    });
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Delete this target?')) return;
    setMessage(null);
    try {
      await deletePromoAutopostTarget(id);
      setTargets(prev => prev.filter(target => target.id !== id));
      setMessage('Target deleted.');
    } catch (deleteError) {
      console.error('Failed to delete target:', deleteError);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setMessage(null);
    try {
      const bots = await previewPromoAutopostBots(settings);
      setPreviewBots(bots || []);
    } catch (previewError) {
      console.error('Failed to preview eligible bots:', previewError);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRunNow = async () => {
    if (!confirm('Run promo auto-posting now?')) return;
    setRunNowLoading(true);
    setMessage(null);
    try {
      const result = await runPromoAutopostNow();
      setMessage(`Auto-post run complete. Eligible bots: ${result.eligibleBots || 0}.`);
    } catch (runError) {
      console.error('Failed to run promo auto-post now:', runError);
    } finally {
      setRunNowLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Promo Auto-Posting</h3>
            <p className="text-sm text-gray-500">Auto-post Bot + Performance cards to Telegram hourly.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleSettingChange('enabled', e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="promo-min-win-rate" className="block text-sm text-gray-600 mb-1">Min Win Rate (%)</label>
            <input
              id="promo-min-win-rate"
              type="number"
              value={settings.min_win_rate}
              min={0}
              max={100}
              step={0.1}
              onChange={(e) => handleSettingChange('min_win_rate', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="promo-min-pnl" className="block text-sm text-gray-600 mb-1">Min 7d PnL ($)</label>
            <input
              id="promo-min-pnl"
              type="number"
              value={settings.min_pnl}
              step={1}
              onChange={(e) => handleSettingChange('min_pnl', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="promo-lookback-days" className="block text-sm text-gray-600 mb-1">Lookback Days</label>
            <input
              id="promo-lookback-days"
              type="number"
              value={settings.lookback_days}
              min={1}
              max={30}
              onChange={(e) => handleSettingChange('lookback_days', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.include_bot_settings}
              onChange={(e) => handleSettingChange('include_bot_settings', e.target.checked)}
            />
            Include bot settings in caption
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.include_all_users}
              onChange={(e) => handleSettingChange('include_all_users', e.target.checked)}
            />
            Include all users
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSaveSettings} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button variant="secondary" onClick={handlePreview} disabled={previewLoading || loading}>
            {previewLoading ? 'Previewing...' : 'Preview Eligible Bots'}
          </Button>
          <Button variant="secondary" onClick={handleRunNow} disabled={runNowLoading || loading}>
            {runNowLoading ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Telegram Targets</h3>
        <form onSubmit={handleTargetSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder="Label"
            value={targetForm.label}
            onChange={(e) => setTargetForm(prev => ({ ...prev, label: e.target.value }))}
            aria-label="Target label"
            className="border border-gray-300 rounded-lg px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Bot Token"
            value={targetForm.bot_token}
            onChange={(e) => setTargetForm(prev => ({ ...prev, bot_token: e.target.value }))}
            aria-label="Telegram bot token"
            className="border border-gray-300 rounded-lg px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="Chat ID"
            value={targetForm.chat_id}
            onChange={(e) => setTargetForm(prev => ({ ...prev, chat_id: e.target.value }))}
            aria-label="Telegram chat ID"
            className="border border-gray-300 rounded-lg px-3 py-2"
            required
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={targetForm.enabled}
                onChange={(e) => setTargetForm(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enabled
            </label>
            <Button variant="primary" type="submit" className="ml-auto">
              {targetForm.id ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>

        {targets.length === 0 ? (
          <p className="text-sm text-gray-500">No Telegram targets configured yet.</p>
        ) : (
          <div className="space-y-3">
            {targets.map((target) => (
              <div key={target.id} className="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-200 rounded-lg p-3">
                <div>
                  <div className="font-medium">{target.label}</div>
                  <div className="text-xs text-gray-500">Chat ID: {target.chat_id}</div>
                  <div className="text-xs text-gray-500">Status: {target.enabled ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <Button variant="secondary" onClick={() => handleEditTarget(target)}>Edit</Button>
                  <Button variant="secondary" onClick={() => handleDeleteTarget(target.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Eligible Bots Preview</h3>
        {previewBots.length === 0 ? (
          <p className="text-sm text-gray-500">No eligible bots yet. Run preview to refresh.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {previewBots.map((bot) => (
              <div key={bot.id} className="flex flex-col md:flex-row md:items-center md:justify-between border border-gray-100 rounded-lg p-2">
                <div>
                  <div className="font-medium">{bot.name} ({bot.symbol})</div>
                  <div className="text-xs text-gray-500">{bot.exchange}</div>
                </div>
                <div className="text-xs text-gray-600">
                  Win rate: {Number(bot.winRate).toFixed(1)}% • PnL: ${Number(bot.totalPnL).toFixed(2)} • Trades: {bot.totalTrades}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
