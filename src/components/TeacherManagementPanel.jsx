import { useEffect, useMemo, useState } from 'react'
import { createStudent, getTeacherCourses, getTeacherStudents } from '../api/management'

function emptyForm() {
  return {
    username: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    ru_code: '',
    course_id: '',
  }
}

export function TeacherManagementPanel() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(emptyForm)

  const load = async () => {
    const [coursesRes, studentsRes] = await Promise.all([getTeacherCourses(), getTeacherStudents()])
    if (!coursesRes.ok || !studentsRes.ok) {
      setError(coursesRes.error || studentsRes.error || 'No se pudo cargar la gestion.')
      setLoading(false)
      return
    }
    setCourses(coursesRes.courses || [])
    setStudents(studentsRes.students || [])
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    Promise.all([getTeacherCourses(), getTeacherStudents()]).then(([coursesRes, studentsRes]) => {
      if (!active) return
      if (!coursesRes.ok || !studentsRes.ok) {
        setError(coursesRes.error || studentsRes.error || 'No se pudo cargar la gestion.')
        setLoading(false)
        return
      }
      setCourses(coursesRes.courses || [])
      setStudents(studentsRes.students || [])
      setError('')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const activeCourseId = form.course_id || courses[0]?.id || ''

  const grouped = useMemo(() => {
    const map = new Map()
    for (const course of courses) {
      map.set(course.id, { course, students: [] })
    }
    for (const student of students) {
      if (!map.has(student.course_id)) {
        map.set(student.course_id, { course: { id: student.course_id, name: student.course_name }, students: [] })
      }
      map.get(student.course_id).students.push(student)
    }
    return Array.from(map.values())
  }, [courses, students])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await createStudent({ ...form, course_id: activeCourseId })
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar el alumno.')
      setBusy(false)
      return
    }
    setForm(emptyForm())
    await load()
    setBusy(false)
    setSuccess('Alumno registrado y asignado al curso.')
  }

  if (loading) {
    return <div className="management-empty">Cargando tus cursos y alumnos...</div>
  }

  return (
    <div className="management-shell">
      <div className="panel management-banner">
        <div className="panel-head">
          <h2>Gestion de alumnos</h2>
          <span className="count">{courses.length} cursos</span>
        </div>
        <div className="lead">
          {error && <div className="management-alert">{error}</div>}
          {success && <div className="management-success">{success}</div>}
          <p className="management-message">
            Desde aquí creas nuevos alumnos y los vinculas a los cursos creados por el Regente.
          </p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="panel">
          <div className="management-empty">
            <div className="big">Sin cursos disponibles</div>
            <p>El regente debe crear cursos institucionales antes de que puedas registrar alumnos.</p>
          </div>
        </div>
      ) : (
        <div className="management-grid">
          <section className="panel management-card">
            <div className="panel-head">
              <h2>Nuevo alumno</h2>
            </div>
            <form onSubmit={submit} className="management-form">
              <div className="form-grid-2">
                <Field label="Usuario">
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="alumno.perez" />
                </Field>
                <Field label="Nombre completo">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maria Fernanda Quispe" />
                </Field>
                <Field label="Email">
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alumno@donbosco.edu" />
                </Field>
                <Field label="Contraseña">
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="clave inicial" />
                </Field>
                <Field label="RUDE / codigo interno" hint="Opcional. Debe ser unico.">
                  <input value={form.ru_code} onChange={(e) => setForm({ ...form, ru_code: e.target.value })} placeholder="RUDE-2026-001" />
                </Field>
                <Field label="Telefono" hint="Opcional.">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+591 7..." />
                </Field>
              </div>

              <Field label="Curso">
                <select value={activeCourseId} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} · {course.level || 'Sin nivel'}{course.school_year ? ` (${course.school_year})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <button className="btn primary" disabled={busy}>Registrar alumno</button>
            </form>
          </section>

          <section className="panel management-card">
            <div className="panel-head">
              <h2>Alumnos por curso</h2>
              <span className="count">{students.length}</span>
            </div>
            <div className="management-list">
              {grouped.length === 0 ? (
                <div className="management-empty">
                  <div className="big">Sin alumnos</div>
                  <p>Todavia no registraste alumnos en tus cursos.</p>
                </div>
              ) : (
                grouped.map(({ course, students: studentList }) => (
                  <div key={course.id} className="management-item">
                    <strong>{course.name}</strong>
                    <div className="courses">
                      <span className="badge" data-status="info">{course.level || 'Sin nivel'}</span>
                      {course.school_year && <span className="badge" data-status="pre_approved">Gestión {course.school_year}</span>}
                    </div>
                    <div className="management-list nested">
                      {studentList.length === 0 ? (
                        <div className="management-note">Sin alumnos registrados en este curso.</div>
                      ) : (
                        studentList.map((student) => (
                          <div key={student.id} className="management-item subtle">
                            <strong>{student.name}</strong>
                            <div className="meta">
                              {student.username} · {student.email}
                              {student.ru_code ? ` · RUDE ${student.ru_code}` : ''}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="f-field">
      <span className="f-label">{label}</span>
      {children}
      {hint && <span className="management-note">{hint}</span>}
    </label>
  )
}
