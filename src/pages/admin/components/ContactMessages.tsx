import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface ContactMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  admin_notes: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
  users?: {
    email: string;
    full_name: string | null;
  } | null;
}

export default function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'read' | 'replied' | 'archived'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch user info separately if user_id exists
      const messagesWithUsers = await Promise.all(
        (data || []).map(async (message) => {
          if (message.user_id) {
            try {
              // Try to get user info from auth.users (admin can access this)
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('id', message.user_id)
                .single();
              
              if (!userError && userData) {
                return { ...message, users: userData };
              }
            } catch (e) {
              // If we can't fetch user info, just continue without it
              console.log('Could not fetch user info for message:', message.id);
            }
          }
          return { ...message, users: null };
        })
      );
      
      setMessages(messagesWithUsers);
    } catch (error: any) {
      console.error('Error loading contact messages:', error);
      alert(`Failed to load messages: ${error?.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: ContactMessage['status'], notes?: string) => {
    try {
      setUpdating(true);
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'replied') {
        updateData.replied_at = new Date().toISOString();
      }

      if (notes !== undefined) {
        updateData.admin_notes = notes;
      }

      const { error } = await supabase
        .from('contact_messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) throw error;

      // Refresh messages
      await loadMessages();
      
      // Clear selected message if it was updated
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
        setAdminNotes('');
      }

      alert(`Message marked as ${status}`);
    } catch (error: any) {
      console.error('Error updating message:', error);
      alert(`Failed to update message: ${error?.message || error}`);
    } finally {
      setUpdating(false);
    }
  };

  const refreshMessages = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const getStatusColor = (status: ContactMessage['status']) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'read':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'replied':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'archived':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = messages.filter(m => m.status === 'new').length;

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8">
          <i className="ri-loader-4-line animate-spin text-3xl text-gray-400"></i>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading contact messages...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Messages</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage contact form submissions from users
          </p>
        </div>
        <Button
          onClick={refreshMessages}
          disabled={refreshing}
          variant="secondary"
        >
          <i className={`ri-refresh-line mr-2 ${refreshing ? 'animate-spin' : ''}`}></i>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{messages.length}</p>
            </div>
            <i className="ri-mail-line text-3xl text-gray-400"></i>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">New</p>
              <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
            </div>
            <i className="ri-mail-unread-line text-3xl text-blue-400"></i>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Replied</p>
              <p className="text-2xl font-bold text-green-600">
                {messages.filter(m => m.status === 'replied').length}
              </p>
            </div>
            <i className="ri-mail-check-line text-3xl text-green-400"></i>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Archived</p>
              <p className="text-2xl font-bold text-yellow-600">
                {messages.filter(m => m.status === 'archived').length}
              </p>
            </div>
            <i className="ri-archive-line text-3xl text-yellow-400"></i>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'new', 'read', 'replied', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'new' && unreadCount > 0 && (
              <span className="ml-2 bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Messages List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages List */}
        <Card className="p-0">
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <i className="ri-inbox-line text-4xl mb-4"></i>
                <p>No messages found</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => {
                    setSelectedMessage(message);
                    setAdminNotes(message.admin_notes || '');
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    selectedMessage?.id === message.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                      : ''
                  } ${message.status === 'new' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {message.subject}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {message.name} &lt;{message.email}&gt;
                      </p>
                      {message.user_id && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          User ID: {message.user_id}
                          {message.users && (
                            <span> ({message.users.full_name || message.users.email})</span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(message.status)}`}>
                      {message.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mt-2">
                    {message.message}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Message Detail */}
        <Card>
          {selectedMessage ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedMessage.subject}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedMessage.name} &lt;{selectedMessage.email}&gt;
                  </p>
                  {selectedMessage.user_id && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      User ID: {selectedMessage.user_id}
                      {selectedMessage.users && (
                        <span> ({selectedMessage.users.full_name || selectedMessage.users.email})</span>
                      )}
                    </p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(selectedMessage.status)}`}>
                  {selectedMessage.status}
                </span>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message:</p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {selectedMessage.message}
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>Received: {new Date(selectedMessage.created_at).toLocaleString()}</p>
                {selectedMessage.replied_at && (
                  <p>Replied: {new Date(selectedMessage.replied_at).toLocaleString()}</p>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Add notes about this message..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {selectedMessage.status !== 'read' && (
                  <Button
                    onClick={() => updateMessageStatus(selectedMessage.id, 'read', adminNotes)}
                    disabled={updating}
                    variant="secondary"
                    size="sm"
                  >
                    <i className="ri-eye-line mr-2"></i>
                    Mark as Read
                  </Button>
                )}
                {selectedMessage.status !== 'replied' && (
                  <Button
                    onClick={() => updateMessageStatus(selectedMessage.id, 'replied', adminNotes)}
                    disabled={updating}
                    variant="secondary"
                    size="sm"
                  >
                    <i className="ri-mail-check-line mr-2"></i>
                    Mark as Replied
                  </Button>
                )}
                {selectedMessage.status !== 'archived' && (
                  <Button
                    onClick={() => updateMessageStatus(selectedMessage.id, 'archived', adminNotes)}
                    disabled={updating}
                    variant="secondary"
                    size="sm"
                  >
                    <i className="ri-archive-line mr-2"></i>
                    Archive
                  </Button>
                )}
                <Button
                  onClick={() => {
                    window.location.href = `mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`;
                  }}
                  variant="primary"
                  size="sm"
                >
                  <i className="ri-mail-send-line mr-2"></i>
                  Reply via Email
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <i className="ri-mail-line text-4xl mb-4"></i>
              <p>Select a message to view details</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

