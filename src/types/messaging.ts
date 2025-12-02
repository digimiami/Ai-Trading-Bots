export interface Message {
  id: string
  sender_id: string
  recipient_id: string | null
  subject: string | null
  body: string
  is_read: boolean
  read_at: string | null
  is_broadcast: boolean
  parent_message_id: string | null
  created_at: string
  updated_at: string
  sender?: {
    id: string
    name: string
    email: string
  }
  recipient?: {
    id: string
    name: string
    email: string
  } | null
  parent?: {
    id: string
    subject: string | null
    body: string
  } | null
}

export interface SendMessageParams {
  recipientId?: string
  recipientUsername?: string
  subject?: string
  body: string
  parentMessageId?: string
  isBroadcast?: boolean
}

export interface GetMessagesParams {
  type?: 'inbox' | 'sent' | 'all' | 'admin'
  limit?: number
  offset?: number
}

export interface User {
  id: string
  name: string
  email: string
  role?: string
}

