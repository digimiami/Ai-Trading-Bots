
import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserWithRole extends User {
  role?: string;
  status?: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessCache, setAccessCache] = useState<Record<string, { role: string; status: string }>>({})

  const fetchUserAccess = useCallback(async (userId: string): Promise<{ role: string; status: string }> => {
    if (accessCache[userId]) {
      return accessCache[userId]
    }

    try {
      const selectAccessInfo = async (includeStatus: boolean) => {
        const columns = includeStatus ? 'role, status' : 'role'
        return supabase
          .from('users')
          .select(columns)
          .eq('id', userId)
          .maybeSingle()
      }

      let { data, error } = await selectAccessInfo(true)

      if (error) {
        const columnMissing = (error as any)?.code === '42703'
        const noRows = (error as any)?.code === 'PGRST116'

        if (columnMissing) {
          ({ data, error } = await selectAccessInfo(false))
          if (!error) {
            const info = {
              role: (data as any)?.role || 'user',
              status: 'active'
            }
            setAccessCache(prev => ({ ...prev, [userId]: info }))
            return info
          }
        }

        if (!noRows) {
          console.error('❌ Error fetching user access info:', error)
        }
        return { role: 'user', status: 'active' }
      }

      const info = {
        role: (data as any)?.role || 'user',
        status: (data as any)?.status || 'active'
      }

      setAccessCache(prev => ({ ...prev, [userId]: info }))
      return info
    } catch (error) {
      console.error('❌ Error fetching user access info:', error)
      return { role: 'user', status: 'active' }
    }
  }, [accessCache])

  const refreshUserRole = async () => {
    if (user?.id) {
      console.log('🔄 Refreshing user access for:', user.email);
      const access = await fetchUserAccess(user.id)
      console.log('🔄 Setting user access to:', access);
      setUser(prev => prev ? { ...prev, role: access.role || 'user', status: access.status || 'active' } : null)
      
      // Force a re-render by updating the state
      setTimeout(() => {
        console.log('🔄 Final user state:', { email: user.email, role: role });
      }, 100);
    }
  }

  // Helper to restore session from localStorage if getSession() times out
  const restoreSessionFromStorage = async (): Promise<any> => {
    try {
      if (typeof window === 'undefined') return null
      
      // Supabase uses format: sb-{project-ref}-auth-token
      // Extract project ref from Supabase URL
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || ''
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'default'
      const expectedKey = `sb-${projectRef}-auth-token`
      
      // Check all keys starting with 'sb-' (in case format is different)
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-'))
      console.log('🔍 Checking localStorage keys:', allKeys, 'Expected:', expectedKey)
      
      // Try expected key first
      const keysToCheck = [expectedKey, ...allKeys.filter(k => k !== expectedKey)]
      
      for (const key of keysToCheck) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            const parsed = JSON.parse(value)
            
            // Check if this looks like a Supabase session
            if (parsed.access_token && parsed.user) {
              console.log('🔍 Found session in localStorage:', key)
              
              // Validate token is not expired
              const expiresAt = parsed.expires_at
              if (expiresAt) {
                const expirationTime = typeof expiresAt === 'number' 
                  ? expiresAt * 1000  // Convert seconds to milliseconds
                  : parseInt(expiresAt) * 1000
                
                if (expirationTime > Date.now()) {
                  console.log('✅ Session valid, expires in', Math.round((expirationTime - Date.now()) / 1000), 'seconds')
                  
                  // Reconstruct session object compatible with Supabase
                  const session = {
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token,
                    expires_in: parsed.expires_in || 3600,
                    expires_at: expiresAt,
                    token_type: parsed.token_type || 'bearer',
                    user: parsed.user
                  }
                  
                  // Try to set session in Supabase client (with timeout)
                  // Note: This is non-blocking - we continue even if it fails
                  supabase.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token
                  }).then(() => {
                    console.log('✅ Session restored to Supabase client')
                  }).catch((setError: any) => {
                    console.warn('⚠️ Could not set session in Supabase client:', setError?.message || setError)
                    // Continue anyway - we have the session data and will use it manually
                  })
                  
                  // Return session immediately - don't wait for setSession
                  return session
                } else {
                  console.log('⚠️ Stored session expired', Math.round((Date.now() - expirationTime) / 1000 / 60), 'minutes ago')
                  // Clear expired session to prevent refresh attempts
                  try {
                    localStorage.removeItem(key)
                    console.log('🧹 Cleared expired session from localStorage')
                  } catch (e) {
                    console.warn('⚠️ Could not clear expired session:', e)
                  }
                }
              } else {
                // No expiration time, assume valid
                console.log('⚠️ Session has no expiration time, assuming valid')
                const session = {
                  access_token: parsed.access_token,
                  refresh_token: parsed.refresh_token,
                  expires_in: parsed.expires_in || 3600,
                  expires_at: parsed.expires_at,
                  token_type: parsed.token_type || 'bearer',
                  user: parsed.user
                }
                
                // Try to set session in Supabase client (non-blocking)
                supabase.auth.setSession({
                  access_token: parsed.access_token,
                  refresh_token: parsed.refresh_token
                }).then(() => {
                  console.log('✅ Session restored to Supabase client (no expiration)')
                }).catch((setError: any) => {
                  console.warn('⚠️ Could not set session in Supabase client:', setError?.message || setError)
                  // Continue anyway - we have the session data
                })
                
                // Return session immediately
                return session
              }
            }
          } catch (e) {
            // Not valid JSON, skip
            continue
          }
        }
      }
      
      console.log('❌ No valid session found in localStorage')
      return null
    } catch (error) {
      console.error('❌ Error restoring session from storage:', error)
      return null
    }
  }

  useEffect(() => {
    let isMounted = true
    let sessionLoaded = false
    let manuallyRestoredSession = false // Track if we restored from localStorage
    
    // Get initial session with timeout and better error handling
    const sessionPromise = Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: any }, error: any }>((resolve) => {
        setTimeout(() => {
          resolve({ data: { session: null }, error: { message: 'Timeout',
            shouldRetry: true } })
        }, 5000)
      })
    ])
    
    sessionPromise
      .then(async (result) => {
        if (!isMounted) return
        
        const { data: { session }, error } = result
        
        // If timeout or error, try to restore from localStorage
        if ((error && error.message === 'Timeout') || !session) {
          console.log('🔍 getSession() timed out or failed, checking localStorage...')
          const restoredSession = await restoreSessionFromStorage()
          
          if (restoredSession) {
            console.log('✅ Restored session from localStorage:', restoredSession.user?.email)
            sessionLoaded = true
            manuallyRestoredSession = true // Mark as manually restored
            
            // Set session first
            setSession(restoredSession as any)
            
            // Set user immediately with metadata role, then fetch real role async
            if (restoredSession.user) {
              // Set user immediately with metadata role to prevent delay
              const metadataRole = restoredSession.user.user_metadata?.role || 'user'
              setUser({ ...restoredSession.user, role: metadataRole, status: 'active' })
              console.log('✅ User set from storage (immediate):', { 
                email: restoredSession.user.email, 
                role: metadataRole,
                status: 'active'
              })
              
              // Fetch real role in background and update
              fetchUserAccess(restoredSession.user.id)
                .then((access) => {
                  if (isMounted && access) {
                    setUser({ ...restoredSession.user!, role: access.role, status: access.status })
                    console.log('✅ User access updated:', { email: restoredSession.user!.email, access })
                  }
                })
                .catch((accessError) => {
                  console.warn('⚠️ Could not fetch access info, using metadata role:', accessError)
                })
            } else {
              setUser(null)
            }
            
            setLoading(false)
            console.log('✅ Session restoration complete, loading set to false')
            
            // Clear the flag after a short delay to allow auth state listener to sync
            setTimeout(() => {
              manuallyRestoredSession = false
            }, 3000)
            
            return
          } else if (error?.shouldRetry) {
            console.log('⏳ Retrying getSession after brief delay...')
            await new Promise(resolve => setTimeout(resolve, 1200))
            const retry = await supabase.auth.getSession()
            if (retry?.data?.session) {
              sessionLoaded = true
              setSession(retry.data.session)
              const access = await fetchUserAccess(retry.data.session.user.id)
              setUser({ ...retry.data.session.user, role: access.role, status: access.status })
              setLoading(false)
              return
            }
          } else {
            console.warn('⚠️ No session found in localStorage')
          }
        }
        
        sessionLoaded = true
        
        if (error && error.message !== 'Timeout') {
          console.error('❌ Session error:', error)
          setSession(null)
          setUser(null)
      setLoading(false)
      return
    }

        console.log('🔐 Initial session:', session ? 'Found' : 'None', session?.user?.email)
        setSession(session)
        if (session?.user) {
          const access = await fetchUserAccess(session.user.id)
          if (access.status !== 'active') {
            console.warn('⚠️ User account is not active, signing out:', { email: session.user.email, status: access.status })
            await supabase.auth.signOut()
            setUser(null)
            setLoading(false)
            return
          }
          setUser({ ...session.user, role: access.role || 'user', status: access.status || 'active' })
          console.log('✅ User loaded:', { email: session.user.email, access })
        } else {
          setUser(null)
        }
        setLoading(false)
      })
      .catch(async (error) => {
        console.error('❌ Auth session error:', error)
        if (!isMounted) return
        
        // Try to restore from localStorage on error
        console.log('🔍 Error occurred, trying to restore from localStorage...')
        const restoredSession = await restoreSessionFromStorage()
        
        if (restoredSession) {
          console.log('✅ Restored session from localStorage after error:', restoredSession.user?.email)
          sessionLoaded = true
          manuallyRestoredSession = true // Mark as manually restored
          
          // Set session
          setSession(restoredSession as any)
          
          // Set user immediately with metadata role
          if (restoredSession.user) {
            const metadataRole = restoredSession.user.user_metadata?.role || 'user'
            setUser({ ...restoredSession.user, role: metadataRole, status: 'active' })
            console.log('✅ User restored after error (immediate):', { 
              email: restoredSession.user.email, 
              role: metadataRole,
              status: 'active' 
            })
            
            // Fetch real role in background
            fetchUserAccess(restoredSession.user.id)
              .then((access) => {
                if (isMounted && access) {
                  setUser({ ...restoredSession.user!, role: access.role, status: access.status })
                  console.log('✅ User access updated after error:', { email: restoredSession.user!.email, access })
                }
              })
              .catch((accessError) => {
                console.warn('⚠️ Could not fetch access info after error:', accessError)
              })
          } else {
            setUser(null)
          }
          
          setLoading(false)
          console.log('✅ Error recovery complete, loading set to false')
          
          // Clear the flag after a short delay
          setTimeout(() => {
            manuallyRestoredSession = false
          }, 3000)
          
          return
        }
        
        console.warn('⚠️ No session in localStorage after error')
        sessionLoaded = true
        setSession(null)
        setUser(null)
        setLoading(false)
      })
    
    // Set a timeout as backup (increased for domain scenarios)
    const timeout = setTimeout(async () => {
      // Only warn if session hasn't loaded after timeout
      if (isMounted && !sessionLoaded) {
        console.warn('⚠️ Auth loading timeout - trying localStorage fallback...')
        
        // Final attempt: restore from localStorage
        const restoredSession = await restoreSessionFromStorage()
        if (restoredSession) {
          console.log('✅ Restored session on timeout:', restoredSession.user?.email)
          sessionLoaded = true
          manuallyRestoredSession = true // Mark as manually restored
          
          // Set session
          setSession(restoredSession as any)
          
          // Set user immediately with metadata role
          if (restoredSession.user) {
            const metadataRole = restoredSession.user.user_metadata?.role || 'user'
            setUser({ ...restoredSession.user, role: metadataRole, status: 'active' })
            console.log('✅ User restored on timeout (immediate):', { 
              email: restoredSession.user.email, 
              role: metadataRole,
              status: 'active'
            })
            
            // Fetch real role in background
            fetchUserAccess(restoredSession.user.id)
              .then((access) => {
                if (isMounted && access) {
                  setUser({ ...restoredSession.user!, role: access.role, status: access.status })
                  console.log('✅ User access updated on timeout:', { email: restoredSession.user!.email, access })
                }
              })
              .catch((accessError) => {
                console.warn('⚠️ Could not fetch access info on timeout:', accessError)
              })
          } else {
            setUser(null)
          }
          
          setLoading(false)
          console.log('✅ Final timeout restore complete')
          
          // Clear the flag after a short delay
          setTimeout(() => {
            manuallyRestoredSession = false
          }, 3000)
          
          return
        }
        
        console.warn('⚠️ No session found in localStorage either')
        setLoading(false)
      }
    }, 8000) // Reduced since we have Promise.race now
    
    // Listen for auth changes
    let subscription: any = null
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔐 Auth state changed:', event, session?.user?.email)
          if (!isMounted) return
          
          // If we just manually restored a session, ignore auth state changes that would clear it
          // unless it's a SIGNED_IN event (which confirms our restoration worked)
          if (manuallyRestoredSession && !session && event !== 'SIGNED_IN') {
            console.log('⚠️ Ignoring auth state change - session was manually restored')
            return
          }
          
          // Only clear user if we're not in the middle of a manual restoration
          if (session?.user) {
            const access = await fetchUserAccess(session.user.id)
            if (access.status !== 'active') {
              console.warn('⚠️ Auth change detected inactive user, signing out:', { email: session.user.email, status: access.status })
              await supabase.auth.signOut()
              setSession(null)
              setUser(null)
              setLoading(false)
              manuallyRestoredSession = false
              return
            }
            setUser({ ...session.user, role: access.role || 'user', status: access.status || 'active' })
            setSession(session)
            console.log('✅ User set from auth state:', { email: session.user.email, access })
            manuallyRestoredSession = false // Clear flag when we get a real auth state
          } else if (!manuallyRestoredSession) {
            // Only clear if we haven't manually restored
            setSession(null)
            setUser(null)
            console.log('❌ User cleared from auth state')
          }
          
          setLoading(false)
        }
      )
      subscription = data?.subscription
    } catch (error) {
      console.error('Auth state change listener error:', error)
      if (isMounted) {
        setLoading(false)
      }
    }

    // Combined cleanup function
    return () => {
      isMounted = false
      clearTimeout(timeout)
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [fetchUserAccess])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
      // If sign in successful, update session and user immediately
      if (data?.session && data?.user && !error) {
        setSession(data.session)
        const access = await fetchUserAccess(data.user.id)
        if (access.status !== 'active') {
          console.warn('⚠️ User attempted to sign in but account is not active:', { email, status: access.status })
          await supabase.auth.signOut()
          setUser(null)
          setSession(null)
          setLoading(false)
          return { data: null, error: { message: `Account is ${access.status}. Please contact support.` } as any }
        }
        setUser({ ...data.user, role: access.role || 'user', status: access.status || 'active' })
        setLoading(false)
        return { data, error: null }
    }
    
      setLoading(false)
    return { data, error }
    } catch (error) {
      console.error('Sign in error:', error)
      setLoading(false)
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
