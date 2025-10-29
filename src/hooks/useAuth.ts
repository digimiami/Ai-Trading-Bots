
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
    let isMounted = true
    let sessionLoaded = false
    
    // Get initial session with timeout
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return
        sessionLoaded = true
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
        sessionLoaded = true
        setUser(null)
        setLoading(false)
      })
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      // Only warn if session hasn't loaded after timeout
      if (isMounted && !sessionLoaded) {
        console.warn('Auth loading timeout - continuing without session')
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
  }, [fetchUserRole])

  const signIn = async (email: string, password: string) => {
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
    const { error } = await supabase.auth.signOut()
    setUser(null)
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
