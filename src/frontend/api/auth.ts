import { api } from './client'
import type { ApiResponse } from './types'

export interface UserProfile {
  id: string
  email: string | null
  phone: string | null
  displayName: string
  avatarUrl: string | null
  planTier: string
  role: 'user' | 'admin'
}

export interface AuthResult {
  user: UserProfile
  token: string
}

export interface SmsAuthResult extends AuthResult {
  isNewUser: boolean
}

export interface AuthChallengeResult {
  challengeId: string
  maskedTarget: string
  expiresInSec: number
  resendAfterSec: number
  debugCode?: string
}

export const authApi = {
  startEmailRegistration(data: { email: string; password: string; displayName: string; inviteCode: string }) {
    return api.post('auth/register', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  verifyEmailRegistration(data: { challengeId: string; code: string }) {
    return api.post('auth/register/verify', { json: data }).json<ApiResponse<AuthResult>>()
  },

  resendEmailRegistration(data: { challengeId: string }) {
    return api.post('auth/register/resend', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  login(data: { email: string; password: string }) {
    return api.post('auth/login', { json: data }).json<ApiResponse<AuthResult>>()
  },

  startEmailPasswordReset(data: { email: string }) {
    return api.post('auth/password/reset', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  resendEmailPasswordReset(data: { challengeId: string }) {
    return api.post('auth/password/reset/resend', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  verifyEmailPasswordReset(data: { challengeId: string; code: string; password: string }) {
    return api.post('auth/password/reset/verify', { json: data }).json<ApiResponse<AuthResult>>()
  },

  sendSmsCode(data: { phone: string; inviteCode?: string }) {
    return api.post('auth/sms/send', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  verifySmsCode(data: { challengeId: string; code: string; displayName?: string; inviteCode?: string }) {
    return api.post('auth/sms/verify', { json: data }).json<ApiResponse<SmsAuthResult>>()
  },

  resendSmsCode(data: { challengeId: string }) {
    return api.post('auth/sms/resend', { json: data }).json<ApiResponse<AuthChallengeResult>>()
  },

  logout() {
    return api.post('auth/logout').json<ApiResponse<{ message: string }>>()
  },

  me() {
    return api.get('auth/me').json<ApiResponse<{ user: UserProfile }>>()
  },

  updateProfile(data: { displayName?: string; avatarUrl?: string | null }) {
    return api.patch('auth/profile', { json: data }).json<ApiResponse<{ user: UserProfile }>>()
  },
}
