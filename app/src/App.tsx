import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Header } from './components/layout/header'
import { AUTH_UNAUTHORIZED_EVENT, loadAccessToken } from './lib/auth-token'
import { DashboardPage } from './pages/dashboard-page'
import { ForgotPasswordPage } from './pages/forgot-password-page'
import { LoginPage } from './pages/login-page'
import { ProfilePage } from './pages/profile-page'
import { RegisterPage } from './pages/register-page'
import { SplashPage } from './pages/splash-page'

function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation()
  const hasToken = Boolean(loadAccessToken())

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const showHeader = !['/', '/login', '/forgot-password', '/register'].includes(location.pathname)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUnauthorized = () => {
      navigate('/login', { replace: true })
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized)
    }
  }, [navigate])

  return (
    <div className="min-h-screen">
      {showHeader && <Header />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={(
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/profile"
            element={(
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default App
