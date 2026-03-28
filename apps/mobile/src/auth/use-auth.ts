import { useContext } from 'react'
import { AuthContext } from './auth-context.shared'
import type { AuthState } from './auth-types'

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
