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
  os?: string;
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
        <Button variant="primary" onClick={() => openModal()} className="flex items-center gap-2">
          <i className="ri-add-line"></i> Create Tracking URL
        </Button>
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
                      <th className="px-3 py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clickAnalytics.slice(0, 50).map((click) => (
                      <tr key={click.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{new Date(click.clicked_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{click.country || '-'}</td>
                        <td className="px-3 py-2">{click.city || '-'}</td>
                        <td className="px-3 py-2 capitalize">{click.device_type || '-'}</td>
                        <td className="px-3 py-2">{click.browser || '-'}</td>
                        <td className="px-3 py-2">{click.os || '-'}</td>
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

              {editingUrl.id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Short Code:</strong> <code className="bg-white px-2 py-1 rounded">{editingUrl.short_code}</code>
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    Tracking URL: <code className="bg-white px-2 py-1 rounded">{editingUrl.short_code ? `${baseUrl}/t/${editingUrl.short_code}` : 'Will be generated on save'}</code>
                  </p>
                </div>
              )}

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

