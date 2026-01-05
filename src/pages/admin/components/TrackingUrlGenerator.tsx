import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface TrackingUrl {
  id: string;
  name: string;
  destination_url: string;
  campaign_name?: string;
  source?: string;
  medium?: string;
  content?: string;
  term?: string;
  custom_params?: Record<string, any>;
  short_code: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  clicks_count?: number;
  unique_clicks_count?: number;
}

interface TrackingUrlClick {
  id: string;
  tracking_url_id: string;
  ip_address?: string;
  country?: string;
  region?: string;
  city?: string;
  device_type?: string;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
  language?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  converted?: boolean;
  conversion_type?: string;
  converted_at?: string;
  time_to_conversion_seconds?: number;
  pages_viewed?: number;
  session_duration_seconds?: number;
  bounce?: boolean;
  is_mobile_traffic?: boolean;
  landing_page_url?: string;
  clicked_at: string;
}

export default function TrackingUrlGenerator() {
  const [urls, setUrls] = useState<TrackingUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUrl, setEditingUrl] = useState<Partial<TrackingUrl> | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [clickAnalytics, setClickAnalytics] = useState<TrackingUrlClick[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [customParamKey, setCustomParamKey] = useState('');
  const [customParamValue, setCustomParamValue] = useState('');

  const baseUrl = window.location.origin;

  const fetchUrls = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tracking_urls')
        .select(`
          *,
          clicks:tracking_url_clicks(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to include click counts
      const urlsWithStats = (data || []).map((url: any) => ({
        ...url,
        clicks_count: url.clicks?.length || 0,
        unique_clicks_count: new Set(url.clicks?.map((c: any) => c.session_id) || []).size
      }));

      setUrls(urlsWithStats);
    } catch (err: any) {
      console.error('Error fetching tracking URLs:', err);
      alert(`Failed to fetch tracking URLs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  useEffect(() => {
    if (selectedUrl) {
      fetchClickAnalytics(selectedUrl);
    }
  }, [selectedUrl]);

  const fetchClickAnalytics = async (urlId: string) => {
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracking_url_clicks')
        .select('*')
        .eq('tracking_url_id', urlId)
        .order('clicked_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setClickAnalytics(data || []);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      alert(`Failed to fetch analytics: ${err.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUrl?.name || !editingUrl?.destination_url) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const urlData: any = {
        name: editingUrl.name,
        destination_url: editingUrl.destination_url,
        campaign_name: editingUrl.campaign_name || null,
        source: editingUrl.source || null,
        medium: editingUrl.medium || null,
        content: editingUrl.content || null,
        term: editingUrl.term || null,
        custom_params: editingUrl.custom_params || {},
        is_active: editingUrl.is_active ?? true,
        expires_at: editingUrl.expires_at || null,
        created_by: user.id
      };

      if (editingUrl.id) {
        // Update existing
        const { error } = await supabase
          .from('tracking_urls')
          .update(urlData)
          .eq('id', editingUrl.id);

        if (error) throw error;
        alert('✅ Tracking URL updated successfully!');
      } else {
        // Create new - generate short code
        const { data: shortCodeData, error: codeError } = await supabase.rpc('generate_tracking_code');
        if (codeError) throw codeError;

        urlData.short_code = shortCodeData;

        const { data: newUrl, error } = await supabase
          .from('tracking_urls')
          .insert(urlData)
          .select()
          .single();

        if (error) throw error;
        alert(`✅ Tracking URL created successfully!\n\nShort URL: ${baseUrl}/t/${newUrl.short_code}`);
      }

      setShowModal(false);
      setEditingUrl(null);
      fetchUrls();
    } catch (err: any) {
      console.error('Error saving tracking URL:', err);
      alert(`Failed to save tracking URL: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tracking URL? This will also delete all associated click data.')) return;

    try {
      const { error } = await supabase
        .from('tracking_urls')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Tracking URL deleted successfully!');
      fetchUrls();
    } catch (err: any) {
      console.error('Error deleting tracking URL:', err);
      alert('Failed to delete tracking URL');
    }
  };

  const openModal = (url: TrackingUrl | null = null) => {
    setEditingUrl(url || {
      name: '',
      destination_url: '',
      campaign_name: '',
      source: '',
      medium: '',
      content: '',
      term: '',
      custom_params: {},
      is_active: true
    });
    setShowModal(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const getTrackingUrl = (url: TrackingUrl) => {
    return `${baseUrl}/t/${url.short_code}`;
  };

  const getFullTrackingUrl = (url: TrackingUrl) => {
    const trackingUrl = getTrackingUrl(url);
    const params = new URLSearchParams();
    if (url.source) params.append('utm_source', url.source);
    if (url.medium) params.append('utm_medium', url.medium);
    if (url.campaign_name) params.append('utm_campaign', url.campaign_name);
    if (url.content) params.append('utm_content', url.content);
    if (url.term) params.append('utm_term', url.term);
    if (url.custom_params) {
      Object.entries(url.custom_params).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }
    return params.toString() ? `${trackingUrl}?${params.toString()}` : trackingUrl;
  };

  // Analytics summary
  const getAnalyticsSummary = (url: TrackingUrl) => {
    const analytics = clickAnalytics.filter(c => c.tracking_url_id === url.id);
    const countries = new Set(analytics.map(a => a.country).filter(Boolean));
    const devices = analytics.reduce((acc: Record<string, number>, a) => {
      if (a.device_type) acc[a.device_type] = (acc[a.device_type] || 0) + 1;
      return acc;
    }, {});

    return { countries: countries.size, devices };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tracking URL Generator</h2>
          <p className="text-gray-600">Generate tracking URLs for ads and campaigns with click/view analytics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchUrls} className="flex items-center gap-2" disabled={loading}>
            <i className="ri-refresh-line"></i> Refresh
          </Button>
          <Button variant="primary" onClick={() => openModal()} className="flex items-center gap-2">
            <i className="ri-add-line"></i> Create Tracking URL
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
          </div>
        ) : urls.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-link text-4xl mb-4 block"></i>
            No tracking URLs found. Create your first one to start tracking!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Tracking URL</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3 text-center">Clicks</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {urls.map((url) => {
                  const fullUrl = getFullTrackingUrl(url);
                  const trackingUrl = getTrackingUrl(url);
                  return (
                    <tr key={url.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-medium">{url.name}</td>
                      <td className="px-4 py-4">
                        <a href={url.destination_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-xs block">
                          {url.destination_url}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-blue-600">{trackingUrl}</code>
                          <button
                            onClick={() => copyToClipboard(fullUrl, url.id)}
                            className="text-gray-500 hover:text-blue-600"
                            title="Copy full URL"
                          >
                            <i className={`ri-${copySuccess === url.id ? 'check-line text-green-600' : 'file-copy-line'}`}></i>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{url.campaign_name || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => setSelectedUrl(selectedUrl === url.id ? null : url.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {url.clicks_count || 0} total
                          {url.unique_clicks_count !== undefined && (
                            <span className="text-gray-500 text-xs block">{url.unique_clicks_count} unique</span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          url.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {url.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => openModal(url)}>
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleDelete(url.id)} className="text-red-600 hover:text-red-700">
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Analytics Panel */}
      {selectedUrl && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Click Analytics</h3>
            <button onClick={() => setSelectedUrl(null)} className="text-gray-500 hover:text-gray-700">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
          {analyticsLoading ? (
            <div className="text-center py-8">
              <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
            </div>
          ) : clickAnalytics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No clicks recorded yet
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{clickAnalytics.length}</div>
                  <div className="text-sm text-gray-600">Total Clicks</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(clickAnalytics.map(c => c.ip_address).filter(Boolean)).size}
                  </div>
                  <div className="text-sm text-gray-600">Unique IPs</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(clickAnalytics.map(c => c.country).filter(Boolean)).size}
                  </div>
                  <div className="text-sm text-gray-600">Countries</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {Object.keys(clickAnalytics.reduce((acc: Record<string, boolean>, c) => {
                      if (c.device_type) acc[c.device_type] = true;
                      return acc;
                    }, {})).length}
                  </div>
                  <div className="text-sm text-gray-600">Device Types</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Country</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">Device</th>
                      <th className="px-3 py-2">Browser</th>
                      <th className="px-3 py-2">OS</th>
                      <th className="px-3 py-2">UTM Source</th>
                      <th className="px-3 py-2">UTM Campaign</th>
                      <th className="px-3 py-2">Converted</th>
                      <th className="px-3 py-2">Pages</th>
                      <th className="px-3 py-2">Duration</th>
                      <th className="px-3 py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clickAnalytics.slice(0, 50).map((click) => (
                      <tr key={click.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(click.clicked_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{click.country || '-'}</td>
                        <td className="px-3 py-2">{click.city || '-'}</td>
                        <td className="px-3 py-2 capitalize">{click.device_type || '-'}</td>
                        <td className="px-3 py-2">{click.browser || '-'}</td>
                        <td className="px-3 py-2">{click.os || '-'}</td>
                        <td className="px-3 py-2 text-xs">{click.utm_source || '-'}</td>
                        <td className="px-3 py-2 text-xs">{click.utm_campaign || '-'}</td>
                        <td className="px-3 py-2">
                          {click.converted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              <i className="ri-check-line"></i>
                              {click.conversion_type || 'Yes'}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">{click.pages_viewed || 1}</td>
                        <td className="px-3 py-2">{click.session_duration_seconds ? `${click.session_duration_seconds}s` : '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono">{click.ip_address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {showModal && editingUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingUrl.id ? 'Edit' : 'Create'} Tracking URL</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editingUrl.name || ''}
                  onChange={(e) => setEditingUrl({ ...editingUrl, name: e.target.value })}
                  placeholder="e.g., Facebook Ad - Summer Campaign"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination URL *</label>
                <input
                  type="url"
                  value={editingUrl.destination_url || ''}
                  onChange={(e) => setEditingUrl({ ...editingUrl, destination_url: e.target.value })}
                  placeholder="https://example.com/landing-page"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={editingUrl.campaign_name || ''}
                    onChange={(e) => setEditingUrl({ ...editingUrl, campaign_name: e.target.value })}
                    placeholder="utm_campaign"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={editingUrl.source || ''}
                    onChange={(e) => setEditingUrl({ ...editingUrl, source: e.target.value })}
                    placeholder="utm_source (e.g., facebook)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medium</label>
                  <input
                    type="text"
                    value={editingUrl.medium || ''}
                    onChange={(e) => setEditingUrl({ ...editingUrl, medium: e.target.value })}
                    placeholder="utm_medium (e.g., cpc)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <input
                    type="text"
                    value={editingUrl.content || ''}
                    onChange={(e) => setEditingUrl({ ...editingUrl, content: e.target.value })}
                    placeholder="utm_content"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Custom Parameters Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Parameters
                </label>
                <div className="space-y-2">
                  {/* Display existing custom params */}
                  {editingUrl.custom_params && Object.keys(editingUrl.custom_params).length > 0 && (
                    <div className="space-y-2 mb-3">
                      {Object.entries(editingUrl.custom_params).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <code className="text-sm font-mono bg-white px-2 py-1 rounded border flex-1">
                            {key}={String(value)}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              const newParams = { ...editingUrl.custom_params };
                              delete newParams[key];
                              setEditingUrl({ ...editingUrl, custom_params: newParams });
                            }}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove parameter"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new custom param */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customParamKey}
                      onChange={(e) => setCustomParamKey(e.target.value)}
                      placeholder="Parameter name (e.g., param1)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <span className="self-center text-gray-500">=</span>
                    <input
                      type="text"
                      value={customParamValue}
                      onChange={(e) => setCustomParamValue(e.target.value)}
                      placeholder="Value (e.g., value1)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customParamKey.trim() && customParamValue.trim()) {
                          setEditingUrl({
                            ...editingUrl,
                            custom_params: {
                              ...editingUrl.custom_params,
                              [customParamKey.trim()]: customParamValue.trim()
                            }
                          });
                          setCustomParamKey('');
                          setCustomParamValue('');
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                    >
                      <i className="ri-add-line"></i> Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Add custom parameters that will be appended to your tracking URL (e.g., param1=value1&param2=value2)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingUrl.is_active ?? true}
                  onChange={(e) => setEditingUrl({ ...editingUrl, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>

              {/* URL Preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">Preview URL:</p>
                {editingUrl.id ? (
                  <>
                    <p className="text-xs text-blue-700 mb-1">
                      <strong>Short Code:</strong> <code className="bg-white px-2 py-1 rounded">{editingUrl.short_code}</code>
                    </p>
                    <div className="mt-2">
                      <code className="bg-white px-2 py-1 rounded text-xs block break-all">
                        {getFullTrackingUrl(editingUrl as TrackingUrl)}
                      </code>
                    </div>
                  </>
                ) : editingUrl.destination_url ? (
                  <div className="text-xs text-blue-700">
                    <p className="mb-1">Will generate: <code className="bg-white px-2 py-1 rounded">yoursite.com/t/XXXXX</code></p>
                    <p>With parameters: {(() => {
                      const params: string[] = [];
                      if (editingUrl.source) params.push(`utm_source=${editingUrl.source}`);
                      if (editingUrl.medium) params.push(`utm_medium=${editingUrl.medium}`);
                      if (editingUrl.campaign_name) params.push(`utm_campaign=${editingUrl.campaign_name}`);
                      if (editingUrl.content) params.push(`utm_content=${editingUrl.content}`);
                      if (editingUrl.term) params.push(`utm_term=${editingUrl.term}`);
                      if (editingUrl.custom_params) {
                        Object.entries(editingUrl.custom_params).forEach(([key, value]) => {
                          params.push(`${key}=${value}`);
                        });
                      }
                      return params.length > 0 ? params.join('&') : 'none';
                    })()}</p>
                  </div>
                ) : (
                  <p className="text-xs text-blue-700">Enter destination URL to see preview</p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : editingUrl.id ? 'Update URL' : 'Create URL'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

