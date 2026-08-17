import { useEffect, useState } from 'react'
import { useAuth, useRouter } from '../components/router'
import { Link } from '../components/Link'
import { ROLES } from '../api/auth'

const REDIRECT_KEY = 'colegio.redirectAfterLogin'
const ADMIN_ROLES = [ROLES.ADMIN, ROLES.INSPECTOR, ROLES.TEACHER]

const DEMO = [
  { username: 'estudiante', password: 'estudiante123', role: ROLES.STUDENT, label: 'Estudiante' },
  { username: 'padre', password: 'padre123', role: ROLES.PARENT, label: 'Padre / Tutor' },
  { username: 'docente', password: 'docente123', role: ROLES.TEACHER, label: 'Docente' },
  { username: 'inspectoria', password: 'inspectoria123', role: ROLES.INSPECTOR, label: 'Inspectoria' },
  { username: 'rectora', password: 'rectora123', role: ROLES.ADMIN, label: 'Direccion' },
]

export function LoginPage() {
  const { login, user } = useAuth()
  const { navigate } = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const takeRedirect = () => {
    let saved
    try {
      saved = sessionStorage.getItem(REDIRECT_KEY)
      sessionStorage.removeItem(REDIRECT_KEY)
    } catch {
      saved = null
    }
    if (!saved || saved === '/login') return null
    return saved
  }

  const redirectAfterLogin = (role) => {
    const saved = takeRedirect()
    if (saved) {
      navigate(saved)
      return
    }
    if (ADMIN_ROLES.includes(role)) {
      navigate('/admin')
    } else if (role === 'student' || role === 'parent') {
      navigate('/dashboard')
    } else {
      navigate('/')
    }
  }

  useEffect(() => {
    if (user) redirectAfterLogin(user.role)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await login(form)
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    redirectAfterLogin(res.user.role)
  }

  if (user) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ alignItems: 'center' }}>
          <div className="auth-mark">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
              <path d="M21 12a9 9 0 1 1-6.2-8.6" />
            </svg>
          </div>
          <h1>Bienvenido, {user.name.split(' ').slice(0, 2).join(' ')}</h1>
          <p>Redirigiendo a tu panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <span className="crest">DB</span>
          <h1>Acceso al sistema</h1>
          <p>Inicia sesion para solicitar un permiso o gestionar licencias.</p>
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
          <Link to="/">Volver al inicio</Link>
        </div>
      </div>
    </div>
  )
}
