import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface NotificationQueueItem {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'processed' | 'failed';
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

export default function AdminNotifications() {
  const [queue, setQueue] = useState<NotificationQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('admin_notification_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setQueue(data || []);
    } catch (err: any) {
      console.error('Failed to load notification queue:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-admin-notifications');
      if (error) throw error;
      alert(`✅ Queue processing triggered! Results: ${JSON.stringify(data.results || 'No pending notifications')}`);
      loadQueue();
    } catch (err: any) {
      alert(`❌ Failed to process queue: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleTestNotification = async (type: 'new_user' | 'subscription_paid') => {
    setLoading(true);
    try {
      let testData: any = {};
      if (type === 'new_user') {
        testData = {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString()
        };
      } else {
        testData = {
          user_id: 'test-user-id',
          user_email: 'test@example.com',
          plan_name: 'Premium Plan',
          amount: 99.99,
          invoice_id: 'TEST-INV-123'
        };
      }

      const { error } = await supabase.functions.invoke('admin-notifications', {
        body: { type, data: testData }
      });

      if (error) throw error;
      alert('✅ Test notification sent successfully!');
    } catch (err: any) {
      alert(`❌ Failed to send test notification: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Admin Notifications</h2>
          <p className="text-gray-600">Manage and test admin email notifications</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={loadQueue}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
            Refresh Queue
          </Button>
          <Button
            variant="primary"
            onClick={handleProcessQueue}
            disabled={processing}
            className="flex items-center gap-2"
          >
            <i className={`ri-play-line ${processing ? 'animate-spin' : ''}`}></i>
            Process Pending Queue
          </Button>
        </div>
      </div>

      {/* Test Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Test Notifications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium mb-2">New User Signup</h4>
            <p className="text-sm text-gray-500 mb-4">Send a test email for a new user registration.</p>
            <Button
              variant="secondary"
              onClick={() => handleTestNotification('new_user')}
              disabled={loading}
              className="w-full"
            >
              Send Test Signup Email
            </Button>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium mb-2">Subscription Payment</h4>
            <p className="text-sm text-gray-500 mb-4">Send a test email for a successful subscription payment.</p>
            <Button
              variant="secondary"
              onClick={() => handleTestNotification('subscription_paid')}
              disabled={loading}
              className="w-full"
            >
              Send Test Payment Email
            </Button>
          </div>
        </div>
      </Card>

      {/* Queue Section */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold">Notification Queue (Last 50)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Processed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">
                    No items in queue
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 text-sm">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{item.type.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'processed' ? 'bg-green-100 text-green-800' :
                        item.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status}
                      </span>
                      {item.error_message && (
                        <p className="text-xs text-red-600 mt-1">{item.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                      {JSON.stringify(item.data)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.processed_at ? new Date(item.processed_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

