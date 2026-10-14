import { useState } from 'react'
import { Modal, Field, Alert } from './ui'

const MODES = {
  approved: {
    title: 'Aprobar permiso',
    confirm: 'Aprobar permiso',
    tone: 'btn-success',
    help: 'Las faltas de estos días quedarán registradas como justificadas.',
    commentLabel: 'Comentario para la familia',
    required: false,
  },
  info_required: {
    title: 'Solicitar corrección',
    confirm: 'Enviar a corrección',
    tone: 'btn-warn',
    help: 'La familia verá tu comentario y podrá corregir y reenviar la solicitud.',
    commentLabel: 'Qué debe corregir la familia',
    required: true,
  },
  rejected: {
    title: 'Rechazar permiso',
    confirm: 'Rechazar permiso',
    tone: 'btn-danger',
    help: 'El rechazo es definitivo. Explica el motivo a la familia.',
    commentLabel: 'Motivo del rechazo',
    required: true,
  },
}

export function DecisionModal({ mode, request, onConfirm, onClose, loading }) {
  const config = MODES[mode]
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  if (!config || !request) return null

  const submit = (e) => {
    e.preventDefault()
    if (config.required && comment.trim().length < 5) {
      setError('Escribe un comentario de al menos 5 caracteres.')
      return
    }
    onConfirm(mode, { comment: comment.trim() })
  }

  return (
    <Modal
      title={config.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="decision-form" className={'btn ' + config.tone} disabled={loading}>
            {loading ? 'Guardando…' : config.confirm}
          </button>
        </>
      }
    >
      <form id="decision-form" onSubmit={submit} className="stack">
        <div className="decision-summary">
          <strong>{request.student_name}</strong>
          <span>
            {request.course} · <span className="mono">{request.tracking_code}</span>
          </span>
        </div>
        <Alert tone={mode === 'approved' ? 'ok' : mode === 'rejected' ? 'danger' : 'warn'}>{config.help}</Alert>
        <Field label={config.commentLabel} required={config.required} optional={!config.required} error={error}>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              setError('')
            }}
            placeholder={
              mode === 'info_required'
                ? 'Ej.: Adjunte el certificado médico firmado y sellado.'
                : mode === 'rejected'
                  ? 'Ej.: Las fechas coinciden con evaluaciones trimestrales.'
                  : 'Ej.: Que se recupere pronto.'
            }
          />
        </Field>
      </form>
    </Modal>
  )
}
