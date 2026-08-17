import { apiRequest } from './client'

const STATUS = ['pending', 'pre_approved', 'approved', 'rejected', 'info_required', 'cancelled']

const TYPE_LABEL = {
  medical: 'Medica',
  personal: 'Personal',
  calamidad_domestica: 'Calamidad dom.',
  institutional: 'Institucional',
  other: 'Otra',
}

const COURSES = [
  '1ro Secundaria A',
  '1ro Secundaria B',
  '2do Secundaria A',
  '3ro Secundaria A',
  '6to Primaria A',
  'Personal docente',
]

export async function getLeaveRequests() {
  const res = await apiRequest('/leave-requests')
  return res.ok ? res.items || [] : []
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

export async function getStudentAbsences() {
  const res = await apiRequest('/absences/me')
  return res.ok ? res.items || [] : []
}

export const Constants = {
  STATUS,
  TYPE_LABEL,
  COURSES,
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

export function computeHours(start, end) {
  const ms = new Date(end) - new Date(start)
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100)
}
