
import { useState, useEffect, useCallback, useMemo } from 'react'
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
        email_change_confirm_status: 0,
        banned_until: '',
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

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const role = await fetchUserRole(session.user.id)
        setUser({ ...session.user, role: role || 'user' })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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

    return () => subscription.unsubscribe()
  }, [DEMO_MODE])

  const signIn = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode - simulate successful login
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
        email_change_confirm_status: 0,
        banned_until: '',
        reauthentication_sent_at: '',
        reauthentication_confirm_status: 0,
        is_sso_user: false,
        deleted_at: '',
        is_anonymous: false,
      }
      setUser(mockUser)
      return { data: { user: mockUser }, error: null }
    }

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
  }

  const signUp = async (email: string, password: string) => {
    if (DEMO_MODE) {
      // Demo mode - simulate successful signup
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
        email_change_confirm_status: 0,
        banned_until: '',
        reauthentication_sent_at: '',
        reauthentication_confirm_status: 0,
        is_sso_user: false,
        deleted_at: '',
        is_anonymous: false,
      }
      setUser(mockUser)
      return { data: { user: mockUser }, error: null }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
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
