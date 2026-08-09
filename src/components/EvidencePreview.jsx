import { formatBytes } from '../api/leaveRequests'

export function EvidencePreview({ attachments, onOpen }) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="panel" style={{ margin: '12px 0' }}>
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
          No hay evidencias adjuntas para esta solicitud.
        </div>
      </div>
    )
  }
  return (
    <div className="evidence">
      {attachments.map((a) => (
        <button
          key={a.id}
          className="file"
          onClick={() => onOpen(a)}
          title={a.file_name}
        >
          <span className={'ico ' + (a.file_type === 'application/pdf' ? 'pdf' : 'img')}>
            {a.file_type === 'application/pdf' ? 'PDF' : 'IMG'}
          </span>
          <span className="meta">
            <span className="name">{a.file_name}</span>
            <span className="size">{formatBytes(a.file_size)}</span>
          </span>
          <span style={{ marginLeft: 6, color: 'var(--text-weak)' }} aria-hidden>
            ↗
          </span>
        </button>
      ))}
    </div>
  )
}

export function EvidenceLightbox({ attachment, onClose }) {
  if (!attachment) return null
  const isImg = attachment.file_type && attachment.file_type.startsWith('image/')
  return (
    <div className="evidence-preview" onClick={onClose}>
      <div className="frame" onClick={(e) => e.stopPropagation()}>
        <div className="bar">
          <div>
            <strong>{attachment.file_name}</strong>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              · {formatBytes(attachment.file_size)}
            </span>
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="content">
          {isImg ? (
            <img
              src={`https://placehold.co/700x520/png?text=${encodeURIComponent(attachment.file_name)}`}
              alt={attachment.file_name}
            />
          ) : (
            <div className="pdf-stand">
              <div className="big">📄</div>
              <div>{attachment.file_name}</div>
              <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>
                Vista previa de PDF · {formatBytes(attachment.file_size)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
