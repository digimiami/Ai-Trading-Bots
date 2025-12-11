import { useState, useEffect } from 'react';
import { useAdmin } from '../../../hooks/useAdmin';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string | null;
  is_active: boolean;
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
  const { sendEmail, getMailboxes, getEmails, loading, error } = useAdmin();
  
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<'inbound' | 'outbound' | 'all'>('all');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showCompose, setShowCompose] = useState(false);
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
  const [sending, setSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalEmails, setTotalEmails] = useState(0);
  const emailsPerPage = 20;

  useEffect(() => {
    loadMailboxes();
    loadEmails();
  }, [selectedMailbox, selectedDirection, currentPage]);

  const loadMailboxes = async () => {
    try {
      const data = await getMailboxes();
      setMailboxes(data);
      if (data.length > 0 && !composeForm.from) {
        setComposeForm(prev => ({ ...prev, from: data[0].email_address }));
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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.from || !composeForm.to || !composeForm.subject) {
      alert('Please fill in From, To, and Subject fields');
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

  return (
    <div className="space-y-6">
      {/* Header with Compose Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Center</h2>
          <p className="text-gray-600">Manage outbound emails and view inbound messages</p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2"
        >
          <i className="ri-mail-send-line"></i>
          Compose Email
        </Button>
      </div>

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
                <select
                  value={composeForm.from}
                  onChange={(e) => setComposeForm({ ...composeForm, from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  {mailboxes.map(mb => (
                    <option key={mb.id} value={mb.email_address}>
                      {mb.display_name || mb.email_address}
                    </option>
                  ))}
                </select>
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
                  disabled={sending}
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

      {/* Email List */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">
          {selectedDirection === 'all' ? 'All Emails' : selectedDirection === 'inbound' ? 'Inbound Emails' : 'Outbound Emails'}
        </h3>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReply(email);
                      }}
                      className="ml-2"
                    >
                      <i className="ri-reply-line"></i> Reply
                    </Button>
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleReply(selectedEmail)}
                >
                  <i className="ri-reply-line"></i> Reply
                </Button>
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
