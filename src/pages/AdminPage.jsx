import { useEffect, useMemo, useState } from 'react'
import {
  getLeaveRequests,
  updateRequestStatus,
  formatDate,
  computeHours,
  Constants,
} from '../api/leaveRequests'
import { useAuth } from '../components/router'
import { Link } from '../components/Link'
import { ROLE_LABELS, initialsOf, ROLES } from '../api/auth'
import { LeaveFilterBar } from '../components/LeaveFilterBar'
import { LeaveRow } from '../components/LeaveRow'
import { StatusBadge } from '../components/StatusBadge'
import { DecisionModal } from '../components/DecisionModal'
import {
  EvidencePreview,
  EvidenceLightbox,
} from '../components/EvidencePreview'
import { RectorManagementPanel } from '../components/RectorManagementPanel'
import { TeacherManagementPanel } from '../components/TeacherManagementPanel'

const ALLOWED_ROLES = [ROLES.ADMIN, ROLES.INSPECTOR, ROLES.TEACHER]

export function AdminPage() {
  const { user, logout } = useAuth()

  if (!user) {
    return <Gate message="Inicia sesion para acceder al panel de revision." cta />
  }
  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <Gate
        message={`El rol "${ROLE_LABELS[user.role] || user.role}" no tiene acceso al panel de revision.`}
        cta={false}
      />
    )
  }
  return <AdminReviewPanel user={user} logout={logout} />
}

function Gate({ message, cta }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark warn">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1>Acceso restringido</h1>
        <p>{message}</p>
        {cta && (
          <Link to="/login" className="btn primary">
            Iniciar sesion
          </Link>
        )}
        <Link to="/" className="btn ghost">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}

function AdminReviewPanel({ user, logout }) {
  const [data, setData] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'all',
    request_type: 'all',
    course: 'all',
    from: '',
    to: '',
    q: '',
  })
  const [decision, setDecision] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [toast, setToast] = useState(null)
  const [loadingDecision, setLoadingDecision] = useState(false)

  useEffect(() => {
    let alive = true
    getLeaveRequests().then((items) => {
      if (!alive) return
      setData(items)
      setSelectedId(items[0]?.id || null)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => filterAndSort(data, filters), [data, filters])
  const selected = useMemo(
    () => data.find((r) => r.id === selectedId) || filtered[0] || null,
    [data, selectedId, filtered]
  )

  const showToast = (kind, msg) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 2400)
  }

  const canDecide = (mode) => {
    if (user.role === ROLES.ADMIN) return true
    if (user.role === ROLES.INSPECTOR) return mode !== 'approve'
    return mode === 'pre_approve' || mode === 'info_required'
  }

  const decide = async (mode, { comment }) => {
    if (!selected) return
    setLoadingDecision(true)
    const updated = await updateRequestStatus(selected.id, mode, { comment })
    setLoadingDecision(false)
    if (!updated.ok) {
      showToast('danger', updated.error || 'No se pudo actualizar la solicitud.')
      return
    }
    const fresh = await getLeaveRequests()
    setData(fresh)
    setSelectedId(updated.item?.id || selected.id)
    setDecision(null)
    const labels = {
      approve: 'Licencia aprobada — comprobante PDF generado.',
      reject: 'Solicitud rechazada y notificada.',
      info_required: 'Se ha solicitado informacion adicional.',
      pre_approve: 'Pre-dictamen emitido.',
    }
    showToast('success', labels[mode] || 'Accion realizada.')
  }

  const [activeTab, setActiveTab] = useState('requests')
  const reviewerRoleLabel = ROLE_LABELS[user?.role] || ''

  return (
    <div className="app-shell admin-shell">
      <header className="app-header">
        <div className="brand">
          <span className="crest">DB</span>
          <span>U.E. Don Bosco · Panel de control</span>
        </div>
        {(user.role === ROLES.ADMIN || user.role === ROLES.TEACHER) && (
          <div className="nav-tabs" style={{ display: 'flex', gap: 8, margin: '0 16px' }}>
            <button
              className={`btn ${activeTab === 'requests' ? 'primary' : 'ghost'}`}
              onClick={() => setActiveTab('requests')}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              Licencias
            </button>
            <button
              className={`btn ${activeTab === 'management' ? 'primary' : 'ghost'}`}
              onClick={() => setActiveTab('management')}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              {user.role === ROLES.ADMIN ? 'Regencia / Cursos' : 'Alumnos y Cursos'}
            </button>
          </div>
        )}
        <div className="user">
          <span className="avatar">{initialsOf(user.name)}</span>
          <span className="who">
            {user.name}
            <small>{reviewerRoleLabel}</small>
          </span>
          <Link to="/" className="btn ghost" style={{ marginLeft: 8 }}>
            Inicio
          </Link>
          <button className="btn ghost" onClick={logout} style={{ marginLeft: 4 }}>
            Salir
          </button>
        </div>
      </header>

      {activeTab === 'requests' ? (
        <>
          <Stats data={data} />

          {loading ? (
            <div className="panel" style={{ padding: 20, marginBottom: 14 }}>
              Cargando solicitudes...
            </div>
          ) : null}

          <LeaveFilterBar
            filters={filters}
            onChange={setFilters}
            totalCount={data.length}
            visibleCount={filtered.length}
          />

          <div className="review-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Solicitudes entrantes</h2>
                <span className="count">{filtered.length}</span>
              </div>
              <div className="list">
                {filtered.length === 0 ? (
                  <div
                    style={{
                      padding: 32,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    No existen solicitudes que coincidan con los filtros.
                  </div>
                ) : (
                  filtered.map((r) => (
                    <LeaveRow
                      key={r.id}
                      req={r}
                      active={selected && r.id === selected.id}
                      onClick={() => setSelectedId(r.id)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="panel">
              {selected ? (
                <RequestDetail
                  req={selected}
                  canDecide={canDecide}
                  onOpenEvidence={setLightbox}
                  onDecide={setDecision}
                />
              ) : (
                <EmptyState />
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          {user.role === ROLES.ADMIN && <RectorManagementPanel />}
          {user.role === ROLES.TEACHER && <TeacherManagementPanel />}
        </>
      )}

      {decision && (
        <DecisionModal
          key={selected?.id + ':' + decision}
          mode={decision}
          request={selected}
          onConfirm={decide}
          onClose={() => setDecision(null)}
          loading={loadingDecision}
        />
      )}

      {lightbox && (
        <EvidenceLightbox attachment={lightbox} onClose={() => setLightbox(null)} />
      )}

      <Toast toast={toast} />
    </div>
  )
}

function Stats({ data }) {
  const count = (s) => data.filter((r) => r.status === s).length
  return (
    <div className="stats">
      <Stat kind="pending" label="Pendientes" value={count('pending')} />
      <Stat kind="approved" label="Aprobadas" value={count('approved')} />
      <Stat kind="rejected" label="Rechazadas" value={count('rejected')} />
      <Stat
        kind="info"
        label="Requieren info"
        value={count('info_required') + count('pre_approved')}
      />
    </div>
  )
}
function Stat({ kind, label, value }) {
  return (
    <div className="stat-card" data-kind={kind}>
      <div className="label">
        <span className="dot" /> {label}
      </div>
      <div className="value">{value}</div>
      <div className="delta">Ultimos 7 dias</div>
    </div>
  )
}

function RequestDetail({ req, canDecide, onOpenEvidence, onDecide }) {
  const closed =
    req.status === 'approved' || req.status === 'rejected' || req.status === 'cancelled'
  const hours = computeHours(req.start_date, req.end_date)

  return (
    <>
      <div className="panel-head">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            className="avatar"
            style={{
              height: 36,
              display: 'grid',
              placeItems: 'center',
              width: 36,
              borderRadius: '50%',
              background: 'var(--neutral-soft)',
              color: 'var(--neutral)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {req.initials}
          </div>
          <div>
            <h2 style={{ fontSize: 16 }}>{req.applicant.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {req.applicant.course} · {req.applicant.email}
            </div>
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div className="detail">
        <div className="top">
          <div className="who">
            <h1>{Constants.TYPE_LABEL[req.request_type] || req.request_type}</h1>
            <div className="sub">
              Codigo de seguimiento:{' '}
              <span style={{ font: 'var(--mono)', fontFamily: 'var(--mono)' }}>
                {req.tracking_code}
              </span>
            </div>
          </div>
        </div>

        <div className="grid2">
          <KV k="Fecha de inicio" v={formatDate(req.start_date)} />
          <KV k="Fecha de fin" v={formatDate(req.end_date)} />
          <KV k="Horas estimadas" v={`${hours} h`} />
          <KV k="Solicitado el" v={formatDate(req.created_at)} />
          <KV k="Curso / area" v={req.course} />
          <KV k="Contacto" v={<span>{req.applicant.phone || '—'}</span>} />
        </div>

        <div className="section-title">Motivo / justificacion</div>
        <div className="reason-box">{req.reason}</div>

        <div className="section-title">Evidencias adjuntas</div>
        <EvidencePreview attachments={req.attachments} onOpen={onOpenEvidence} />

        <div className="section-title">Historial de auditoria</div>
        <Timeline events={req.events} />

        {!closed ? (
          <div className="actions">
            {canDecide('approve') && (
              <button
                className="btn success"
                onClick={() => onDecide('approve')}
                title="Aprobar (decision final - Administrador)"
              >
                Aprobar
              </button>
            )}
            {canDecide('pre_approve') && (
              <button
                className="btn info"
                onClick={() => onDecide('pre_approve')}
                title="Emitir pre-dictamen"
                style={{
                  background: 'var(--info)',
                  borderColor: 'var(--info)',
                  color: '#fff',
                }}
              >
                Pre-dictamen
              </button>
            )}
            {canDecide('info_required') && (
              <button
                className="btn warn"
                onClick={() => onDecide('info_required')}
                title="Solicitar correccion o mas informacion"
              >
                Solicitar correccion
              </button>
            )}
            {canDecide('reject') && (
              <button
                className="btn danger"
                onClick={() => onDecide('reject')}
                title="Rechazar (con motivo obligatorio)"
              >
                Rechazar
              </button>
            )}
            <div className="spacer" style={{ flex: 1 }} />
            <button className="btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V3h12v6M6 9H4v12h16V9h-2M6 9h12" />
              </svg>
              Descargar PDF
            </button>
          </div>
        ) : (
          <div className="locked-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Esta solicitud esta cerrada. Cualquier cambio requerira reabrir el expediente.
          </div>
        )}
      </div>
    </>
  )
}

function KV({ k, v }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={'v' + (typeof v === 'string' && /^LIC-/.test(v) ? ' mono' : '')}>
        {v}
      </span>
    </div>
  )
}

function Timeline({ events }) {
  if (!events || events.length === 0)
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin eventos.</div>
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div key={i} className={'ev ' + (e.kind || '')}>
          <div className="marker">●</div>
          <div className="body">
            <span className="who">{e.label}</span>
            <span className="when">{formatDate(e.at)}</span>
            {e.note ? <span className="note">{e.note}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="detail-empty">
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h6M9 8h6M5 4h14v16H5z" />
      </svg>
      <div className="big">Seleccione una solicitud</div>
      <p style={{ marginTop: 6, fontSize: 13 }}>
        Elija una peticion a la izquierda para ver el detalle, evidencia adjunta y
        tomar una decision de aprobacion o rechazo.
      </p>
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="toast-wrap">
      <div className={'toast ' + toast.kind}>{toast.msg}</div>
    </div>
  )
}

function filterAndSort(data, f) {
  return data.filter((r) => {
    if (f.status !== 'all' && r.status !== f.status) return false
    if (f.request_type !== 'all' && r.request_type !== f.request_type) return false
    if (f.course !== 'all' && r.course !== f.course) return false
    if (f.from && new Date(r.start_date) < new Date(f.from + 'T00:00:00')) return false
    if (f.to && new Date(r.end_date) > new Date(f.to + 'T23:59:59')) return false
    if (f.q) {
      const q = f.q.toLowerCase()
      const hay = (r.tracking_code + ' ' + r.applicant.name + ' ' + r.course).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
