import { useMemo, useState } from 'react'
import { Constants, createLeaveRequest, computeHours } from '../api/leaveRequests'
import { useAuth } from '../components/router'
import { Link } from '../components/Link'

const EMPTY = {
  request_type: 'medical',
  start_date: '',
  end_date: '',
  reason: '',
  applicant_name: '',
  course: '',
  email: '',
  phone: '',
  attachments: [],
}

export function LeaveRequestForm() {
  const { user } = useAuth()
  const linkedStudents = user?.linkedStudents || []
  const [form, setForm] = useState(() =>
    user
      ? {
          ...EMPTY,
          applicant_name: user.name,
          course: user.course || '',
          email: user.email || '',
          student_id: linkedStudents[0]?.id || '',
        }
      : EMPTY
  )
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const activeStudentId = form.student_id || linkedStudents[0]?.id || ''

  const set = (patch) => setForm((p) => ({ ...p, ...patch }))
  const hours = useMemo(
    () =>
      form.start_date && form.end_date
        ? computeHours(
            new Date(form.start_date + 'T00:00:00').toISOString(),
            new Date(form.end_date + 'T23:59:00').toISOString()
          )
        : 0,
    [form.start_date, form.end_date]
  )

  const validate = () => {
    const e = {}
    if (!form.applicant_name.trim()) e.applicant_name = 'Indica tu nombre completo.'
    if (user?.role === 'parent' && !form.student_id) e.student_id = 'Selecciona un estudiante vinculado.'
    if (!form.request_type) e.request_type = 'Selecciona un tipo.'
    if (!form.start_date) e.start_date = 'Indica la fecha de inicio.'
    if (!form.end_date) e.end_date = 'Indica la fecha de fin.'
    if (form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date))
      e.end_date = 'La fecha de fin no puede ser anterior a la de inicio.'
    if (!form.reason.trim() || form.reason.trim().length < 12)
      e.reason = 'Describe el motivo (al menos 12 caracteres).'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Email no valido.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onFiles = (e) => {
    const files = Array.from(e.target.files || [])
    const atts = files.map((f) => ({
      file_name: f.name,
      file_type: f.type || 'application/octet-stream',
      file_size: f.size,
    }))
    set({ attachments: [...form.attachments, ...atts] })
  }

  const removeAttachment = (i) => {
    set({ attachments: form.attachments.filter((_, idx) => idx !== i) })
  }

  const submit = (e) => {
    e.preventDefault()
    window.scrollTo(0, 0)
    setSubmitted(null)
    setSubmitError('')
    if (!validate()) return
    setSubmitting(true)
    createLeaveRequest({ ...form, student_id: activeStudentId })
      .then((res) => {
        setSubmitting(false)
        if (!res.ok) {
          setSubmitError(res.error || 'No se pudo registrar la solicitud.')
          return
        }
        setSubmitted(res.item)
      })
      .catch(() => {
        setSubmitting(false)
        setSubmitError('No se pudo registrar la solicitud.')
      })
  }

  if (submitted) {
    return <SuccessView req={submitted} onAnother={() => {
      setSubmitted(null)
      setForm(EMPTY)
    }} />
  }

  return (
    <div className="form-page">
      <div className="form-portal-head">
        <Link to="/" className="lnav-brand">
          <span className="crest">DB</span>
          <span className="lnav-brand-name">U.E. <strong>Don Bosco</strong></span>
        </Link>
          <span className="form-portal-user">
          Hola, {user.name.split(' ').slice(0, 2).join(' ')}
        </span>
      </div>

      <div className="form-banner">
        <span className="hero-eyebrow">Solicitud de permiso / licencia</span>
        <h1>Completa el formulario</h1>
        <p>
          Completa todos los campos. Recibiras un codigo de seguimiento
          (LIC-...) para acompanar el estado de tu solicitud.
        </p>
      </div>

      <form className="form-shell" onSubmit={submit} noValidate>
        <fieldset className="form-card">
          <legend>Datos del solicitante</legend>
          <div className="form-grid">
            <Field
              label="Nombre completo"
              required
              error={errors.applicant_name}
            >
              <input
                value={form.applicant_name}
                onChange={(e) => set({ applicant_name: e.target.value })}
                disabled={!!user}
                placeholder="Ej. Maria Fernanda Quispe Mamani"
              />
            </Field>
            <Field label="Curso / Area" optional>
              <input
                value={form.course}
                onChange={(e) => set({ course: e.target.value })}
                disabled={!!user}
              />
            </Field>
            <Field label="Estudiante" required={user?.role === 'parent'} error={errors.student_id}>
              <select
                value={activeStudentId}
                onChange={(e) => set({ student_id: e.target.value })}
                disabled={linkedStudents.length === 0}
              >
                <option value="">Selecciona un estudiante</option>
                {linkedStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.course || 'Sin curso'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email" optional error={errors.email}>
              <input
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                disabled={!!user}
                placeholder="nombre@colegio.edu"
              />
            </Field>
            <Field label="Telefono" optional>
              <input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+591 7XX XXXXX"
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-card">
          <legend>Datos del permiso</legend>
          <div className="form-grid">
            <Field label="Tipo de permiso" required error={errors.request_type}>
              <select
                value={form.request_type}
                onChange={(e) => set({ request_type: e.target.value })}
              >
                {Object.entries(Constants.TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Fecha de inicio" required error={errors.start_date}>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set({ start_date: e.target.value })}
                />
              </Field>
              <Field label="Fecha de fin" required error={errors.end_date}>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set({ end_date: e.target.value })}
                />
              </Field>
            </div>
            <div className="hint-block span-full">
              Horas estimadas de ausencia: <strong>{hours} h</strong>
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 8 }}>
            <Field
              label="Motivo / justificacion"
              required
              error={errors.reason}
              classNameField="span-full"
            >
              <textarea
                className="long"
                value={form.reason}
                onChange={(e) => set({ reason: e.target.value })}
                placeholder="Explica el motivo de la solicitud. Detalla la causal e indica la documentacion que adjuntaras."
              />
            </Field>
          </div>
        </fieldset>

        {submitError && (
          <div className="auth-err" style={{ marginTop: 4 }}>
            {submitError}
          </div>
        )}

        <fieldset className="form-card">
          <legend>Evidencias adjuntas</legend>
          <label className="file-drop">
            <input type="file" multiple onChange={onFiles} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4M5 11l7-7 7 7M4 20h16" />
            </svg>
            <span>Haz clic para adjuntar certificados o comprobantes</span>
            <small>PDF, JPG, PNG (max. 5 MB por archivo)</small>
          </label>
          {form.attachments.length > 0 && (
            <ul className="att-list">
              {form.attachments.map((a, i) => (
                <li key={i}>
                  <span className={'att-ico ' + (a.file_type.includes('pdf') ? 'pdf' : 'img')}>
                    {a.file_type.includes('pdf') ? 'PDF' : 'IMG'}
                  </span>
                  <span className="att-name">{a.file_name}</span>
                  <span className="att-size">{fmtBytes(a.file_size)}</span>
                  <button
                    type="button"
                    className="att-remove"
                    onClick={() => removeAttachment(i)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="form-actions">
          <Link to="/" className="btn ghost">
            Volver
          </Link>
          <button
            type="submit"
            className="btn primary lg"
            disabled={submitting}
          >
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, optional, error, classNameField, children }) {
  return (
    <div className={'f-field ' + (classNameField || '')}>
      <label className="f-label">
        {label}
        {required && <span className="req">*</span>}
        {optional && <span className="opt">(opcional)</span>}
      </label>
      {children}
      {error && <span className="f-err">{error}</span>}
    </div>
  )
}

function SuccessView({ req, onAnother }) {
  return (
    <div className="form-page">
      <div className="success-card">
        <div className="success-mark">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1>Solicitud registrada</h1>
        <p>
          Tu peticion fue creada con exito. Usa el siguiente codigo para hacer
          seguimiento en cualquier momento.
        </p>
        <div className="success-code">{req.tracking_code}</div>
        <div className="success-summary">
          <KV k="Solicitante" v={req.applicant.name} />
          <KV k="Tipo" v={Constants.TYPE_LABEL[req.request_type] || req.request_type} />
          <KV k="Estado" v="Pendiente de revision" />
        </div>
        <div className="success-actions">
          <button className="btn" onClick={onAnother}>
            Crear otra solicitud
          </button>
          <Link to="/" className="btn ghost">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

function KV({ k, v }) {
  return (
    <div className="success-kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  )
}

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
