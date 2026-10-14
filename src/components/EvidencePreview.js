import { useEffect, useState } from 'react'
import { formatBytes, getAttachmentData } from '../api/leaveRequests'
import { Modal, Alert } from './ui'

function FileIcon({ type }) {
  const isPdf = type === 'application/pdf'
  return (
    <span className="file-icon" data-kind={isPdf ? 'pdf' : 'img'} aria-hidden="true">
      {isPdf ? 'PDF' : 'IMG'}
    </span>
  )
}

export function EvidencePreview({ attachments, onOpen }) {
  if (!attachments || attachments.length === 0) {
    return <p className="muted">La familia no adjuntó documentos.</p>
  }
  return (
    <ul className="files">
      {attachments.map((a) => (
        <li key={a.id}>
          <button type="button" className="file" onClick={() => onOpen(a)}>
            <FileIcon type={a.file_type} />
            <span className="file-text">
              <span className="file-name">{a.file_name}</span>
              <span className="file-size">{formatBytes(a.file_size || 0)}</span>
            </span>
            <span className="file-open">Ver</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function dataUrlToObjectUrl(dataUrl) {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bytes = atob(body)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) buffer[i] = bytes.charCodeAt(i)
  return URL.createObjectURL(new Blob([buffer], { type: mime }))
}

// Descarga el archivo real desde el servidor y lo muestra en un visor.
export function EvidenceLightbox({ requestId, attachment, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: '' })

  useEffect(() => {
    let alive = true
    let objectUrl = null
    getAttachmentData(requestId, attachment.id).then((res) => {
      if (!alive) return
      if (!res.ok || !res.item?.file_url) {
        setState({ loading: false, url: null, error: res.error || 'El archivo no está disponible.' })
        return
      }
      try {
        objectUrl = dataUrlToObjectUrl(res.item.file_url)
        setState({ loading: false, url: objectUrl, error: '' })
      } catch {
        setState({ loading: false, url: null, error: 'El archivo está dañado y no se puede mostrar.' })
      }
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [requestId, attachment.id])

  const isPdf = attachment.file_type === 'application/pdf'

  return (
    <Modal
      wide
      title={attachment.file_name}
      onClose={onClose}
      footer={
        state.url && (
          <a className="btn btn-primary" href={state.url} download={attachment.file_name}>
            Descargar archivo
          </a>
        )
      }
    >
      <div className="viewer">
        {state.loading && <p className="muted">Abriendo documento…</p>}
        <Alert tone="danger">{state.error}</Alert>
        {state.url &&
          (isPdf ? (
            <iframe src={state.url} title={attachment.file_name} />
          ) : (
            <img src={state.url} alt={attachment.file_name} />
          ))}
      </div>
    </Modal>
  )
}
