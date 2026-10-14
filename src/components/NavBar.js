import { useEffect, useRef, useState } from 'react'
import { Link } from './Link'
import { Crest } from './ui'
import { useAuth, useRouter } from './router'
import { ROLE_LABELS, initialsOf } from '../api/auth'
import { COLEGIO } from '../colegio'

// Cada rol ve solo los accesos que le corresponden.
function linksFor(user) {
  if (!user) {
    return [
      { to: '/', label: 'Inicio' },
      { to: '/servicios', label: 'Permisos escolares' },
      { href: '#/#contacto', label: 'Contacto' },
    ]
  }
  switch (user.role) {
    case 'parent':
      return [
        { to: '/dashboard', label: 'Mis solicitudes' },
        { to: '/permisos', label: 'Solicitar permiso' },
      ]
    case 'student':
      return [{ to: '/dashboard', label: 'Mi asistencia' }]
    case 'admin':
    case 'inspector':
      return [{ to: '/admin', label: 'Panel de gestión' }]
    case 'teacher':
      return [{ to: '/admin', label: 'Mis cursos' }]
    default:
      return []
  }
}

function NavLinks({ links, current, className }) {
  return (
    <nav className={className} aria-label="Principal">
      {links.map((l) =>
        l.to ? (
          <Link key={l.label} to={l.to} aria-current={current === l.to ? 'page' : undefined}>
            {l.label}
          </Link>
        ) : (
          <a key={l.label} href={l.href}>
            {l.label}
          </a>
        )
      )}
    </nav>
  )
}

// Cierra un panel desplegable con Escape o con un clic fuera de él.
function useDismiss(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, setOpen, ref])
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(open, setOpen, ref)

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-chip"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {initialsOf(user.name)}
        </span>
        <span className="user-chip-text">
          <span className="user-chip-name">{user.name}</span>
          <span className="user-chip-role">{ROLE_LABELS[user.role] || user.role}</span>
        </span>
        <svg className="chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {open && (
        <div className="user-pop">
          <div className="user-pop-head">
            <strong>{user.name}</strong>
            <span>
              {ROLE_LABELS[user.role] || user.role} · @{user.username}
            </span>
          </div>
          <button type="button" className="user-pop-item" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function NavBar() {
  const { user, logout } = useAuth()
  const { path } = useRouter()
  const current = path.split('?')[0].split('#')[0]
  const links = linksFor(user)
  const [menuOpen, setMenuOpen] = useState(false)
  const barRef = useRef(null)
  useDismiss(menuOpen, setMenuOpen, barRef)

  // Al cambiar de pagina el menu del celular se cierra solo.
  const [lastPath, setLastPath] = useState(path)
  if (lastPath !== path) {
    setLastPath(path)
    setMenuOpen(false)
  }

  return (
    <header className="topbar" ref={barRef}>
      <div className="utility" aria-label="Datos del colegio">
        <div className="container utility-inner">
          <span>
            {COLEGIO.nombreCompleto} · Obra salesiana
          </span>
          <span>
            {COLEGIO.municipio}, {COLEGIO.departamento}
            {COLEGIO.telefono ? ` · Tel. ${COLEGIO.telefono}` : ''} · Secretaría: {COLEGIO.horario.toLowerCase()}
          </span>
        </div>
      </div>

      <div className="topbar-inner container">
        <Link to="/" className="brand" aria-label="U.E. Don Bosco Colcapirhua, inicio">
          <Crest size={34} />
          <span className="brand-text">
            <span className="brand-sub">U.E. · Colcapirhua</span>
            <span className="brand-name">Don Bosco</span>
          </span>
        </Link>

        <NavLinks links={links} current={current} className="topnav" />

        <div className="topbar-user">
          {user ? (
            <UserMenu user={user} onLogout={logout} />
          ) : (
            <Link to="/login" className="btn btn-accent btn-sm">
              Ingresar
            </Link>
          )}
        </div>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="menu-icon" aria-hidden="true" data-open={menuOpen}>
            <span />
            <span />
            <span />
          </span>
          {menuOpen ? 'Cerrar' : 'Menú'}
        </button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="mobile-menu">
          <div className="container">
            <NavLinks links={links} current={current} className="mobile-nav" />
            <div className="mobile-user">
              {user ? (
                <>
                  <span className="user-chip is-static">
                    <span className="avatar" aria-hidden="true">
                      {initialsOf(user.name)}
                    </span>
                    <span className="user-chip-text">
                      <span className="user-chip-name">{user.name}</span>
                      <span className="user-chip-role">{ROLE_LABELS[user.role] || user.role}</span>
                    </span>
                  </span>
                  <button type="button" className="btn btn-on-dark btn-sm" onClick={logout}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn-accent btn-block">
                  Ingresar al sistema
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="stripe" aria-hidden="true" />
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Crest size={28} />
          <span>
            U.E. Don Bosco Colcapirhua · Cochabamba · Obra salesiana · {new Date().getFullYear()}
          </span>
        </div>
        <nav className="footer-links" aria-label="Pie de página">
          <Link to="/">Inicio</Link>
          <Link to="/servicios">Permisos escolares</Link>
          <a href="#/#contacto">Contacto</a>
        </nav>
      </div>
    </footer>
  )
}
