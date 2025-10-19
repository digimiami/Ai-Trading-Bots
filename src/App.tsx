
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './router'
import { useAuth } from './hooks/useAuth'
import AuthPage from './pages/auth/page'
import { Header } from './components/feature/Header'
import Navigation from './components/feature/Navigation'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="pt-16 pb-20">
          <AppRoutes />
        </main>
        <Navigation />
      </div>
    </BrowserRouter>
  )
}

export default App
