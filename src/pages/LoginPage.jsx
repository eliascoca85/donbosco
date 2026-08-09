import { useState } from 'react'
import { useAuth, useRouter } from '../components/router'
import { Link } from '../components/Link'
import { ROLES } from '../api/auth'

const DEMO = [
  { username: 'estudiante', password: 'cole123', role: ROLES.STUDENT, label: 'Estudiante' },
  { username: 'padre', password: 'cole123', role: ROLES.PARENT, label: 'Padre / Tutor' },
  { username: 'docente', password: 'cole123', role: ROLES.TEACHER, label: 'Docente' },
  { username: 'inspectoria', password: 'cole123', role: ROLES.INSPECTOR, label: 'Inspectoria' },
  { username: 'rectora', password: 'cole123', role: ROLES.ADMIN, label: 'Direccion' },
]

export function LoginPage() {
  const { login, user } = useAuth()
  const { navigate } = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const res = login(form)
      setLoading(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      redirectByRole(res.user.role, navigate)
    }, 350)
  }

  const redirectByRole = (role, nav) => {
    if (role === ROLES.ADMIN || role === ROLES.INSPECTOR || role === ROLES.TEACHER) {
      nav('/admin')
    } else {
      nav('/permisos')
    }
  }

  if (user) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-mark">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>Ya has iniciado sesion</h1>
          <p>
            Bienvenido de nuevo, <strong>{user.name}</strong>.
          </p>
          <button
            className="btn primary"
            onClick={() => redirectByRole(user.role, navigate)}
          >
            Ir a mi panel
          </button>
          <Link to="/" className="btn ghost">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <span className="crest">U</span>
          <h1>Acceso al sistema</h1>
          <p>Inicia sesion para verificar tu identidad y recibir un rol.</p>
        </div>

        <form onSubmit={submit} className="auth-form" noValidate>
          <div className="f-field">
            <label className="f-label">Usuario</label>
            <input
              value={form.username}
              autoFocus
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="usuario"
            />
          </div>
          <div className="f-field">
            <label className="f-label">Contrasena</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="auth-err">{error}</div>}

          <button type="submit" className="btn primary lg" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <div className="auth-divider"><span>o probar con</span></div>
        <div className="auth-demo">
          {DEMO.map((d) => (
            <button
              key={d.username}
              className="demo-chip"
              onClick={() => {
                setForm({ username: d.username, password: d.password })
                setError('')
              }}
              title={`Autocompletar: ${d.username} / ${d.password}`}
            >
              <span className="demo-role">{d.label}</span>
              <span className="demo-user">{d.username}</span>
            </button>
          ))}
        </div>

        <div className="auth-foot">
          <Link to="/permisos">Solicitar permiso sin cuenta</Link>
          <span>·</span>
          <Link to="/">Volver al inicio</Link>
        </div>
      </div>
    </div>
  )
}
