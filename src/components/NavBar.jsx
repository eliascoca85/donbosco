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
          <span className="crest">U</span>
          <span className="lnav-brand-name">
            U.E. <strong>Mariscal Santa Cruz</strong>
          </span>
        </Link>

        <nav className="lnav-links">
          <Link to="/">Inicio</Link>
          <a href="#/#servicios">Servicios</a>
          <a href="#/#contacto">Contacto</a>
          <Link to="/permisos">Solicitar permiso</Link>
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
              <Link to="/login" className="btn ghost">
                Iniciar sesion
              </Link>
              <Link to="/permisos" className="btn primary">
                Solicitar permiso
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
