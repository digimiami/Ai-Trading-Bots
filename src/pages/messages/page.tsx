import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/feature/Header'
import Navigation from '../../components/feature/Navigation'
import Card from '../../components/base/Card'
import Button from '../../components/base/Button'
import { useMessaging } from '../../hooks/useMessaging'
import { useAuth } from '../../hooks/useAuth'
import type { Message, User } from '../../types/messaging'

export default function MessagesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getMessages, markAsRead, sendMessage, searchUsers, getAllUsers } = useMessaging()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'compose'>('inbox')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [composeRecipient, setComposeRecipient] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [isBroadcast, setIsBroadcast] = useState(false)
  const [userSearchResults, setUserSearchResults] = useState<User[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    console.log('📨 MessagesPage: Tab changed to', activeTab, '- Loading messages...')
    loadMessages()
  }, [activeTab])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const type = activeTab === 'sent' ? 'sent' : 'inbox'
      console.log('📨 MessagesPage: Loading messages, type:', type)
      const msgs = await getMessages({ type, limit: 100 })
      console.log('📨 MessagesPage: Received', msgs.length, 'messages')
      setMessages(msgs)
    } catch (error) {
      console.error('📨 MessagesPage: Error loading messages:', error)
      setMessages([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const handleMessageClick = async (message: Message) => {
    setSelectedMessage(message)
    if (!message.is_read && message.recipient_id === user?.id) {
      try {
        await markAsRead(message.id)
        // Update local state
        setMessages(prev => prev.map(m => 
          m.id === message.id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m
        ))
      } catch (error) {
        console.error('Error marking message as read:', error)
      }
    }
  }

  const handleSearchUsers = async (query: string) => {
    if (query.length < 2) {
      setUserSearchResults([])
      return
    }
    try {
      setSearchingUsers(true)
      const results = await searchUsers(query)
      setUserSearchResults(results)
    } catch (error) {
      console.error('Error searching users:', error)
    } finally {
      setSearchingUsers(false)
    }
  }

  const handleSendMessage = async () => {
    if (!composeBody.trim()) {
      alert('Message body is required')
      return
    }

    if (!isBroadcast && !selectedRecipient && !composeRecipient.trim()) {
      alert('Please select a recipient or enter a username')
      return
    }

    try {
      await sendMessage({
        recipientId: selectedRecipient?.id,
        recipientUsername: !selectedRecipient ? composeRecipient : undefined,
        subject: composeSubject || undefined,
        body: composeBody,
        isBroadcast: isAdmin && isBroadcast
      })
      
      // Reset form
      setComposeRecipient('')
      setComposeSubject('')
      setComposeBody('')
      setSelectedRecipient(null)
      setIsBroadcast(false)
      setUserSearchResults([])
      
      alert('Message sent successfully!')
      // Reload messages for current tab
      await loadMessages()
    } catch (error: any) {
      alert(`Error sending message: ${error.message}`)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="ml-64 p-6">
        <Header 
          title="Messages" 
          subtitle="Communicate with users and admins"
        />

        <div className="mt-6 flex gap-4">
          {/* Sidebar */}
          <Card className="w-80 p-4">
            <div className="flex flex-col gap-2">
              <Button
                variant={activeTab === 'inbox' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('inbox')}
                className="w-full justify-start"
              >
                <i className="ri-inbox-line mr-2"></i>
                Inbox
              </Button>
              <Button
                variant={activeTab === 'sent' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('sent')}
                className="w-full justify-start"
              >
                <i className="ri-send-plane-line mr-2"></i>
                Sent
              </Button>
              <Button
                variant={activeTab === 'compose' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('compose')}
                className="w-full justify-start"
              >
                <i className="ri-edit-line mr-2"></i>
                Compose
              </Button>
            </div>
          </Card>

          {/* Main Content */}
          <Card className="flex-1 p-6">
            {activeTab === 'compose' ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Compose Message</h2>
                
                {isAdmin && (
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="broadcast"
                      checked={isBroadcast}
                      onChange={(e) => {
                        setIsBroadcast(e.target.checked)
                        if (e.target.checked) {
                          setSelectedRecipient(null)
                          setComposeRecipient('')
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <label htmlFor="broadcast" className="text-sm">
                      Send to all users (Broadcast)
                    </label>
                  </div>
                )}

                {!isBroadcast && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Recipient</label>
                    <input
                      type="text"
                      value={composeRecipient}
                      onChange={(e) => {
                        setComposeRecipient(e.target.value)
                        handleSearchUsers(e.target.value)
                        setSelectedRecipient(null)
                      }}
                      placeholder="Enter username or email"
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    />
                    {userSearchResults.length > 0 && (
                      <div className="border rounded-lg bg-white dark:bg-gray-800 max-h-48 overflow-y-auto">
                        {userSearchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              setSelectedRecipient(u)
                              setComposeRecipient(u.name || u.email)
                              setUserSearchResults([])
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="font-medium">{u.name}</div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedRecipient && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Selected: {selectedRecipient.name} ({selectedRecipient.email})
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Subject (optional)</label>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Message subject"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Message</label>
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Type your message here..."
                    rows={10}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>

                <Button onClick={handleSendMessage} className="w-full">
                  <i className="ri-send-plane-fill mr-2"></i>
                  Send Message
                </Button>
              </div>
            ) : selectedMessage ? (
              <div className="space-y-4">
                <Button
                  variant="secondary"
                  onClick={() => setSelectedMessage(null)}
                  className="mb-4"
                >
                  <i className="ri-arrow-left-line mr-2"></i>
                  Back
                </Button>

                <div className="border-b pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold">
                      {selectedMessage.subject || '(No subject)'}
                    </h2>
                    {!selectedMessage.is_read && selectedMessage.recipient_id === user?.id && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                        New
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    From: {selectedMessage.sender?.name || 'Unknown'} ({selectedMessage.sender?.email})
                    {selectedMessage.is_broadcast && ' • Broadcast to all users'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(selectedMessage.created_at)}
                  </div>
                </div>

                <div className="prose dark:prose-invert whitespace-pre-wrap">
                  {selectedMessage.body}
                </div>

                {selectedMessage.parent && (
                  <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm font-medium mb-2">In reply to:</div>
                    <div className="text-sm">{selectedMessage.parent.body}</div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t">
                  <Button
                    onClick={() => {
                      setActiveTab('compose')
                      setComposeRecipient(selectedMessage.sender?.name || selectedMessage.sender?.email || '')
                      setComposeSubject(`Re: ${selectedMessage.subject || 'Message'}`)
                      setSelectedMessage(null)
                    }}
                  >
                    <i className="ri-reply-line mr-2"></i>
                    Reply
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    {activeTab === 'inbox' ? 'Inbox' : 'Sent Messages'}
                  </h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadMessages()}
                  >
                    <i className="ri-refresh-line mr-2"></i>
                    Refresh
                  </Button>
                </div>

                {loading ? (
                  <div className="text-center py-8">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No messages found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => handleMessageClick(message)}
                        className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          !message.is_read && message.recipient_id === user?.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {activeTab === 'inbox' 
                                  ? message.sender?.name || 'Unknown'
                                  : message.recipient?.name || (message.is_broadcast ? 'All Users' : 'Unknown')
                                }
                              </span>
                              {!message.is_read && message.recipient_id === user?.id && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                              {message.is_broadcast && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs">
                                  Broadcast
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium mb-1">
                              {message.subject || '(No subject)'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {message.body}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 ml-4">
                            {formatDate(message.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

