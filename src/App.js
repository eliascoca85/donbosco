import { useEffect } from 'react'
import { AppProviders } from './components/AppProviders'
import { useRouter, useAuth } from './components/router'
import { hasRole, ROLE_LABELS } from './api/auth'
import { Link } from './components/Link'
import { NavBar, Footer } from './components/NavBar'
import { Crest } from './components/ui'
import { HomePage } from './pages/HomePage'
import { ServicesPage } from './pages/ServicesPage'
import { LeaveRequestForm } from './pages/LeaveRequestForm'
import { LoginPage } from './pages/LoginPage'
import { AdminPage } from './pages/AdminPage'
import { StudentDashboard } from './pages/StudentDashboard'

const SESSION_KEY = 'colegio.redirectAfterLogin'

// Solo los padres de familia solicitan permisos.
const ROUTES = {
  '/': { page: HomePage, footer: true },
  '/servicios': { page: ServicesPage, footer: true },
  '/permisos': { page: LeaveRequestForm, roles: ['parent'] },
  '/dashboard': { page: StudentDashboard, roles: ['student', 'parent'] },
  '/admin': { page: AdminPage, roles: ['admin', 'inspector', 'teacher'] },
}

function Router() {
  const { path } = useRouter()
  const normalized = path.split('?')[0].split('#')[0] || '/'

  if (normalized === '/login') return <LoginPage />

  const route = ROUTES[normalized]
  if (!route) {
    return (
      <Layout footer>
        <Message title="Página no encontrada" text="La dirección que abriste no existe en el sistema del colegio." />
      </Layout>
    )
  }

  const Page = route.page
  return (
    <Layout footer={route.footer}>
      {route.roles ? (
        <RequireAuth roles={route.roles}>
          <Page />
        </RequireAuth>
      ) : (
        <Page />
      )}
    </Layout>
  )
}

function Layout({ footer, children }) {
  return (
    <div className="site">
      <a className="skip-link" href="#contenido" onClick={(e) => {
        e.preventDefault()
        document.getElementById('contenido')?.focus()
      }}>
        Saltar al contenido
      </a>
      <NavBar />
      <main id="contenido" tabIndex={-1}>
        {children}
      </main>
      {footer && <Footer />}
    </div>
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
      navigate('/login')
    }
  }, [user, path, navigate])

  if (!user) return null

  if (!hasRole(user, roles)) {
    const home = user.role === 'parent' || user.role === 'student' ? '/dashboard' : '/admin'
    return (
      <Message
        title="Esta sección no está disponible para tu cuenta"
        text={`Ingresaste como ${ROLE_LABELS[user.role] || user.role}. ${
          roles.includes('parent') && roles.length === 1
            ? 'Solo los padres, madres o tutores registrados por la Dirección pueden solicitar permisos.'
            : 'Usa el menú superior para ir a tus opciones.'
        }`}
        action={
          <Link to={home} className="btn btn-primary">
            Ir a mi panel
          </Link>
        }
      />
    )
  }

  return children
}

function Message({ title, text, action }) {
  return (
    <div className="container message-page">
      <div className="message-card">
        <Crest size={48} />
        <h1>{title}</h1>
        <p>{text}</p>
        {action || (
          <Link to="/" className="btn btn-primary">
            Volver al inicio
          </Link>
        )}
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
