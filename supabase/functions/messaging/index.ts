import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables')
      return new Response(JSON.stringify({ 
        error: 'Server configuration error',
        details: 'Missing Supabase credentials'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: authError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user role
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('❌ Error fetching user data:', userError)
      return new Response(JSON.stringify({ 
        error: 'Failed to get user data',
        details: userError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isAdmin = userData?.role === 'admin'

    // Parse request body
    let body: any = {}
    let action: string | null = null
    let params: any = {}
    
    try {
      if (req.method === 'POST' || req.method === 'PUT') {
        const bodyText = await req.text()
        if (bodyText) {
          body = JSON.parse(bodyText)
          action = body.action
          params = { ...body }
          delete params.action
        }
      } else if (req.method === 'GET') {
        const url = new URL(req.url)
        action = url.searchParams.get('action')
        params = Object.fromEntries(url.searchParams.entries())
      }
    } catch (e) {
      console.error('Error parsing request:', e)
      return new Response(JSON.stringify({ 
        error: 'Invalid request body',
        details: e.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('📨 Processing messaging action:', action, 'User:', user.id, 'Admin:', isAdmin)

    switch (action) {
      // Send a message
      case 'sendMessage': {
        try {
          const { recipientId, recipientUsername, subject, body: messageBody, parentMessageId, isBroadcast } = params

          if (!messageBody) {
            return new Response(JSON.stringify({ error: 'Message body is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          let finalRecipientId: string | null = null

          // Handle broadcast messages (admin only)
          if (isBroadcast === true) {
            if (!isAdmin) {
              return new Response(JSON.stringify({ error: 'Only admins can send broadcast messages' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
            finalRecipientId = null // null recipient_id means broadcast
          } else {
            // Find recipient by ID or username/email
            if (recipientId) {
              finalRecipientId = recipientId
          } else if (recipientUsername) {
            // Search for user by email or name (case-insensitive)
            const searchTerm = recipientUsername.trim()
            
            // First try to find in users table
            const { data: recipientData, error: findError } = await supabaseClient
              .from('users')
              .select('id, name, email')
              .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
              .limit(1)
            
            if (findError) {
              console.error('Error finding user:', findError)
              return new Response(JSON.stringify({ 
                error: 'Failed to find user',
                details: findError.message 
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
            
            if (!recipientData || recipientData.length === 0) {
              // If not found in users table, try auth.users by email
              const { data: authUsers, error: authError } = await supabaseClient.auth.admin.listUsers()
              
              if (!authError && authUsers?.users) {
                const foundUser = authUsers.users.find(u => 
                  u.email?.toLowerCase() === searchTerm.toLowerCase() ||
                  u.user_metadata?.name?.toLowerCase() === searchTerm.toLowerCase()
                )
                
                if (foundUser) {
                  // Verify user exists in users table, if not, we can't send (foreign key constraint)
                  const { data: userCheck } = await supabaseClient
                    .from('users')
                    .select('id')
                    .eq('id', foundUser.id)
                    .single()
                  
                  if (userCheck) {
                    finalRecipientId = foundUser.id
                  } else {
                    return new Response(JSON.stringify({ 
                      error: 'User found but not activated. Please ensure the user has completed registration.' 
                    }), {
                      status: 404,
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    })
                  }
                } else {
                  return new Response(JSON.stringify({ error: 'User not found. Please check the email or username.' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  })
                }
              } else {
                return new Response(JSON.stringify({ error: 'User not found. Please check the email or username.' }), {
                  status: 404,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
              }
            } else {
              finalRecipientId = recipientData[0].id
            }
            } else {
              return new Response(JSON.stringify({ error: 'Recipient ID or username/email is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }

            // Users can't send messages to themselves
            if (finalRecipientId === user.id) {
              return new Response(JSON.stringify({ error: 'Cannot send message to yourself' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          }

          // Insert message
          const insertData: any = {
            sender_id: user.id,
            subject: subject || null,
            body: messageBody,
            is_broadcast: isBroadcast === true,
            parent_message_id: parentMessageId || null
          }
          
          // Only set recipient_id if it's not a broadcast
          if (!isBroadcast) {
            insertData.recipient_id = finalRecipientId
          } else {
            insertData.recipient_id = null
          }

          console.log('📨 Inserting message:', {
            sender_id: user.id,
            recipient_id: finalRecipientId,
            is_broadcast: isBroadcast,
            has_subject: !!subject,
            body_length: messageBody.length
          })

          const { data: message, error: insertError } = await supabaseClient
            .from('messages')
            .insert(insertData)
            .select()
            .single()

          if (insertError) {
            console.error('❌ Error inserting message:', insertError)
            console.error('Insert data was:', insertData)
            return new Response(JSON.stringify({ 
              error: 'Failed to send message',
              details: insertError.message,
              code: insertError.code,
              hint: insertError.hint
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          console.log('✅ Message sent successfully:', message.id)

          return new Response(JSON.stringify({ message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (sendError: any) {
          console.error('❌ Unexpected error in sendMessage:', sendError)
          return new Response(JSON.stringify({ 
            error: 'Failed to send message',
            details: sendError?.message || String(sendError)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // Get messages (inbox)
      case 'getMessages': {
        const { type = 'inbox', limit = 50, offset = 0 } = params // type: 'inbox', 'sent', 'all'

        let query = supabaseClient
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email),
            recipient:users!messages_recipient_id_fkey(id, name, email),
            parent:messages!messages_parent_message_id_fkey(id, subject, body)
          `)

        if (isAdmin && type === 'admin') {
          // Admins can see all messages - no filter needed
        } else if (type === 'inbox') {
          // Messages received by user (including broadcasts)
          // Use separate queries and combine, or use a union approach
          const { data: directMessages, error: directError } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, name, email),
              recipient:users!messages_recipient_id_fkey(id, name, email),
              parent:messages!messages_parent_message_id_fkey(id, subject, body)
            `)
            .eq('recipient_id', user.id)
            .eq('is_broadcast', false)

          const { data: broadcastMessages, error: broadcastError } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, name, email),
              recipient:users!messages_recipient_id_fkey(id, name, email),
              parent:messages!messages_parent_message_id_fkey(id, subject, body)
            `)
            .eq('is_broadcast', true)

          if (directError || broadcastError) {
            console.error('Error fetching messages:', directError || broadcastError)
            return new Response(JSON.stringify({ 
              error: 'Failed to fetch messages',
              details: (directError || broadcastError)?.message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          const allMessages = [...(directMessages || []), ...(broadcastMessages || [])]
          const sortedMessages = allMessages.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          const paginatedMessages = sortedMessages.slice(offset, offset + limit)

          return new Response(JSON.stringify({ messages: paginatedMessages }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else if (type === 'sent') {
          // Messages sent by user
          query = query.eq('sender_id', user.id)
        } else if (type === 'all') {
          // All messages user is involved in - use separate queries
          const { data: sentMessages, error: sentError } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, name, email),
              recipient:users!messages_recipient_id_fkey(id, name, email),
              parent:messages!messages_parent_message_id_fkey(id, subject, body)
            `)
            .eq('sender_id', user.id)

          const { data: receivedMessages, error: receivedError } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, name, email),
              recipient:users!messages_recipient_id_fkey(id, name, email),
              parent:messages!messages_parent_message_id_fkey(id, subject, body)
            `)
            .eq('recipient_id', user.id)

          const { data: broadcastMessages, error: broadcastError } = await supabaseClient
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, name, email),
              recipient:users!messages_recipient_id_fkey(id, name, email),
              parent:messages!messages_parent_message_id_fkey(id, subject, body)
            `)
            .eq('is_broadcast', true)

          if (sentError || receivedError || broadcastError) {
            console.error('Error fetching messages:', sentError || receivedError || broadcastError)
            return new Response(JSON.stringify({ 
              error: 'Failed to fetch messages',
              details: (sentError || receivedError || broadcastError)?.message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }

          // Combine and deduplicate messages
          const messageMap = new Map()
          ;[...(sentMessages || []), ...(receivedMessages || []), ...(broadcastMessages || [])].forEach(msg => {
            messageMap.set(msg.id, msg)
          })
          const allMessages = Array.from(messageMap.values())
          const sortedMessages = allMessages.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          const paginatedMessages = sortedMessages.slice(offset, offset + limit)

          return new Response(JSON.stringify({ messages: paginatedMessages }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: messages, error: messagesError } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (messagesError) {
          console.error('Error fetching messages:', messagesError)
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch messages',
            details: messagesError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ messages: messages || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get a single message
      case 'getMessage': {
        const { messageId } = params

        if (!messageId) {
          return new Response(JSON.stringify({ error: 'Message ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: message, error: messageError } = await supabaseClient
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email),
            recipient:users!messages_recipient_id_fkey(id, name, email),
            parent:messages!messages_parent_message_id_fkey(id, subject, body)
          `)
          .eq('id', messageId)
          .single()

        if (messageError) {
          return new Response(JSON.stringify({ 
            error: 'Message not found',
            details: messageError.message 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Check if user has access to this message
        if (!isAdmin && message.sender_id !== user.id && message.recipient_id !== user.id && !message.is_broadcast) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ message }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Mark message as read
      case 'markAsRead': {
        const { messageId } = params

        if (!messageId) {
          return new Response(JSON.stringify({ error: 'Message ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Check if user is recipient
        const { data: message, error: checkError } = await supabaseClient
          .from('messages')
          .select('recipient_id, is_broadcast')
          .eq('id', messageId)
          .single()

        if (checkError || !message) {
          return new Response(JSON.stringify({ error: 'Message not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!isAdmin && message.recipient_id !== user.id && !message.is_broadcast) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: updatedMessage, error: updateError } = await supabaseClient
          .from('messages')
          .update({ 
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', messageId)
          .select()
          .single()

        if (updateError) {
          console.error('Error updating message:', updateError)
          return new Response(JSON.stringify({ 
            error: 'Failed to mark message as read',
            details: updateError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ message: updatedMessage }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get unread message count
      case 'getUnreadCount': {
        const { data: count, error: countError } = await supabaseClient
          .rpc('get_unread_message_count', { user_id: user.id })

        if (countError) {
          console.error('Error getting unread count:', countError)
          // Fallback: manual count
          const { count: manualCount } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`)
            .eq('is_read', false)

          return new Response(JSON.stringify({ count: manualCount || 0 }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ count: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get conversation thread
      case 'getConversation': {
        const { otherUserId, limit = 50, offset = 0 } = params

        if (!otherUserId) {
          return new Response(JSON.stringify({ error: 'Other user ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get all messages between current user and other user
        const { data: messages, error: messagesError } = await supabaseClient
          .from('messages')
          .select(`
            *,
            sender:users!messages_sender_id_fkey(id, name, email),
            recipient:users!messages_recipient_id_fkey(id, name, email)
          `)
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (messagesError) {
          console.error('Error fetching conversation:', messagesError)
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch conversation',
            details: messagesError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ messages: messages || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Search users by username (for finding users to message)
      case 'searchUsers': {
        const { query: searchQuery, limit = 20 } = params

        if (!searchQuery || searchQuery.length < 2) {
          return new Response(JSON.stringify({ error: 'Search query must be at least 2 characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: users, error: usersError } = await supabaseClient
          .from('users')
          .select('id, name, email')
          .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .neq('id', user.id) // Don't include current user
          .limit(limit)

        if (usersError) {
          console.error('Error searching users:', usersError)
          return new Response(JSON.stringify({ 
            error: 'Failed to search users',
            details: usersError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ users: users || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Admin: Get all users for broadcast
      case 'getAllUsers': {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: users, error: usersError } = await supabaseClient
          .from('users')
          .select('id, name, email, role')
          .order('name', { ascending: true })

        if (usersError) {
          console.error('Error fetching users:', usersError)
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch users',
            details: usersError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ users: users || [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid action',
          availableActions: [
            'sendMessage',
            'getMessages',
            'getMessage',
            'markAsRead',
            'getUnreadCount',
            'getConversation',
            'searchUsers',
            'getAllUsers'
          ]
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error: any) {
    console.error('❌ Messaging function error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error?.message || String(error)
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
      }
    })
  }
})

