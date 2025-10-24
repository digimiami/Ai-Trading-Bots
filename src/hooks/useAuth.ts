
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
  }, [])

  const signIn = async (email: string, password: string) => {
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
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
