import { useEffect, useMemo, useState } from 'react'
import { assignTeacherCourses, createCourse, createGuardianCredential, getManagementData } from '../api/management'

function emptyParentForm() {
  return {
    username: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    ci_number: '',
    relationship: 'padre',
    student_ids: [],
  }
}

function emptyTeacherForm() {
  return {
    teacher_id: '',
    course_ids: [],
  }
}

function emptyCourseForm() {
  return {
    name: '',
    level: 'secundaria',
    school_year: '',
  }
}

export function RectorManagementPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [parentForm, setParentForm] = useState(emptyParentForm)
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm)
  const [courseForm, setCourseForm] = useState(emptyCourseForm)

  const load = async () => {
    const res = await getManagementData()
    if (!res.ok) {
      setError(res.error || 'No se pudo cargar la gestion institucional.')
      setLoading(false)
      return
    }
    setData(res)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    getManagementData().then((res) => {
      if (!active) return
      if (!res.ok) {
        setError(res.error || 'No se pudo cargar la gestion institucional.')
        setLoading(false)
        return
      }
      setData(res)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const activeTeacherId = teacherForm.teacher_id || data?.teachers[0]?.id || ''

  const studentOptions = useMemo(() => data?.students || [], [data])
  const teacherOptions = useMemo(() => data?.teachers || [], [data])
  const courseOptions = useMemo(() => data?.courses || [], [data])

  const submitParent = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await createGuardianCredential(parentForm)
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar el tutor.')
      setBusy(false)
      return
    }
    setParentForm(emptyParentForm())
    await load()
    setBusy(false)
    setSuccess('Credenciales de padre / tutor registradas y vinculaciones actualizadas.')
  }

  const submitTeacher = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await assignTeacherCourses({ ...teacherForm, teacher_id: activeTeacherId })
    if (!res.ok) {
      setError(res.error || 'No se pudo actualizar la asignacion del docente.')
      setBusy(false)
      return
    }
    await load()
    setBusy(false)
    setSuccess('Asignacion de cursos actualizada.')
  }

  const submitCourse = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await createCourse(courseForm)
    if (!res.ok) {
      setError(res.error || 'No se pudo crear el curso.')
      setBusy(false)
      return
    }
    setCourseForm(emptyCourseForm())
    await load()
    setBusy(false)
    setSuccess('Curso creado correctamente.')
  }

  if (loading) {
    return <div className="management-empty">Cargando gestion institucional...</div>
  }

  if (!data) {
    return <div className="management-empty management-alert">{error || 'No hay datos para gestionar.'}</div>
  }

  return (
    <div className="management-shell">
      <div className="panel management-banner">
        <div className="panel-head">
          <h2>Regencia institucional</h2>
          <span className="count">Padres y docentes</span>
        </div>
        <div className="lead">
          {error && <div className="management-alert">{error}</div>}
          {success && <div className="management-success">{success}</div>}
          <p className="management-message">
            Desde aqui el regente crea credenciales de padres o tutores y los vincula con estudiantes,
            y tambien asigna cursos a los docentes para que solo vean las solicitudes de sus secciones.
          </p>
        </div>
      </div>

      <div className="management-grid">
        <section className="panel management-card">
          <div className="panel-head">
            <h2>Padres / tutores</h2>
            <span className="count">{data.parents.length}</span>
          </div>
          <form onSubmit={submitParent} className="management-form">
            <div className="form-grid-2">
              <Field label="Usuario">
                <input value={parentForm.username} onChange={(e) => setParentForm({ ...parentForm, username: e.target.value })} placeholder="padre.gomez" />
              </Field>
              <Field label="Nombre completo">
                <input value={parentForm.name} onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })} placeholder="Rosa Elena Calle Tarqui" />
              </Field>
              <Field label="Email">
                <input value={parentForm.email} onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })} placeholder="rosa.calle@donbosco.edu" />
              </Field>
              <Field label="Contraseña">
                <input type="password" value={parentForm.password} onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })} placeholder="clave inicial" />
              </Field>
              <Field label="CI">
                <input value={parentForm.ci_number} onChange={(e) => setParentForm({ ...parentForm, ci_number: e.target.value })} placeholder="LP-1234567" />
              </Field>
              <Field label="Telefono">
                <input value={parentForm.phone} onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })} placeholder="+591 7..." />
              </Field>
            </div>

            <Field label="Relacion">
              <select value={parentForm.relationship} onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}>
                <option value="padre">Padre</option>
                <option value="madre">Madre</option>
                <option value="tutor legal">Tutor legal</option>
              </select>
            </Field>

            <Field label="Vincular estudiantes" hint="Puedes seleccionar varios estudiantes.">
              <select
                multiple
                value={parentForm.student_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((option) => option.value)
                  setParentForm({ ...parentForm, student_ids: values })
                }}
                className="management-multiselect"
              >
                {studentOptions.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.course_name || 'Sin curso'}
                  </option>
                ))}
              </select>
            </Field>

            <button className="btn primary" disabled={busy}>Guardar padre / tutor</button>
          </form>

          <div className="management-list">
            {data.parents.map((parent) => (
              <div key={parent.id} className="management-item">
                <strong>{parent.name}</strong>
                <div className="meta">{parent.username} · {parent.email}</div>
                <div className="children">
                  {Array.isArray(parent.children) && parent.children.length > 0
                    ? parent.children.map((child) => child.name).join(', ')
                    : 'Sin estudiantes vinculados'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel management-card">
          <div className="panel-head">
            <h2>Docentes / cursos</h2>
            <span className="count">{data.teachers.length}</span>
          </div>
          <form onSubmit={submitTeacher} className="management-form">
            <Field label="Docente">
              <select
                value={activeTeacherId}
                onChange={(e) => setTeacherForm({ ...teacherForm, teacher_id: e.target.value })}
              >
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} · {teacher.username}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cursos asignados">
              <select
                multiple
                value={teacherForm.course_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((option) => option.value)
                  setTeacherForm({ ...teacherForm, course_ids: values })
                }}
                className="management-multiselect"
              >
                {courseOptions.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} · {course.level}
                  </option>
                ))}
              </select>
            </Field>

            <button className="btn primary" disabled={busy}>Guardar asignacion</button>
          </form>

          <div className="management-list">
            {data.teachers.map((teacher) => (
              <div key={teacher.id} className="management-item">
                <strong>{teacher.name}</strong>
                <div className="meta">{teacher.username} · {teacher.email}</div>
                <div className="courses">
                  {(teacher.courses || []).map((course) => (
                    <span key={course.id} className="badge" data-status="approved">{course.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel management-card">
          <div className="panel-head">
            <h2>Cursos / secciones</h2>
            <span className="count">{data.courses.length}</span>
          </div>
          <form onSubmit={submitCourse} className="management-form">
            <Field label="Nombre del curso" hint='Ejemplo: "1ro Secundaria A"'>
              <input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="1ro Secundaria A" />
            </Field>
            <div className="form-grid-2">
              <Field label="Nivel">
                <select value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })}>
                  <option value="primaria">Primaria</option>
                  <option value="secundaria">Secundaria</option>
                </select>
              </Field>
              <Field label="Gestion / año">
                <input value={courseForm.school_year} onChange={(e) => setCourseForm({ ...courseForm, school_year: e.target.value })} placeholder="2026" />
              </Field>
            </div>
            <button className="btn primary" disabled={busy}>Crear curso</button>
          </form>

          <div className="management-list">
            {data.courses.map((course) => (
              <div key={course.id} className="management-item">
                <strong>{course.name}</strong>
                <div className="meta">{course.level || '—'} · {course.school_year || 'Sin gestion'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
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