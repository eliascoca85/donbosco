import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getManagementData,
  createGuardianCredential,
  updateGuardian,
  deactivateGuardian,
  createTeacher,
  updateTeacher,
  deactivateTeacher,
  assignTeacherCourses,
  createCourse,
} from '../api/management'
import { Field, Alert, Modal, Toast, EmptyState } from './ui'

const RELATIONSHIPS = [
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'tutor legal', label: 'Tutor legal' },
]

const SECTIONS = [
  { id: 'parents', label: 'Padres de familia' },
  { id: 'teachers', label: 'Docentes' },
  { id: 'courses', label: 'Cursos' },
]

// Gestion de Direccion e Inspectoria: padres, docentes y cursos.
export function RectorManagementPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [section, setSection] = useState('parents')
  const [toast, setToast] = useState(null)

  const reload = useCallback(async () => {
    const res = await getManagementData()
    if (res.ok) {
      setData({ students: res.students, parents: res.parents, teachers: res.teachers, courses: res.courses })
      setError('')
    } else {
      setError(res.error)
    }
  }, [])

  useEffect(() => {
    let alive = true
    getManagementData().then((res) => {
      if (!alive) return
      if (res.ok) setData({ students: res.students, parents: res.parents, teachers: res.teachers, courses: res.courses })
      else setError(res.error)
    })
    return () => {
      alive = false
    }
  }, [])

  const notify = useCallback((tone, message) => {
    setToast({ tone, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // Las respuestas de escritura traen los datos actualizados.
  const apply = useCallback(
    (res, message) => {
      if (!res.ok) {
        notify('danger', res.error)
        return false
      }
      if (res.data) setData(res.data)
      else reload()
      notify('ok', message)
      return true
    },
    [notify, reload]
  )

  if (error && !data) return <Alert tone="danger">{error}</Alert>
  if (!data) return <p className="muted">Cargando datos del colegio…</p>

  const counts = {
    parents: data.parents.filter((p) => p.status === 'active').length,
    teachers: data.teachers.filter((t) => t.status === 'active').length,
    courses: data.courses.length,
  }

  return (
    <div className="mgmt">
      <nav className="segmented" aria-label="Gestión">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            <span className="count">{counts[s.id]}</span>
          </button>
        ))}
      </nav>

      {section === 'parents' && <ParentsSection data={data} apply={apply} />}
      {section === 'teachers' && <TeachersSection data={data} apply={apply} />}
      {section === 'courses' && <CoursesSection data={data} apply={apply} />}

      <Toast toast={toast} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Padres de familia                                                   */
/* ------------------------------------------------------------------ */

const EMPTY_PERSON = { name: '', username: '', email: '', phone: '', password: '' }

function PersonFields({ form, set, errors = {}, editing }) {
  return (
    <>
      <Field label="Nombre completo" required>
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
      </Field>
      <div className="field-row">
        <Field label="Usuario" required hint="Minúsculas, sin espacios. Ej.: maria.quispe">
          <input
            value={form.username}
            onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            autoComplete="off"
          />
        </Field>
        <Field
          label={editing ? 'Nueva contraseña' : 'Contraseña inicial'}
          required={!editing}
          optional={editing}
          hint={editing ? 'Déjala vacía para no cambiarla.' : 'Mínimo 6 caracteres.'}
          error={errors.password}
        >
          <input
            type="text"
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Correo electrónico" required>
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Teléfono" optional>
          <input type="tel" value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
      </div>
    </>
  )
}

function ParentsSection({ data, apply }) {
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const list = useMemo(() => {
    const text = q.trim().toLowerCase()
    return data.parents.filter((p) => {
      if (!showInactive && p.status !== 'active') return false
      if (!text) return true
      return [p.name, p.ci_number, p.username, ...(p.children || []).map((c) => c.name)].join(' ').toLowerCase().includes(text)
    })
  }, [data.parents, q, showInactive])

  const toggleStatus = async (p) => {
    if (p.status === 'active') {
      if (!window.confirm(`¿Desactivar la cuenta de ${p.name}? No podrá ingresar ni pedir permisos.`)) return
      apply(await deactivateGuardian(p.id), 'Cuenta desactivada.')
    } else {
      apply(
        await updateGuardian(p.id, {
          name: p.name,
          username: p.username,
          email: p.email,
          phone: p.phone,
          ci_number: p.ci_number,
          status: 'active',
        }),
        'Cuenta reactivada.'
      )
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Padres de familia</h2>
          <p className="muted">Solo ellos pueden pedir permisos, y únicamente para los estudiantes vinculados.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          Registrar padre o tutor
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, CI o estudiante"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar padres"
        />
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar cuentas desactivadas
        </label>
      </div>

      {list.length === 0 ? (
        <EmptyState title={data.parents.length ? 'Sin resultados' : 'Aún no hay padres registrados'}>
          {data.parents.length ? 'Prueba con otro nombre o CI.' : 'Registra al primero para que pueda pedir permisos.'}
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Padre / tutor</th>
                <th>CI</th>
                <th>Estudiantes a cargo</th>
                <th>Contacto</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.status !== 'active' ? 'is-inactive' : ''}>
                  <td>
                    <strong>{p.name}</strong>
                    <span className="muted block">@{p.username}</span>
                    {p.status !== 'active' && <span className="tag tag-muted">Desactivado</span>}
                  </td>
                  <td className="mono">{p.ci_number}</td>
                  <td>
                    {p.children?.length ? (
                      <ul className="chips">
                        {p.children.map((c) => (
                          <li key={c.id} className="chip">
                            {c.name} <span className="muted">· {c.course}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted">Sin vincular</span>
                    )}
                  </td>
                  <td>
                    <span className="block">{p.email}</span>
                    <span className="muted">{p.phone || '—'}</span>
                  </td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={'btn btn-sm ' + (p.status === 'active' ? 'btn-ghost-danger' : 'btn-ghost')}
                      onClick={() => toggleStatus(p)}
                    >
                      {p.status === 'active' ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ParentModal
          parent={editing === 'new' ? null : editing}
          students={data.students}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const res =
              editing === 'new'
                ? await createGuardianCredential(payload)
                : await updateGuardian(editing.id, payload)
            if (apply(res, editing === 'new' ? 'Padre o tutor registrado.' : 'Datos actualizados.')) setEditing(null)
            return res
          }}
        />
      )}
    </section>
  )
}

function ParentModal({ parent, students, onClose, onSave }) {
  const initialIds = (parent?.children || []).map((c) => c.id)
  const [form, setForm] = useState({
    ...EMPTY_PERSON,
    ...(parent ? { name: parent.name, username: parent.username, email: parent.email, phone: parent.phone || '' } : {}),
    ci_number: parent?.ci_number || '',
    relationship: parent?.children?.[0]?.relationship || 'padre',
    student_ids: initialIds,
  })
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const visible = useMemo(() => {
    const text = q.trim().toLowerCase()
    return students
      .filter((s) => s.status === 'active' || form.student_ids.includes(s.id))
      .filter((s) => !text || `${s.name} ${s.course_name} ${s.ru_code || ''}`.toLowerCase().includes(text))
  }, [students, q, form.student_ids])

  const toggle = (id) =>
    set({ student_ids: form.student_ids.includes(id) ? form.student_ids.filter((x) => x !== id) : [...form.student_ids, id] })

  const submit = async (e) => {
    e.preventDefault()
    if (!form.ci_number.trim()) return setError('El CI es obligatorio.')
    if (!parent && form.password.length < 6) return setError('La contraseña inicial debe tener al menos 6 caracteres.')
    setSaving(true)
    setError('')
    const linksChanged =
      form.student_ids.length !== initialIds.length || form.student_ids.some((id) => !initialIds.includes(id))
    const payload = {
      name: form.name,
      username: form.username,
      email: form.email,
      phone: form.phone,
      ci_number: form.ci_number,
      relationship: form.relationship,
      ...(form.password ? { password: form.password } : {}),
      // Al editar solo se reemplazan los vinculos si cambiaron, para no perder el parentesco de cada uno.
      ...(!parent || linksChanged ? { student_ids: form.student_ids } : {}),
    }
    const res = await onSave(payload)
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <Modal
      wide
      title={parent ? `Editar a ${parent.name}` : 'Registrar padre o tutor'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="parent-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : parent ? 'Guardar cambios' : 'Registrar'}
          </button>
        </>
      }
    >
      <form id="parent-form" className="stack" onSubmit={submit} noValidate>
        <PersonFields form={form} set={set} editing={Boolean(parent)} />
        <div className="field-row">
          <Field label="Carnet de identidad (CI)" required>
            <input value={form.ci_number} onChange={(e) => set({ ci_number: e.target.value })} />
          </Field>
          <Field label="Parentesco">
            <select value={form.relationship} onChange={(e) => set({ relationship: e.target.value })}>
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="pick">
          <legend>
            Estudiantes a cargo <span className="opt">(opcional)</span>
          </legend>
          <p className="field-hint">
            También puede hacerlo el profesor del curso al registrar al estudiante.
          </p>
          <input
            type="search"
            placeholder="Buscar estudiante o curso"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar estudiante"
          />
          <div className="pick-list">
            {visible.length === 0 ? (
              <p className="muted">No hay estudiantes que coincidan.</p>
            ) : (
              visible.map((s) => (
                <label key={s.id} className="check">
                  <input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>
                    {s.name} <span className="muted">· {s.course_name}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <span className="field-hint">{form.student_ids.length} seleccionado(s)</span>
        </fieldset>

        <Alert tone="danger">{error}</Alert>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Docentes                                                            */
/* ------------------------------------------------------------------ */

function TeachersSection({ data, apply }) {
  const [editing, setEditing] = useState(null)
  const [assigning, setAssigning] = useState(null)

  const toggleStatus = async (t) => {
    if (t.status === 'active') {
      if (!window.confirm(`¿Desactivar la cuenta de ${t.name}?`)) return
      apply(await deactivateTeacher(t.id), 'Cuenta desactivada.')
    } else {
      apply(
        await updateTeacher(t.id, { name: t.name, username: t.username, email: t.email, phone: t.phone, status: 'active' }),
        'Cuenta reactivada.'
      )
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Docentes</h2>
          <p className="muted">Cada docente solo ve y registra estudiantes de los cursos que le asignes.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          Registrar docente
        </button>
      </div>

      {data.teachers.length === 0 ? (
        <EmptyState title="Aún no hay docentes registrados" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Docente</th>
                <th>Cursos asignados</th>
                <th>Contacto</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.id} className={t.status !== 'active' ? 'is-inactive' : ''}>
                  <td>
                    <strong>{t.name}</strong>
                    <span className="muted block">@{t.username}</span>
                    {t.status !== 'active' && <span className="tag tag-muted">Desactivado</span>}
                  </td>
                  <td>
                    {t.courses?.length ? (
                      <ul className="chips">
                        {t.courses.map((c) => (
                          <li key={c.id} className="chip chip-blue">
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted">Sin cursos</span>
                    )}
                  </td>
                  <td>
                    <span className="block">{t.email}</span>
                    <span className="muted">{t.phone || '—'}</span>
                  </td>
                  <td className="row-actions">
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => setAssigning(t)}>
                      Asignar cursos
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={'btn btn-sm ' + (t.status === 'active' ? 'btn-ghost-danger' : 'btn-ghost')}
                      onClick={() => toggleStatus(t)}
                    >
                      {t.status === 'active' ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TeacherModal
          teacher={editing === 'new' ? null : editing}
          courses={data.courses}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const res = editing === 'new' ? await createTeacher(payload) : await updateTeacher(editing.id, payload)
            if (apply(res, editing === 'new' ? 'Docente registrado.' : 'Datos actualizados.')) setEditing(null)
            return res
          }}
        />
      )}

      {assigning && (
        <AssignModal
          teacher={assigning}
          courses={data.courses}
          onClose={() => setAssigning(null)}
          onSave={async (courseIds) => {
            const res = await assignTeacherCourses({ teacher_id: assigning.id, course_ids: courseIds })
            if (apply(res, 'Cursos asignados.')) setAssigning(null)
            return res
          }}
        />
      )}
    </section>
  )
}

function CourseChecks({ courses, selected, onChange }) {
  if (courses.length === 0) return <p className="muted">Primero crea cursos en la pestaña «Cursos».</p>
  return (
    <div className="pick-grid">
      {courses.map((c) => (
        <label key={c.id} className="check check-card">
          <input
            type="checkbox"
            checked={selected.includes(c.id)}
            onChange={() =>
              onChange(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])
            }
          />
          <span>
            {c.name}
            {c.level && <span className="muted block">{c.level}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

function TeacherModal({ teacher, courses, onClose, onSave }) {
  const [form, setForm] = useState({
    ...EMPTY_PERSON,
    ...(teacher ? { name: teacher.name, username: teacher.username, email: teacher.email, phone: teacher.phone || '' } : {}),
    course_ids: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((p) => ({ ...p, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    if (!teacher && form.password.length < 6) return setError('La contraseña inicial debe tener al menos 6 caracteres.')
    setSaving(true)
    setError('')
    const { course_ids, password, ...person } = form
    const res = await onSave({
      ...person,
      ...(password ? { password } : {}),
      ...(teacher ? {} : { course_ids }),
    })
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <Modal
      wide
      title={teacher ? `Editar a ${teacher.name}` : 'Registrar docente'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="teacher-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : teacher ? 'Guardar cambios' : 'Registrar'}
          </button>
        </>
      }
    >
      <form id="teacher-form" className="stack" onSubmit={submit} noValidate>
        <PersonFields form={form} set={set} editing={Boolean(teacher)} />
        {!teacher && (
          <fieldset className="pick">
            <legend>
              Cursos a su cargo <span className="opt">(opcional)</span>
            </legend>
            <CourseChecks courses={courses} selected={form.course_ids} onChange={(ids) => set({ course_ids: ids })} />
          </fieldset>
        )}
        <Alert tone="danger">{error}</Alert>
      </form>
    </Modal>
  )
}

function AssignModal({ teacher, courses, onClose, onSave }) {
  const [selected, setSelected] = useState((teacher.courses || []).map((c) => c.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSaving(true)
    const res = await onSave(selected)
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <Modal
      title={`Cursos de ${teacher.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar asignación'}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          Marca las aulas que acompaña. Podrá registrar estudiantes y ver los permisos de esos cursos.
        </p>
        <CourseChecks courses={courses} selected={selected} onChange={setSelected} />
        <Alert tone="danger">{error}</Alert>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Cursos                                                              */
/* ------------------------------------------------------------------ */

function CoursesSection({ data, apply }) {
  const [form, setForm] = useState({ name: '', level: 'Secundaria', school_year: String(new Date().getFullYear()) })
  const [saving, setSaving] = useState(false)

  const teachersByCourse = useMemo(() => {
    const map = {}
    data.teachers
      .filter((t) => t.status === 'active')
      .forEach((t) => (t.courses || []).forEach((c) => (map[c.id] = [...(map[c.id] || []), t.name])))
    return map
  }, [data.teachers])

  const studentsByCourse = useMemo(() => {
    const map = {}
    data.students.forEach((s) => (map[s.course_id] = (map[s.course_id] || 0) + 1))
    return map
  }, [data.students])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const ok = apply(await createCourse(form), `Curso «${form.name}» creado.`)
    setSaving(false)
    if (ok) setForm((p) => ({ ...p, name: '' }))
  }

  return (
    <div className="mgmt-split">
      <form className="card stack" onSubmit={submit}>
        <h2>Nuevo curso</h2>
        <Field label="Nombre del curso" required hint='Ej.: "3ro Secundaria B"'>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} />
        </Field>
        <div className="field-row">
          <Field label="Nivel">
            <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option>Inicial</option>
              <option>Primaria</option>
              <option>Secundaria</option>
            </select>
          </Field>
          <Field label="Gestión">
            <input value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving || form.name.trim().length < 3}>
          {saving ? 'Creando…' : 'Crear curso'}
        </button>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Cursos del colegio</h2>
          <span className="count">{data.courses.length}</span>
        </div>
        {data.courses.length === 0 ? (
          <EmptyState title="Aún no hay cursos" />
        ) : (
          <ul className="course-list">
            {data.courses.map((c) => (
              <li key={c.id} className="course">
                <div>
                  <strong>{c.name}</strong>
                  <span className="muted block">
                    {[c.level, c.school_year].filter(Boolean).join(' · ') || '—'} · {studentsByCourse[c.id] || 0} estudiantes
                  </span>
                </div>
                <div className="course-teachers">
                  {teachersByCourse[c.id]?.length ? (
                    teachersByCourse[c.id].map((name) => (
                      <span key={name} className="chip chip-blue">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="tag tag-warn">Sin docente</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
