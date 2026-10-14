import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  restoreCurrentUser,
} from '../api/auth'
import { SESSION_EXPIRED_EVENT } from '../api/client'
import { RouterContext, AuthContext } from './router'

function parseHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export function AppProviders({ children }) {
  const [path, setPath] = useState(parseHash())
  const [user, setUser] = useState(getCurrentUser())
  const [sessionNotice, setSessionNotice] = useState('')

  useEffect(() => {
    let mounted = true
    const onHash = () => {
      setPath(parseHash())
      window.scrollTo(0, 0)
    }
    // Cualquier 401 de la API (token vencido o cuenta desactivada) cierra la sesion; RequireAuth
    // recuerda la pagina y lleva al ingreso, donde se muestra el aviso.
    const onExpired = (e) => {
      setUser(null)
      setSessionNotice(e.detail || 'Tu sesión expiró. Vuelve a ingresar.')
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    if (!window.location.hash) window.location.hash = '/'
    restoreCurrentUser().then((current) => {
      if (mounted) setUser(current)
    })
    return () => {
      mounted = false
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    }
  }, [])

  const navigate = useCallback((to) => {
    if (to === parseHash()) return
    window.location.hash = to
  }, [])

  const login = useCallback((creds) => {
    return apiLogin(creds).then((res) => {
      if (res.ok) {
        setUser(res.user)
        setSessionNotice('')
      }
      return res
    })
  }, [])

  // Vuelve a pedir el perfil (por ejemplo, los hijos que el docente acaba de vincular).
  const refreshUser = useCallback(() => {
    return restoreCurrentUser().then((current) => {
      setUser(current)
      return current
    })
  }, [])

  const logout = useCallback(() => {
    return apiLogout().finally(() => {
      setUser(null)
      navigate('/')
    })
  }, [navigate])

  const auth = useMemo(
    () => ({ user, login, logout, refreshUser, sessionNotice }),
    [user, login, logout, refreshUser, sessionNotice]
  )
  const router = useMemo(() => ({ path, navigate }), [path, navigate])

  return (
    <RouterContext.Provider value={router}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </RouterContext.Provider>
  )
}
