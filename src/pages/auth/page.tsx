
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/base/Button'
import { Card } from '../../components/base/Card'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)
  const [showFixAuth, setShowFixAuth] = useState(false)
  
  const navigate = useNavigate()
  const { user, loading: authLoading, signIn, signUp } = useAuth()

  // Redirect authenticated users - new users go to pricing to pay first
  useEffect(() => {
    if (!authLoading && user) {
      // For new signups or users coming from auth flow, redirect to pricing page to pay before using the app
      // This ensures users create an invoice and pay before accessing the dashboard
      const currentPath = window.location.pathname
      const isAuthPage = currentPath === '/auth' || currentPath.startsWith('/auth/')
      const isRoot = currentPath === '/'
      
      if (isAuthPage || isRoot) {
        // New signup or returning from email confirmation - redirect to pricing to pay
        navigate('/pricing', { replace: true })
      }
      // If already on another page (like /dashboard), don't redirect (let them stay there)
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess('Password reset email sent! Please check your inbox.')
        setTimeout(() => {
          setIsForgotPassword(false)
          setSuccess(null)
        }, 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
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
        // Free signup - no invitation code required
        // Users will automatically get the Testing plan with 14-day trial
        result = await signUp(email, password)
        
        // Check if email confirmation is required
        if (!result.error && result.data?.user) {
          // Check if user needs to confirm email
          if (!result.data.user.email_confirmed_at) {
            setSuccess('✅ Account created successfully! Please check your email inbox to confirm your account. Once confirmed, you can sign in.')
            setLoading(false)
            // Clear form
            setEmail('')
            setPassword('')
            // Switch to login after showing message
            setTimeout(() => {
              setIsLogin(true)
              setSuccess(null)
            }, 8000)
            return
          } else {
            // Email already confirmed (shouldn't happen normally, but handle it)
            setSuccess('✅ Account created successfully! Redirecting to pricing to select a plan...')
            setLoading(false)
            // Redirect to pricing page so user can pay before using the app
            setTimeout(() => {
              navigate('/pricing')
            }, 1500)
            return
          }
        }
        
        // Optional: If invitation code was provided, mark it as used (but not required)
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
        // Handle rate limiting errors with a user-friendly message
        if (result.error.message?.includes('429') || result.error.message?.toLowerCase().includes('rate limit') || result.error.message?.toLowerCase().includes('too many requests')) {
          setError('Too many signup attempts. Please wait a few minutes before trying again.')
        } else {
          setError(result.error.message || 'Authentication failed')
        }
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
        <div className="flex justify-center mb-6">
          <img 
            src="https://dkawxgwdqiirgmmjbvhc.supabase.co/storage/v1/object/public/profile-images/logo.png" 
            alt="Pablo Logo" 
            className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
          />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600">
            {isForgotPassword 
              ? 'Enter your email to receive a password reset link' 
              : isLogin 
              ? 'Sign in to your trading account' 
              : 'Start your trading journey'}
          </p>
          {inviteCode && !isForgotPassword && (
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

        <form onSubmit={isForgotPassword ? handlePasswordReset : handleSubmit} className="space-y-6">
          {!isLogin && !isForgotPassword && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <i className="ri-gift-line mr-2"></i>
                <strong>Free 14-Day Trial!</strong> Start with 1 bot and 10 trades/day. No credit card required.
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

          {!isForgotPassword && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true)
                      setError(null)
                      setSuccess(null)
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
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
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
              {error.includes('Invalid login credentials') && !isForgotPassword && (
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

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-600 text-sm">{success}</p>
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
            disabled={loading}
          >
            {loading 
              ? 'Processing...' 
              : isForgotPassword 
              ? 'Send Reset Link' 
              : isLogin 
              ? 'Sign In' 
              : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {isForgotPassword ? (
            <button
              onClick={() => {
                setIsForgotPassword(false)
                setError(null)
                setSuccess(null)
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
                setSuccess(null)
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
