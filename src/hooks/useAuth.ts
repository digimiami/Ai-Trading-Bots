
import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserWithRole extends User {
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleCache, setRoleCache] = useState<Record<string, string>>({})

  // Demo mode - bypass authentication for testing
  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1'
  
  // Debug logging
  console.log('🔍 Auth Debug:', {
    VITE_DEMO_MODE: import.meta.env.VITE_DEMO_MODE,
    DEMO_MODE_ENABLED: DEMO_MODE,
    SUPABASE_URL: import.meta.env.VITE_PUBLIC_SUPABASE_URL
  })

  const fetchUserRole = useCallback(async (userId: string): Promise<string | null> => {
    // Check cache first
    if (roleCache[userId]) {
      return roleCache[userId];
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('❌ Error fetching user role:', error)
        return 'user'
      }
      
      const role = data?.role || 'user';
      
      // Cache the role
      setRoleCache(prev => ({ ...prev, [userId]: role }));
      
      return role;
    } catch (error) {
      console.error('❌ Error fetching user role:', error)
      return 'user'
    }
  }, [roleCache])

  const refreshUserRole = async () => {
    if (user?.id) {
      console.log('🔄 Refreshing user role for:', user.email);
      const role = await fetchUserRole(user.id)
      console.log('🔄 Setting user role to:', role);
      setUser(prev => prev ? { ...prev, role: role || 'user' } : null)
      
      // Force a re-render by updating the state
      setTimeout(() => {
        console.log('🔄 Final user state:', { email: user.email, role: role });
      }, 100);
    }
  }

  useEffect(() => {
    if (DEMO_MODE) {
      // Demo mode - create a mock user
      const mockUser: UserWithRole = {
        id: 'demo-user-id',
        email: 'demo@example.com',
        role: 'admin',
        user_metadata: { name: 'Demo User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phone: '',
        confirmation_sent_at: '',
        recovery_sent_at: '',
        email_change_sent_at: '',
        new_email: '',
        new_phone: '',
        invited_at: '',
        action_link: '',
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: '',
        confirmed_at: new Date().toISOString(),
        reauthentication_sent_at: '',
        reauthentication_confirm_status: 0,
        is_sso_user: false,
        deleted_at: '',
        is_anonymous: false,
      }
      setUser(mockUser)
      setLoading(false)
      return
    }

    let isMounted = true
    
    // Get initial session with timeout
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return
        setSession(session)
        if (session?.user) {
          const role = await fetchUserRole(session.user.id)
          setUser({ ...session.user, role: role || 'user' })
        } else {
          setUser(null)
        }
        setLoading(false)
      })
      .catch((error) => {
        console.error('Auth session error:', error)
        if (!isMounted) return
        setUser(null)
        setLoading(false)
      })
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn('Auth loading timeout - setting loading to false')
      if (isMounted) {
        setLoading(false)
      }
    }, 5000) // 5 second timeout
    
    // Listen for auth changes
    let subscription: any = null
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          setSession(session)
          if (session?.user) {
            const role = await fetchUserRole(session.user.id)
            setUser({ ...session.user, role: role || 'user' })
          } else {
            setUser(null)
          }
          setLoading(false)
        }
      )
      subscription = data?.subscription
    } catch (error) {
      console.error('Auth state change listener error:', error)
    }

    // Combined cleanup function
    return () => {
      isMounted = false
      clearTimeout(timeout)
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [DEMO_MODE, fetchUserRole])

  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode - simulate successful login
      console.log('✅ DEMO MODE: Signing in with demo user')
      const mockUser: UserWithRole = {
        id: 'demo-user-id',
        email: email || 'demo@example.com',
        role: 'admin',
        user_metadata: { name: 'Demo User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phone: '',
        confirmation_sent_at: '',
        recovery_sent_at: '',
        email_change_sent_at: '',
        new_email: '',
        new_phone: '',
        invited_at: '',
        action_link: '',
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: '',
        confirmed_at: new Date().toISOString(),
        reauthentication_sent_at: '',
        reauthentication_confirm_status: 0,
        is_sso_user: false,
        deleted_at: '',
        is_anonymous: false,
      }
      console.log('✅ DEMO MODE: Setting user and returning success')
      setUser(mockUser)
      // Add small delay to simulate network
      await new Promise(resolve => setTimeout(resolve, 100))
      return { data: { user: mockUser, session: null }, error: null }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      // If sign in successful, fetch user role
      if (data?.user && !error) {
        const role = await fetchUserRole(data.user.id)
        setUser({ ...data.user, role: role || 'user' })
      }
      
      return { data, error }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error: error as any }
    }
  }

  const signUp = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode - simulate successful signup
      console.log('✅ DEMO MODE: Signing up with demo user')
      const mockUser: UserWithRole = {
        id: 'demo-user-id',
        email: email || 'demo@example.com',
        role: 'admin',
        user_metadata: { name: 'Demo User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phone: '',
        confirmation_sent_at: '',
        recovery_sent_at: '',
        email_change_sent_at: '',
        new_email: '',
        new_phone: '',
        invited_at: '',
        action_link: '',
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: '',
        confirmed_at: new Date().toISOString(),
        reauthentication_sent_at: '',
        reauthentication_confirm_status: 0,
        is_sso_user: false,
        deleted_at: '',
        is_anonymous: false,
      }
      console.log('✅ DEMO MODE: Setting user and returning success')
      setUser(mockUser)
      // Add small delay to simulate network
      await new Promise(resolve => setTimeout(resolve, 100))
      return { data: { user: mockUser, session: null }, error: null }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error: error as any }
    }
  }

  const signOut = async () => {
    if (DEMO_MODE) {
      // Demo mode - simulate sign out
      setUser(null)
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUserRole,
  }
}
