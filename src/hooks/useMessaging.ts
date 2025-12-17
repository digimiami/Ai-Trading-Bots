import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Message, SendMessageParams, GetMessagesParams, User } from '../types/messaging'

const MESSAGING_FUNCTION_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || ''}/functions/v1/messaging`

export function useMessaging() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callMessagingFunction = async (action: string, params: any = {}) => {
    try {
      setLoading(true)
      setError(null)

      const session = await supabase.auth.getSession()
      if (!session.data.session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(MESSAGING_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || ''
        },
        body: JSON.stringify({ action, ...params })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to perform messaging operation'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (params: SendMessageParams): Promise<Message> => {
    const data = await callMessagingFunction('sendMessage', params)
    return data.message
  }

  const getMessages = async (params: GetMessagesParams = {}): Promise<Message[]> => {
    try {
      console.log('📨 useMessaging: Fetching messages with params:', params)
      const data = await callMessagingFunction('getMessages', params)
      console.log('📨 useMessaging: Received messages:', data.messages?.length || 0)
      return data.messages || []
    } catch (error) {
      console.error('📨 useMessaging: Error fetching messages:', error)
      throw error
    }
  }

  const getMessage = async (messageId: string): Promise<Message> => {
    const data = await callMessagingFunction('getMessage', { messageId })
    return data.message
  }

  const markAsRead = async (messageId: string): Promise<Message> => {
    const data = await callMessagingFunction('markAsRead', { messageId })
    return data.message
  }

  const getUnreadCount = async (): Promise<number> => {
    const data = await callMessagingFunction('getUnreadCount')
    return data.count || 0
  }

  const getConversation = async (otherUserId: string, limit = 50, offset = 0): Promise<Message[]> => {
    const data = await callMessagingFunction('getConversation', { otherUserId, limit, offset })
    return data.messages || []
  }

  const searchUsers = async (query: string, limit = 20): Promise<User[]> => {
    const data = await callMessagingFunction('searchUsers', { query, limit })
    return data.users || []
  }

  const getAllUsers = async (): Promise<User[]> => {
    const data = await callMessagingFunction('getAllUsers')
    return data.users || []
  }

  const deleteMessage = async (messageId: string): Promise<void> => {
    await callMessagingFunction('deleteMessage', { messageId })
  }

  return {
    loading,
    error,
    sendMessage,
    getMessages,
    getMessage,
    markAsRead,
    getUnreadCount,
    getConversation,
    searchUsers,
    getAllUsers,
    deleteMessage
  }
}

// Hook for real-time unread count
export function useUnreadMessageCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const messaging = useMessaging()
  
  // Use useRef to prevent infinite loops from function reference changes
  const isFetchingRef = useRef(false)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const getUnreadCountRef = useRef(messaging.getUnreadCount)
  const subscriptionSetupRef = useRef(false)

  // Keep the ref updated with the latest function (but don't trigger effects)
  getUnreadCountRef.current = messaging.getUnreadCount

  const fetchCount = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return
    }

    try {
      // Check authentication before making the call
      const session = await supabase.auth.getSession()
      if (!session.data.session) {
        // Not authenticated - silently return 0, don't log errors
        setCount(0)
        setLoading(false)
        return
      }

      isFetchingRef.current = true
      setLoading(true)
      const unreadCount = await getUnreadCountRef.current()
      setCount(unreadCount)
      // Clear any retry timeout on success
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    } catch (err: any) {
      // Only log non-authentication errors and non-resource errors
      const isResourceError = err.message?.includes('INSUFFICIENT_RESOURCES') || 
                             err.message?.includes('Failed to fetch') ||
                             err.name === 'TypeError'
      
      if (err.message !== 'Not authenticated' && 
          err.message !== 'Unauthorized' && 
          !isResourceError) {
        console.error('Error fetching unread count:', err)
      }
      
      // Set count to 0 on any error (including auth errors)
      setCount(0)
      
      // If it's a resource error, don't retry immediately - wait longer
      if (isResourceError) {
        // Wait 30 seconds before allowing another fetch to prevent resource exhaustion
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
        retryTimeoutRef.current = setTimeout(() => {
          isFetchingRef.current = false
        }, 30000)
        return
      }
    } finally {
      // Only reset fetching flag if it's not a resource error with retry timeout
      if (!retryTimeoutRef.current) {
        isFetchingRef.current = false
      }
      setLoading(false)
    }
  }, []) // Empty dependency array - we use refs to access the latest functions

  useEffect(() => {
    // Prevent multiple subscription setups
    if (subscriptionSetupRef.current) {
      return
    }

    let channel: any = null
    let interval: NodeJS.Timeout | null = null
    let mounted = true

    const setupSubscription = async () => {
      // Check if authenticated before setting up real-time subscription
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !mounted) {
        setCount(0)
        setLoading(false)
        return // Don't set up subscription if not authenticated
      }

      // Fetch initial count
      await fetchCount()

      if (!mounted) return

      // Set up real-time subscription for messages
      try {
        channel = supabase
          .channel('messages')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages'
            },
            () => {
              // Refetch count when messages change (only if not already fetching)
              if (!isFetchingRef.current && mounted) {
                fetchCount()
              }
            }
          )
          .subscribe()

        // Poll every 60 seconds as backup (reduced from 30s to 60s to save egress)
        interval = setInterval(() => {
          if (!isFetchingRef.current && mounted) {
            fetchCount()
          }
        }, 60000)
        
        subscriptionSetupRef.current = true
      } catch (err) {
        console.error('Error setting up message subscription:', err)
      }
    }

    setupSubscription()

    // Cleanup function
    return () => {
      mounted = false
      subscriptionSetupRef.current = false
      if (channel) {
        channel.unsubscribe()
      }
      if (interval) {
        clearInterval(interval)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      isFetchingRef.current = false
    }
  }, []) // Empty dependency array - only run once on mount

  return { count, loading, refetch: fetchCount }
}

