import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  authApi,
  type AuthChallengeResult,
  type SmsAuthResult,
  type UserProfile,
} from '@/api/auth'
import { setDevAuth } from '../utils/dev-token'

const AUTH_QUERY_KEY = ['auth', 'me'] as const

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<UserProfile | null> => {
      try {
        const res = await authApi.me()
        return res.data.user
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const emailRegisterStartMutation = useMutation({
    mutationFn: (data: { email: string; password: string; displayName: string; inviteCode: string }) =>
      authApi.startEmailRegistration(data),
  })

  const emailRegisterVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string }) => authApi.verifyEmailRegistration(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const emailRegisterResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendEmailRegistration(data),
  })

  const smsSendMutation = useMutation({
    mutationFn: (data: { phone: string; inviteCode?: string }) => authApi.sendSmsCode(data),
  })

  const smsVerifyMutation = useMutation({
    mutationFn: (data: { challengeId: string; code: string; displayName?: string }) =>
      authApi.verifySmsCode(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const smsResendMutation = useMutation({
    mutationFn: (data: { challengeId: string }) => authApi.resendSmsCode(data),
  })

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.invalidateQueries()
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: { displayName?: string; avatarUrl?: string | null }) =>
      authApi.updateProfile(data),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, res.data.user)
    },
  })

  const login = useCallback(
    (data: { email: string; password: string }) => loginMutation.mutateAsync(data),
    [loginMutation],
  )

  const startEmailRegistration = useCallback(
    async (data: { email: string; password: string; displayName: string; inviteCode: string }): Promise<AuthChallengeResult> => {
      const res = await emailRegisterStartMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterStartMutation],
  )

  const verifyEmailRegistration = useCallback(
    async (data: { challengeId: string; code: string }) => {
      const res = await emailRegisterVerifyMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterVerifyMutation],
  )

  const resendEmailRegistration = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await emailRegisterResendMutation.mutateAsync(data)
      return res.data
    },
    [emailRegisterResendMutation],
  )

  const sendSmsCode = useCallback(
    async (data: { phone: string; inviteCode?: string }): Promise<AuthChallengeResult> => {
      const res = await smsSendMutation.mutateAsync(data)
      return res.data
    },
    [smsSendMutation],
  )

  const verifySmsCode = useCallback(
    async (data: { challengeId: string; code: string; displayName?: string }): Promise<SmsAuthResult> => {
      const res = await smsVerifyMutation.mutateAsync(data)
      return res.data
    },
    [smsVerifyMutation],
  )

  const resendSmsCode = useCallback(
    async (data: { challengeId: string }): Promise<AuthChallengeResult> => {
      const res = await smsResendMutation.mutateAsync(data)
      return res.data
    },
    [smsResendMutation],
  )

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation])

  const updateProfile = useCallback(
    async (data: { displayName?: string; avatarUrl?: string | null }): Promise<UserProfile> => {
      const res = await updateProfileMutation.mutateAsync(data)
      return res.data.user
    },
    [updateProfileMutation],
  )

  const switchIdentity = useCallback(
    async (identity: 'anonymous' | 'user' | 'admin') => {
      await setDevAuth(identity)
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
    },
    [queryClient],
  )

  const currentIdentity: 'anonymous' | 'user' | 'admin' = !user
    ? 'anonymous'
    : user.role === 'admin'
      ? 'admin'
      : 'user'

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    currentIdentity,
    login,
    startEmailRegistration,
    verifyEmailRegistration,
    resendEmailRegistration,
    sendSmsCode,
    verifySmsCode,
    resendSmsCode,
    logout,
    updateProfile,
    switchIdentity,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: emailRegisterStartMutation.isPending
      || emailRegisterVerifyMutation.isPending
      || emailRegisterResendMutation.isPending,
    isEmailRegisterStartPending: emailRegisterStartMutation.isPending,
    isEmailRegisterVerifyPending: emailRegisterVerifyMutation.isPending,
    isEmailRegisterResendPending: emailRegisterResendMutation.isPending,
    isSmsSendPending: smsSendMutation.isPending,
    isSmsVerifyPending: smsVerifyMutation.isPending,
    isSmsResendPending: smsResendMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isUpdateProfilePending: updateProfileMutation.isPending,
    loginError: loginMutation.error,
    registerError: emailRegisterStartMutation.error
      ?? emailRegisterVerifyMutation.error
      ?? emailRegisterResendMutation.error,
    smsError: smsSendMutation.error ?? smsVerifyMutation.error ?? smsResendMutation.error,
    updateProfileError: updateProfileMutation.error,
  }
}
