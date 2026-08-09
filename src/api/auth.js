// Capa de autenticacion basada en mocks en memoria.
// Reemplazar por llamadas fetch(VITE_API_URL + '/auth/login') cuando el backend exista.

export const ROLES = {
  STUDENT: 'student',
  PARENT: 'parent',
  TEACHER: 'teacher',
  INSPECTOR: 'inspector',
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  student: 'Estudiante',
  parent: 'Padre / Tutor',
  teacher: 'Docente',
  inspector: 'Inspectoria',
  admin: 'Administracion / Direccion',
}

const USERS = [
  {
    id: 'u-stu-1',
    username: 'estudiante',
    password: 'cole123',
    name: 'Maria Fernanda Quispe Mamani',
    email: 'maria.quispe@colegio.edu',
    role: ROLES.STUDENT,
    course: '2do Secundaria A',
  },
  {
    id: 'u-par-1',
    username: 'padre',
    password: 'cole123',
    name: 'Rosa Elena Calle Tarqui',
    email: 'rosa.calle@colegio.edu',
    role: ROLES.PARENT,
    course: '1ro Secundaria A',
  },
  {
    id: 'u-tea-1',
    username: 'docente',
    password: 'cole123',
    name: 'Carlos Mendoza',
    email: 'carlos.mendoza@colegio.edu',
    role: ROLES.TEACHER,
    course: 'Personal docente',
  },
  {
    id: 'u-ins-1',
    username: 'inspectoria',
    password: 'cole123',
    name: 'Juan Flores',
    email: 'juan.flores@colegio.edu',
    role: ROLES.INSPECTOR,
    course: 'Inspectoria general',
  },
  {
    id: 'u-adm-1',
    username: 'rectora',
    password: 'cole123',
    name: 'Rosa Azcarraga',
    email: 'rosa.azcarraga@colegio.edu',
    role: ROLES.ADMIN,
    course: 'Direccion',
  },
]

const SESSION_KEY = 'colegio.session'

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSession(user) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(SESSION_KEY)
}

function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    course: u.course,
  }
}

export function getCurrentUser() {
  return publicUser(readSession())
}

export function login({ username, password }) {
  const found = USERS.find(
    (u) =>
      u.username.toLowerCase() === String(username || '').toLowerCase() &&
      u.password === password
  )
  if (!found) {
    return { ok: false, error: 'Usuario o contrasena incorrectos.' }
  }
  const pub = publicUser(found)
  writeSession(pub)
  return { ok: true, user: pub }
}

export function logout() {
  writeSession(null)
}

export function hasRole(user, roles) {
  if (!user) return false
  if (!roles || roles.length === 0) return true
  return roles.includes(user.role)
}

export function initialsOf(full) {
  if (!full) return '?'
  return full
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
