import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getLeaveRequests,
  updateRequestStatus,
  formatDate,
  formatDay,
  countSchoolDays,
  normalizeStatus,
  Constants,
} from '../api/leaveRequests'
import { useAuth } from '../components/router'
import { ROLE_LABELS, ROLES } from '../api/auth'
import { LeaveFilterBar, EMPTY_FILTERS } from '../components/LeaveFilterBar'
import { LeaveRow } from '../components/LeaveRow'
import { StatusBadge } from '../components/StatusBadge'
import { DecisionModal } from '../components/DecisionModal'
import { EvidencePreview, EvidenceLightbox } from '../components/EvidencePreview'
import { RectorManagementPanel } from '../components/RectorManagementPanel'
import { TeacherManagementPanel } from '../components/TeacherManagementPanel'
import { PageBanner, EmptyState, Toast, Alert } from '../components/ui'

const CLOSED = ['approved', 'rejected', 'cancelled']

export function AdminPage() {
  const { user } = useAuth()
  const isTeacher = user.role === ROLES.TEACHER
  const [tab, setTab] = useState(isTeacher ? 'management' : 'requests')

  const tabs = isTeacher
    ? [
        { id: 'management', label: 'Mis cursos y estudiantes' },
        { id: 'requests', label: 'Permisos de mis cursos' },
      ]
    : [
        { id: 'requests', label: 'Solicitudes de permiso' },
        { id: 'management', label: 'Familias, docentes y cursos' },
      ]

  return (
    <>
      <PageBanner
        eyebrow={ROLE_LABELS[user.role] || user.role}
        title={isTeacher ? `Buen día, ${user.name.split(' ')[0]}` : 'Panel de gestión'}
      >
        {isTeacher
          ? 'Registra a los estudiantes de tus cursos y vincúlalos con sus padres o tutores.'
          : 'Revisa los permisos que envían las familias y administra padres, docentes y cursos.'}
      </PageBanner>

      <div className="container page">
        <div className="tabs" role="tablist" aria-label="Secciones del panel">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'requests' ? (
          <RequestsReview user={user} />
        ) : isTeacher ? (
          <TeacherManagementPanel />
        ) : (
          <RectorManagementPanel />
        )}
      </div>
    </>
  )
}

function RequestsReview({ user }) {
  const canDecide = user.role === ROLES.ADMIN || user.role === ROLES.INSPECTOR
  const [data, setData] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [decision, setDecision] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    const res = await getLeaveRequests()
    setLoading(false)
    if (!res.ok) {
      setLoadError(res.error)
      return
    }
    setLoadError('')
    setData(res.items)
  }, [])

  useEffect(() => {
    let alive = true
    getLeaveRequests().then((res) => {
      if (!alive) return
      setLoading(false)
      if (res.ok) setData(res.items)
      else setLoadError(res.error)
    })
    return () => {
      alive = false
    }
  }, [])

  const courses = useMemo(
    () => [...new Set(data.map((r) => r.course).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [data]
  )
  const filtered = useMemo(() => filterAndSort(data, filters), [data, filters])
  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  )

  const showToast = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const decide = async (mode, { comment }) => {
    if (!selected) return
    setSaving(true)
    const res = await updateRequestStatus(selected.id, mode, { comment })
    setSaving(false)
    if (!res.ok) {
      showToast('danger', res.error)
      // Otra persona pudo resolverla mientras tanto: se recarga para mostrar su estado real.
      setDecision(null)
      load()
      return
    }
    setData((prev) => prev.map((r) => (r.id === res.item.id ? res.item : r)))
    setDecision(null)
    const labels = {
      approved: 'Permiso aprobado. Las faltas quedan justificadas.',
      rejected: 'Permiso rechazado. La familia verá el motivo.',
      info_required: 'Corrección solicitada a la familia.',
    }
    showToast('ok', labels[mode])
  }

  return (
    <>
      <Stats data={data} />

      <LeaveFilterBar
        filters={filters}
        onChange={setFilters}
        courses={courses}
        totalCount={data.length}
        visibleCount={filtered.length}
      />

      <div className="review-grid">
        <section className="card list-card" aria-label="Solicitudes">
          <div className="card-head">
            <h2>Solicitudes</h2>
            <span className="count">{filtered.length}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
              Actualizar
            </button>
          </div>
          <div className="list">
            {loading ? (
              <p className="list-empty">Cargando solicitudes…</p>
            ) : loadError ? (
              <div className="list-empty">
                <Alert tone="danger">{loadError}</Alert>
              </div>
            ) : filtered.length === 0 ? (
              <p className="list-empty">
                {data.length === 0 ? 'Aún no llegaron solicitudes de permiso.' : 'Ninguna solicitud coincide con los filtros.'}
              </p>
            ) : (
              filtered.map((r) => (
                <LeaveRow key={r.id} req={r} active={selected?.id === r.id} onClick={() => setSelectedId(r.id)} />
              ))
            )}
          </div>
        </section>

        <section className="card detail-card" aria-label="Detalle de la solicitud">
          {selected ? (
            <RequestDetail
              req={selected}
              canDecide={canDecide}
              onOpenEvidence={setLightbox}
              onDecide={setDecision}
            />
          ) : (
            <EmptyState title="Selecciona una solicitud">
              Aquí verás el motivo, los documentos adjuntos y el historial del permiso.
            </EmptyState>
          )}
        </section>
      </div>

      {decision && (
        <DecisionModal
          key={selected?.id + ':' + decision}
          mode={decision}
          request={selected}
          onConfirm={decide}
          onClose={() => setDecision(null)}
          loading={saving}
        />
      )}

      {lightbox && (
        <EvidenceLightbox requestId={lightbox.requestId} attachment={lightbox.attachment} onClose={() => setLightbox(null)} />
      )}

      <Toast toast={toast} />
    </>
  )
}

function Stats({ data }) {
  const count = (s) => data.filter((r) => normalizeStatus(r.status) === s).length
  const items = [
    { tone: 'pending', label: 'Pendientes de revisión', value: count('pending') },
    { tone: 'info_required', label: 'Esperando corrección', value: count('info_required') },
    { tone: 'approved', label: 'Aprobadas', value: count('approved') },
    { tone: 'rejected', label: 'Rechazadas', value: count('rejected') },
  ]
  return (
    <div className="stats">
      {items.map((s) => (
        <div key={s.tone} className="stat" data-tone={s.tone}>
          <span className="stat-value">{s.value}</span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function RequestDetail({ req, canDecide, onOpenEvidence, onDecide }) {
  const status = normalizeStatus(req.status)
  const closed = CLOSED.includes(status)
  const days = countSchoolDays(req.start_date, req.end_date)

  return (
    <div className="detail">
      <div className="slip-head">
        <span>Papeleta de permiso</span>
        <span>N.º {req.tracking_code}</span>
      </div>
      <div className="detail-head">
        <div>
          <span className="detail-type">{Constants.TYPE_LABEL[req.request_type] || req.request_type}</span>
          <h2>{req.student_name}</h2>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <dl className="kv-grid">
        <KV k="Desde" v={formatDay(req.start_date)} />
        <KV k="Hasta" v={formatDay(req.end_date)} />
        <KV k="Días de clase" v={days === 1 ? '1 día' : `${days} días`} />
        <KV k="Curso" v={req.course} />
        <KV k="Solicitante" v={req.applicant?.name} />
        <KV k="Teléfono" v={req.applicant?.phone || '—'} />
        <KV k="Enviada el" v={formatDate(req.created_at)} />
        {req.reviewed_by_name && <KV k="Revisada por" v={req.reviewed_by_name} />}
      </dl>

      <h3 className="detail-title">Motivo</h3>
      <p className="reason">{req.reason}</p>

      {req.review_comment && (
        <>
          <h3 className="detail-title">Último comentario de revisión</h3>
          <p className="reason reason-note">{req.review_comment}</p>
        </>
      )}

      <h3 className="detail-title">Documentos adjuntos</h3>
      <EvidencePreview
        attachments={req.attachments}
        onOpen={(attachment) => onOpenEvidence({ requestId: req.id, attachment })}
      />

      <h3 className="detail-title">Historial</h3>
      <Timeline events={req.events} />

      {closed ? (
        <Alert tone="info">Esta solicitud ya fue resuelta y no admite más cambios.</Alert>
      ) : canDecide ? (
        <div className="detail-actions">
          <button type="button" className="btn btn-success" onClick={() => onDecide('approved')}>
            Aprobar
          </button>
          {status !== 'info_required' && (
            <button type="button" className="btn btn-warn" onClick={() => onDecide('info_required')}>
              Solicitar corrección
            </button>
          )}
          <button type="button" className="btn btn-danger" onClick={() => onDecide('rejected')}>
            Rechazar
          </button>
        </div>
      ) : (
        <Alert tone="info">Las decisiones sobre permisos las toma Dirección o Inspectoría.</Alert>
      )}
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="kv">
      <dt>{k}</dt>
      <dd>{v || '—'}</dd>
    </div>
  )
}

function Timeline({ events }) {
  if (!events || events.length === 0) return <p className="muted">Sin movimientos registrados.</p>
  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={i} className="tl-item" data-kind={e.kind || ''}>
          <span className="tl-dot" aria-hidden="true" />
          <div>
            <span className="tl-label">{e.label}</span>
            <span className="tl-when">
              {formatDate(e.at)}
              {e.actor ? ` · ${e.actor}` : ''}
            </span>
            {e.note && <span className="tl-note">{e.note}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function filterAndSort(data, f) {
  const q = f.q.trim().toLowerCase()
  return data
    .filter((r) => {
      if (f.status !== 'all' && normalizeStatus(r.status) !== f.status) return false
      if (f.request_type !== 'all' && r.request_type !== f.request_type) return false
      if (f.course !== 'all' && r.course !== f.course) return false
      if (f.from && new Date(r.end_date) < new Date(f.from + 'T00:00:00')) return false
      if (f.to && new Date(r.start_date) > new Date(f.to + 'T23:59:59')) return false
      if (q) {
        const hay = [r.tracking_code, r.student_name, r.applicant?.name, r.course].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      // Primero lo que espera decisión; luego lo más reciente.
      const rank = (r) => (normalizeStatus(r.status) === 'pending' ? 0 : normalizeStatus(r.status) === 'info_required' ? 1 : 2)
      return rank(a) - rank(b) || new Date(b.created_at) - new Date(a.created_at)
    })
}
