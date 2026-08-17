import { useEffect } from 'react'
import { AppProviders } from './components/AppProviders'
import { useRouter, useAuth } from './components/router'
import { hasRole } from './api/auth'
import { Link } from './components/Link'
import { NavBar } from './components/NavBar'
import { HomePage } from './pages/HomePage'
import { ServicesPage } from './pages/ServicesPage'
import { LeaveRequestForm } from './pages/LeaveRequestForm'
import { LoginPage } from './pages/LoginPage'
import { AdminPage } from './pages/AdminPage'
import { StudentDashboard } from './pages/StudentDashboard'

const ROLES_SOLICITANTE = ['parent']

const SESSION_KEY = 'colegio.redirectAfterLogin'

function Router() {
  const { path } = useRouter()
  const normalized = path.split('?')[0].split('#')[0]

  if (normalized === '/' || normalized === '') {
    return (
      <>
        <NavBar />
        <HomePage />
      </>
    )
  }
  if (normalized === '/servicios') {
    return (
      <>
        <NavBar />
        <ServicesPage />
      </>
    )
  }
  if (normalized === '/permisos') {
    return (
      <RequireAuth roles={ROLES_SOLICITANTE}>
        <LeaveRequestForm />
      </RequireAuth>
    )
  }
  if (normalized === '/login') {
    return <LoginPage />
  }
  if (normalized === '/dashboard') {
    return (
      <RequireAuth roles={['student', 'parent']}>
        <StudentDashboard />
      </RequireAuth>
    )
  }
  if (normalized === '/admin') {
    return (
      <RequireAuth roles={['admin', 'inspector', 'teacher']}>
        <AdminPage />
      </RequireAuth>
    )
  }
  return (
    <>
      <NavBar />
      <NotFound />
    </>
  )
}

function RequireAuth({ roles, children }) {
  const { user } = useAuth()
  const { path, navigate } = useRouter()

  useEffect(() => {
    if (!user) {
      try {
        sessionStorage.setItem(SESSION_KEY, path)
      } catch {
        /* noop */
      }
      if (path !== '/login') navigate('/login')
    }
  }, [user, path, navigate])

  if (!user) return null

  if (roles && roles.length > 0 && !hasRole(user, roles)) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-mark warn">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </div>
          <h1>Acceso no autorizado</h1>
          <p>
            Tu rol ({user.role}) no tiene permiso para ver esta seccion.
          </p>
          <Link to="/" className="btn primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* noop */
  }
  return children
}

function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>404 — Pagina no encontrada</h1>
        <p>La ruta solicitada no existe en el sistema del colegio.</p>
        <Link to="/" className="btn primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}

function App() {
  return (
    <AppProviders>
      <Router />
    </AppProviders>
  )
}

export default App
