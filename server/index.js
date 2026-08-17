/* global process */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

const PORT = Number(process.env.PORT || 4000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'don-bosco-dev-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const SCHEMA_PATH = path.resolve(process.cwd(), 'db/schema.sql')

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
})

const ROLE_LABELS = {
  student: 'Estudiante',
  parent: 'Padre / Tutor',
  teacher: 'Docente',
  inspector: 'Inspectoria',
  admin: 'Administracion / Direccion',
}

function initialsOf(full) {
  if (!full) return '?'
  return String(full)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

async function query(text, params = []) {
  return pool.query(text, params)
}

async function ensureSchema() {
  try {
    await query('SELECT 1 FROM roles LIMIT 1')
    return
  } catch {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
    await query(schema)
  }
}

async function seedReferenceData() {
  await query(
    `INSERT INTO roles (name, description) VALUES
      ('admin', 'Regente / Direccion - control total y gestion de credenciales'),
      ('inspector', 'Inspectoria - acompanamiento y disciplina'),
      ('teacher', 'Docente / Tutor - revisa permisos de sus cursos asignados'),
      ('parent', 'Padre / Tutor - solicita permisos para sus hijos'),
      ('student', 'Estudiante - no solicita permisos, solo ve su panel de faltas')
    ON CONFLICT (name) DO NOTHING`
  )

  await query(
    `INSERT INTO courses (name, level, school_year) VALUES
      ('1ro Secundaria A', 'Secundaria', '2026'),
      ('1ro Secundaria B', 'Secundaria', '2026'),
      ('2do Secundaria A', 'Secundaria', '2026'),
      ('3ro Secundaria A', 'Secundaria', '2026'),
      ('6to Primaria A', 'Primaria', '2026')
    ON CONFLICT (name) DO NOTHING`
  )

  await query(
    `INSERT INTO users (username, name, email, password_hash, role_id, phone) VALUES
      ('rectora', 'Rosa Azcarraga', 'rosa.azcarraga@donbosco.edu', crypt('rectora123', gen_salt('bf')), (SELECT id FROM roles WHERE name='admin'), '+591-70000001'),
      ('inspectoria', 'Juan Flores', 'juan.flores@donbosco.edu', crypt('inspectoria123', gen_salt('bf')), (SELECT id FROM roles WHERE name='inspector'), '+591-70000002'),
      ('docente', 'Carlos Mendoza', 'carlos.mendoza@donbosco.edu', crypt('docente123', gen_salt('bf')), (SELECT id FROM roles WHERE name='teacher'), '+591-70000003'),
      ('padre', 'Rosa Elena Calle Tarqui', 'rosa.calle@donbosco.edu', crypt('padre123', gen_salt('bf')), (SELECT id FROM roles WHERE name='parent'), '+591-70000004'),
      ('estudiante', 'Maria Fernanda Quispe Mamani', 'maria.quispe@donbosco.edu', crypt('estudiante123', gen_salt('bf')), (SELECT id FROM roles WHERE name='student'), '+591-70000005'),
      ('estudiante2', 'Lucas Andres Choque Flores', 'lucas.choque@donbosco.edu', crypt('estudiante123', gen_salt('bf')), (SELECT id FROM roles WHERE name='student'), '+591-70000006')
    ON CONFLICT (username) DO NOTHING`
  )

  await query(
    `INSERT INTO students (user_id, ru_code, course_id, status) VALUES
      ((SELECT id FROM users WHERE username='estudiante'), 'RUDE-0001', (SELECT id FROM courses WHERE name='2do Secundaria A'), 'active'),
      ((SELECT id FROM users WHERE username='estudiante2'), 'RUDE-0002', (SELECT id FROM courses WHERE name='1ro Secundaria A'), 'active')
    ON CONFLICT (user_id) DO NOTHING`
  )

  await query(
    `INSERT INTO guardians (user_id, ci_number) VALUES
      ((SELECT id FROM users WHERE username='padre'), 'LP-1234567')
    ON CONFLICT (user_id) DO NOTHING`
  )

  await query(
    `INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary) VALUES
      ((SELECT id FROM students WHERE ru_code='RUDE-0001'), (SELECT id FROM guardians WHERE ci_number='LP-1234567'), 'padre', true),
      ((SELECT id FROM students WHERE ru_code='RUDE-0002'), (SELECT id FROM guardians WHERE ci_number='LP-1234567'), 'padre', false)
    ON CONFLICT (student_id, guardian_id) DO NOTHING`
  )

  await query(
    `INSERT INTO course_reviewers (course_id, reviewer_id) VALUES
      ((SELECT id FROM courses WHERE name='1ro Secundaria A'), (SELECT id FROM users WHERE username='docente')),
      ((SELECT id FROM courses WHERE name='2do Secundaria A'), (SELECT id FROM users WHERE username='docente')),
      ((SELECT id FROM courses WHERE name='3ro Secundaria A'), (SELECT id FROM users WHERE username='inspectoria')),
      ((SELECT id FROM courses WHERE name='1ro Secundaria B'), (SELECT id FROM users WHERE username='rectora'))
    ON CONFLICT (course_id, reviewer_id) DO NOTHING`
  )
}

async function ensureSupplementalSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS student_absences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      request_id UUID REFERENCES leave_requests(id) ON DELETE SET NULL,
      course_id SMALLINT REFERENCES courses(id) ON DELETE SET NULL,
      absence_date DATE NOT NULL,
      reason TEXT NOT NULL,
      licensed BOOLEAN NOT NULL DEFAULT false,
      tracking_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  )

  await query('CREATE INDEX IF NOT EXISTS idx_absences_student ON student_absences(student_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_absences_date ON student_absences(absence_date DESC)')
  await query('CREATE INDEX IF NOT EXISTS idx_absences_request ON student_absences(request_id)')
  await query('DROP TRIGGER IF EXISTS trg_absences_updated_at ON student_absences')
  await query(
    `CREATE TRIGGER trg_absences_updated_at BEFORE UPDATE ON student_absences
     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()`
  )

  const count = await query('SELECT COUNT(*)::int AS count FROM student_absences')
  if (count.rows[0].count > 0) return

  await query(
    `INSERT INTO student_absences (student_id, course_id, absence_date, reason, licensed, tracking_code) VALUES
      ((SELECT id FROM students WHERE ru_code='RUDE-0001'), (SELECT id FROM courses WHERE name='2do Secundaria A'), CURRENT_DATE - 7, 'Inasistencia no justificada por retraso de reporte.', false, NULL),
      ((SELECT id FROM students WHERE ru_code='RUDE-0001'), (SELECT id FROM courses WHERE name='2do Secundaria A'), CURRENT_DATE - 4, 'Inasistencia justificada por licencia aprobada.', true, 'LIC-2026-0001'),
      ((SELECT id FROM students WHERE ru_code='RUDE-0002'), (SELECT id FROM courses WHERE name='1ro Secundaria A'), CURRENT_DATE - 3, 'Falta sin aviso previo.', false, NULL)`
  )
}

async function seedDemoRequests() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM leave_requests')
  if (rows[0].count > 0) return

  await query(
    `INSERT INTO leave_requests (
      tracking_code, applicant_id, applicant_kind, student_id, course_id,
      request_type, start_date, end_date, reason, status,
      pre_reviewed_by, pre_review_at, pre_review_comment,
      reviewed_by, reviewed_at, review_comment
    ) VALUES
      (
        'LIC-2026-0001',
        (SELECT id FROM users WHERE username='padre'),
        'guardian',
        (SELECT id FROM students WHERE ru_code='RUDE-0001'),
        (SELECT id FROM courses WHERE name='2do Secundaria A'),
        'medical',
        now() - interval '4 day',
        now() - interval '2 day',
        'Solicitud por reposo medico de un estudiante con certificado adjunto.',
        'approved',
        (SELECT id FROM users WHERE username='docente'),
        now() - interval '3 day',
        'Documentacion verificada y pre-dictamen favorable.',
        (SELECT id FROM users WHERE username='rectora'),
        now() - interval '2 day',
        'Aprobada por direccion.'
      ),
      (
        'LIC-2026-0002',
        (SELECT id FROM users WHERE username='padre'),
        'guardian',
        (SELECT id FROM students WHERE ru_code='RUDE-0002'),
        (SELECT id FROM courses WHERE name='1ro Secundaria A'),
        'personal',
        now() + interval '2 day',
        now() + interval '3 day',
        'Ausencia familiar programada con sustento documentado.',
        'pending',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      ),
      (
        'LIC-2026-0003',
        (SELECT id FROM users WHERE username='docente'),
        'staff',
        NULL,
        (SELECT id FROM courses WHERE name='1ro Secundaria A'),
        'institutional',
        now() + interval '5 day',
        now() + interval '5 day',
        'Permiso institucional para actividad academica externa.',
        'pre_approved',
        (SELECT id FROM users WHERE username='docente'),
        now() - interval '1 day',
        'Se remite a direccion para decision final.',
        NULL,
        NULL,
        NULL
      )
    ON CONFLICT (tracking_code) DO NOTHING`
  )

  await query(
    `INSERT INTO student_absences (student_id, request_id, course_id, absence_date, reason, licensed, tracking_code)
     SELECT
       s.id,
       lr.id,
       lr.course_id,
       (date_trunc('day', lr.start_date) + (ofs || ' day')::interval)::date,
       'Inasistencia justificada por licencia aprobada.',
       true,
       lr.tracking_code
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     CROSS JOIN generate_series(0, 2) AS ofs
     WHERE lr.tracking_code = 'LIC-2026-0001'
    ON CONFLICT DO NOTHING`
  )

  await query(
    `INSERT INTO student_absences (student_id, request_id, course_id, absence_date, reason, licensed, tracking_code) VALUES
      ((SELECT id FROM students WHERE ru_code='RUDE-0001'), NULL, (SELECT id FROM courses WHERE name='2do Secundaria A'), CURRENT_DATE - 7, 'Inasistencia no justificada por retraso de reporte.', false, NULL),
      ((SELECT id FROM students WHERE ru_code='RUDE-0002'), NULL, (SELECT id FROM courses WHERE name='1ro Secundaria A'), CURRENT_DATE - 3, 'Falta sin aviso previo.', false, NULL)
    ON CONFLICT DO NOTHING`
  )
}

async function bootstrap() {
  await ensureSchema()
  await ensureSupplementalSchema()
  await seedReferenceData()
  await seedDemoRequests()
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function getToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return null
  return header.slice(7).trim()
}

async function getPublicUserById(userId) {
  const { rows } = await query(
    `SELECT
      u.id,
      u.username,
      u.name,
      u.email,
      u.phone,
      r.name AS role_name,
      c.name AS student_course,
      tc.assigned_courses,
      pc.linked_students,
      g.id AS guardian_id,
      s.id AS student_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN students s ON s.user_id = u.id
     LEFT JOIN courses c ON c.id = s.course_id
     LEFT JOIN guardians g ON g.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name) AS assigned_courses
       FROM course_reviewers cr
       JOIN courses c ON c.id = cr.course_id
       WHERE cr.reviewer_id = u.id
     ) tc ON true
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object('id', s2.id, 'name', u2.name, 'course', c2.name)
         ORDER BY u2.name
       ) AS linked_students
       FROM student_guardians sg
       JOIN students s2 ON s2.id = sg.student_id
       JOIN users u2 ON u2.id = s2.user_id
       LEFT JOIN courses c2 ON c2.id = s2.course_id
       WHERE sg.guardian_id = g.id
     ) pc ON true
     WHERE u.id = $1`,
    [userId]
  )
  const row = rows[0]
  if (!row) return null

  const assignedCourses = Array.isArray(row.assigned_courses) ? row.assigned_courses : row.assigned_courses || []
  const linkedStudents = Array.isArray(row.linked_students) ? row.linked_students : row.linked_students || []
  const role = row.role_name
  const courseLabel =
    role === 'student'
      ? row.student_course || '—'
      : role === 'parent'
      ? `${linkedStudents.length} estudiantes vinculados`
      : role === 'teacher'
      ? `${assignedCourses.length} cursos asignados`
      : role === 'admin' || role === 'inspector'
      ? 'Gestión institucional'
      : '—'

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role,
    roleLabel: ROLE_LABELS[role] || role,
    course: courseLabel,
    studentCourse: row.student_course,
    assignedCourses,
    linkedStudents,
    initials: initialsOf(row.name),
  }
}

async function authMiddleware(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return res.status(401).json({ error: 'No autenticado.' })
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await getPublicUserById(payload.sub)
    if (!user) return res.status(401).json({ error: 'Sesion invalida.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Sesion invalida.' })
  }
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado.' })
    }
    next()
  }
}

function buildEvents(row) {
  const events = [
    {
      kind: 'created',
      label: `Solicitud creada por ${row.applicant_name}`,
      at: row.created_at,
      note: null,
      actor: row.applicant_name,
    },
  ]
  if (row.pre_review_comment) {
    events.push({
      kind: 'pre_approved',
      label: 'Pre-dictamen emitido',
      at: row.pre_review_at,
      note: row.pre_review_comment,
      actor: row.pre_reviewed_by_name,
    })
  }
  if (row.review_comment && (row.status === 'approved' || row.status === 'rejected')) {
    events.push({
      kind: row.status,
      label: row.status === 'approved' ? 'Licencia aprobada' : 'Licencia rechazada',
      at: row.reviewed_at,
      note: row.review_comment,
      actor: row.reviewed_by_name,
    })
  }
  if (row.status === 'info_required' && row.review_comment) {
    events.push({
      kind: 'info_required',
      label: 'Se solicito correccion / mas informacion',
      at: row.reviewed_at,
      note: row.review_comment,
      actor: row.reviewed_by_name,
    })
  }
  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

function serializeRequest(row, attachments = []) {
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    applicant: {
      name: row.applicant_name,
      kind: row.applicant_kind,
      course: row.course_name || '—',
      email: row.applicant_email || '—',
      phone: row.applicant_phone || '—',
    },
    applicant_kind: row.applicant_kind,
    course: row.course_name || '—',
    course_id: row.course_id,
    student_id: row.student_id,
    request_type: row.request_type,
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason,
    status: row.status,
    created_at: row.created_at,
    pre_reviewed_by_name: row.pre_reviewed_by_name,
    pre_review_at: row.pre_review_at,
    pre_review_comment: row.pre_review_comment,
    reviewed_by_name: row.reviewed_by_name,
    reviewed_at: row.reviewed_at,
    review_comment: row.review_comment,
    attachments,
    initials: initialsOf(row.applicant_name),
    events: buildEvents(row),
  }
}

async function getRequestRowsForUser(user) {
  const baseSql = `
    SELECT
      lr.*,
      applicant.name AS applicant_name,
      applicant.email AS applicant_email,
      applicant.phone AS applicant_phone,
      course.name AS course_name,
      pre_u.name AS pre_reviewed_by_name,
      review_u.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN users applicant ON applicant.id = lr.applicant_id
    LEFT JOIN courses course ON course.id = lr.course_id
    LEFT JOIN users pre_u ON pre_u.id = lr.pre_reviewed_by
    LEFT JOIN users review_u ON review_u.id = lr.reviewed_by
    WHERE lr.deleted_at IS NULL
  `
  let sql = baseSql
  const params = []

  if (user.role === 'teacher') {
    params.push(user.id)
    sql += ' AND EXISTS (SELECT 1 FROM course_reviewers cr WHERE cr.reviewer_id = $1 AND cr.course_id = lr.course_id)'
  } else if (user.role === 'parent') {
    params.push(user.id)
    sql += ` AND (
      lr.applicant_id = $1
      OR EXISTS (
        SELECT 1
        FROM guardians g
        JOIN student_guardians sg ON sg.guardian_id = g.id
        WHERE g.user_id = $1 AND sg.student_id = lr.student_id
      )
    )`
  } else if (user.role === 'student') {
    params.push(user.id)
    sql += ` AND (
      lr.applicant_id = $1
      OR EXISTS (
        SELECT 1
        FROM students s
        WHERE s.user_id = $1 AND s.id = lr.student_id
      )
    )`
  }

  sql += ' ORDER BY lr.created_at DESC'
  const { rows } = await query(sql, params)
  const requestIds = rows.map((row) => row.id)
  const attachmentMap = new Map()
  if (requestIds.length > 0) {
    const { rows: attachments } = await query(
      `SELECT id, request_id, file_name, file_type, file_size, kind, file_url
       FROM request_attachments
       WHERE request_id = ANY($1::uuid[])`,
      [requestIds]
    )
    for (const attachment of attachments) {
      const current = attachmentMap.get(attachment.request_id) || []
      current.push(attachment)
      attachmentMap.set(attachment.request_id, current)
    }
  }
  return rows.map((row) =>
    serializeRequest(
      row,
      (attachmentMap.get(row.id) || []).map((attachment) => ({
        id: attachment.id,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_size: Number(attachment.file_size),
        kind: attachment.kind,
        file_url: attachment.file_url,
      }))
    )
  )
}

async function createAbsencesFromRequest(requestId) {
  const { rows } = await query(
    `SELECT lr.*, s.id AS student_row_id
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1`,
    [requestId]
  )
  const request = rows[0]
  if (!request || !request.student_row_id || request.status !== 'approved') return

  const start = new Date(request.start_date)
  const end = new Date(request.end_date)
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10)
    await query(
      `INSERT INTO student_absences (student_id, request_id, course_id, absence_date, reason, licensed, tracking_code)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT DO NOTHING`,
      [request.student_row_id, request.id, request.course_id, iso, 'Inasistencia justificada por licencia aprobada.', request.tracking_code]
    )
  }
}

async function getAbsencesForUser(user) {
  if (user.role !== 'student' && user.role !== 'parent') return []

  let sql = `
    SELECT
      sa.id,
      sa.absence_date,
      sa.reason,
      sa.licensed,
      sa.tracking_code,
      sa.created_at,
      course.name AS course_name,
      student_user.name AS student_name
    FROM student_absences sa
    JOIN students s ON s.id = sa.student_id
    JOIN users student_user ON student_user.id = s.user_id
    LEFT JOIN courses course ON course.id = sa.course_id
    WHERE 1 = 1
  `
  const params = []

  if (user.role === 'student') {
    sql += ' AND student_user.id = $1'
    params.push(user.id)
  } else {
    sql += ` AND EXISTS (
      SELECT 1
      FROM guardians g
      JOIN student_guardians sg ON sg.guardian_id = g.id
      WHERE g.user_id = $1 AND sg.student_id = s.id
    )`
    params.push(user.id)
  }

  sql += ' ORDER BY sa.absence_date DESC, sa.created_at DESC'
  const { rows } = await query(sql, params)
  return rows.map((row) => ({
    id: row.id,
    date: row.absence_date,
    reason: row.reason,
    licensed: row.licensed,
    tracking_code: row.tracking_code,
    student_name: row.student_name,
    course: row.course_name,
    weekday: new Date(row.absence_date).toLocaleDateString('es-BO', { weekday: 'long' }),
  }))
}

async function getManagementData() {
  const [students, parents, teachers, courses] = await Promise.all([
    query(
      `SELECT
        s.id,
        s.ru_code,
        s.status,
        u.id AS user_id,
        u.username,
        u.name,
        u.email,
        u.phone,
        c.name AS course_name
       FROM students s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN courses c ON c.id = s.course_id
       ORDER BY u.name`
    ),
    query(
      `SELECT
        g.id,
        g.ci_number,
        u.id AS user_id,
        u.username,
        u.name,
        u.email,
        u.phone,
        u.status,
        COALESCE(json_agg(json_build_object('id', s.id, 'name', su.name, 'course', c.name) ORDER BY su.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS children
       FROM guardians g
       LEFT JOIN users u ON u.id = g.user_id
       LEFT JOIN student_guardians sg ON sg.guardian_id = g.id
       LEFT JOIN students s ON s.id = sg.student_id
       LEFT JOIN users su ON su.id = s.user_id
       LEFT JOIN courses c ON c.id = s.course_id
       GROUP BY g.id, u.id
       ORDER BY u.name`
    ),
    query(
      `SELECT
        u.id,
        u.username,
        u.name,
        u.email,
        u.phone,
        u.status,
        COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS courses
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
       LEFT JOIN course_reviewers cr ON cr.reviewer_id = u.id
       LEFT JOIN courses c ON c.id = cr.course_id
       GROUP BY u.id
       ORDER BY u.name`
    ),
    query(`SELECT id, name, level, school_year FROM courses ORDER BY name`),
  ])

  return {
    students: students.rows,
    parents: parents.rows,
    teachers: teachers.rows,
    courses: courses.rows,
  }
}

const app = express()
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bosco-api' })
})

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contrasena son obligatorios.' })
  }

  const { rows } = await query(
    `SELECT u.id
     FROM users u
     WHERE lower(u.username) = lower($1)
       AND u.password_hash = crypt($2, u.password_hash)
       AND u.status = 'active'`,
    [username, password]
  )

  const userId = rows[0]?.id
  if (!userId) return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' })

  const user = await getPublicUserById(userId)
  const token = signToken(userId)
  return res.json({ token, user })
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user })
})

app.post('/api/auth/logout', authMiddleware, async (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/leave-requests', authMiddleware, async (req, res) => {
  const rows = await getRequestRowsForUser(req.user)
  res.json({ items: rows })
})

app.post('/api/leave-requests', authMiddleware, requireRole('parent', 'admin'), async (req, res) => {
  const payload = req.body || {}
  const studentId = String(payload.student_id || '').trim()
  const requestType = String(payload.request_type || 'personal')
  const startDate = String(payload.start_date || '').trim()
  const endDate = String(payload.end_date || '').trim()
  const reason = String(payload.reason || '').trim()

  if (!studentId) {
    return res.status(400).json({ error: 'Debes seleccionar un estudiante.' })
  }
  if (!startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' })
  }

  const studentQuery = await query(
    `SELECT s.id, s.course_id, su.name, su.email
     FROM students s
     JOIN users su ON su.id = s.user_id
     WHERE s.id = $1`,
    [studentId]
  )
  const student = studentQuery.rows[0]
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado.' })
  }

  if (req.user.role === 'parent') {
    const guardianQuery = await query('SELECT id FROM guardians WHERE user_id = $1', [req.user.id])
    const guardian = guardianQuery.rows[0]
    const linkQuery = await query(
      `SELECT 1
       FROM student_guardians
       WHERE guardian_id = $1 AND student_id = $2`,
      [guardian?.id, studentId]
    )
    if (!guardian || linkQuery.rowCount === 0) {
      return res.status(403).json({ error: 'No tienes vinculacion con ese estudiante.' })
    }
  }

  const applicantKind = req.user.role === 'parent' ? 'guardian' : 'staff'
  const insert = await query(
    `INSERT INTO leave_requests (
      applicant_id, applicant_kind, student_id, course_id, request_type,
      start_date, end_date, reason, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING id`,
    [req.user.id, applicantKind, studentId, student.course_id, requestType, `${startDate}T00:00:00`, `${endDate}T23:59:59`, reason]
  )

  const requestId = insert.rows[0].id
  const createdRows = await getRequestRowsForUser(req.user)
  const createdRequest = createdRows.find((row) => row.id === requestId)
  res.status(201).json({ item: createdRequest || null })
})

app.patch('/api/leave-requests/:id/status', authMiddleware, requireRole('teacher', 'inspector', 'admin'), async (req, res) => {
  const id = req.params.id
  const nextStatus = String(req.body?.status || '')
  const comment = String(req.body?.comment || '').trim()

  const { rows } = await query(
    `SELECT lr.*, c.name AS course_name
     FROM leave_requests lr
     LEFT JOIN courses c ON c.id = lr.course_id
     WHERE lr.id = $1`,
    [id]
  )
  const current = rows[0]
  if (!current) return res.status(404).json({ error: 'Solicitud no encontrada.' })

  const assignedCourse = await query(
    `SELECT 1 FROM course_reviewers WHERE reviewer_id = $1 AND course_id = $2`,
    [req.user.id, current.course_id]
  )
  const isAssignedTeacher = req.user.role === 'teacher' && assignedCourse.rowCount > 0
  const canAccess = req.user.role === 'admin' || req.user.role === 'inspector' || isAssignedTeacher
  if (!canAccess) return res.status(403).json({ error: 'No puedes gestionar esta solicitud.' })

  const allowedByRole =
    req.user.role === 'admin'
      ? ['pre_approved', 'approved', 'rejected', 'info_required']
      : req.user.role === 'inspector'
      ? ['pre_approved', 'rejected', 'info_required']
      : ['pre_approved', 'info_required']
  if (!allowedByRole.includes(nextStatus)) {
    return res.status(403).json({ error: 'Transicion no permitida para tu rol.' })
  }

  const updates = {
    pre_approved: { sql: 'UPDATE leave_requests SET status = $2, pre_reviewed_by = $3, pre_review_at = now(), pre_review_comment = $4 WHERE id = $1 RETURNING id', fields: [id, nextStatus, req.user.id, comment] },
    approved: { sql: 'UPDATE leave_requests SET status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 WHERE id = $1 RETURNING id', fields: [id, nextStatus, req.user.id, comment] },
    rejected: { sql: 'UPDATE leave_requests SET status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 WHERE id = $1 RETURNING id', fields: [id, nextStatus, req.user.id, comment] },
    info_required: { sql: 'UPDATE leave_requests SET status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4 WHERE id = $1 RETURNING id', fields: [id, nextStatus, req.user.id, comment] },
  }

  const update = updates[nextStatus]
  if (!update) return res.status(400).json({ error: 'Estado no soportado.' })
  await query(update.sql, update.fields)

  if (nextStatus === 'approved') {
    await createAbsencesFromRequest(id)
  }

  const refreshed = await getRequestRowsForUser(req.user)
  res.json({ item: refreshed.find((row) => row.id === id) || null })
})

app.get('/api/absences/me', authMiddleware, async (req, res) => {
  const items = await getAbsencesForUser(req.user)
  res.json({ items })
})

app.get('/api/admin/management', authMiddleware, requireRole('admin'), async (_req, res) => {
  const data = await getManagementData()
  res.json(data)
})

app.post('/api/admin/guardians', authMiddleware, requireRole('admin'), async (req, res) => {
  const payload = req.body || {}
  const username = String(payload.username || '').trim()
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const password = String(payload.password || '').trim()
  const phone = String(payload.phone || '').trim() || null
  const ciNumber = String(payload.ci_number || '').trim()
  const studentIds = Array.isArray(payload.student_ids) ? payload.student_ids.filter(Boolean) : []
  const relationship = String(payload.relationship || 'padre').trim() || 'padre'

  if (!username || !name || !email || !password || !ciNumber || studentIds.length === 0) {
    return res.status(400).json({ error: 'Completa todos los campos y selecciona al menos un estudiante.' })
  }

  const roleId = (await query(`SELECT id FROM roles WHERE name = 'parent'`)).rows[0]?.id
  const userResult = await query(
    `INSERT INTO users (username, name, email, password_hash, role_id, phone)
     VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5, $6)
     ON CONFLICT (username)
     DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, updated_at = now()
     RETURNING id`,
    [username, name, email, password, roleId, phone]
  )
  const userId = userResult.rows[0].id

  const guardianResult = await query(
    `INSERT INTO guardians (user_id, ci_number)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET ci_number = EXCLUDED.ci_number, updated_at = now()
     RETURNING id`,
    [userId, ciNumber]
  )
  const guardianId = guardianResult.rows[0].id

  for (let index = 0; index < studentIds.length; index += 1) {
    await query(
      `INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, guardian_id)
       DO UPDATE SET relationship = EXCLUDED.relationship, is_primary = EXCLUDED.is_primary, created_at = now()`,
      [studentIds[index], guardianId, relationship, index === 0]
    )
  }

  const data = await getManagementData()
  res.status(201).json({ item: data.parents.find((parent) => parent.user_id === userId) || null, data })
})

app.patch('/api/admin/guardians/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const guardianId = String(req.params.id || '').trim()
  const payload = req.body || {}
  const username = String(payload.username || '').trim()
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const phone = String(payload.phone ?? '').trim() || null
  const ciNumber = String(payload.ci_number ?? '').trim()
  const password = String(payload.password || '')
  const relationship = String(payload.relationship || 'padre').trim() || 'padre'
  const studentIds = Array.isArray(payload.student_ids) ? payload.student_ids.filter(Boolean) : []

  if (!guardianId) return res.status(400).json({ error: 'Identificador de tutor invalido.' })

  const found = await query(
    `SELECT g.id, g.user_id FROM guardians g WHERE g.id = $1`,
    [guardianId]
  )
  if (found.rowCount === 0) return res.status(404).json({ error: 'Tutor no encontrado.' })
  const userId = found.rows[0].user_id

  if (!username || !name || !email) {
    return res.status(400).json({ error: 'Usuario, nombre y email son obligatorios.' })
  }

  const updates = []
  const params = []
  let idx = 1
  updates.push(`username = $${idx++}`)
  params.push(username)
  updates.push(`name = $${idx++}`)
  params.push(name)
  updates.push(`email = $${idx++}`)
  params.push(email)
  updates.push(`phone = $${idx++}`)
  params.push(phone)
  updates.push(`updated_at = now()`)
  if (password) {
    updates.push(`password_hash = crypt($${idx++}, gen_salt('bf'))`)
    params.push(password)
  }
  params.push(userId)
  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
    params
  )

  if (ciNumber) {
    await query(
      `UPDATE guardians SET ci_number = $2, updated_at = now() WHERE id = $1`,
      [guardianId, ciNumber]
    )
  }

  if (studentIds.length > 0) {
    await query(`DELETE FROM student_guardians WHERE guardian_id = $1`, [guardianId])
    for (let index = 0; index < studentIds.length; index += 1) {
      await query(
        `INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, guardian_id)
         DO UPDATE SET relationship = EXCLUDED.relationship, is_primary = EXCLUDED.is_primary, created_at = now()`,
        [studentIds[index], guardianId, relationship, index === 0]
      )
    }
  }

  const data = await getManagementData()
  res.json({ item: data.parents.find((parent) => parent.id === guardianId) || null, data })
})

app.delete('/api/admin/guardians/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const guardianId = String(req.params.id || '').trim()
  const mode = String(req.body?.mode || req.query?.mode || 'deactivate')
  if (!guardianId) return res.status(400).json({ error: 'Identificador de tutor invalido.' })

  const found = await query(
    `SELECT g.id, g.user_id FROM guardians g WHERE g.id = $1`,
    [guardianId]
  )
  if (found.rowCount === 0) return res.status(404).json({ error: 'Tutor no encontrado.' })
  const userId = found.rows[0].user_id

  if (mode === 'delete') {
    await query(`DELETE FROM student_guardians WHERE guardian_id = $1`, [guardianId])
    await query(`DELETE FROM course_reviewers WHERE reviewer_id = $1`, [userId])
    await query(`DELETE FROM guardians WHERE id = $1`, [guardianId])
    try {
      await query(`DELETE FROM users WHERE id = $1`, [userId])
    } catch {
      const data = await getManagementData()
      return res.status(409).json({
        error: 'No se puede borrar al usuario porque tiene solicitudes de permiso registradas a su nombre. Desactiva la cuenta en su lugar.',
        data,
      })
    }
  } else {
    await query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE id = $1`, [userId])
  }

  const data = await getManagementData()
  res.json({ data })
})

app.post('/api/admin/teachers', authMiddleware, requireRole('admin'), async (req, res) => {
  const payload = req.body || {}
  const username = String(payload.username || '').trim()
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const password = String(payload.password || '')
  const phone = String(payload.phone || '').trim() || null
  const courseIds = Array.isArray(payload.course_ids) ? payload.course_ids.filter(Boolean) : []

  if (!username || !name || !email || !password) {
    return res.status(400).json({ error: 'Completa usuario, nombre, email y contrasena del docente.' })
  }

  const roleId = (await query(`SELECT id FROM roles WHERE name = 'teacher'`)).rows[0]?.id
  let userResult
  try {
    userResult = await query(
      `INSERT INTO users (username, name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5, $6)
       ON CONFLICT (username)
       DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, updated_at = now()
       RETURNING id`,
      [username, name, email, password, roleId, phone]
    )
  } catch {
    return res.status(400).json({ error: 'No se pudo crear el docente. Verifica email y usuario.' })
  }
  const userId = userResult.rows[0].id

  if (courseIds.length > 0) {
    await query('DELETE FROM course_reviewers WHERE reviewer_id = $1', [userId])
    for (const courseId of courseIds) {
      await query(
        `INSERT INTO course_reviewers (course_id, reviewer_id)
         VALUES ($1, $2)
         ON CONFLICT (course_id, reviewer_id) DO NOTHING`,
        [courseId, userId]
      )
    }
  }

  const data = await getManagementData()
  res.status(201).json({ item: data.teachers.find((teacher) => teacher.id === userId) || null, data })
})

app.patch('/api/admin/teachers/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const teacherId = String(req.params.id || '').trim()
  const payload = req.body || {}
  const username = String(payload.username || '').trim()
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const phone = String(payload.phone ?? '').trim() || null
  const password = String(payload.password || '')
  const status = String(payload.status || '').trim()
  const courseIds = Array.isArray(payload.course_ids) ? payload.course_ids.filter(Boolean) : null

  if (!teacherId) return res.status(400).json({ error: 'Identificador de docente invalido.' })

  const teacherCheck = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
     WHERE u.id = $1`,
    [teacherId]
  )
  if (teacherCheck.rowCount === 0) return res.status(404).json({ error: 'Docente no encontrado.' })

  if (!username || !name || !email) {
    return res.status(400).json({ error: 'Usuario, nombre y email son obligatorios.' })
  }

  const updates = []
  const params = []
  let idx = 1
  updates.push(`username = $${idx++}`)
  params.push(username)
  updates.push(`name = $${idx++}`)
  params.push(name)
  updates.push(`email = $${idx++}`)
  params.push(email)
  updates.push(`phone = $${idx++}`)
  params.push(phone)
  updates.push(`updated_at = now()`)
  if (password) {
    updates.push(`password_hash = crypt($${idx++}, gen_salt('bf'))`)
    params.push(password)
  }
  if (status === 'active' || status === 'inactive' || status === 'suspended') {
    updates.push(`status = $${idx++}`)
    params.push(status)
  }
  params.push(teacherId)
  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
    params
  )

  if (Array.isArray(courseIds)) {
    await query('DELETE FROM course_reviewers WHERE reviewer_id = $1', [teacherId])
    for (const courseId of courseIds) {
      await query(
        `INSERT INTO course_reviewers (course_id, reviewer_id)
         VALUES ($1, $2)
         ON CONFLICT (course_id, reviewer_id) DO NOTHING`,
        [courseId, teacherId]
      )
    }
  }

  const data = await getManagementData()
  res.json({ item: data.teachers.find((teacher) => teacher.id === teacherId) || null, data })
})

app.delete('/api/admin/teachers/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const teacherId = String(req.params.id || '').trim()
  const mode = String(req.body?.mode || req.query?.mode || 'deactivate')
  if (!teacherId) return res.status(400).json({ error: 'Identificador de docente invalido.' })

  const teacherCheck = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
     WHERE u.id = $1`,
    [teacherId]
  )
  if (teacherCheck.rowCount === 0) return res.status(404).json({ error: 'Docente no encontrado.' })

  if (mode === 'delete') {
    await query('DELETE FROM course_reviewers WHERE reviewer_id = $1', [teacherId])
    try {
      await query(`DELETE FROM users WHERE id = $1`, [teacherId])
    } catch {
      const data = await getManagementData()
      return res.status(409).json({
        error: 'No se puede borrar al docente porque tiene solicitudes de permiso asociadas. Desactiva la cuenta en su lugar.',
        data,
      })
    }
  } else {
    await query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE id = $1`, [teacherId])
  }

  const data = await getManagementData()
  res.json({ data })
})

app.post('/api/admin/course-assignments', authMiddleware, requireRole('admin'), async (req, res) => {
  const teacherId = String(req.body?.teacher_id || '').trim()
  const courseIds = Array.isArray(req.body?.course_ids) ? req.body.course_ids.filter(Boolean) : []
  if (!teacherId || courseIds.length === 0) {
    return res.status(400).json({ error: 'Debes seleccionar un docente y al menos un curso.' })
  }

  const teacherCheck = await query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
     WHERE u.id = $1`,
    [teacherId]
  )
  if (teacherCheck.rowCount === 0) {
    return res.status(404).json({ error: 'Docente no encontrado.' })
  }

  await query('DELETE FROM course_reviewers WHERE reviewer_id = $1', [teacherId])
  for (const courseId of courseIds) {
    await query(
      `INSERT INTO course_reviewers (course_id, reviewer_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, reviewer_id) DO NOTHING`,
      [courseId, teacherId]
    )
  }

  const data = await getManagementData()
  res.json({ data })
})

app.post('/api/admin/courses', authMiddleware, requireRole('admin'), async (req, res) => {
  const payload = req.body || {}
  const name = String(payload.name || '').trim()
  const level = String(payload.level || '').trim() || null
  const schoolYear = String(payload.school_year || '').trim() || null

  if (!name) {
    return res.status(400).json({ error: 'El nombre del curso es obligatorio.' })
  }

  let created
  try {
    created = await query(
      `INSERT INTO courses (name, level, school_year)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET level = EXCLUDED.level, school_year = EXCLUDED.school_year
       RETURNING id, name, level, school_year`,
      [name, level, schoolYear]
    )
  } catch {
    return res.status(400).json({ error: 'No se pudo crear el curso. Verifica que el nombre no exista.' })
  }

  const data = await getManagementData()
  res.status(201).json({ item: created.rows[0], data })
})

async function getTeacherCourses(userId) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.level, c.school_year,
            (cr.reviewer_id IS NOT NULL) AS is_assigned
     FROM courses c
     LEFT JOIN course_reviewers cr ON cr.course_id = c.id AND cr.reviewer_id = $1
     ORDER BY c.name`,
    [userId]
  )
  return rows
}

app.get('/api/teacher/courses', authMiddleware, requireRole('teacher'), async (req, res) => {
  const courses = await getTeacherCourses(req.user.id)
  res.json({ courses })
})

app.get('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { rows } = await query(
    `SELECT
       s.id,
       s.ru_code,
       s.status,
       u.id AS user_id,
       u.username,
       u.name,
       u.email,
       u.phone,
       c.id AS course_id,
       c.name AS course_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN courses c ON c.id = s.course_id
     JOIN course_reviewers cr ON cr.course_id = c.id AND cr.reviewer_id = $1
     ORDER BY c.name, u.name`,
    [req.user.id]
  )
  res.json({ students: rows })
})

app.post('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const payload = req.body || {}
  const username = String(payload.username || '').trim()
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '').trim()
  const password = String(payload.password || '')
  const phone = String(payload.phone || '').trim() || null
  const ruCode = String(payload.ru_code || '').trim() || null
  const courseId = payload.course_id != null ? String(payload.course_id) : ''

  if (!username || !name || !email || !password || !courseId) {
    return res.status(400).json({ error: 'Completa usuario, nombre, email, contrasena y curso.' })
  }

  const courseCheck = await query(`SELECT id FROM courses WHERE id = $1`, [courseId])
  if (courseCheck.rowCount === 0) {
    return res.status(404).json({ error: 'El curso seleccionado no existe.' })
  }

  await query(
    `INSERT INTO course_reviewers (course_id, reviewer_id)
     VALUES ($1, $2)
     ON CONFLICT (course_id, reviewer_id) DO NOTHING`,
    [courseId, req.user.id]
  )

  const roleId = (await query(`SELECT id FROM roles WHERE name = 'student'`)).rows[0]?.id
  let userResult
  try {
    userResult = await query(
      `INSERT INTO users (username, name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), $5, $6)
       ON CONFLICT (username)
       DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash, updated_at = now()
       RETURNING id`,
      [username, name, email, password, roleId, phone]
    )
  } catch {
    return res.status(400).json({ error: 'No se pudo crear el usuario. Verifica email y usuario.' })
  }
  const userId = userResult.rows[0].id

  let studentResult
  try {
    studentResult = await query(
      `INSERT INTO students (user_id, ru_code, course_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET ru_code = EXCLUDED.ru_code, course_id = EXCLUDED.course_id, updated_at = now()
       RETURNING id`,
      [userId, ruCode, courseId]
    )
  } catch {
    return res.status(400).json({ error: 'No se pudo crear el alumno. El RUDE ya existe para otro estudiante.' })
  }
  const studentId = studentResult.rows[0].id

  const { rows } = await query(
    `SELECT
       s.id,
       s.ru_code,
       s.status,
       u.id AS user_id,
       u.username,
       u.name,
       u.email,
       u.phone,
       c.id AS course_id,
       c.name AS course_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN courses c ON c.id = s.course_id
     WHERE s.id = $1`,
    [studentId]
  )

  res.status(201).json({ item: rows[0] || null })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

async function start() {
  await bootstrap()
  app.listen(PORT, () => {
    console.log(`Bosco API listening on http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})