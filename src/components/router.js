import { createContext, useContext } from 'react'

export const RouterContext = createContext({ path: '/', navigate: () => {} })
export const AuthContext = createContext(null)

export function useRouter() {
  return useContext(RouterContext)
}

export function useAuth() {
  return useContext(AuthContext)
}
