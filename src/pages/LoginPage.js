import { useEffect, useState } from 'react'
import { useAuth, useRouter } from '../components/router'
import { Link } from '../components/Link'
import { ROLES } from '../api/auth'
import { Crest, Field, Alert } from '../components/ui'
import { IMAGENES } from '../colegio'
import { PhotoCredit } from '../components/PhotoCredit'

const REDIRECT_KEY = 'colegio.redirectAfterLogin'

// Cuentas de demostración del seed local.
const DEMO = [
  { username: 'padre', password: 'padre123', label: 'Padre de familia' },
  { username: 'rectora', password: 'rectora123', label: 'Dirección' },
  { username: 'inspectoria', password: 'inspectoria123', label: 'Inspectoría' },
  { username: 'docente', password: 'docente123', label: 'Docente' },
  { username: 'estudiante', password: 'estudiante123', label: 'Estudiante' },
]

function homeFor(role) {
  if (role === ROLES.PARENT || role === ROLES.STUDENT) return '/dashboard'
  if ([ROLES.ADMIN, ROLES.INSPECTOR, ROLES.TEACHER].includes(role)) return '/admin'
  return '/'
}

export function LoginPage() {
  const { login, user, sessionNotice } = useAuth()
  const { navigate } = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let saved = null
    try {
      saved = sessionStorage.getItem(REDIRECT_KEY)
      sessionStorage.removeItem(REDIRECT_KEY)
    } catch {
      /* noop */
    }
    navigate(saved && saved !== '/login' ? saved : homeFor(user.role))
  }, [user, navigate])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password) {
      setError('Escribe tu usuario y tu contraseña.')
      return
    }
    setError('')
    setLoading(true)
    const res = await login({ username: form.username.trim().toLowerCase(), password: form.password })
    setLoading(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="auth">
      <aside className="auth-side" style={{ '--auth-photo': `url(${IMAGENES.plaza.src})` }}>
        <Link to="/" className="auth-back">
          ← Volver al sitio
        </Link>
        <div className="auth-side-body">
          <Crest size={88} />
          <p className="auth-school">Unidad Educativa · Colcapirhua</p>
          <h1 className="auth-title">Don Bosco</h1>
          <p className="auth-motto">«Buenos cristianos y honrados ciudadanos»</p>
        </div>
        <ul className="auth-roles">
          <li>
            <strong>Padres de familia</strong> piden permisos para sus hijos.
          </li>
          <li>
            <strong>Dirección e Inspectoría</strong> los aprueban, rechazan o piden corrección.
          </li>
          <li>
            <strong>Docentes</strong> registran a sus estudiantes y los vinculan con su familia.
          </li>
        </ul>
        <PhotoCredit credito={IMAGENES.plaza.credito} className="on-dark" />
      </aside>

      <main className="auth-main">
        <form className="auth-form stack" onSubmit={submit} noValidate>
          <div>
            <span className="pennant">Sistema de permisos</span>
            <h2>Ingresar</h2>
            <p className="muted">Usa el usuario y la contraseña que te entregó el colegio.</p>
          </div>

          <Field label="Usuario">
            <input
              value={form.username}
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {!error && sessionNotice && <Alert tone="warn">{sessionNotice}</Alert>}
          <Alert tone="danger">{error}</Alert>

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading || Boolean(user)}>
            {loading || user ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="field-hint">¿Olvidaste tu contraseña? Acércate a Secretaría o Inspectoría.</p>

          <div className="demo">
            <span className="demo-title">Cuentas de prueba</span>
            <div className="demo-chips">
              {DEMO.map((d) => (
                <button
                  key={d.username}
                  type="button"
                  className="demo-chip"
                  onClick={() => {
                    setForm({ username: d.username, password: d.password })
                    setError('')
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
