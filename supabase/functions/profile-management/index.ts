import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, ...params } = await req.json()

    switch (action) {
      case 'updateProfile':
        const { name, bio, location, website, profilePicture } = params
        
        // Ensure user exists in users table
        const { data: existingUser, error: userCheckError } = await supabaseClient
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (userCheckError && userCheckError.code === 'PGRST116') {
          // User doesn't exist, create them
          const { error: createUserError } = await supabaseClient
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              role: 'user',
              name: name || user.email?.split('@')[0] || 'User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (createUserError) {
            console.error('Error creating user:', createUserError)
            throw createUserError
          }
        }

        // Update user profile
        const { data: updatedUser, error: updateError } = await supabaseClient
          .from('users')
          .update({
            name: name || existingUser?.name,
            bio: bio || null,
            location: location || null,
            website: website || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()
          .single()

        if (updateError) throw updateError

        // Handle profile picture upload if provided
        let profilePictureUrl = null
        if (profilePicture) {
          try {
            // Convert base64 to buffer
            const base64Data = profilePicture.split(',')[1]
            const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
            
            // Generate unique filename
            const fileExt = 'jpg' // Default to jpg
            const fileName = `profile-${user.id}-${Date.now()}.${fileExt}`
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
              .from('profile-images')
              .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: true
              })

            if (uploadError) {
              console.error('Profile picture upload error:', uploadError)
              // Don't throw error, just log it - profile update should still succeed
            } else {
              // Get public URL
              const { data: urlData } = supabaseClient.storage
                .from('profile-images')
                .getPublicUrl(fileName)
              
              profilePictureUrl = urlData.publicUrl
              
              // Update user with profile picture URL
              await supabaseClient
                .from('users')
                .update({ profile_picture_url: profilePictureUrl })
                .eq('id', user.id)
            }
          } catch (imageError) {
            console.error('Profile picture processing error:', imageError)
            // Don't throw error, just log it
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          user: updatedUser,
          profilePictureUrl 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'getProfile':
        const { data: profile, error: profileError } = await supabaseClient
          .from('users')
          .select('id, email, name, bio, location, website, profile_picture_url, created_at, updated_at')
          .eq('id', user.id)
          .single()

        if (profileError && profileError.code === 'PGRST116') {
          // User doesn't exist, return default profile
          return new Response(JSON.stringify({ 
            profile: {
              id: user.id,
              email: user.email,
              name: user.email?.split('@')[0] || 'User',
              bio: null,
              location: null,
              website: null,
              profile_picture_url: null
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (profileError) throw profileError

        return new Response(JSON.stringify({ profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Profile management error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

