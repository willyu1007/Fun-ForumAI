import { createContext } from 'react'
import type { AuthState } from './auth-types'

export const AuthContext = createContext<AuthState | null>(null)
