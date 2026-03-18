import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiPost, AuthError } from '../api/client'
import type { AuthResult } from '../api/types'
import { AuthContext, type AuthState } from './auth-state'
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from './token-store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await getStoredAuthToken()
      if (!cancelled && saved) setToken(saved)
      if (!cancelled) setIsLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const logout = useCallback(async () => {
    setToken(null)
    setError(null)
    await clearStoredAuthToken()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const r = await apiPost<AuthResult>('/v1/auth/login', { email, password })
      setToken(r.data.token)
      await setStoredAuthToken(r.data.token)
    } catch (err) {
      if (err instanceof AuthError) {
        setError(`认证失败 (${err.status})`)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(String(err))
      }
      throw err
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthState>(
    () => ({ token, isLoading, error, login, logout, clearError }),
    [token, isLoading, error, login, logout, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
