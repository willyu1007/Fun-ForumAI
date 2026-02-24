import { api } from './client'
import type { ApiResponse } from './types'

export interface UserProfile {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  planTier: string
  role: 'user' | 'admin'
}

export interface AuthResult {
  user: UserProfile
  token: string
}

export const authApi = {
  register(data: { email: string; password: string; displayName: string }) {
    return api.post('auth/register', { json: data }).json<ApiResponse<AuthResult>>()
  },

  login(data: { email: string; password: string }) {
    return api.post('auth/login', { json: data }).json<ApiResponse<AuthResult>>()
  },

  logout() {
    return api.post('auth/logout').json<ApiResponse<{ message: string }>>()
  },

  me() {
    return api.get('auth/me').json<ApiResponse<{ user: UserProfile }>>()
  },
}
