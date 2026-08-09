import { useState } from 'react'

const CONFIG = {
  approve: {
    title: 'Aprobar licencia',
    tone: 'success',
    cta: 'Aprobar',
    requiresComment: false,
    placeholder: 'Observacion (opcional) — se incluira en el comprobante PDF y en la auditoria.',
  },
  pre_approve: {
    title: 'Emitir pre-dictamen',
    tone: 'info',
    cta: 'Emitir pre-dictamen',
    requiresComment: false,
    placeholder: 'Comentario del pre-dictamen (opcional).',
  },
  reject: {
    title: 'Rechazar solicitud',
    tone: 'danger',
    cta: 'Rechazar',
    requiresComment: true,
    placeholder: 'Motivo de rechazo (obligatorio). Se notificara al solicitante.',
  },
  info_required: {
    title: 'Solicitar correccion',
    tone: 'warn',
    cta: 'Enviar solicitud',
    requiresComment: true,
    placeholder: 'Indicar que informacion / correccion se requiere (obligatorio).',
  },
}

export function DecisionModal({ mode, request, onConfirm, onClose }) {
  const cfg = CONFIG[mode]
  const [comment, setComment] = useState('')
  const [err, setErr] = useState('')

  if (!cfg || !request) return null

  const confirm = () => {
    if (cfg.requiresComment && !comment.trim()) {
      setErr('Este campo es obligatorio para esta accion.')
      return
    }
    onConfirm(mode, { comment: comment.trim() })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h3>{cfg.title}</h3>
          <button className="icon-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="body">
          <div style={{ fontSize: 14 }}>
            Solicitud{' '}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
              {request.tracking_code}
            </span>{' '}
            de <strong>{request.applicant.name}</strong>
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {request.course} ·{' '}
              {request.applicant.email}
            </span>
          </div>
          <div>
            <textarea
              autoFocus
              value={comment}
              placeholder={cfg.placeholder}
              onChange={(e) => {
                setComment(e.target.value)
                setErr('')
              }}
            />
            {err ? (
              <div className="hint" style={{ color: 'var(--danger)' }}>
                {err}
              </div>
            ) : (
              <div className="hint">
                {cfg.requiresComment
                  ? 'El comentario es obligatorio.'
                  : 'Opcional: se registrara en audit_logs.'}
              </div>
            )}
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className={'btn ' + cfg.tone} onClick={confirm}>
            {cfg.cta}
          </button>
        </div>
      </div>
    </div>
  )
}
