import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
} from '../api/auth'
import { RouterContext, AuthContext } from './router'

function parseHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export function AppProviders({ children }) {
  const [path, setPath] = useState(parseHash())
  const [user, setUser] = useState(getCurrentUser())

  useEffect(() => {
    const onHash = () => {
      setPath(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.hash = '/'
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((to) => {
    if (to === parseHash()) return
    window.location.hash = to
  }, [])

  const login = useCallback((creds) => {
    const res = apiLogin(creds)
    if (res.ok) setUser(res.user)
    return res
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
    navigate('/')
  }, [navigate])

  const auth = useMemo(() => ({ user, login, logout }), [user, login, logout])
  const router = useMemo(() => ({ path, navigate }), [path, navigate])

  return (
    <RouterContext.Provider value={router}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </RouterContext.Provider>
  )
}
