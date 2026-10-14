import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '../components/Link'
import { useAuth } from '../components/router'
import {
  getStudentAbsences,
  getLeaveRequests,
  resubmitLeaveRequest,
  formatDay,
  formatDate,
  toInputDate,
  normalizeStatus,
  Constants,
} from '../api/leaveRequests'
import { StatusBadge } from '../components/StatusBadge'
import { PageBanner, EmptyState, Modal, Alert, Toast } from '../components/ui'
import { LeaveFields, validateLeave } from './LeaveRequestForm'

export function StudentDashboard() {
  const { user, refreshUser } = useAuth()
  const isParent = user.role === 'parent'
  const [absences, setAbsences] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let alive = true
    // El perfil se pide de nuevo: el docente pudo vincular o quitar hijos desde el ultimo ingreso.
    refreshUser()
    Promise.all([getStudentAbsences(), getLeaveRequests()]).then(([abs, reqs]) => {
      if (!alive) return
      setAbsences(abs.ok ? abs.items : [])
      setRequests(reqs.ok ? reqs.items : [])
      setLoadError(!reqs.ok ? reqs.error : !abs.ok ? abs.error : '')
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [refreshUser])

  const showToast = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // Solo quien envio la solicitud puede corregirla; el otro padre o tutor la ve en modo lectura.
  const isMine = (r) => r.applicant_id === user.id
  const needsCorrection = requests.filter((r) => r.status === 'info_required' && isMine(r))
  const stats = useMemo(() => {
    const licensed = absences.filter((a) => a.licensed).length
    return {
      total: absences.length,
      licensed,
      unlicensed: absences.length - licensed,
      open: requests.filter((r) => ['pending', 'info_required'].includes(normalizeStatus(r.status))).length,
    }
  }, [absences, requests])

  const firstName = user.name.split(' ')[0]
  const children = user.linkedStudents || []

  return (
    <>
      <PageBanner
        eyebrow={isParent ? 'Padres de familia' : user.studentCourse || user.course || 'Estudiante'}
        title={`Hola, ${firstName}`}
        actions={
          isParent && (
            <Link to="/permisos" className="btn btn-accent btn-lg">
              Solicitar permiso
            </Link>
          )
        }
      >
        {isParent
          ? children.length
            ? `Aquí sigues los permisos y la asistencia de ${children.map((c) => c.name.split(' ')[0]).join(', ')}.`
            : 'Cuando el profesor vincule a tus hijos con tu cuenta, podrás pedir permisos para ellos.'
          : 'Aquí ves tus faltas y los permisos que tu familia pidió para ti.'}
      </PageBanner>

      <div className="container page">
        <Alert tone="danger">{loadError}</Alert>
        {needsCorrection.length > 0 && isParent && (
          <div className="callout" role="status">
            <strong>
              {needsCorrection.length === 1
                ? 'Una solicitud necesita tu corrección'
                : `${needsCorrection.length} solicitudes necesitan tu corrección`}
            </strong>
            <span>Revisa el comentario del colegio y reenvíala.</span>
          </div>
        )}

        <div className="stats">
          <div className="stat" data-tone="pending">
            <span className="stat-value">{stats.open}</span>
            <span className="stat-label">Permisos en trámite</span>
          </div>
          <div className="stat" data-tone="approved">
            <span className="stat-value">{stats.licensed}</span>
            <span className="stat-label">Faltas justificadas</span>
          </div>
          <div className="stat" data-tone="rejected">
            <span className="stat-value">{stats.unlicensed}</span>
            <span className="stat-label">Faltas sin justificar</span>
          </div>
        </div>

        <div className="dash-grid">
          <section className="card" aria-labelledby="req-title">
            <div className="card-head">
              <h2 id="req-title">{isParent ? 'Mis solicitudes de permiso' : 'Permisos a mi nombre'}</h2>
              <span className="count">{requests.length}</span>
            </div>
            {loading ? (
              <p className="list-empty">Cargando…</p>
            ) : requests.length === 0 ? (
              <EmptyState
                title="Sin solicitudes todavía"
                action={
                  isParent &&
                  children.length > 0 && (
                    <Link to="/permisos" className="btn btn-primary btn-sm">
                      Solicitar el primer permiso
                    </Link>
                  )
                }
              >
                {isParent ? 'Cuando envíes un permiso, aquí verás en qué estado está.' : null}
              </EmptyState>
            ) : (
              <ul className="req-list">
                {requests.map((r) => (
                  <RequestItem
                    key={r.id}
                    req={r}
                    canFix={isParent && isMine(r)}
                    otherApplicant={isParent && !isMine(r) ? r.applicant?.name : null}
                    onFix={() => setEditing(r)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="abs-title">
            <div className="card-head">
              <h2 id="abs-title">Registro de faltas</h2>
              <span className="count">{absences.length}</span>
            </div>
            {loading ? (
              <p className="list-empty">Cargando…</p>
            ) : absences.length === 0 ? (
              <EmptyState title="Sin faltas registradas">¡Asistencia completa en este periodo!</EmptyState>
            ) : (
              <ul className="abs-list">
                {absences.map((a) => (
                  <AbsenceItem key={a.id} abs={a} showStudent={isParent} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <CorrectionModal
          request={editing}
          onClose={() => setEditing(null)}
          onSaved={(item) => {
            setRequests((prev) => prev.map((r) => (r.id === item.id ? item : r)))
            setEditing(null)
            showToast('ok', 'Solicitud corregida y reenviada al colegio.')
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  )
}

function RequestItem({ req, canFix, otherApplicant, onFix }) {
  const status = normalizeStatus(req.status)
  return (
    <li className="req-item" data-status={status}>
      <div className="slip-head">
        <span>Papeleta de permiso</span>
        <span>N.º {req.tracking_code}</span>
      </div>
      <div className="req-top">
        <div>
          <strong>{req.student_name}</strong>
          <span className="muted">
            {Constants.TYPE_LABEL[req.request_type] || req.request_type} · {formatDay(req.start_date)}
            {formatDay(req.start_date) !== formatDay(req.end_date) && ` – ${formatDay(req.end_date)}`}
          </span>
        </div>
        <StatusBadge status={req.status} />
      </div>
      <p className="req-reason">{req.reason}</p>
      {req.review_comment && status !== 'pending' && (
        <div className="req-comment" data-status={status}>
          <span className="req-comment-label">
            {status === 'info_required' ? 'El colegio pide corregir:' : 'Comentario del colegio:'}
          </span>
          {req.review_comment}
          {req.reviewed_by_name && <span className="muted"> — {req.reviewed_by_name}</span>}
        </div>
      )}
      {canFix && status === 'info_required' && (
        <div className="req-foot">
          <button type="button" className="btn btn-warn btn-sm" onClick={onFix}>
            Corregir y reenviar
          </button>
        </div>
      )}
      {otherApplicant && (
        <p className="muted req-by">
          Enviada por {otherApplicant}
          {status === 'info_required' ? '; la corrección la hace quien la envió.' : '.'}
        </p>
      )}
    </li>
  )
}

function AbsenceItem({ abs, showStudent }) {
  const date = new Date(abs.date)
  return (
    <li className="abs-item" data-licensed={abs.licensed ? 'yes' : 'no'}>
      <span className="abs-date" aria-hidden="true">
        <span className="abs-day">{date.toLocaleDateString('es-BO', { day: '2-digit' })}</span>
        <span className="abs-mon">{date.toLocaleDateString('es-BO', { month: 'short' })}</span>
      </span>
      <div className="abs-main">
        <span className="abs-title">
          {abs.weekday ? abs.weekday.charAt(0).toUpperCase() + abs.weekday.slice(1) : formatDay(abs.date)}
          {showStudent && abs.student_name ? ` · ${abs.student_name}` : ''}
        </span>
        <span className="muted">
          {abs.reason}
          {abs.tracking_code ? ` · ${abs.tracking_code}` : ''}
        </span>
      </div>
      <span className="badge" data-status={abs.licensed ? 'approved' : 'rejected'}>
        <span className="pip" />
        {abs.licensed ? 'Justificada' : 'Sin justificar'}
      </span>
    </li>
  )
}

function CorrectionModal({ request, onClose, onSaved }) {
  const [form, setForm] = useState({
    request_type: request.request_type,
    start_date: toInputDate(request.start_date),
    end_date: toInputDate(request.end_date),
    reason: request.reason,
    attachments: [],
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const errs = validateLeave(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    setError('')
    const res = await resubmitLeaveRequest(request.id, {
      request_type: form.request_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      attachments: form.attachments.map(({ file_name, data_url }) => ({ file_name, data_url })),
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSaved(res.item)
  }

  return (
    <Modal
      wide
      title="Corregir y reenviar"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="correction-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Reenviando…' : 'Reenviar solicitud'}
          </button>
        </>
      }
    >
      <form id="correction-form" className="stack" onSubmit={submit} noValidate>
        <div className="req-comment" data-status="info_required">
          <span className="req-comment-label">El colegio pide corregir:</span>
          {request.review_comment}
          <span className="muted"> — {formatDate(request.reviewed_at)}</span>
        </div>
        <p className="muted">
          Permiso de <strong>{request.student_name}</strong> · <span className="mono">{request.tracking_code}</span>
          {request.attachments?.length ? ` · ${request.attachments.length} documento(s) ya adjunto(s)` : ''}
        </p>
        <LeaveFields
          form={form}
          errors={errors}
          existingAttachments={request.attachments?.length || 0}
          onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        />
        <Alert tone="danger">{error}</Alert>
      </form>
    </Modal>
  )
}
