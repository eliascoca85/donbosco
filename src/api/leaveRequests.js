// Capa de acceso a datos para el panel de revision de licencias.
// Por ahora sirve mocks historicos en memoria; reemplazar por fetch(VITE_API_URL)
// cuando el backend este disponible.

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

const NAMES = [
  ['Maria Fernanda Quispe Mamani', 'estudiante'],
  ['Lucas Andres Choque Flores', 'estudiante'],
  ['Sofia Alejandra Vargas Rios', 'estudiante'],
  ['Diego Humberto Rojas Apaza', 'estudiante'],
  ['Camila Paola Herrera Cruz', 'estudiante'],
  ['Andres Felipe Mamani Guzman', 'estudiante'],
  ['Valentina Rose Mejia Lopez', 'estudiante'],
  ['Pedro Martin Condori Tola', 'estudiante'],
  ['Ana Lucia Espinoza Vega', 'estudiante'],
  ['Mateo Ivan Apaza Colque', 'estudiante'],
  ['Daniela Sofia Rios Quispe', 'estudiante'],
  ['Juan Carlos Rocha Segovia', 'personal'],
  ['Enrique David Soliz Peredo', 'personal'],
  ['Rosa Elena Calle Tarqui', 'padre'],
  ['Mario Antonio Paz Romero', 'padre'],
]

const REVIEWERS = [
  ['tcarlos1', 'Tutor Carlos Mendoza'],
  ['tmariana1', 'Tutora Mariana Soto'],
  ['tjose1', 'Tutor Jose Luis Apaza'],
  ['arosa1', 'Direccion - Rectora Rosa'],
  ['ainspectoria1', 'Inspectoria - Juan Flores'],
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function pad(n) { return String(n).padStart(2, '0') }
function daysAgo(n, h = 9) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, Math.floor(Math.random() * 60), 0, 0)
  return d.toISOString()
}
function fromNow(days, hours = 0) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9 + hours, 0, 0, 0)
  return d.toISOString()
}
function randHex(n) {
  let s = ''
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
function makeCode(year) {
  return `LIC-${year}-${randHex(6)}`
}
function initialsOf(full) {
  return full
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function buildEvents(req) {
  const evs = [
    {
      kind: 'created',
      label: `Solicitud creada por ${req.applicant.name}`,
      at: req.created_at,
      note: null,
      actor: req.applicant.name,
    },
  ]
  if (req.pre_review_comment) {
    evs.push({
      kind: 'pre_approved',
      label: `Pre-dictamen emitido`,
      at: req.pre_review_at,
      note: req.pre_review_comment,
      actor: req.pre_reviewed_by_name,
    })
  }
  if (req.review_comment && (req.status === 'approved' || req.status === 'rejected')) {
    evs.push({
      kind: req.status,
      label: req.status === 'approved' ? 'Licencia aprobada' : 'Licencia rechazada',
      at: req.reviewed_at,
      note: req.review_comment,
      actor: req.reviewed_by_name,
    })
  }
  if (req.status === 'info_required' && req.review_comment) {
    evs.push({
      kind: 'info_required',
      label: 'Se solicito correccion / mas informacion',
      at: req.reviewed_at,
      note: req.review_comment,
      actor: req.reviewed_by_name,
    })
  }
  return evs.sort((a, b) => new Date(a.at) - new Date(b.at))
}

function randEvidence(idSeed) {
  const n = Math.floor(Math.random() * 2) + 1
  const out = []
  for (let i = 0; i < n; i++) {
    const isImg = Math.random() > 0.55
    out.push({
      id: `${idSeed}-att-${i + 1}`,
      file_name: isImg
        ? `comprobante_${i + 1}.png`
        : `certificado_medico_${i + 1}.pdf`,
      file_type: isImg ? 'image/png' : 'application/pdf',
      file_size: Math.floor(400_000 + Math.random() * 1_800_000),
      kind: 'evidence',
    })
  }
  return out
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'mock-' + randHex(16) + '-' + randHex(16)
}

function makeDataset(n = 26) {
  const list = []
  for (let i = 0; i < n; i++) {
    const [name, kind] = pick(NAMES)
    const type = pick(['medical', 'personal', 'calamidad_domestica', 'institutional', 'other'])
    const course = kind === 'estudiante' ? pick(COURSES.slice(0, 6)) : pick(COURSES.slice(5))
    const status = pick(STATUS.filter((s) => s !== 'cancelled'))
    const created = daysAgo(Math.floor(Math.random() * 7))
    const start = fromNow(Math.floor(Math.random() * 5))
    const end = new Date(new Date(start).getTime() + (1 + Math.floor(Math.random() * 3)) * 86400000).toISOString()
    const hasPre = status !== 'pending'
    const hasFinal = status === 'approved' || status === 'rejected'
    const reviewer = pick(REVIEWERS)
    const year = new Date(created).getFullYear()
    const req = {
      id: makeId(),
      tracking_code: makeCode(year),
      applicant: {
        name,
        kind, // estudiante | personal | padre
        course,
        email: name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '') + '@colegio.edu',
        phone: `+591 7${pad(Math.floor(Math.random() * 90) + 10)} ${randHex(4)}${pad(Math.floor(Math.random() * 99))}`,
      },
      applicant_kind: kind,
      course,
      request_type: type,
      start_date: start,
      end_date: end,
      reason:
        type === 'medical'
          ? 'Presenta certificado medico que indica reposo por gripe estacional durante 3 dias. Se adjunta certificado emitido por el centro de salud.'
          : type === 'calamidad_domestica'
          ? 'Fallecimiento de familiar directo (abuela). Se solicita permiso para acompanar a la familia y participar de los servicios funerarios.'
          : type === 'institutional'
          ? 'Participacion en representacion del colegio en encuentro deportivo intercolegial regional.'
          : 'Necesidad de ausencia por motivos academicos/personales. Detalle ampliado en evidencia adjunta.',
      status,
      created_at: created,
      // Pre-dictamen
      pre_reviewed_by_name: hasPre ? reviewer[1] : null,
      pre_review_at: hasPre ? new Date(new Date(created).getTime() + 6 * 3600000).toISOString() : null,
      pre_review_comment: hasPre
        ? 'Se verifican datos del solicitante y evidencia adjunta. Pre-dictamen favorable para su revision final.'
        : null,
      // Decision final
      reviewed_by_name: hasFinal ? pick(REVIEWERS)[1] : null,
      reviewed_at: hasFinal ? new Date(new Date(created).getTime() + 28 * 3600000).toISOString() : null,
      review_comment: hasFinal
        ? status === 'approved'
          ? 'Licencia aprobada conforme al Reglamento Academico, art. 24. Se emite comprobante con codigo QR para verificacion.'
          : 'No se admite la solicitud: la evidencia aportada no acredita fehacientemente la causal invocada. Se recomienda re postular con documentacion valida.'
        : status === 'info_required'
        ? 'Se requiere aclarar el periodo exacto de ausencia y subir certificado con membrete legible.'
        : null,
      attachments: randEvidence(i),
    }
    req.initials = initialsOf(name)
    req.events = buildEvents(req)
    list.push(req)
  }
  // Ordenar por creado descendente
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

let STORE = makeDataset()

export function getLeaveRequests() {
  // Devolver copia
  return JSON.parse(JSON.stringify(STORE))
}

function makeTrackingCode(year) {
  const n = STORE.filter((r) => new Date(r.created_at).getFullYear() === year).length + 1
  return `LIC-${year}-${String(n).padStart(4, '0')}-${randHex(4)}`
}

export function createLeaveRequest(payload, { applicantUser } = {}) {
  const created = new Date().toISOString()
  const startDate = new Date(payload.start_date + 'T00:00:00').toISOString()
  const endDate = new Date(payload.end_date + 'T23:59:00').toISOString()
  const req = {
    id: makeId(),
    tracking_code: makeTrackingCode(new Date(created).getFullYear()),
    applicant: {
      name: applicantUser?.name || payload.applicant_name,
      kind: applicantUser?.role || payload.applicant_kind || 'student',
      course: applicantUser?.course || payload.course || '—',
      email: applicantUser?.email || payload.email || '—',
      phone: payload.phone || '—',
    },
    applicant_kind: applicantUser?.role || payload.applicant_kind || 'student',
    course: applicantUser?.course || payload.course || '—',
    request_type: payload.request_type || 'personal',
    start_date: startDate,
    end_date: endDate,
    reason: payload.reason || '',
    status: 'pending',
    created_at: created,
    pre_reviewed_by_name: null,
    pre_review_at: null,
    pre_review_comment: null,
    reviewed_by_name: null,
    reviewed_at: null,
    review_comment: null,
    attachments: (payload.attachments || []).map((a, i) => ({
      id: `${makeId()}-att-${i + 1}`,
      file_name: a.file_name,
      file_type: a.file_type,
      file_size: a.file_size || 0,
      kind: 'evidence',
    })),
  }
  req.initials = initialsOf(req.applicant.name)
  req.events = buildEvents(req)
  STORE = [req, ...STORE]
  return JSON.parse(JSON.stringify(req))
}

export function updateRequestStatus(id, nextStatus, { reviewerName, comment }) {
  STORE = STORE.map((r) => {
    if (r.id !== id) return r
    const updated = { ...r }
    updated.status = nextStatus
    if (nextStatus === 'pre_approved') {
      updated.pre_reviewed_by_name = reviewerName
      updated.pre_review_at = new Date().toISOString()
      updated.pre_review_comment = comment || ''
    } else if (nextStatus === 'approved' || nextStatus === 'rejected' || nextStatus === 'info_required') {
      updated.reviewed_by_name = reviewerName
      updated.reviewed_at = new Date().toISOString()
      updated.review_comment = comment || ''
    }
    updated.events = buildEvents(updated)
    return updated
  })
  return JSON.parse(JSON.stringify(STORE.find((r) => r.id === id)))
}

export const Constants = {
  STATUS,
  TYPE_LABEL,
  COURSES,
  REVIEWERS,
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
  const diff = (now - then) / 1000 // segundos
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
