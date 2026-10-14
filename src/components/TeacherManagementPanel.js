import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getTeacherCourses,
  getTeacherStudents,
  getTeacherGuardians,
  createStudent,
  updateStudent,
  linkStudentGuardian,
  unlinkStudentGuardian,
} from '../api/management'
import { Field, Alert, Modal, Toast, EmptyState } from './ui'

const RELATIONSHIPS = [
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'tutor legal', label: 'Tutor legal' },
]

const relLabel = (v) => RELATIONSHIPS.find((r) => r.value === v)?.label || v

// El docente registra estudiantes en sus cursos y los vincula con padres creados por Direccion.
export function TeacherManagementPanel() {
  const [courses, setCourses] = useState(null)
  const [students, setStudents] = useState([])
  const [guardians, setGuardians] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [linking, setLinking] = useState(null)
  const [editingStudent, setEditingStudent] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([getTeacherCourses(), getTeacherStudents(), getTeacherGuardians()]).then(([c, s, g]) => {
      if (!alive) return
      if (!c.ok || !s.ok) {
        setError(c.error || s.error)
        setCourses([])
        return
      }
      setCourses(c.courses || [])
      setStudents(s.students || [])
      setGuardians(g.ok ? g.guardians || [] : [])
    })
    return () => {
      alive = false
    }
  }, [])

  const notify = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const replaceStudent = (item) =>
    setStudents((prev) => {
      const exists = prev.some((s) => s.id === item.id)
      const next = exists ? prev.map((s) => (s.id === item.id ? item : s)) : [...prev, item]
      return next.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    })

  const unlink = async (student, guardian) => {
    if (!window.confirm(`¿Quitar a ${guardian.name} como responsable de ${student.name}? Ya no podrá pedirle permisos.`)) return
    const res = await unlinkStudentGuardian(student.id, guardian.id)
    if (!res.ok) return notify('danger', res.error)
    replaceStudent(res.item)
    notify('ok', 'Vínculo eliminado.')
  }

  const byCourse = useMemo(() => {
    const groups = (courses || []).map((c) => ({ ...c, students: students.filter((s) => s.course_id === c.id) }))
    return groups
  }, [courses, students])

  if (!courses) return <p className="muted">Cargando tus cursos…</p>
  if (error) return <Alert tone="danger">{error}</Alert>

  if (courses.length === 0) {
    return (
      <div className="card">
        <EmptyState title="Aún no tienes cursos asignados">
          Dirección o Inspectoría debe asignarte un aula para que puedas registrar a sus estudiantes.
        </EmptyState>
      </div>
    )
  }

  const unlinked = students.filter((s) => s.status === 'active' && !s.guardians?.length).length

  return (
    <div className="mgmt">
      <div className="mgmt-intro">
        <div>
          <h2>Estudiantes de mis cursos</h2>
          <p className="muted">
            Cada estudiante debe estar vinculado con su padre, madre o tutor para que la familia pueda pedir permisos.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          Registrar estudiante
        </button>
      </div>

      {unlinked > 0 && (
        <Alert tone="warn">
          {unlinked === 1
            ? 'Un estudiante todavía no tiene padre o tutor vinculado.'
            : `${unlinked} estudiantes todavía no tienen padre o tutor vinculado.`}
        </Alert>
      )}

      {byCourse.map((course) => (
        <section key={course.id} className="card course-block">
          <div className="card-head">
            <h3>{course.name}</h3>
            <span className="count">{course.students.length}</span>
          </div>
          {course.students.length === 0 ? (
            <p className="list-empty">Sin estudiantes registrados en este curso.</p>
          ) : (
            <ul className="student-list">
              {course.students.map((s) => (
                <li key={s.id} className={'student' + (s.status !== 'active' ? ' is-inactive' : '')}>
                  <div className="student-id">
                    <strong>{s.name}</strong>
                    {s.status !== 'active' && <span className="tag tag-muted">Retirado</span>}
                    <span className="muted">
                      @{s.username}
                      {s.ru_code ? ` · RUDE ${s.ru_code}` : ''}
                    </span>
                  </div>
                  <div className="student-guardians">
                    {s.guardians?.length ? (
                      s.guardians.map((g) => (
                        <span key={g.id} className="chip chip-guardian">
                          <span>
                            {g.name} <span className="muted">· {relLabel(g.relationship)}</span>
                          </span>
                          <button
                            type="button"
                            className="chip-x"
                            onClick={() => unlink(s, g)}
                            aria-label={`Quitar a ${g.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="tag tag-warn">Sin padre vinculado</span>
                    )}
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinking(s)}>
                      Vincular padre
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingStudent(s)}>
                      Editar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {adding && (
        <StudentModal
          courses={courses}
          guardians={guardians}
          onClose={() => setAdding(false)}
          onSaved={(item) => {
            replaceStudent(item)
            setAdding(false)
            notify('ok', `${item.name} quedó registrado en ${item.course_name}.`)
          }}
        />
      )}

      {linking && (
        <LinkModal
          student={linking}
          guardians={guardians}
          onClose={() => setLinking(null)}
          onSaved={(item) => {
            replaceStudent(item)
            setLinking(null)
            notify('ok', 'Padre o tutor vinculado.')
          }}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          courses={courses}
          onClose={() => setEditingStudent(null)}
          onSaved={(item) => {
            replaceStudent(item)
            setEditingStudent(null)
            notify('ok', 'Datos del estudiante actualizados.')
          }}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

function EditStudentModal({ student, courses, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: student.name || '',
    username: student.username || '',
    email: student.email || '',
    phone: student.phone || '',
    password: '',
    ru_code: student.ru_code || '',
    course_id: String(student.course_id),
    status: student.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password && form.password.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.')
    setSaving(true)
    setError('')
    const { password, ...rest } = form
    const res = await updateStudent(student.id, {
      ...rest,
      course_id: Number(form.course_id),
      ...(password ? { password } : {}),
    })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onSaved(res.item)
  }

  return (
    <Modal
      wide
      title={`Editar a ${student.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="edit-student-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="edit-student-form" className="stack" onSubmit={submit} noValidate>
        <Field label="Nombre completo" required>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="field-row">
          <Field label="Curso" required hint="Solo puedes moverlo entre tus cursos.">
            <select value={form.course_id} onChange={(e) => set({ course_id: e.target.value })}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Código RUDE" optional>
            <input value={form.ru_code} onChange={(e) => set({ ru_code: e.target.value })} />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Usuario" required>
            <input
              value={form.username}
              onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              autoComplete="off"
            />
          </Field>
          <Field label="Nueva contraseña" optional hint="Déjala vacía para no cambiarla.">
            <input type="text" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Correo electrónico" required>
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Teléfono" optional>
            <input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </div>
        <Field
          label="Situación"
          hint="Un estudiante retirado no puede ingresar y su familia ya no puede pedirle permisos. Su historial se conserva."
        >
          <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">Inscrito</option>
            <option value="inactive">Retirado</option>
          </select>
        </Field>
        <Alert tone="danger">{error}</Alert>
      </form>
    </Modal>
  )
}

function GuardianPicker({ guardians, value, onChange, exclude = [] }) {
  const [q, setQ] = useState('')
  const options = guardians
    .filter((g) => !exclude.includes(g.id))
    .filter((g) => !q.trim() || `${g.name} ${g.ci_number}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="stack-sm">
      <input
        type="search"
        placeholder="Buscar por nombre o CI"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar padre o tutor"
      />
      <select value={value} onChange={(e) => onChange(e.target.value)} size={Math.min(6, Math.max(3, options.length + 1))}>
        <option value="">— Sin vincular por ahora —</option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} · CI {g.ci_number}
          </option>
        ))}
      </select>
      {guardians.length === 0 && (
        <span className="field-hint">Dirección todavía no registró padres de familia.</span>
      )}
    </div>
  )
}

function StudentModal({ courses, guardians, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    ru_code: '',
    course_id: courses.length === 1 ? String(courses[0].id) : '',
    guardian_id: '',
    relationship: 'madre',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.course_id) return setError('Elige el curso del estudiante.')
    if (form.password.length < 6) return setError('La contraseña inicial debe tener al menos 6 caracteres.')
    setSaving(true)
    setError('')
    const res = await createStudent({
      ...form,
      course_id: Number(form.course_id),
      guardian_id: form.guardian_id || undefined,
    })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onSaved(res.item)
  }

  return (
    <Modal
      wide
      title="Registrar estudiante"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="student-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar estudiante'}
          </button>
        </>
      }
    >
      <form id="student-form" className="stack" onSubmit={submit} noValidate>
        <fieldset className="form-section">
          <legend>Datos del estudiante</legend>
          <Field label="Nombre completo" required>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <div className="field-row">
            <Field label="Curso" required>
              <select value={form.course_id} onChange={(e) => set({ course_id: e.target.value })}>
                {courses.length > 1 && <option value="">Elige un curso</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código RUDE" optional>
              <input value={form.ru_code} onChange={(e) => set({ ru_code: e.target.value })} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Usuario" required hint="Minúsculas, sin espacios.">
              <input
                value={form.username}
                onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                autoComplete="off"
              />
            </Field>
            <Field label="Contraseña inicial" required hint="Mínimo 6 caracteres.">
              <input type="text" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Correo electrónico" required>
              <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Teléfono" optional>
              <input type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Padre, madre o tutor</legend>
          <GuardianPicker guardians={guardians} value={form.guardian_id} onChange={(id) => set({ guardian_id: id })} />
          {form.guardian_id && (
            <Field label="Parentesco">
              <select value={form.relationship} onChange={(e) => set({ relationship: e.target.value })}>
                {RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </fieldset>

        <Alert tone="danger">{error}</Alert>
      </form>
    </Modal>
  )
}

function LinkModal({ student, guardians, onClose, onSaved }) {
  const [guardianId, setGuardianId] = useState('')
  const [relationship, setRelationship] = useState('madre')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!guardianId) return setError('Elige un padre, madre o tutor.')
    setSaving(true)
    const res = await linkStudentGuardian(student.id, { guardian_id: guardianId, relationship })
    setSaving(false)
    if (!res.ok) return setError(res.error)
    onSaved(res.item)
  }

  return (
    <Modal
      title={`Vincular padre a ${student.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || !guardianId}>
            {saving ? 'Vinculando…' : 'Vincular'}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">Solo aparecen los padres registrados por Dirección o Inspectoría.</p>
        <GuardianPicker
          guardians={guardians}
          value={guardianId}
          onChange={setGuardianId}
          exclude={(student.guardians || []).map((g) => g.id)}
        />
        <Field label="Parentesco">
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Alert tone="danger">{error}</Alert>
      </div>
    </Modal>
  )
}
