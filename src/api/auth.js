import { apiRequest, clearStoredSession, getStoredToken, getStoredUser, storeSession } from './client'

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
  inspector: 'Inspectoría',
  admin: 'Administracion / Direccion',
}

export function getCurrentUser() {
  return getStoredUser()
}

export async function restoreCurrentUser() {
  const token = getStoredToken()
  const cached = getStoredUser()
  if (!token) return cached

  const res = await apiRequest('/auth/me')
  if (!res.ok || !res.user) {
    clearStoredSession()
    return null
  }

  storeSession({ token, user: res.user })
  return res.user
}

export async function login({ username, password }) {
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: { username, password },
  })

  if (!res.ok) {
    return { ok: false, error: res.error || 'Usuario o contrasena incorrectos.' }
  }

  storeSession({ token: res.token, user: res.user })
  return { ok: true, user: res.user }
}

export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } finally {
    clearStoredSession()
  }
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
