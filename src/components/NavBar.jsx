import { Link } from './Link'
import { useAuth, useRouter } from './router'
import { ROLE_LABELS, initialsOf } from '../api/auth'

export function NavBar() {
  const { user, logout } = useAuth()
  const { navigate } = useRouter()

  return (
    <header className="lnav">
      <div className="lnav-inner">
        <Link to="/" className="lnav-brand">
          <span className="crest">DB</span>
          <span className="lnav-brand-name">
            U.E. <strong>Don Bosco</strong>
          </span>
        </Link>

        <nav className="lnav-links">
          <Link to="/">Inicio</Link>
          <Link to="/servicios">Servicios</Link>
          <a href="#/#contacto">Contacto</a>
          {user && (user.role === 'parent' || user.role === 'admin') && <Link to="/permisos">Solicitar permiso</Link>}
        </nav>

        <div className="lnav-user">
          {user ? (
            <>
              <span
                className="lnav-avatar"
                title={ROLE_LABELS[user.role] || user.role}
              >
                {initialsOf(user.name)}
              </span>
              <span className="lnav-user-info">
                <span className="lnav-user-name">{user.name}</span>
                <span className="lnav-user-role">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </span>
              {(user.role === 'admin' ||
                user.role === 'inspector' ||
                user.role === 'teacher') && (
                <Link
                  to="/admin"
                  className="btn primary"
                  style={{ marginLeft: 8 }}
                >
                  Panel
                </Link>
              )}
              {(user.role === 'parent' || user.role === 'admin') && (
                <Link to="/permisos" className="btn primary" style={{ marginLeft: 8 }}>
                  Solicitar permiso
                </Link>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn primary">
                Iniciar sesion
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
