import { useEffect, useRef, useState } from 'react'
import {
  Constants,
  createLeaveRequest,
  countSchoolDays,
  formatBytes,
  readAttachments,
  MAX_ATTACHMENTS,
} from '../api/leaveRequests'
import { useAuth } from '../components/router'
import { Link } from '../components/Link'
import { PageBanner, Field, Alert, EmptyState, Crest } from '../components/ui'

const today = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function validateLeave(form) {
  const e = {}
  if (!form.request_type) e.request_type = 'Elige el tipo de permiso.'
  if (!form.start_date) e.start_date = 'Indica desde qué día.'
  if (!form.end_date) e.end_date = 'Indica hasta qué día.'
  if (form.start_date && form.end_date && form.end_date < form.start_date)
    e.end_date = 'La fecha final no puede ser anterior a la inicial.'
  if (form.reason.trim().length < 10) e.reason = 'Describe el motivo con al menos 10 caracteres.'
  return e
}

// Campos comunes al formulario nuevo y a la corrección de una solicitud devuelta.
export function LeaveFields({ form, errors, onChange, existingAttachments = 0 }) {
  const fileInput = useRef(null)
  const [fileError, setFileError] = useState('')
  const free = MAX_ATTACHMENTS - existingAttachments - form.attachments.length
  const days = form.start_date && form.end_date && form.end_date >= form.start_date
    ? countSchoolDays(form.start_date, form.end_date)
    : 0

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    setFileError('')
    if (files.length > free) {
      setFileError(`Puedes adjuntar como máximo ${MAX_ATTACHMENTS} archivos por solicitud.`)
      return
    }
    try {
      const read = await readAttachments(files)
      onChange({ attachments: [...form.attachments, ...read] })
    } catch (err) {
      setFileError(err.message)
    }
  }

  return (
    <>
      <Field label="Tipo de permiso" required error={errors.request_type}>
        <select value={form.request_type} onChange={(e) => onChange({ request_type: e.target.value })}>
          {Object.entries(Constants.TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <div className="field-row">
        <Field label="Desde" required error={errors.start_date}>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
          />
        </Field>
        <Field label="Hasta" required error={errors.end_date}>
          <input
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
          />
        </Field>
      </div>
      {days > 0 && (
        <p className="field-note">
          El permiso cubre <strong>{days === 1 ? '1 día de clase' : `${days} días de clase`}</strong> (lunes a viernes).
        </p>
      )}

      <Field
        label="Motivo"
        required
        error={errors.reason}
        hint="Cuéntanos brevemente por qué tu hijo o hija faltará a clases."
      >
        <textarea
          rows={4}
          maxLength={1000}
          value={form.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
          placeholder="Ej.: Cita con el pediatra en el Hospital del Niño a las 9:00."
        />
      </Field>

      <div className="field">
        <span className="field-label">
          Documentos de respaldo <span className="opt">(opcional)</span>
        </span>
        <div className="dropzone">
          <p>
            Certificado médico, comprobante u otro documento. PDF, JPG, PNG o WEBP de hasta 5 MB.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => fileInput.current?.click()}
            disabled={free <= 0}
          >
            {free <= 0 ? 'Límite de archivos alcanzado' : 'Elegir archivos'}
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={onFiles}
          />
        </div>
        {fileError && <span className="field-error">{fileError}</span>}
        {form.attachments.length > 0 && (
          <ul className="files files-compact">
            {form.attachments.map((a, i) => (
              <li key={a.file_name + i} className="file">
                <span className="file-icon" data-kind={a.file_type === 'application/pdf' ? 'pdf' : 'img'} aria-hidden="true">
                  {a.file_type === 'application/pdf' ? 'PDF' : 'IMG'}
                </span>
                <span className="file-text">
                  <span className="file-name">{a.file_name}</span>
                  <span className="file-size">{formatBytes(a.file_size)}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onChange({ attachments: form.attachments.filter((_, idx) => idx !== i) })}
                  aria-label={`Quitar ${a.file_name}`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function LeaveRequestForm() {
  const { user, refreshUser } = useAuth()
  const students = user.linkedStudents || []
  const emptyForm = () => ({
    student_id: '',
    request_type: 'medical',
    start_date: today(),
    end_date: today(),
    reason: '',
    attachments: [],
  })
  const [form, setForm] = useState(emptyForm)

  // La lista de hijos se pide de nuevo al abrir el formulario: el docente pudo vincular uno recien.
  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // Con un solo hijo vinculado no hace falta elegir.
  const studentId = form.student_id || (students.length === 1 ? students[0].id : '')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [created, setCreated] = useState(null)

  const change = (patch) => {
    setForm((p) => ({ ...p, ...patch }))
    setErrors((p) => {
      const next = { ...p }
      Object.keys(patch).forEach((k) => delete next[k])
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validateLeave(form)
    if (!studentId) errs.student_id = 'Elige para cuál de tus hijos es el permiso.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    setSubmitError('')
    const res = await createLeaveRequest({
      student_id: studentId,
      request_type: form.request_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      attachments: form.attachments.map(({ file_name, data_url }) => ({ file_name, data_url })),
    })
    setSubmitting(false)
    if (!res.ok) {
      setSubmitError(res.error)
      return
    }
    setCreated(res.item)
  }

  if (created) {
    return (
      <>
        <PageBanner eyebrow="Permiso enviado" title="Recibimos tu solicitud" />
        <div className="container page narrow">
          <div className="card success-card">
            <Crest size={52} />
            <p>
              El permiso para <strong>{created.student_name}</strong> quedó registrado y está{' '}
              <strong>pendiente de revisión</strong> por Dirección o Inspectoría.
            </p>
            <div className="tracking">
              <span>Código de seguimiento</span>
              <strong className="mono">{created.tracking_code}</strong>
            </div>
            <p className="muted">
              Te avisaremos aquí mismo cuando haya una respuesta. Si te piden una corrección, podrás editarla desde
              «Mis solicitudes».
            </p>
            <div className="btn-row">
              <Link to="/dashboard" className="btn btn-primary">
                Ver mis solicitudes
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setForm(emptyForm())
                  setErrors({})
                  setCreated(null)
                }}
              >
                Enviar otro permiso
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageBanner eyebrow="Padres de familia" title="Solicitar permiso de inasistencia">
        Completa el formulario y Dirección o Inspectoría revisará tu pedido.
      </PageBanner>

      <div className="container page narrow">
        {students.length === 0 ? (
          <div className="card">
            <EmptyState title="Todavía no tienes estudiantes vinculados">
              El profesor del curso debe vincular a tu hijo o hija con tu cuenta. Cuando lo haga, aparecerá aquí al
              volver a abrir esta página.
            </EmptyState>
          </div>
        ) : (
          <form className="card form-card stack" onSubmit={submit} noValidate>
            <fieldset className="form-section">
              <legend>Estudiante</legend>
              <Field label="¿Para quién es el permiso?" required error={errors.student_id}>
                <select value={studentId} onChange={(e) => change({ student_id: e.target.value })}>
                  {students.length > 1 && <option value="">Elige un estudiante</option>}
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.course}
                    </option>
                  ))}
                </select>
              </Field>
            </fieldset>

            <fieldset className="form-section">
              <legend>Detalle del permiso</legend>
              <LeaveFields form={form} errors={errors} onChange={change} />
            </fieldset>

            <fieldset className="form-section">
              <legend>Solicitante</legend>
              <div className="applicant">
                <span className="avatar">{user.initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span className="muted">
                    {[user.email, user.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </span>
                </div>
              </div>
            </fieldset>

            <Alert tone="danger">{submitError}</Alert>

            <div className="form-actions">
              <Link to="/dashboard" className="btn btn-ghost">
                Cancelar
              </Link>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
