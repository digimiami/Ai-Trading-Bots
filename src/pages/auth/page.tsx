
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/base/Button'
import { Card } from '../../components/base/Card'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const [showFixAuth, setShowFixAuth] = useState(false)
  
  const navigate = useNavigate()
  const { user, loading: authLoading, signIn, signUp } = useAuth()

  // Redirect authenticated users to home page
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard')
    }
  }, [user, authLoading, navigate])

  // Check for invitation code in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const invite = urlParams.get('invite')
    if (invite) {
      setInviteCode(invite)
      setIsLogin(false)
      validateInviteCode(invite)
    }
  }, [])

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card title="Loading...">
          <div className="text-center">
            <p className="text-gray-600">Checking authentication...</p>
          </div>
        </Card>
      </div>
    )
  }

  const validateInviteCode = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/invitation-management?action=validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ code })
      })
      
      const result = await response.json()
      setInviteValid(result.valid)
      
      if (result.valid && result.invitation.email) {
        setEmail(result.invitation.email)
      }
    } catch (err) {
      setInviteValid(false)
    }
  }

  const handleFixAuth = async () => {
    setLoading(true)
    setError(null)

    try {
      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/fix-auth-final`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'digimiami@gmail.com',
          password: 'lagina123'
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setError(null)
        alert('Admin account fixed! You can now login with: digimiami@gmail.com / lagina123')
        setEmail('digimiami@gmail.com')
        setPassword('lagina123')
        setShowFixAuth(false)
      } else {
        setError(result.error || 'Failed to fix admin account')
      }
    } catch (err) {
      setError('Failed to fix admin account')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let result
      
      if (isLogin) {
        result = await signIn(email, password)
        
        // If sign in successful, wait a moment for state to update then navigate
        if (!result.error && result.data?.user) {
          // Wait for auth state to propagate
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Double-check session was set
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            // Session is set, redirect will happen via useEffect
            return
          }
        }
      } else {
        // REQUIRE invitation code for signup
        if (!inviteCode || !inviteCode.trim()) {
          setError('Invitation code is required to create an account. Please contact an admin for an invitation code.')
          setLoading(false)
          return
        }

        // Validate invitation code before signup
        if (inviteValid === false) {
          setError('Invalid or expired invitation code. Please check your invitation code and try again.')
          setLoading(false)
          return
        }

        if (inviteValid === null) {
          // Still validating, wait a moment
          await new Promise(resolve => setTimeout(resolve, 500))
          if (inviteValid === false) {
            setError('Invalid or expired invitation code. Please check your invitation code and try again.')
            setLoading(false)
            return
          }
        }

        result = await signUp(email, password)
        
        // If signup successful, mark invitation code as used
        if (!result.error && result.data?.user && inviteCode) {
          try {
            let activeSession = result.data?.session || null

            if (!activeSession) {
              const loginResult = await supabase.auth.signInWithPassword({ email, password })
              if (loginResult.error) {
                console.warn('Auto sign-in after signup failed:', loginResult.error)
              } else {
                activeSession = loginResult.data?.session || null
              }
            }

            const { data: { session: currentSession } } = await supabase.auth.getSession()
            const accessToken = currentSession?.access_token || activeSession?.access_token

            if (accessToken) {
              const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
              const useResponse = await fetch(`${supabaseUrl}/functions/v1/invitation-management?action=use`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({ 
                  code: inviteCode,
                  userId: result.data?.user?.id 
                })
              })
              
              if (!useResponse.ok) {
                console.error('Failed to mark invitation as used:', await useResponse.text())
              }
            } else {
              console.warn('No access token available to mark invitation as used.')
            }
          } catch (inviteError) {
            console.error('Failed to mark invitation as used:', inviteError)
          }
        }
      }

      if (result.error) {
        setError(result.error.message || 'Authentication failed')
        setLoading(false)
      } else if (isLogin && result.data?.user) {
        // Sign in successful - loading will be managed by redirect
        // Don't set loading to false here to keep "Processing..." until redirect
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to your trading account' : 'Start your trading journey'}
          </p>
          {inviteCode && (
            <div className={`mt-3 p-2 rounded-lg text-sm ${
              inviteValid === true ? 'bg-green-50 text-green-700' : 
              inviteValid === false ? 'bg-red-50 text-red-700' : 
              'bg-yellow-50 text-yellow-700'
            }`}>
              {inviteValid === true ? '✓ Valid invitation code' : 
               inviteValid === false ? '✗ Invalid or expired invitation' : 
               'Validating invitation...'}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
                Invitation Code <span className="text-red-500">*</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={async (e) => {
                  const code = e.target.value
                  setInviteCode(code)
                  if (code.trim()) {
                    await validateInviteCode(code)
                  } else {
                    setInviteValid(null)
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin invitation code"
                required
              />
              {inviteCode && (
                <div className={`mt-2 text-xs ${
                  inviteValid === true ? 'text-green-600' : 
                  inviteValid === false ? 'text-red-600' : 
                  'text-gray-500'
                }`}>
                  {inviteValid === true ? '✓ Valid invitation code' : 
                   inviteValid === false ? '✗ Invalid or expired invitation code' : 
                   'Validating...'}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                An invitation code from an admin is required to create an account.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
              {error.includes('Invalid login credentials') && (
                <button
                  type="button"
                  onClick={() => setShowFixAuth(true)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  Fix Admin Account
                </button>
              )}
            </div>
          )}

          {showFixAuth && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm mb-3">
                Click below to fix the admin account authentication:
              </p>
              <Button
                type="button"
                onClick={handleFixAuth}
                disabled={loading}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                {loading ? 'Fixing...' : 'Fix Admin Account'}
              </Button>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!!(loading || (!isLogin && (!inviteCode || inviteCode.trim() === '' || inviteValid === false)))}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </Card>
    </div>
  )
}
