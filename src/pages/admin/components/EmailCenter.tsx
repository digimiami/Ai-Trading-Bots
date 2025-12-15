import { useState, useEffect } from 'react';
import { useAdmin } from '../../../hooks/useAdmin';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  forward_to: string | null;
  created_at: string;
}

interface Email {
  id: string;
  mailbox_id: string | null;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_address: string;
  cc_addresses?: string[] | null;
  bcc_addresses?: string[] | null;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  thread_id: string | null;
  status: string;
  error_message: string | null;
  received_at: string;
  sent_at: string | null;
  created_at: string;
  mailboxes?: {
    email_address: string;
    display_name: string | null;
  } | null;
}

export default function EmailCenter() {
  const { sendEmail, broadcastEmail, getMailboxes, getEmails, createMailbox, updateMailbox, deleteMailbox, loading, getUsers } = useAdmin();
  
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<'inbound' | 'outbound' | 'all'>('all');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showMailboxManager, setShowMailboxManager] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mailboxForm, setMailboxForm] = useState({
    email_address: '',
    display_name: '',
    is_active: true,
    forward_to: ''
  });
  const [composeForm, setComposeForm] = useState({
    from: '',
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    html: '',
    text: '',
    replyTo: ''
  });
  const [broadcastForm, setBroadcastForm] = useState({
    from: '',
    subject: '',
    html: '',
    text: '',
    sendToAll: false,
    selectedUserIds: [] as string[],
    selectedUserEmails: [] as string[]
  });
  const [users, setUsers] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalEmails, setTotalEmails] = useState(0);
  const emailsPerPage = 20;

  useEffect(() => {
    loadMailboxes();
    loadEmails();
    loadUsers();
  }, [selectedMailbox, selectedDirection, currentPage]);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const loadMailboxes = async () => {
    try {
      const data = await getMailboxes(true); // Include inactive for management
      setMailboxes(data);
      // Set default to first active mailbox
      const activeMailbox = data.find(mb => mb.is_active);
      if (activeMailbox && !composeForm.from) {
        setComposeForm(prev => ({ ...prev, from: activeMailbox.email_address }));
      }
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    }
  };

  const loadEmails = async () => {
    try {
      const params: any = {
        limit: emailsPerPage,
        offset: currentPage * emailsPerPage
      };
      
      if (selectedMailbox !== 'all') {
        params.mailboxId = selectedMailbox;
      }
      
      if (selectedDirection !== 'all') {
        params.direction = selectedDirection;
      }
      
      const data = await getEmails(params);
      setEmails(data);
      setTotalEmails(data.length);
    } catch (err) {
      console.error('Failed to load emails:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadMailboxes(), loadEmails()]);
    } catch (err) {
      console.error('Failed to refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.from || !composeForm.to || !composeForm.subject) {
      alert('Please fill in From, To, and Subject fields');
      return;
    }
    if (mailboxes.length === 0 || !mailboxes.find(m => m.email_address === composeForm.from)) {
      alert('⚠️ Please select a valid mailbox or create one first.');
      return;
    }

    setSending(true);
    try {
      const emailData: any = {
        from: composeForm.from,
        to: composeForm.to.split(',').map(e => e.trim()),
        subject: composeForm.subject,
      };

      if (composeForm.cc) {
        emailData.cc = composeForm.cc.split(',').map(e => e.trim());
      }
      if (composeForm.bcc) {
        emailData.bcc = composeForm.bcc.split(',').map(e => e.trim());
      }
      if (composeForm.html) {
        emailData.html = composeForm.html;
      }
      if (composeForm.text) {
        emailData.text = composeForm.text;
      }
      if (composeForm.replyTo) {
        emailData.replyTo = composeForm.replyTo;
      }

      await sendEmail(emailData);
      alert('✅ Email sent successfully!');
      setShowCompose(false);
      setComposeForm({
        from: mailboxes[0]?.email_address || '',
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        html: '',
        text: '',
        replyTo: ''
      });
      loadEmails();
    } catch (err: any) {
      alert(`❌ Failed to send email: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (email: Email) => {
    setComposeForm({
      from: email.mailboxes?.email_address || mailboxes[0]?.email_address || '',
      to: email.from_address,
      cc: '',
      bcc: '',
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject || ''}`,
      html: '',
      text: '',
      replyTo: email.from_address
    });
    setShowCompose(true);
  };

  const handleForward = (email: Email) => {
    // Create forwarded email content
    const forwardHeader = `
<div style="border-left: 3px solid #ccc; padding-left: 10px; margin: 20px 0; color: #666; font-size: 12px;">
  <div><strong>From:</strong> ${email.from_address}</div>
  <div><strong>To:</strong> ${email.to_address}</div>
  <div><strong>Date:</strong> ${new Date(email.received_at || email.sent_at || email.created_at).toLocaleString()}</div>
  <div><strong>Subject:</strong> ${email.subject || '(No subject)'}</div>
</div>
`;
    
    const forwardedHtml = forwardHeader + (email.html_body || `<pre>${email.text_body || ''}</pre>`);
    const forwardedText = `
---------- Forwarded message ----------
From: ${email.from_address}
To: ${email.to_address}
Date: ${new Date(email.received_at || email.sent_at || email.created_at).toLocaleString()}
Subject: ${email.subject || '(No subject)'}

${email.text_body || email.html_body?.replace(/<[^>]*>/g, '') || ''}
`;

    setComposeForm({
      from: email.mailboxes?.email_address || mailboxes[0]?.email_address || '',
      to: '',
      cc: '',
      bcc: '',
      subject: email.subject?.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject || ''}`,
      html: forwardedHtml,
      text: forwardedText,
      replyTo: ''
    });
    setShowCompose(true);
  };

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMailbox(
        mailboxForm.email_address, 
        mailboxForm.display_name || undefined, 
        mailboxForm.is_active,
        mailboxForm.forward_to || undefined
      );
      alert('✅ Mailbox created successfully!');
      setShowMailboxManager(false);
      setMailboxForm({ email_address: '', display_name: '', is_active: true, forward_to: '' });
      loadMailboxes();
    } catch (err: any) {
      alert(`❌ Failed to create mailbox: ${err.message}`);
    }
  };

  const handleUpdateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMailbox) return;
    try {
      const updates: any = {
        email_address: mailboxForm.email_address,
        is_active: mailboxForm.is_active,
      };
      
      // Only include display_name if it's not empty
      if (mailboxForm.display_name.trim()) {
        updates.display_name = mailboxForm.display_name;
      } else {
        updates.display_name = null;
      }
      
      // Only include forward_to if it's not empty
      if (mailboxForm.forward_to.trim()) {
        updates.forward_to = mailboxForm.forward_to;
      } else {
        updates.forward_to = null;
      }
      
      await updateMailbox(editingMailbox.id, updates);
      alert('✅ Mailbox updated successfully!');
      setShowMailboxManager(false);
      setEditingMailbox(null);
      setMailboxForm({ email_address: '', display_name: '', is_active: true, forward_to: '' });
      loadMailboxes();
    } catch (err: any) {
      console.error('Update mailbox error:', err);
      alert(`❌ Failed to update mailbox: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteMailbox = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteMailbox(id);
      alert('✅ Mailbox deleted successfully!');
      loadMailboxes();
      if (composeForm.from && mailboxes.find(m => m.id === id)?.email_address === composeForm.from) {
        setComposeForm(prev => ({ ...prev, from: mailboxes[0]?.email_address || '' }));
      }
    } catch (err: any) {
      alert(`❌ Failed to delete mailbox: ${err.message}`);
    }
  };

  const startEditMailbox = (mailbox: Mailbox) => {
    setEditingMailbox(mailbox);
    setMailboxForm({
      email_address: mailbox.email_address,
      display_name: mailbox.display_name || '',
      is_active: mailbox.is_active,
      forward_to: mailbox.forward_to || ''
    });
    setShowMailboxManager(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with Compose Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Center</h2>
          <p className="text-gray-600">Manage outbound emails and view inbound messages</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowMailboxManager(true)}
            className="flex items-center gap-2"
          >
            <i className="ri-mail-settings-line"></i>
            Manage Mailboxes
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              // Load users when opening broadcast modal
              await loadUsers();
              setBroadcastForm({
                from: mailboxes.find(m => m.is_active)?.email_address || '',
                subject: '',
                html: '',
                text: '',
                sendToAll: false,
                selectedUserIds: [],
                selectedUserEmails: []
              });
              setShowBroadcast(true);
            }}
            className="flex items-center gap-2"
          >
            <i className="ri-broadcast-line"></i>
            Broadcast
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2"
          >
            <i className="ri-mail-send-line"></i>
            Compose Email
          </Button>
        </div>
      </div>

      {/* Info if no mailboxes */}
      {mailboxes.length === 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
            <div>
              <h3 className="font-semibold text-blue-800 mb-1">No Mailboxes Configured</h3>
              <p className="text-sm text-blue-700 mb-2">
                Create a mailbox to start sending and receiving emails.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowMailboxManager(true)}
                className="mt-2"
              >
                <i className="ri-add-line"></i> Create Your First Mailbox
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mailbox</label>
            <select
              value={selectedMailbox}
              onChange={(e) => {
                setSelectedMailbox(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Mailboxes</option>
              {mailboxes.map(mb => (
                <option key={mb.id} value={mb.id}>
                  {mb.display_name || mb.email_address}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
            <select
              value={selectedDirection}
              onChange={(e) => {
                setSelectedDirection(e.target.value as any);
                setCurrentPage(0);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Emails</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Mailbox Manager Modal */}
      {showMailboxManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingMailbox ? 'Edit Mailbox' : 'Manage Mailboxes'}
              </h3>
              <button
                onClick={() => {
                  setShowMailboxManager(false);
                  setEditingMailbox(null);
                  setMailboxForm({ email_address: '', display_name: '', is_active: true });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            {/* Mailbox Form */}
            <form onSubmit={editingMailbox ? handleUpdateMailbox : handleCreateMailbox} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={mailboxForm.email_address}
                  onChange={(e) => setMailboxForm({ ...mailboxForm, email_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="support@pablobots.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={mailboxForm.display_name}
                  onChange={(e) => setMailboxForm({ ...mailboxForm, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Pablo Bots - Support"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={mailboxForm.is_active}
                  onChange={(e) => setMailboxForm({ ...mailboxForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active (can send/receive emails)
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forward To (optional)</label>
                <input
                  type="email"
                  value={mailboxForm.forward_to}
                  onChange={(e) => setMailboxForm({ ...mailboxForm, forward_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="forward@example.com (leave empty to disable forwarding)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  All inbound emails to this mailbox will be automatically forwarded to this address
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                >
                  {editingMailbox ? 'Update Mailbox' : 'Create Mailbox'}
                </Button>
                {editingMailbox && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingMailbox(null);
                      setMailboxForm({ email_address: '', display_name: '', is_active: true, forward_to: '' });
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>

            {/* Mailboxes List */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Existing Mailboxes</h4>
              {mailboxes.length === 0 ? (
                <p className="text-gray-500 text-sm">No mailboxes created yet.</p>
              ) : (
                <div className="space-y-2">
                  {mailboxes.map(mb => (
                    <div
                      key={mb.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{mb.display_name || mb.email_address}</div>
                        <div className="text-sm text-gray-600">{mb.email_address}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            mb.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {mb.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {mb.forward_to && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              <i className="ri-forward-line mr-1"></i>
                              Forwarding to {mb.forward_to}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEditMailbox(mb)}
                        >
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDeleteMailbox(mb.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Compose Email</h3>
              <button
                onClick={() => setShowCompose(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <div className="flex gap-2">
                  <select
                    value={composeForm.from}
                    onChange={(e) => setComposeForm({ ...composeForm, from: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select a mailbox...</option>
                    {mailboxes.map(mb => (
                      <option key={mb.id} value={mb.email_address}>
                        {mb.display_name || mb.email_address} {!mb.is_active ? '(inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowCompose(false);
                      setShowMailboxManager(true);
                    }}
                    className="whitespace-nowrap"
                  >
                    <i className="ri-add-line"></i> New
                  </Button>
                </div>
                {mailboxes.length === 0 && (
                  <p className="mt-1 text-sm text-blue-600">
                    💡 No mailboxes yet. Click "New" to create one.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="text"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@example.com (comma-separated for multiple)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC (optional)</label>
                <input
                  type="text"
                  value={composeForm.cc}
                  onChange={(e) => setComposeForm({ ...composeForm, cc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BCC (optional)</label>
                <input
                  type="text"
                  value={composeForm.bcc}
                  onChange={(e) => setComposeForm({ ...composeForm, bcc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HTML Body</label>
                <textarea
                  value={composeForm.html}
                  onChange={(e) => setComposeForm({ ...composeForm, html: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={8}
                  placeholder="HTML content..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Body (fallback)</label>
                <textarea
                  value={composeForm.text}
                  onChange={(e) => setComposeForm({ ...composeForm, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                  placeholder="Plain text content..."
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sending || !composeForm.from}
                  className="flex-1"
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCompose(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Broadcast Email to Users</h3>
              <button
                onClick={() => setShowBroadcast(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!broadcastForm.from || !broadcastForm.subject) {
                alert('Please fill in From and Subject fields');
                return;
              }
              if (!broadcastForm.sendToAll && broadcastForm.selectedUserIds.length === 0 && broadcastForm.selectedUserEmails.length === 0) {
                alert('Please select recipients or choose "Send to All Users"');
                return;
              }

              setBroadcasting(true);
              try {
                const result = await broadcastEmail({
                  from: broadcastForm.from,
                  subject: broadcastForm.subject,
                  html: broadcastForm.html,
                  text: broadcastForm.text,
                  sendToAll: broadcastForm.sendToAll,
                  userIds: broadcastForm.sendToAll ? undefined : broadcastForm.selectedUserIds.length > 0 ? broadcastForm.selectedUserIds : undefined,
                  userEmails: broadcastForm.sendToAll ? undefined : broadcastForm.selectedUserEmails.length > 0 ? broadcastForm.selectedUserEmails : undefined
                });
                alert(`✅ Broadcast completed! ${result.results?.sent || 0} sent, ${result.results?.failed || 0} failed`);
                setShowBroadcast(false);
                setBroadcastForm({
                  from: mailboxes.find(m => m.is_active)?.email_address || '',
                  subject: '',
                  html: '',
                  text: '',
                  sendToAll: false,
                  selectedUserIds: [],
                  selectedUserEmails: []
                });
                loadEmails();
              } catch (err: any) {
                alert(`❌ Failed to broadcast email: ${err.message}`);
              } finally {
                setBroadcasting(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                <select
                  value={broadcastForm.from}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select a mailbox...</option>
                  {mailboxes.map(mb => (
                    <option key={mb.id} value={mb.email_address}>
                      {mb.display_name || mb.email_address} {!mb.is_active ? '(inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={broadcastForm.subject}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HTML Body</label>
                <textarea
                  value={broadcastForm.html}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, html: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={8}
                  placeholder="HTML content..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Body (fallback)</label>
                <textarea
                  value={broadcastForm.text}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={4}
                  placeholder="Plain text content..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendToAll"
                  checked={broadcastForm.sendToAll}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, sendToAll: e.target.checked, selectedUserIds: [], selectedUserEmails: [] })}
                  className="w-4 h-4"
                />
                <label htmlFor="sendToAll" className="text-sm font-medium text-gray-700">
                  Send to All Active Users ({users.filter(u => u.status === 'active').length} users)
                </label>
              </div>
              {!broadcastForm.sendToAll && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Users</label>
                  <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {users.map(user => (
                      <div key={user.id} className="flex items-center gap-2 p-2 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={broadcastForm.selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBroadcastForm({
                                ...broadcastForm,
                                selectedUserIds: [...broadcastForm.selectedUserIds, user.id]
                              });
                            } else {
                              setBroadcastForm({
                                ...broadcastForm,
                                selectedUserIds: broadcastForm.selectedUserIds.filter(id => id !== user.id)
                              });
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer flex-1">
                          {user.email} {user.status !== 'active' && <span className="text-gray-400">({user.status})</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {broadcastForm.selectedUserIds.length} user(s)
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={broadcasting || !broadcastForm.from}
                  className="flex-1"
                >
                  {broadcasting ? 'Broadcasting...' : `Send to ${broadcastForm.sendToAll ? `All Users (${users.filter(u => u.status === 'active').length})` : `${broadcastForm.selectedUserIds.length} Selected`}`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowBroadcast(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Email List */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {selectedDirection === 'all' ? 'All Emails' : selectedDirection === 'inbound' ? 'Inbound Emails' : 'Outbound Emails'}
          </h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`}></i>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="ri-mail-line text-4xl mb-2"></i>
            <p>No emails found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map(email => (
              <div
                key={email.id}
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedEmail?.id === email.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'
                }`}
                onClick={() => setSelectedEmail(email)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs ${
                        email.direction === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {email.direction}
                      </span>
                      <span className="font-medium">
                        {email.direction === 'inbound' ? email.from_address : email.to_address}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">{email.subject || '(No subject)'}</div>
                    <div className="text-xs text-gray-500">
                      {email.direction === 'inbound' ? 'To: ' : 'From: '}
                      {email.direction === 'inbound' ? email.to_address : email.from_address}
                      {' • '}
                      {new Date(email.received_at || email.sent_at || email.created_at).toLocaleString()}
                    </div>
                  </div>
                  {email.direction === 'inbound' && (
                    <div className="flex gap-2 ml-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(email);
                        }}
                      >
                        <i className="ri-reply-line"></i> Reply
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleForward(email);
                        }}
                      >
                        <i className="ri-forward-line"></i> Forward
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Email Detail View */}
      {selectedEmail && (
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">{selectedEmail.subject || '(No subject)'}</h3>
              <div className="text-sm text-gray-600 mt-1">
                <div>From: {selectedEmail.from_address}</div>
                <div>To: {selectedEmail.to_address}</div>
                {selectedEmail.cc_addresses && selectedEmail.cc_addresses.length > 0 && (
                  <div>CC: {selectedEmail.cc_addresses.join(', ')}</div>
                )}
                <div className="mt-2">
                  {new Date(selectedEmail.received_at || selectedEmail.sent_at || selectedEmail.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedEmail.direction === 'inbound' && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleReply(selectedEmail)}
                  >
                    <i className="ri-reply-line"></i> Reply
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleForward(selectedEmail)}
                  >
                    <i className="ri-forward-line"></i> Forward
                  </Button>
                </>
              )}
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>
          <div className="border-t pt-4">
            {selectedEmail.html_body ? (
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }}
              />
            ) : (
              <div className="whitespace-pre-wrap text-gray-800">
                {selectedEmail.text_body || '(No content)'}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalEmails > emailsPerPage && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {currentPage + 1}
          </span>
          <Button
            variant="secondary"
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={emails.length < emailsPerPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
