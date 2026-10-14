import { apiRequest } from './client'

// pre_approved queda solo por compatibilidad con datos antiguos: se muestra como pendiente.
const STATUS = ['pending', 'info_required', 'approved', 'rejected']

export const STATUS_LABEL = {
  pending: 'Pendiente',
  pre_approved: 'Pendiente',
  info_required: 'Corrección solicitada',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}

export function normalizeStatus(status) {
  return status === 'pre_approved' ? 'pending' : status
}

const TYPE_LABEL = {
  medical: 'Salud',
  personal: 'Personal',
  calamidad_domestica: 'Calamidad doméstica',
  institutional: 'Actividad institucional',
  other: 'Otro motivo',
}

// Devuelve { ok, items } o { ok: false, error } para que la pantalla muestre el problema
// en lugar de una lista vacia que parece "no hay solicitudes".
export async function getLeaveRequests() {
  const res = await apiRequest('/leave-requests')
  if (!res.ok) return { ok: false, error: res.error || 'No se pudieron cargar las solicitudes.' }
  return { ok: true, items: res.items || [] }
}

export async function createLeaveRequest(payload) {
  const res = await apiRequest('/leave-requests', {
    method: 'POST',
    body: payload,
  })
  if (!res.ok) {
    return { ok: false, error: res.error || 'No se pudo registrar la solicitud.' }
  }
  return { ok: true, item: res.item }
}

export async function updateRequestStatus(id, nextStatus, { comment }) {
  const res = await apiRequest(`/leave-requests/${id}/status`, {
    method: 'PATCH',
    body: { status: nextStatus, comment },
  })
  if (!res.ok) {
    return { ok: false, error: res.error || 'No se pudo actualizar el estado.' }
  }
  return { ok: true, item: res.item }
}

// El padre reenvia una solicitud devuelta para correccion.
export async function resubmitLeaveRequest(id, payload) {
  const res = await apiRequest(`/leave-requests/${id}`, {
    method: 'PATCH',
    body: payload,
  })
  if (!res.ok) {
    return { ok: false, error: res.error || 'No se pudo reenviar la solicitud.' }
  }
  return { ok: true, item: res.item }
}

export async function getAttachmentData(requestId, attachmentId) {
  const res = await apiRequest(`/leave-requests/${requestId}/attachments/${attachmentId}`)
  if (!res.ok) return { ok: false, error: res.error || 'No se pudo abrir el adjunto.' }
  return { ok: true, item: res.item }
}

export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

// Lee los archivos elegidos como data URL, validando tipo y tamano antes de enviarlos.
export async function readAttachments(files) {
  const list = Array.from(files || [])
  for (const file of list) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      throw new Error(`"${file.name}" no es PDF, JPG, PNG ni WEBP.`)
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`"${file.name}" pesa mas de 5 MB.`)
    }
  }
  return Promise.all(
    list.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () =>
            resolve({ file_name: file.name, file_type: file.type, file_size: file.size, data_url: String(reader.result) })
          reader.onerror = () => reject(new Error(`No se pudo leer "${file.name}".`))
          reader.readAsDataURL(file)
        })
    )
  )
}

export async function getStudentAbsences() {
  const res = await apiRequest('/absences/me')
  if (!res.ok) return { ok: false, error: res.error || 'No se pudo cargar la asistencia.' }
  return { ok: true, items: res.items || [] }
}

export const Constants = {
  STATUS,
  TYPE_LABEL,
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDay(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatLongDay(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function relativeTime(iso) {
  if (!iso) return ''
  const now = new Date()
  const then = new Date(iso)
  const diff = (now - then) / 1000
  if (diff < 60) return 'hace instantes'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`
  return formatDay(iso)
}

// Fecha local en formato YYYY-MM-DD para inputs type="date".
export function toInputDate(iso) {
  if (!iso) return ''
  // Una fecha sola (YYYY-MM-DD) ya es local; new Date() la tomaria como UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Dias de clase (lunes a viernes) entre dos fechas, ambas incluidas.
export function countSchoolDays(start, end) {
  if (!start || !end) return 0
  const from = new Date(toInputDate(start) + 'T12:00:00')
  const to = new Date(toInputDate(end) + 'T12:00:00')
  let days = 0
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) days += 1
  }
  return days
}
