const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
const TOKEN_KEY = 'colegio.session.token'
const USER_KEY = 'colegio.session.user'

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession({ token, user }) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user))
    else sessionStorage.removeItem(USER_KEY)
  } catch {
    /* noop */
  }
}

export function clearStoredSession() {
  storeSession({ token: null, user: null })
}

export async function apiRequest(path, { method = 'GET', body, auth = true, token } = {}) {
  const headers = { Accept: 'application/json' }
  let payload

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const effectiveToken = token ?? (auth ? getStoredToken() : null)
  if (effectiveToken) {
    headers.Authorization = `Bearer ${effectiveToken}`
  }

  let response
  try {
    response = await fetch(`${DEFAULT_API_URL}${path}`, {
      method,
      headers,
      body: payload,
    })
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor local.' }
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data.error || 'La operacion no pudo completarse.',
      data,
    }
  }

  return { ok: true, ...data }
}