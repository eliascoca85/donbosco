import { useEffect, useMemo, useState } from 'react'
import { Link } from '../components/Link'
import { useAuth, useRouter } from '../components/router'
import {
  getStudentAbsences,
  formatDay,
} from '../api/leaveRequests'
import { ROLE_LABELS, initialsOf } from '../api/auth'

export function StudentDashboard() {
  const { user, logout } = useAuth()
  const { navigate } = useRouter()
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getStudentAbsences(user).then((items) => {
      if (!alive) return
      setAbsences(items)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [user])

  const stats = useMemo(() => {
    const licensed = absences.filter((a) => a.licensed).length
    const unlicensed = absences.length - licensed
    const hoursLicensed = absences
      .filter((a) => a.licensed)
      .reduce((acc) => acc + 6, 0)
    return { total: absences.length, licensed, unlicensed, hoursLicensed }
  }, [absences])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="crest">DB</span>
          <span>U.E. Don Bosco &middot; Mi asistencia</span>
        </div>
        <div className="user">
          <span className="avatar">{initialsOf(user.name)}</span>
          <span className="who">
            {user.name}
            <small>{ROLE_LABELS[user.role] || user.role} &middot; {user.course || '—'}</small>
          </span>
          {user.role === 'parent' && (
            <Link to="/permisos" className="btn primary" style={{ marginLeft: 8 }}>
              Solicitar permiso
            </Link>
          )}
          <button
            className="btn ghost"
            style={{ marginLeft: 4 }}
            onClick={async () => {
              await logout()
              navigate('/')
            }}
          >
            Salir
          </button>
        </div>
      </header>

      <div className="dash-hero">
        <div>
          <span className="hero-eyebrow">Resumen de inasistencias</span>
          <h1>Hola, {user.name.split(' ').slice(0, 2).join(' ')}.</h1>
          <p>
            {user.role === 'parent'
              ? 'Aqui puedes ver las faltas acumuladas de tus estudiantes vinculados, diferenciando las que cuentan con licencia aprobada de las que no.'
              : 'Aqui puedes ver tus faltas acumuladas, diferenciando las que cuentan con licencia aprobada de las que no. Mantenerte al dia con tu asistencia es parte de tu proyecto de vida.'}
          </p>
        </div>
        {user.role === 'parent' && (
          <Link to="/permisos" className="btn primary lg">
            + Solicitar un permiso
          </Link>
        )}
      </div>

      <div className="stats">
        <div className="stat-card" data-kind="info">
          <div className="label">
            <span className="dot" /> Faltas totales
          </div>
          <div className="value">{stats.total}</div>
          <div className="delta">Periodo actual</div>
        </div>
        <div className="stat-card" data-kind="approved">
          <div className="label">
            <span className="dot" /> Con licencia
          </div>
          <div className="value">{stats.licensed}</div>
          <div className="delta">~{stats.hoursLicensed} h justificadas</div>
        </div>
        <div className="stat-card" data-kind="pending">
          <div className="label">
            <span className="dot" /> Sin licencia
          </div>
          <div className="value">{stats.unlicensed}</div>
          <div className="delta">Requiere justificacion</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{user.role === 'parent' ? 'Detalle de faltas de estudiantes vinculados' : 'Detalle de faltas'}</h2>
          <span className="count">{absences.length}</span>
        </div>
        <div className="list">
          {loading ? (
            <div className="dash-empty">
              <div className="big">Cargando asistencia...</div>
            </div>
          ) : absences.length === 0 ? (
            <div className="dash-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <div className="big">Sin faltas registradas</div>
              <p>Tienes asistencia impecable. Felicidades.</p>
            </div>
          ) : (
            absences.map((a) => (
              <AbsenceRow key={a.id} abs={a} showStudent={user.role === 'parent'} />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function AbsenceRow({ abs, showStudent }) {
  const date = new Date(abs.date)
  const day = date.toLocaleDateString('es-BO', { day: '2-digit' })
  const month = date.toLocaleDateString('es-BO', { month: 'short' })
  const weekday =
    abs.weekday.charAt(0).toUpperCase() + abs.weekday.slice(1)
  const time = date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={'ab-row ' + (abs.licensed ? 'lic' : 'nolic')}>
      <div className="ab-date">
        <span className="ab-day">{day}</span>
        <span className="ab-mon">{month}</span>
      </div>
      <div className="ab-main">
        <div className="ab-row1">
          <span className="ab-weekday">{weekday}</span>
          <span
            className={'badge ' + (abs.licensed ? 'ok' : 'warn')}
            data-status={abs.licensed ? 'approved' : 'pending'}
          >
            {abs.licensed ? 'Con licencia' : 'Sin licencia'}
          </span>
        </div>
        <div className="ab-meta">
          <span>{weekday}, {formatDay(abs.date)} &middot; {time}</span>
        </div>
        <div className="ab-reason">{abs.reason}</div>
        {showStudent && abs.student_name && (
          <div className="ab-code">Estudiante: {abs.student_name} · {abs.course || '—'}</div>
        )}
        {abs.licensed && abs.tracking_code && (
          <div className="ab-code">Codigo: {abs.tracking_code}</div>
        )}
      </div>
    </div>
  )
}
