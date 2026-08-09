import { AppProviders } from './components/AppProviders'
import { useRouter } from './components/router'
import { Link } from './components/Link'
import { NavBar } from './components/NavBar'
import { LandingPage } from './pages/LandingPage'
import { LeaveRequestForm } from './pages/LeaveRequestForm'
import { LoginPage } from './pages/LoginPage'
import { AdminPage } from './pages/AdminPage'

function Router() {
  const { path } = useRouter()
  const normalized = path.split('?')[0].split('#')[0]

  if (normalized === '/' || normalized === '') {
    return (
      <>
        <NavBar />
        <LandingPage />
      </>
    )
  }
  if (normalized === '/permisos') {
    return (
      <>
        <NavBar />
        <LeaveRequestForm />
      </>
    )
  }
  if (normalized === '/login') {
    return (
      <>
        <NavBar />
        <LoginPage />
      </>
    )
  }
  if (normalized === '/admin') {
    return (
      <>
        <NavBar />
        <AdminPage />
      </>
    )
  }
  return (
    <>
      <NavBar />
      <NotFound />
    </>
  )
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
