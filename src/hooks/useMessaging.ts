import { useState, useEffect, useCallback } from 'react'
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
  const { getUnreadCount } = useMessaging()

  const fetchCount = useCallback(async () => {
    try {
      setLoading(true)
      const unreadCount = await getUnreadCount()
      setCount(unreadCount)
    } catch (err) {
      console.error('Error fetching unread count:', err)
    } finally {
      setLoading(false)
    }
  }, [getUnreadCount])

  useEffect(() => {
    fetchCount()

    // Set up real-time subscription for messages
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Refetch count when messages change
          fetchCount()
        }
      )
      .subscribe()

    // Poll every 30 seconds as backup
    const interval = setInterval(fetchCount, 30000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [fetchCount])

  return { count, loading, refetch: fetchCount }
}

