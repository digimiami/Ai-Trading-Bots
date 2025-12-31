
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface TrackingScript {
  id: string;
  name: string;
  script_content: string;
  event_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TrackingScripts() {
  const [scripts, setScripts] = useState<TrackingScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingScript, setEditingScript] = useState<Partial<TrackingScript> | null>(null);

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-management-enhanced', {
        body: { action: 'getTrackingScripts' }
      });
      if (error) throw error;
      setScripts(data.scripts || []);
    } catch (err: any) {
      console.error('Error fetching tracking scripts:', err);
      alert('Failed to fetch tracking scripts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScript?.name || !editingScript?.script_content) return;

    setSaving(true);
    try {
      const action = editingScript.id ? 'updateTrackingScript' : 'createTrackingScript';
      const { error } = await supabase.functions.invoke('admin-management-enhanced', {
        body: { action, ...editingScript }
      });
      if (error) throw error;
      
      alert(`Tracking script ${editingScript.id ? 'updated' : 'created'} successfully!`);
      setShowModal(false);
      setEditingScript(null);
      fetchScripts();
    } catch (err: any) {
      console.error('Error saving tracking script:', err);
      alert('Failed to save tracking script');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tracking script?')) return;

    try {
      const { error } = await supabase.functions.invoke('admin-management-enhanced', {
        body: { action: 'deleteTrackingScript', id }
      });
      if (error) throw error;
      
      alert('Tracking script deleted successfully!');
      fetchScripts();
    } catch (err: any) {
      console.error('Error deleting tracking script:', err);
      alert('Failed to delete tracking script');
    }
  };

  const openModal = (script: TrackingScript | null = null) => {
    setEditingScript(script || {
      name: '',
      script_content: '',
      event_type: 'signup',
      is_active: true
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tracking Scripts</h2>
          <p className="text-gray-600">Manage ads and analytics tracking codes for signup and other events.</p>
        </div>
        <Button variant="primary" onClick={() => openModal()} className="flex items-center gap-2">
          <i className="ri-add-line"></i> Add Script
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <i className="ri-loader-4-line animate-spin text-4xl text-gray-400"></i>
          </div>
        ) : scripts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-code-line text-4xl mb-4 block"></i>
            No tracking scripts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {scripts.map((script) => (
                  <tr key={script.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium">{script.name}</td>
                    <td className="px-4 py-4 capitalize">{script.event_type}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        script.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {script.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {new Date(script.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <Button variant="secondary" size="sm" onClick={() => openModal(script)}>
                        <i className="ri-edit-line"></i>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleDelete(script.id)} className="text-red-600 hover:text-red-700">
                        <i className="ri-delete-bin-line"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && editingScript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingScript.id ? 'Edit' : 'Add'} Tracking Script</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Script Name</label>
                <input
                  type="text"
                  value={editingScript.name || ''}
                  onChange={(e) => setEditingScript({ ...editingScript, name: e.target.value })}
                  placeholder="e.g., Facebook Pixel Signup"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={editingScript.event_type || 'signup'}
                  onChange={(e) => setEditingScript({ ...editingScript, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="signup">Signup Successful</option>
                  <option value="page_view">Page View</option>
                  <option value="payment">Payment Successful</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Script Content (HTML/JavaScript)
                </label>
                <textarea
                  value={editingScript.script_content || ''}
                  onChange={(e) => setEditingScript({ ...editingScript, script_content: e.target.value })}
                  placeholder="<!-- Paste your tracking code here -->\n<script>\n  fbq('track', 'CompleteRegistration');\n</script>"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={10}
                  required
                />
                <p className="mt-1 text-xs text-gray-500 italic">
                  Tip: Include the full &lt;script&gt; tags. These will be injected into the page when the event occurs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingScript.is_active || false}
                  onChange={(e) => setEditingScript({ ...editingScript, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (Inject script when event occurs)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Script'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

