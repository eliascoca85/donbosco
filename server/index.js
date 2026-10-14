/* global process */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'
import { Buffer } from 'node:buffer'

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

// Ejecuta varias consultas como una sola operacion: si una falla, no queda nada a medias.
async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((text, params = []) => client.query(text, params))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const UNIQUE_MESSAGES = {
  users_username_key: 'Ese nombre de usuario ya esta registrado.',
  users_email_key: 'Ese email ya esta registrado.',
  guardians_ci_number_key: 'Ya existe un padre / tutor con ese CI.',
  students_ru_code_key: 'Ese RUDE ya pertenece a otro estudiante.',
  courses_name_key: 'Ya existe un curso con ese nombre.',
}

const LEAVE_TYPES = ['medical', 'personal', 'calamidad_domestica', 'institutional', 'other']
const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const MAX_ATTACHMENTS = 3
const DECIDABLE_STATUSES = ['pending', 'pre_approved', 'info_required']
const RELATIONSHIPS = ['padre', 'madre', 'tutor legal']

function parseIsoDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  return Number.isNaN(new Date(`${text}T00:00:00Z`).getTime()) ? null : text
}

function normalizeRelationship(value) {
  const text = String(value || '').trim().toLowerCase()
  return RELATIONSHIPS.includes(text) ? text : 'padre'
}

// Valida los adjuntos enviados como data URL (base64) desde el formulario.
function parseAttachments(list) {
  if (list == null) return []
  if (!Array.isArray(list)) throw new HttpError(400, 'Adjuntos invalidos.')
  if (list.length > MAX_ATTACHMENTS) throw new HttpError(400, `Puedes adjuntar como maximo ${MAX_ATTACHMENTS} archivos.`)
  return list.map((item) => {
    const fileName = String(item?.file_name || '').trim().slice(0, 180)
    const dataUrl = String(item?.data_url || '')
    const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!fileName || !match) throw new HttpError(400, 'Un adjunto no se pudo leer. Vuelve a seleccionarlo.')
    const fileType = match[1]
    if (!ATTACHMENT_TYPES.includes(fileType)) {
      throw new HttpError(400, `"${fileName}" no es PDF, JPG, PNG ni WEBP.`)
    }
    const fileSize = Buffer.byteLength(match[2], 'base64')
    if (fileSize <= 0 || fileSize > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(400, `"${fileName}" supera el limite de 5 MB.`)
    }
    return { fileName, fileType, fileSize, dataUrl }
  })
}

async function insertAttachments(run, requestId, userId, attachments) {
  for (const att of attachments) {
    await run(
      `INSERT INTO request_attachments (request_id, uploaded_by, kind, storage_path, file_url, file_name, file_type, file_size)
       VALUES ($1, $2, 'evidence', 'inline', $3, $4, $5, $6)`,
      [requestId, userId, att.dataUrl, att.fileName, att.fileType, att.fileSize]
    )
  }
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
      ('admin', 'Direccion - gestiona padres, docentes y decide permisos'),
      ('inspector', 'Inspectoria - gestiona padres, docentes y decide permisos'),
      ('teacher', 'Docente - registra estudiantes de sus cursos y los vincula con sus padres'),
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
      ((SELECT id FROM courses WHERE name='2do Secundaria A'), (SELECT id FROM users WHERE username='docente'))
    ON CONFLICT (course_id, reviewer_id) DO NOTHING`
  )
}

const AUDIT_TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION fn_audit_leave_request()
RETURNS trigger AS $fn$
DECLARE
    act audit_action;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
        VALUES (NEW.applicant_id, 'create', 'leave_requests', NEW.id::text,
                jsonb_build_object('to', NEW.status, 'tracking_code', NEW.tracking_code));
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
        VALUES (NULL, 'delete', 'leave_requests', OLD.id::text,
                jsonb_build_object('tracking_code', OLD.tracking_code));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            CASE NEW.status
                WHEN 'pre_approved'  THEN act := 'pre_approve';
                WHEN 'approved'      THEN act := 'approve';
                WHEN 'rejected'      THEN act := 'reject';
                WHEN 'info_required' THEN act := 'request_info';
                ELSE act := 'update';
            END CASE;
            INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
            VALUES (
                CASE WHEN NEW.status IN ('pending', 'cancelled') THEN NEW.applicant_id
                     WHEN NEW.status = 'pre_approved' THEN NEW.pre_reviewed_by
                     ELSE NEW.reviewed_by END,
                act,
                'leave_requests',
                NEW.id::text,
                jsonb_build_object(
                    'from', OLD.status,
                    'to',   NEW.status,
                    'comment', CASE WHEN NEW.status IN ('pending', 'cancelled') THEN NULL
                                    WHEN NEW.status = 'pre_approved' THEN NEW.pre_review_comment
                                    ELSE NEW.review_comment END
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql`

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

  await query('ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ')
  await query('CREATE INDEX IF NOT EXISTS idx_absences_student ON student_absences(student_id)')
  await query('CREATE INDEX IF NOT EXISTS idx_absences_date ON student_absences(absence_date DESC)')
  await query('CREATE INDEX IF NOT EXISTS idx_absences_request ON student_absences(request_id)')
  await query('DROP TRIGGER IF EXISTS trg_absences_updated_at ON student_absences')
  await query(
    `CREATE TRIGGER trg_absences_updated_at BEFORE UPDATE ON student_absences
     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()`
  )

  // Solo los docentes acompanan cursos; Direccion e Inspectoria ya ven todo.
  await query(
    `DELETE FROM course_reviewers cr USING users u, roles r
     WHERE u.id = cr.reviewer_id AND r.id = u.role_id AND r.name <> 'teacher'`
  )

  // La version original no registraba la creacion y atribuia el reenvio del padre al revisor.
  await query(AUDIT_TRIGGER_SQL)

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
      u.status,
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
       WHERE sg.guardian_id = g.id AND s2.status = 'active'
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
    active: row.status === 'active',
  }
}

async function authMiddleware(req, res, next) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No autenticado.' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Tu sesion expiro. Vuelve a ingresar.' })
  }
  // Un fallo de la base de datos es un 500, no una sesion invalida: no debe cerrar la sesion del usuario.
  try {
    const user = await getPublicUserById(payload.sub)
    if (!user) return res.status(401).json({ error: 'Sesion invalida.' })
    if (!user.active) return res.status(401).json({ error: 'Tu cuenta esta desactivada. Comunicate con la direccion.' })
    req.user = user
    next()
  } catch (error) {
    next(error)
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

// Eventos a partir de las columnas actuales; solo se usa si la solicitud no tiene historial en audit_logs
// (por ejemplo, las solicitudes demo insertadas antes de corregir el trigger).
function buildEventsFromRow(row) {
  const events = []
  if (row.pre_review_comment) {
    events.push({
      kind: 'pre_approved',
      label: 'Pre-dictamen emitido',
      at: row.pre_review_at,
      note: row.pre_review_comment,
      actor: row.pre_reviewed_by_name,
    })
  }
  if (row.reviewed_at && (row.status === 'approved' || row.status === 'rejected')) {
    events.push({
      kind: row.status,
      label: `${row.status === 'approved' ? 'Permiso aprobado' : 'Permiso rechazado'} por ${row.reviewed_by_name || 'direccion'}`,
      at: row.reviewed_at,
      note: row.review_comment || null,
      actor: row.reviewed_by_name,
    })
  }
  if (row.reviewed_at && row.status !== 'approved' && row.status !== 'rejected' && row.review_comment) {
    events.push({
      kind: 'info_required',
      label: `Correccion solicitada por ${row.reviewed_by_name || 'direccion'}`,
      at: row.reviewed_at,
      note: row.review_comment,
      actor: row.reviewed_by_name,
    })
    if (row.status === 'pending' && row.resubmitted_at) {
      events.push({
        kind: 'created',
        label: 'Solicitud corregida y reenviada',
        at: row.resubmitted_at,
        note: null,
        actor: row.applicant_name,
      })
    }
  }
  return events
}

function eventFromLog(log, row) {
  const to = log.metadata?.to
  const note = log.metadata?.comment || null
  const who = log.actor_name || 'direccion'
  if (to === 'approved') return { kind: 'approved', label: `Permiso aprobado por ${who}`, at: log.created_at, note, actor: log.actor_name }
  if (to === 'rejected') return { kind: 'rejected', label: `Permiso rechazado por ${who}`, at: log.created_at, note, actor: log.actor_name }
  if (to === 'info_required') {
    return { kind: 'info_required', label: `Correccion solicitada por ${who}`, at: log.created_at, note, actor: log.actor_name }
  }
  if (to === 'pre_approved') return { kind: 'pre_approved', label: 'Pre-dictamen emitido', at: log.created_at, note, actor: log.actor_name }
  if (to === 'pending' && log.metadata?.from === 'info_required') {
    return { kind: 'created', label: 'Solicitud corregida y reenviada', at: log.created_at, note: null, actor: row.applicant_name }
  }
  if (to === 'cancelled') return { kind: 'rejected', label: 'Solicitud anulada', at: log.created_at, note, actor: log.actor_name }
  return null
}

function buildEvents(row, history = []) {
  const created = {
    kind: 'created',
    label: `Solicitud creada por ${row.applicant_name}`,
    at: row.created_at,
    note: null,
    actor: row.applicant_name,
  }
  const transitions = history.filter((log) => log.action !== 'create' && log.action !== 'delete')
  const rest = transitions.length
    ? transitions.map((log) => eventFromLog(log, row)).filter(Boolean)
    : buildEventsFromRow(row)
  return [created, ...rest].sort((a, b) => new Date(a.at) - new Date(b.at))
}

function serializeRequest(row, attachments = [], history = []) {
  return {
    id: row.id,
    tracking_code: row.tracking_code,
    student_name: row.student_name || null,
    applicant: {
      name: row.applicant_name,
      kind: row.applicant_kind,
      course: row.course_name || '—',
      email: row.applicant_email || '—',
      phone: row.applicant_phone || '—',
    },
    applicant_kind: row.applicant_kind,
    applicant_id: row.applicant_id,
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
    events: buildEvents(row, history),
  }
}

async function getRequestRowsForUser(user, onlyId = null) {
  const baseSql = `
    SELECT
      lr.*,
      applicant.name AS applicant_name,
      applicant.email AS applicant_email,
      applicant.phone AS applicant_phone,
      course.name AS course_name,
      student_user.name AS student_name,
      pre_u.name AS pre_reviewed_by_name,
      review_u.name AS reviewed_by_name
    FROM leave_requests lr
    JOIN users applicant ON applicant.id = lr.applicant_id
    LEFT JOIN courses course ON course.id = lr.course_id
    LEFT JOIN students st ON st.id = lr.student_id
    LEFT JOIN users student_user ON student_user.id = st.user_id
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

  if (onlyId) {
    params.push(onlyId)
    sql += ` AND lr.id = $${params.length}`
  }
  sql += ' ORDER BY lr.created_at DESC'
  const { rows } = await query(sql, params)
  const requestIds = rows.map((row) => row.id)
  const attachmentMap = new Map()
  if (requestIds.length > 0) {
    const { rows: attachments } = await query(
      `SELECT id, request_id, file_name, file_type, file_size, kind
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
  // Historial completo de cambios de estado: cada correccion y decision conserva su comentario.
  const historyMap = new Map()
  if (requestIds.length > 0) {
    const { rows: logs } = await query(
      `SELECT al.entity_id, al.action, al.metadata, al.created_at, u.name AS actor_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       WHERE al.entity_type = 'leave_requests' AND al.entity_id = ANY($1::text[])
       ORDER BY al.created_at, al.id`,
      [requestIds.map(String)]
    )
    for (const log of logs) {
      const current = historyMap.get(log.entity_id) || []
      current.push(log)
      historyMap.set(log.entity_id, current)
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
      })),
      historyMap.get(String(row.id)) || []
    )
  )
}

// Al aprobar un permiso, cada dia habil del periodo queda como falta justificada.
// Si ya existia una falta sin licencia ese dia, se marca como justificada en lugar de duplicarla.
async function createAbsencesFromRequest(run, requestId) {
  const { rows } = await run(
    `SELECT lr.id, lr.student_id, lr.course_id, lr.tracking_code, d::date AS day
     FROM leave_requests lr
     CROSS JOIN LATERAL generate_series(lr.start_date::date, lr.end_date::date, interval '1 day') AS d
     WHERE lr.id = $1 AND lr.status = 'approved' AND lr.student_id IS NOT NULL
       AND EXTRACT(ISODOW FROM d) < 6`,
    [requestId]
  )
  for (const row of rows) {
    const updated = await run(
      `UPDATE student_absences
       SET licensed = true, request_id = $2, tracking_code = $3, reason = $4
       WHERE student_id = $1 AND absence_date = $5`,
      [row.student_id, row.id, row.tracking_code, 'Inasistencia justificada por licencia aprobada.', row.day]
    )
    if (updated.rowCount > 0) continue
    await run(
      `INSERT INTO student_absences (student_id, request_id, course_id, absence_date, reason, licensed, tracking_code)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [row.student_id, row.id, row.course_id, row.day, 'Inasistencia justificada por licencia aprobada.', row.tracking_code]
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
        c.id AS course_id,
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
        COALESCE(json_agg(json_build_object('id', s.id, 'name', su.name, 'course', c.name, 'relationship', sg.relationship) ORDER BY su.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS children
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
// Los adjuntos viajan en base64 (hasta 3 x 5 MB), por eso el limite es mayor al habitual.
app.use(express.json({ limit: '25mb' }))

// Direccion e inspectoria comparten las mismas atribuciones de gestion.
const MANAGERS = ['admin', 'inspector']

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
    `SELECT u.id, u.status
     FROM users u
     WHERE lower(u.username) = lower($1)
       AND u.password_hash = crypt($2, u.password_hash)`,
    [username, password]
  )

  const found = rows[0]
  if (!found) return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' })
  if (found.status !== 'active') {
    return res.status(403).json({ error: 'Tu cuenta esta desactivada. Comunicate con la direccion.' })
  }

  const user = await getPublicUserById(found.id)
  const token = signToken(found.id)
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

function readLeavePayload(payload) {
  const requestType = String(payload.request_type || '')
  const startDate = parseIsoDate(payload.start_date)
  const endDate = parseIsoDate(payload.end_date)
  const reason = String(payload.reason || '').trim()

  if (!LEAVE_TYPES.includes(requestType)) throw new HttpError(400, 'Selecciona un tipo de permiso valido.')
  if (!startDate || !endDate) throw new HttpError(400, 'Indica la fecha de inicio y de fin.')
  if (endDate < startDate) throw new HttpError(400, 'La fecha de fin no puede ser anterior a la de inicio.')
  if (reason.length < 10) throw new HttpError(400, 'Describe el motivo con al menos 10 caracteres.')
  return { requestType, startDate, endDate, reason }
}

// Evita dos permisos abiertos o aprobados para el mismo estudiante en fechas que se cruzan.
async function assertNoOverlap(run, studentId, startDate, endDate, exceptId = null) {
  const { rows } = await run(
    `SELECT tracking_code FROM leave_requests
     WHERE student_id = $1 AND deleted_at IS NULL
       AND status IN ('pending', 'pre_approved', 'info_required', 'approved')
       AND start_date::date <= $3::date AND end_date::date >= $2::date
       AND ($4::uuid IS NULL OR id <> $4::uuid)
     LIMIT 1`,
    [studentId, startDate, endDate, exceptId]
  )
  if (rows[0]) {
    throw new HttpError(409, `Ya existe el permiso ${rows[0].tracking_code} para esas fechas. Revisa "Mis solicitudes".`)
  }
}

// Solo los padres / tutores solicitan permisos, y solo para estudiantes vinculados a ellos.
app.post('/api/leave-requests', authMiddleware, requireRole('parent'), async (req, res) => {
  const payload = req.body || {}
  const studentId = String(payload.student_id || '').trim()
  if (!studentId) return res.status(400).json({ error: 'Selecciona el estudiante para quien pides el permiso.' })
  const { requestType, startDate, endDate, reason } = readLeavePayload(payload)
  const attachments = parseAttachments(payload.attachments)

  const link = await query(
    `SELECT s.id, s.course_id, s.status
     FROM students s
     JOIN student_guardians sg ON sg.student_id = s.id
     JOIN guardians g ON g.id = sg.guardian_id
     WHERE s.id = $1 AND g.user_id = $2`,
    [studentId, req.user.id]
  )
  const student = link.rows[0]
  if (!student) return res.status(403).json({ error: 'Ese estudiante no esta vinculado a tu cuenta.' })
  if (student.status !== 'active') {
    return res.status(409).json({ error: 'El estudiante figura como retirado; comunicate con su profesor de curso.' })
  }
  await assertNoOverlap(query, student.id, startDate, endDate)

  const requestId = await withTransaction(async (run) => {
    const insert = await run(
      `INSERT INTO leave_requests (
        applicant_id, applicant_kind, student_id, course_id, request_type,
        start_date, end_date, reason, status
      ) VALUES ($1, 'guardian', $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING id`,
      [req.user.id, student.id, student.course_id, requestType, `${startDate}T00:00:00`, `${endDate}T23:59:59`, reason]
    )
    const id = insert.rows[0].id
    await insertAttachments(run, id, req.user.id, attachments)
    return id
  })

  const [created] = await getRequestRowsForUser(req.user, requestId)
  res.status(201).json({ item: created || null })
})

// El padre corrige una solicitud devuelta por direccion / inspectoria y la reenvia a revision.
app.patch('/api/leave-requests/:id', authMiddleware, requireRole('parent'), async (req, res) => {
  const id = String(req.params.id)
  const payload = req.body || {}
  const { requestType, startDate, endDate, reason } = readLeavePayload(payload)
  const attachments = parseAttachments(payload.attachments)

  const { rows } = await query(
    `SELECT id, status, student_id FROM leave_requests WHERE id = $1 AND applicant_id = $2 AND deleted_at IS NULL`,
    [id, req.user.id]
  )
  const current = rows[0]
  if (!current) return res.status(404).json({ error: 'Solicitud no encontrada.' })
  if (current.status !== 'info_required') {
    return res.status(409).json({ error: 'Solo puedes corregir solicitudes a las que se pidio correccion.' })
  }
  if (current.student_id) await assertNoOverlap(query, current.student_id, startDate, endDate, id)

  await withTransaction(async (run) => {
    await run(
      `UPDATE leave_requests
       SET request_type = $2, start_date = $3, end_date = $4, reason = $5,
           status = 'pending', resubmitted_at = now()
       WHERE id = $1`,
      [id, requestType, `${startDate}T00:00:00`, `${endDate}T23:59:59`, reason]
    )
    const existing = await run('SELECT COUNT(*)::int AS count FROM request_attachments WHERE request_id = $1', [id])
    if (existing.rows[0].count + attachments.length > MAX_ATTACHMENTS) {
      throw new HttpError(400, `La solicitud ya tiene adjuntos; el maximo es ${MAX_ATTACHMENTS}.`)
    }
    await insertAttachments(run, id, req.user.id, attachments)
  })

  const [updated] = await getRequestRowsForUser(req.user, id)
  res.json({ item: updated || null })
})

// Decision sobre un permiso: solo direccion e inspectoria.
// approved / rejected cierran el expediente; info_required lo devuelve al padre para corregir.
app.patch('/api/leave-requests/:id/status', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const id = String(req.params.id)
  const nextStatus = String(req.body?.status || '')
  const comment = String(req.body?.comment || '').trim()

  if (!['approved', 'rejected', 'info_required'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Decision no valida.' })
  }
  if ((nextStatus === 'rejected' || nextStatus === 'info_required') && !comment) {
    return res.status(400).json({ error: 'Indica el motivo para el padre / tutor.' })
  }

  await withTransaction(async (run) => {
    const { rows } = await run(
      'SELECT id, status FROM leave_requests WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [id]
    )
    const current = rows[0]
    if (!current) throw new HttpError(404, 'Solicitud no encontrada.')
    if (!DECIDABLE_STATUSES.includes(current.status)) {
      throw new HttpError(409, 'Esta solicitud ya fue cerrada y no admite otra decision.')
    }
    if (nextStatus === 'info_required' && current.status === 'info_required') {
      throw new HttpError(409, 'Ya se pidio una correccion; espera a que el padre / tutor la reenvie.')
    }

    await run(
      `UPDATE leave_requests
       SET status = $2, reviewed_by = $3, reviewed_at = now(), review_comment = $4
       WHERE id = $1`,
      [id, nextStatus, req.user.id, comment || null]
    )
    if (nextStatus === 'approved') await createAbsencesFromRequest(run, id)
  })

  const [refreshed] = await getRequestRowsForUser(req.user, id)
  res.json({ item: refreshed || null })
})

// Descarga de un adjunto; solo para quien puede ver la solicitud.
app.get('/api/leave-requests/:id/attachments/:attachmentId', authMiddleware, async (req, res) => {
  const [visible] = await getRequestRowsForUser(req.user, String(req.params.id))
  if (!visible) return res.status(404).json({ error: 'Solicitud no encontrada.' })
  const { rows } = await query(
    'SELECT id, file_name, file_type, file_size, file_url FROM request_attachments WHERE id = $1 AND request_id = $2',
    [String(req.params.attachmentId), visible.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Adjunto no encontrado.' })
  res.json({ item: { ...rows[0], file_size: Number(rows[0].file_size) } })
})

app.get('/api/absences/me', authMiddleware, async (req, res) => {
  const items = await getAbsencesForUser(req.user)
  res.json({ items })
})

/* ------------------------------------------------------------------ */
/* Gestion institucional (direccion e inspectoria)                     */
/* ------------------------------------------------------------------ */

app.get('/api/admin/management', authMiddleware, requireRole(...MANAGERS), async (_req, res) => {
  const data = await getManagementData()
  res.json(data)
})

function readPerson(payload, { requirePassword }) {
  const person = {
    username: String(payload.username || '').trim().toLowerCase(),
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim(),
    password: String(payload.password || ''),
    phone: String(payload.phone ?? '').trim() || null,
  }
  if (person.username.length < 3) throw new HttpError(400, 'El usuario debe tener al menos 3 caracteres.')
  if (!/^[a-z0-9._-]+$/.test(person.username)) {
    throw new HttpError(400, 'El usuario solo admite letras, numeros, punto, guion y guion bajo.')
  }
  if (person.name.length < 3) throw new HttpError(400, 'Escribe el nombre completo.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) throw new HttpError(400, 'El email no es valido.')
  if (person.phone && !/^\+?[0-9\-\s]{6,20}$/.test(person.phone)) {
    throw new HttpError(400, 'El telefono solo admite numeros, espacios y guiones.')
  }
  if (requirePassword && person.password.length < 6) {
    throw new HttpError(400, 'La contrasena inicial debe tener al menos 6 caracteres.')
  }
  if (!requirePassword && person.password && person.password.length < 6) {
    throw new HttpError(400, 'La nueva contrasena debe tener al menos 6 caracteres.')
  }
  return person
}

function readStatus(value) {
  const status = String(value || '').trim()
  return status === 'active' || status === 'inactive' ? status : null
}

// Sincroniza los estudiantes a cargo: quita los desmarcados, agrega los nuevos con el parentesco elegido
// y conserva intactos los vinculos que ya existian (por ejemplo, los que registro el docente).
async function replaceGuardianStudents(run, guardianId, studentIds, relationship) {
  await run('DELETE FROM student_guardians WHERE guardian_id = $1 AND NOT (student_id = ANY($2::uuid[]))', [
    guardianId,
    studentIds,
  ])
  for (const studentId of studentIds) {
    await run(
      `INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
       VALUES ($1, $2, $3, NOT EXISTS (SELECT 1 FROM student_guardians WHERE student_id = $1))
       ON CONFLICT (student_id, guardian_id) DO NOTHING`,
      [studentId, guardianId, relationship]
    )
  }
}

app.post('/api/admin/guardians', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: true })
  const ciNumber = String(payload.ci_number || '').trim()
  const relationship = normalizeRelationship(payload.relationship)
  const studentIds = Array.isArray(payload.student_ids) ? [...new Set(payload.student_ids.filter(Boolean))] : []
  if (!ciNumber) return res.status(400).json({ error: 'El CI del padre / tutor es obligatorio.' })

  const userId = await withTransaction(async (run) => {
    const user = await run(
      `INSERT INTO users (username, name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), (SELECT id FROM roles WHERE name = 'parent'), $5)
       RETURNING id`,
      [person.username, person.name, person.email, person.password, person.phone]
    )
    const guardian = await run(
      'INSERT INTO guardians (user_id, ci_number) VALUES ($1, $2) RETURNING id',
      [user.rows[0].id, ciNumber]
    )
    await replaceGuardianStudents(run, guardian.rows[0].id, studentIds, relationship)
    return user.rows[0].id
  })

  const data = await getManagementData()
  res.status(201).json({ item: data.parents.find((parent) => parent.user_id === userId) || null, data })
})

app.patch('/api/admin/guardians/:id', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const guardianId = String(req.params.id || '').trim()
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: false })
  const ciNumber = String(payload.ci_number ?? '').trim()
  const relationship = normalizeRelationship(payload.relationship)
  const status = readStatus(payload.status)
  const studentIds = Array.isArray(payload.student_ids) ? [...new Set(payload.student_ids.filter(Boolean))] : null
  if (!ciNumber) return res.status(400).json({ error: 'El CI del padre / tutor es obligatorio.' })

  await withTransaction(async (run) => {
    const found = await run('SELECT id, user_id FROM guardians WHERE id = $1', [guardianId])
    if (found.rowCount === 0) throw new HttpError(404, 'Padre / tutor no encontrado.')
    const userId = found.rows[0].user_id

    const params = [userId, person.username, person.name, person.email, person.phone]
    let sets = 'username = $2, name = $3, email = $4, phone = $5, updated_at = now()'
    if (person.password) {
      params.push(person.password)
      sets += `, password_hash = crypt($${params.length}, gen_salt('bf'))`
    }
    if (status) {
      params.push(status)
      sets += `, status = $${params.length}`
    }
    await run(`UPDATE users SET ${sets} WHERE id = $1`, params)
    await run('UPDATE guardians SET ci_number = $2, updated_at = now() WHERE id = $1', [guardianId, ciNumber])
    if (studentIds) await replaceGuardianStudents(run, guardianId, studentIds, relationship)
  })

  const data = await getManagementData()
  res.json({ item: data.parents.find((parent) => parent.id === guardianId) || null, data })
})

// Se desactiva la cuenta (no se borra) para conservar el historial de permisos.
app.delete('/api/admin/guardians/:id', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const guardianId = String(req.params.id || '').trim()
  const found = await query('SELECT user_id FROM guardians WHERE id = $1', [guardianId])
  if (found.rowCount === 0) return res.status(404).json({ error: 'Padre / tutor no encontrado.' })
  await query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE id = $1`, [found.rows[0].user_id])
  const data = await getManagementData()
  res.json({ data })
})

async function assertTeacher(run, teacherId) {
  const check = await run(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id AND r.name = 'teacher' WHERE u.id = $1`,
    [teacherId]
  )
  if (check.rowCount === 0) throw new HttpError(404, 'Docente no encontrado.')
}

async function replaceTeacherCourses(run, teacherId, courseIds) {
  await run('DELETE FROM course_reviewers WHERE reviewer_id = $1', [teacherId])
  for (const courseId of courseIds) {
    await run('INSERT INTO course_reviewers (course_id, reviewer_id) VALUES ($1, $2)', [courseId, teacherId])
  }
}

function readCourseIds(value) {
  if (!Array.isArray(value)) return null
  const ids = [...new Set(value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
  return ids
}

app.post('/api/admin/teachers', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: true })
  const courseIds = readCourseIds(payload.course_ids) || []

  const userId = await withTransaction(async (run) => {
    const user = await run(
      `INSERT INTO users (username, name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), (SELECT id FROM roles WHERE name = 'teacher'), $5)
       RETURNING id`,
      [person.username, person.name, person.email, person.password, person.phone]
    )
    await replaceTeacherCourses(run, user.rows[0].id, courseIds)
    return user.rows[0].id
  })

  const data = await getManagementData()
  res.status(201).json({ item: data.teachers.find((teacher) => teacher.id === userId) || null, data })
})

app.patch('/api/admin/teachers/:id', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const teacherId = String(req.params.id || '').trim()
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: false })
  const status = readStatus(payload.status)
  const courseIds = readCourseIds(payload.course_ids)

  await withTransaction(async (run) => {
    await assertTeacher(run, teacherId)
    const params = [teacherId, person.username, person.name, person.email, person.phone]
    let sets = 'username = $2, name = $3, email = $4, phone = $5, updated_at = now()'
    if (person.password) {
      params.push(person.password)
      sets += `, password_hash = crypt($${params.length}, gen_salt('bf'))`
    }
    if (status) {
      params.push(status)
      sets += `, status = $${params.length}`
    }
    await run(`UPDATE users SET ${sets} WHERE id = $1`, params)
    if (courseIds) await replaceTeacherCourses(run, teacherId, courseIds)
  })

  const data = await getManagementData()
  res.json({ item: data.teachers.find((teacher) => teacher.id === teacherId) || null, data })
})

app.delete('/api/admin/teachers/:id', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const teacherId = String(req.params.id || '').trim()
  await assertTeacher(query, teacherId)
  await query(`UPDATE users SET status = 'inactive', updated_at = now() WHERE id = $1`, [teacherId])
  const data = await getManagementData()
  res.json({ data })
})

// Asigna el docente a uno o varios cursos (aulas). Una lista vacia le quita todos.
app.post('/api/admin/course-assignments', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const teacherId = String(req.body?.teacher_id || '').trim()
  const courseIds = readCourseIds(req.body?.course_ids)
  if (!teacherId || !courseIds) {
    return res.status(400).json({ error: 'Selecciona un docente y sus cursos.' })
  }

  await withTransaction(async (run) => {
    await assertTeacher(run, teacherId)
    await replaceTeacherCourses(run, teacherId, courseIds)
  })

  const data = await getManagementData()
  res.json({ data })
})

app.post('/api/admin/courses', authMiddleware, requireRole(...MANAGERS), async (req, res) => {
  const payload = req.body || {}
  const name = String(payload.name || '').trim()
  const level = String(payload.level || '').trim() || null
  const schoolYear = String(payload.school_year || '').trim() || null
  if (name.length < 3) return res.status(400).json({ error: 'Escribe el nombre del curso, por ejemplo "1ro Secundaria A".' })

  const created = await query(
    `INSERT INTO courses (name, level, school_year) VALUES ($1, $2, $3)
     RETURNING id, name, level, school_year`,
    [name, level, schoolYear]
  )

  const data = await getManagementData()
  res.status(201).json({ item: created.rows[0], data })
})

/* ------------------------------------------------------------------ */
/* Docentes: estudiantes de sus cursos y vinculo con padres            */
/* ------------------------------------------------------------------ */

async function getTeacherCourses(userId) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.level, c.school_year
     FROM courses c
     JOIN course_reviewers cr ON cr.course_id = c.id AND cr.reviewer_id = $1
     ORDER BY c.name`,
    [userId]
  )
  return rows
}

async function getTeacherStudents(userId, onlyStudentId = null) {
  const params = [userId]
  let filter = ''
  if (onlyStudentId) {
    params.push(onlyStudentId)
    filter = 'AND s.id = $2'
  }
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
       c.name AS course_name,
       COALESCE(
         json_agg(json_build_object('id', g.id, 'name', gu.name, 'ci_number', g.ci_number, 'relationship', sg.relationship)
           ORDER BY gu.name) FILTER (WHERE g.id IS NOT NULL),
         '[]'::json
       ) AS guardians
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN courses c ON c.id = s.course_id
     JOIN course_reviewers cr ON cr.course_id = c.id AND cr.reviewer_id = $1
     LEFT JOIN student_guardians sg ON sg.student_id = s.id
     LEFT JOIN guardians g ON g.id = sg.guardian_id
     LEFT JOIN users gu ON gu.id = g.user_id
     WHERE 1 = 1 ${filter}
     GROUP BY s.id, u.id, c.id
     ORDER BY c.name, u.name`,
    params
  )
  return rows
}

app.get('/api/teacher/courses', authMiddleware, requireRole('teacher'), async (req, res) => {
  const courses = await getTeacherCourses(req.user.id)
  res.json({ courses })
})

app.get('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const students = await getTeacherStudents(req.user.id)
  res.json({ students })
})

// Padres / tutores registrados por direccion, para vincularlos con estudiantes.
app.get('/api/teacher/guardians', authMiddleware, requireRole('teacher'), async (_req, res) => {
  const { rows } = await query(
    `SELECT g.id, g.ci_number, u.name
     FROM guardians g
     JOIN users u ON u.id = g.user_id
     WHERE u.status = 'active'
     ORDER BY u.name`
  )
  res.json({ guardians: rows })
})

async function assertTeacherCourse(run, teacherId, courseId) {
  const check = await run('SELECT 1 FROM course_reviewers WHERE reviewer_id = $1 AND course_id = $2', [teacherId, courseId])
  if (check.rowCount === 0) throw new HttpError(403, 'Solo puedes registrar estudiantes en los cursos que te asigno la direccion.')
}

async function linkGuardian(run, studentId, guardianId, relationship) {
  const guardian = await run(
    `SELECT g.id FROM guardians g JOIN users u ON u.id = g.user_id WHERE g.id = $1 AND u.status = 'active'`,
    [guardianId]
  )
  if (guardian.rowCount === 0) throw new HttpError(404, 'Padre / tutor no encontrado o inactivo.')
  const already = await run('SELECT 1 FROM student_guardians WHERE student_id = $1', [studentId])
  const result = await run(
    `INSERT INTO student_guardians (student_id, guardian_id, relationship, is_primary)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, guardian_id) DO UPDATE SET relationship = EXCLUDED.relationship`,
    [studentId, guardianId, relationship, already.rowCount === 0]
  )
  return result
}

app.post('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: true })
  const ruCode = String(payload.ru_code || '').trim() || null
  const courseId = Number(payload.course_id)
  const guardianId = String(payload.guardian_id || '').trim()
  const relationship = normalizeRelationship(payload.relationship)
  if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'Selecciona el curso del estudiante.' })

  const studentId = await withTransaction(async (run) => {
    await assertTeacherCourse(run, req.user.id, courseId)
    const user = await run(
      `INSERT INTO users (username, name, email, password_hash, role_id, phone)
       VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), (SELECT id FROM roles WHERE name = 'student'), $5)
       RETURNING id`,
      [person.username, person.name, person.email, person.password, person.phone]
    )
    const student = await run(
      'INSERT INTO students (user_id, ru_code, course_id) VALUES ($1, $2, $3) RETURNING id',
      [user.rows[0].id, ruCode, courseId]
    )
    if (guardianId) await linkGuardian(run, student.rows[0].id, guardianId, relationship)
    return student.rows[0].id
  })

  const [item] = await getTeacherStudents(req.user.id, studentId)
  res.status(201).json({ item: item || null })
})

async function assertTeacherStudent(teacherId, studentId) {
  const [student] = await getTeacherStudents(teacherId, studentId)
  if (!student) throw new HttpError(403, 'Ese estudiante no pertenece a tus cursos.')
}

// El docente corrige los datos del estudiante, lo cambia entre sus cursos o lo marca como retirado.
app.patch('/api/teacher/students/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const studentId = String(req.params.id)
  const payload = req.body || {}
  const person = readPerson(payload, { requirePassword: false })
  const ruCode = String(payload.ru_code || '').trim() || null
  const courseId = Number(payload.course_id)
  const status = readStatus(payload.status) || 'active'
  if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'Selecciona el curso del estudiante.' })

  await assertTeacherStudent(req.user.id, studentId)
  await withTransaction(async (run) => {
    await assertTeacherCourse(run, req.user.id, courseId)
    const found = await run('SELECT user_id FROM students WHERE id = $1', [studentId])
    const params = [found.rows[0].user_id, person.username, person.name, person.email, person.phone, status]
    let sets = 'username = $2, name = $3, email = $4, phone = $5, status = $6, updated_at = now()'
    if (person.password) {
      params.push(person.password)
      sets += `, password_hash = crypt($${params.length}, gen_salt('bf'))`
    }
    await run(`UPDATE users SET ${sets} WHERE id = $1`, params)
    await run('UPDATE students SET ru_code = $2, course_id = $3, status = $4, updated_at = now() WHERE id = $1', [
      studentId,
      ruCode,
      courseId,
      status,
    ])
  })

  const [item] = await getTeacherStudents(req.user.id, studentId)
  res.json({ item: item || null })
})

app.post('/api/teacher/students/:id/guardians', authMiddleware, requireRole('teacher'), async (req, res) => {
  const studentId = String(req.params.id)
  const guardianId = String(req.body?.guardian_id || '').trim()
  if (!guardianId) return res.status(400).json({ error: 'Selecciona un padre / tutor.' })
  await assertTeacherStudent(req.user.id, studentId)
  await withTransaction((run) => linkGuardian(run, studentId, guardianId, normalizeRelationship(req.body?.relationship)))
  const [item] = await getTeacherStudents(req.user.id, studentId)
  res.json({ item })
})

app.delete('/api/teacher/students/:id/guardians/:guardianId', authMiddleware, requireRole('teacher'), async (req, res) => {
  const studentId = String(req.params.id)
  await assertTeacherStudent(req.user.id, studentId)
  await query('DELETE FROM student_guardians WHERE student_id = $1 AND guardian_id = $2', [studentId, String(req.params.guardianId)])
  const [item] = await getTeacherStudents(req.user.id, studentId)
  res.json({ item })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

// Errores no controlados: siempre se responde JSON con un mensaje entendible.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message })
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Los adjuntos son demasiado pesados. Maximo 5 MB por archivo.' })
  }
  if (error?.code === '23505') {
    return res.status(409).json({ error: UNIQUE_MESSAGES[error.constraint] || 'Ese registro ya existe.' })
  }
  if (error?.code === '22P02' || error?.code === '23503') {
    return res.status(400).json({ error: 'Alguno de los datos seleccionados no existe.' })
  }
  if (error?.code === '23514') {
    return res.status(400).json({ error: 'Revisa los datos: alguno no tiene el formato esperado.' })
  }
  console.error(error)
  res.status(500).json({ error: 'Error interno del servidor.' })
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
